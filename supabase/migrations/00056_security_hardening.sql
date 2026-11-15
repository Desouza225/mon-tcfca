-- ============================================================================
-- Migration 00056: Security Hardening (RLS, Role Escalation, Quota RPC IDOR,
--                  SECURITY DEFINER search_path, Forgery Prevention)
-- ============================================================================

-- 1. Revoke anonymous read access on profiles
REVOKE ALL ON TABLE public.profiles FROM anon;

-- 2. Ensure productions columns used by AI correction & UI exist
ALTER TABLE public.productions
  ADD COLUMN IF NOT EXISTS consigne TEXT,
  ADD COLUMN IF NOT EXISTS ref_code TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3. Harden handle_new_user() — NEVER trust raw_user_meta_data->>'role'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nom, prenom, role, cree_par)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, NEW.raw_user_meta_data->>'email'),
    COALESCE(NEW.raw_user_meta_data->>'nom', ''),
    COALESCE(NEW.raw_user_meta_data->>'prenom', ''),
    'etudiant'::public.user_role,
    CASE
      WHEN NEW.raw_user_meta_data->>'cree_par' IS NOT NULL
           AND NEW.raw_user_meta_data->>'cree_par' <> ''
      THEN (NEW.raw_user_meta_data->>'cree_par')::uuid
      ELSE NULL
    END
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 4. Prevent role injection in auth.users.raw_user_meta_data from client SDK
CREATE OR REPLACE FUNCTION public.protect_user_metadata_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin_or_super(auth.uid()) THEN
    IF NEW.raw_user_meta_data IS NOT NULL AND NEW.raw_user_meta_data ? 'role' THEN
      IF TG_OP = 'INSERT' THEN
        NEW.raw_user_meta_data := jsonb_set(NEW.raw_user_meta_data, '{role}', '"etudiant"'::jsonb);
      ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.raw_user_meta_data IS NOT NULL AND OLD.raw_user_meta_data ? 'role' THEN
          NEW.raw_user_meta_data := jsonb_set(NEW.raw_user_meta_data, '{role}', OLD.raw_user_meta_data->'role');
        ELSE
          NEW.raw_user_meta_data := NEW.raw_user_meta_data - 'role';
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_user_metadata_role ON auth.users;
CREATE TRIGGER trg_protect_user_metadata_role
  BEFORE INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.protect_user_metadata_role();

-- 5. Protect privileged columns on public.profiles (role, bloque, examen_blanc_actif, cree_par)
CREATE OR REPLACE FUNCTION public.protect_profile_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  -- Service role / internal triggers (auth.uid() IS NULL) and admins/super_admins are allowed
  IF v_caller IS NULL OR public.is_admin_or_super(v_caller) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.role IS DISTINCT FROM 'etudiant'::public.user_role THEN
      RAISE EXCEPTION 'Modification de rôle non autorisée.';
    END IF;
    NEW.bloque := false;
    NEW.examen_blanc_actif := false;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Modification de rôle non autorisée.';
    END IF;
    IF NEW.cree_par IS DISTINCT FROM OLD.cree_par THEN
      RAISE EXCEPTION 'Modification de cree_par non autorisée.';
    END IF;
    IF NEW.bloque IS DISTINCT FROM OLD.bloque THEN
      IF NOT public.can_prof_update_student(v_caller, NEW.id) THEN
        RAISE EXCEPTION 'Modification du statut de blocage non autorisée.';
      END IF;
    END IF;
    IF NEW.examen_blanc_actif IS DISTINCT FROM OLD.examen_blanc_actif THEN
      IF NOT (public.can_manage_examen_blanc(v_caller, NEW.id) OR public.can_prof_update_student(v_caller, NEW.id)) THEN
        RAISE EXCEPTION 'Modification du statut examen blanc non autorisée.';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_role ON public.profiles;
DROP TRIGGER IF EXISTS trg_protect_profile_privileged_columns ON public.profiles;
CREATE TRIGGER trg_protect_profile_privileged_columns
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privileged_columns();

-- 6. Fix abonnements & paiements RLS policies (prevent client-side quota/plan tampering)
DROP POLICY IF EXISTS "Student can update own abonnement quota" ON public.abonnements;
DROP POLICY IF EXISTS "Student can view own abonnement" ON public.abonnements;
CREATE POLICY "Student can view own abonnement" ON public.abonnements
  FOR SELECT TO authenticated
  USING (etudiant_id = auth.uid() OR user_id = auth.uid());

DROP POLICY IF EXISTS "Student can insert paiement" ON public.paiements;
DROP POLICY IF EXISTS "Student can view own paiements" ON public.paiements;
CREATE POLICY "Student can view own paiements" ON public.paiements
  FOR SELECT TO authenticated
  USING (etudiant_id = auth.uid() OR user_id = auth.uid());

-- 7. Fix corrections RLS policy (prevent students from forging AI corrections)
DROP POLICY IF EXISTS "Le service role et edge functions peuvent insérer les corrections" ON public.corrections;
DROP POLICY IF EXISTS "Service role or staff can insert corrections" ON public.corrections;
CREATE POLICY "Service role or staff can insert corrections" ON public.corrections
  FOR INSERT TO authenticated, service_role
  WITH CHECK (
    auth.uid() IS NULL
    OR public.is_professeur_or_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Service role or staff can update corrections" ON public.corrections;
CREATE POLICY "Service role or staff can update corrections" ON public.corrections
  FOR UPDATE TO authenticated, service_role
  USING (
    auth.uid() IS NULL
    OR public.is_professeur_or_admin(auth.uid())
  )
  WITH CHECK (
    auth.uid() IS NULL
    OR public.is_professeur_or_admin(auth.uid())
  );

-- 8. Fix notifications RLS policy (prevent arbitrary notification spoofing by students/anon)
DROP POLICY IF EXISTS "Service can insert notifications" ON public.notifications;
CREATE POLICY "Service can insert notifications" ON public.notifications
  FOR INSERT TO service_role
  WITH CHECK (true);

-- 9. Harden Quota RPCs with caller verification (prevent IDOR quota draining)
CREATE OR REPLACE FUNCTION public.check_user_quota(
  p_user_id UUID,
  p_type TEXT -- 'ee', 'eo', ou 'examen_blanc'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_abonnement RECORD;
  v_remaining INTEGER := 0;
BEGIN
  IF auth.uid() IS NOT NULL
     AND auth.uid() <> p_user_id
     AND NOT public.is_professeur_or_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Non autorisé à consulter le quota d''un autre utilisateur.';
  END IF;

  SELECT * INTO v_abonnement
  FROM public.abonnements
  WHERE (user_id = p_user_id OR etudiant_id = p_user_id)
    AND (status = 'active' OR statut = 'actif')
    AND (current_period_end IS NULL OR current_period_end > now())
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'has_active_sub', false,
      'remaining', 0,
      'plan_id', NULL,
      'message', 'Aucun abonnement actif trouvé.'
    );
  END IF;

  IF lower(p_type) = 'ee' THEN
    v_remaining := COALESCE(v_abonnement.quota_ee_restant, 0);
  ELSIF lower(p_type) = 'eo' THEN
    v_remaining := COALESCE(v_abonnement.quota_eo_restant, 0);
  ELSIF lower(p_type) = 'examen_blanc' THEN
    v_remaining := COALESCE(v_abonnement.quota_examen_blanc_restant, 0);
  ELSE
    RETURN jsonb_build_object('has_active_sub', true, 'remaining', 0, 'error', 'Type invalide (ee, eo ou examen_blanc attendu).');
  END IF;

  RETURN jsonb_build_object(
    'has_active_sub', true,
    'remaining', v_remaining,
    'plan_id', v_abonnement.plan_id,
    'expiration', v_abonnement.current_period_end
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.decrement_user_quota(
  p_user_id UUID,
  p_type TEXT -- 'ee', 'eo', ou 'examen_blanc'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_abonnement RECORD;
  v_remaining INTEGER := 0;
BEGIN
  IF auth.uid() IS NOT NULL
     AND auth.uid() <> p_user_id
     AND NOT public.is_admin_or_super(auth.uid()) THEN
    RAISE EXCEPTION 'Non autorisé à décrémenter le quota d''un autre utilisateur.';
  END IF;

  IF lower(p_type) = 'ee' THEN
    SELECT * INTO v_abonnement
    FROM public.abonnements
    WHERE (user_id = p_user_id OR etudiant_id = p_user_id)
      AND (status = 'active' OR statut = 'actif')
      AND (current_period_end IS NULL OR current_period_end > now())
      AND quota_ee_restant > 0
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'QUOTA_EXHAUSTED',
        'message', 'Votre quota de corrections écrites est épuisé. Veuillez recharger ou mettre à niveau votre abonnement.'
      );
    END IF;

    UPDATE public.abonnements
    SET quota_ee_restant = quota_ee_restant - 1,
        updated_at = now()
    WHERE id = v_abonnement.id;

    v_remaining := v_abonnement.quota_ee_restant - 1;

    RETURN jsonb_build_object(
      'success', true,
      'remaining', v_remaining,
      'subscription_id', v_abonnement.id
    );

  ELSIF lower(p_type) = 'eo' THEN
    SELECT * INTO v_abonnement
    FROM public.abonnements
    WHERE (user_id = p_user_id OR etudiant_id = p_user_id)
      AND (status = 'active' OR statut = 'actif')
      AND (current_period_end IS NULL OR current_period_end > now())
      AND quota_eo_restant > 0
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'QUOTA_EXHAUSTED',
        'message', 'Votre quota de corrections orales est épuisé. Veuillez recharger ou mettre à niveau votre abonnement.'
      );
    END IF;

    UPDATE public.abonnements
    SET quota_eo_restant = quota_eo_restant - 1,
        updated_at = now()
    WHERE id = v_abonnement.id;

    v_remaining := v_abonnement.quota_eo_restant - 1;

    RETURN jsonb_build_object(
      'success', true,
      'remaining', v_remaining,
      'subscription_id', v_abonnement.id
    );

  ELSIF lower(p_type) = 'examen_blanc' THEN
    SELECT * INTO v_abonnement
    FROM public.abonnements
    WHERE (user_id = p_user_id OR etudiant_id = p_user_id)
      AND (status = 'active' OR statut = 'actif')
      AND (current_period_end IS NULL OR current_period_end > now())
      AND quota_examen_blanc_restant > 0
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'QUOTA_EXHAUSTED',
        'message', 'Votre quota d''examens blancs est épuisé.'
      );
    END IF;

    UPDATE public.abonnements
    SET quota_examen_blanc_restant = quota_examen_blanc_restant - 1,
        updated_at = now()
    WHERE id = v_abonnement.id;

    v_remaining := v_abonnement.quota_examen_blanc_restant - 1;

    RETURN jsonb_build_object(
      'success', true,
      'remaining', v_remaining,
      'subscription_id', v_abonnement.id
    );
  ELSE
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_TYPE',
      'message', 'Type de quota inconnu.'
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.consommer_quota_examen_blanc(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub_id UUID;
  v_restant INT;
BEGIN
  IF auth.uid() IS NOT NULL
     AND auth.uid() <> p_user_id
     AND NOT public.is_admin_or_super(auth.uid()) THEN
    RETURN jsonb_build_object(
      'success', false,
      'quota_restant', 0,
      'error', 'Non autorisé'
    );
  END IF;

  SELECT id, quota_examen_blanc_restant
  INTO v_sub_id, v_restant
  FROM public.abonnements
  WHERE (etudiant_id = p_user_id OR user_id = p_user_id)
    AND (status = 'active' OR statut = 'actif')
    AND (current_period_end IS NULL OR current_period_end > NOW())
    AND (date_fin IS NULL OR date_fin > NOW())
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_sub_id IS NULL THEN
    SELECT id, quota_examen_blanc_restant
    INTO v_sub_id, v_restant
    FROM public.abonnements
    WHERE (etudiant_id = p_user_id OR user_id = p_user_id)
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF v_sub_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'quota_restant', 0,
      'error', 'Aucun abonnement trouvé'
    );
  END IF;

  IF COALESCE(v_restant, 0) <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'quota_restant', 0,
      'error', 'Quota d''examens blancs épuisé'
    );
  END IF;

  UPDATE public.abonnements
  SET
    quota_examen_blanc_restant = GREATEST(0, quota_examen_blanc_restant - 1),
    updated_at = NOW()
  WHERE id = v_sub_id
  RETURNING quota_examen_blanc_restant INTO v_restant;

  RETURN jsonb_build_object(
    'success', true,
    'abonnement_id', v_sub_id,
    'quota_restant', v_restant
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.count_pending_expression_entrainement(
  p_etudiant_id uuid,
  p_epreuve public.epreuve_type
)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF auth.uid() IS NOT NULL
     AND auth.uid() <> p_etudiant_id
     AND NOT public.is_professeur_or_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;

  SELECT COUNT(DISTINCT s.id)::integer
  INTO v_count
  FROM public.sessions_examen s
  WHERE s.etudiant_id = p_etudiant_id
    AND s.mode = 'entrainement'
    AND EXISTS (
      SELECT 1
      FROM public.productions pr
      WHERE pr.session_id = s.id
        AND pr.etudiant_id = p_etudiant_id
        AND pr.epreuve = p_epreuve
        AND pr.statut_correction IN ('en_attente', 'en_cours')
    );

  RETURN COALESCE(v_count, 0);
END;
$$;

-- 10. Harden cleanup_expired_profiles RPC against unauthenticated / student invocation
CREATE OR REPLACE FUNCTION public.cleanup_expired_profiles(dry_run boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_cutoff timestamptz := now() - interval '30 days';
  v_ids uuid[];
  v_count integer;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin_or_super(auth.uid()) THEN
    RAISE EXCEPTION 'Accès refusé : opération réservée aux administrateurs ou au service_role.';
  END IF;

  SELECT array_agg(id)
  INTO v_ids
  FROM public.profiles
  WHERE role = 'etudiant'
    AND COALESCE(last_active_at, created_at) < v_cutoff;

  v_count := COALESCE(array_length(v_ids, 1), 0);

  IF NOT dry_run AND v_count > 0 THEN
    DELETE FROM auth.users
    WHERE id = ANY(v_ids);
  END IF;

  RETURN jsonb_build_object(
    'dry_run', dry_run,
    'cutoff', v_cutoff,
    'deleted_count', v_count,
    'deleted_ids', COALESCE(to_jsonb(v_ids), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_expired_profiles(boolean) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_profiles(boolean) TO authenticated, service_role;

-- 11. Harden SECURITY DEFINER functions with explicit SET search_path = public
CREATE OR REPLACE FUNCTION public.is_role_professeur()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'professeur'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_role_professeur(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = uid AND role = 'professeur'
  );
$$;

-- Replace 00036's overload of submit_professeur_correction (removing raw_user_meta_data trust & auto-insert)
CREATE OR REPLACE FUNCTION public.submit_professeur_correction(
  p_production_id uuid,
  p_score numeric,
  p_grille_notation jsonb DEFAULT NULL,
  p_commentaire text DEFAULT NULL,
  p_raison_refus text DEFAULT NULL,
  p_statut text DEFAULT 'corrige'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id         uuid;
  v_caller_role       text;
  v_prod              record;
  v_session_id        uuid;
  v_etudiant_id       uuid;
  v_epreuve           text;
  v_numero_tache      integer;
  v_epreuve_label     text;
  v_prods_ee_count    integer := 0;
  v_prods_ee_done     integer := 0;
  v_prods_ee_sum      numeric := 0;
  v_prods_eo_count    integer := 0;
  v_prods_eo_done     integer := 0;
  v_prods_eo_sum      numeric := 0;
  v_sess              record;
  v_score_ee_final    integer;
  v_score_eo_final    integer;
  v_scores_arr        integer[];
  v_score_global      integer;
  v_niveau_cecrl      text;
  v_max_ee            numeric := 20;
  v_max_eo            numeric := 20;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Non authentifié. Veuillez vous reconnecter.';
  END IF;

  SELECT role::text INTO v_caller_role FROM public.profiles WHERE id = v_caller_id;
  IF v_caller_role IS NULL OR lower(trim(v_caller_role)) NOT IN ('professeur', 'admin', 'super_admin') THEN
    RAISE EXCEPTION 'Accès refusé : rôle professeur ou administrateur requis.';
  END IF;

  SELECT id, session_id, etudiant_id, epreuve, numero_tache, audio_url
  INTO v_prod
  FROM public.productions
  WHERE id = p_production_id;

  IF v_prod.id IS NULL THEN
    RAISE EXCEPTION 'Production introuvable (ID : %)', p_production_id;
  END IF;

  v_session_id   := v_prod.session_id;
  v_etudiant_id  := v_prod.etudiant_id;
  v_epreuve      := v_prod.epreuve;
  v_numero_tache := v_prod.numero_tache;

  IF p_statut = 'refuse' THEN
    UPDATE public.productions
    SET
      statut_correction = 'refuse',
      score = 0,
      audio_url = NULL,
      contenu_texte = NULL,
      raison_refus = coalesce(trim(p_raison_refus), 'Production refusée par l''enseignant.'),
      commentaire = NULL,
      grille_notation = coalesce(p_grille_notation, grille_notation),
      corrige_at = now(),
      professeur_id = v_caller_id,
      updated_at = now()
    WHERE id = p_production_id;
  ELSE
    UPDATE public.productions
    SET
      statut_correction = 'corrige',
      score = p_score,
      commentaire = coalesce(p_commentaire, commentaire),
      grille_notation = coalesce(p_grille_notation, grille_notation),
      raison_refus = NULL,
      corrige_at = now(),
      professeur_id = v_caller_id,
      updated_at = now()
    WHERE id = p_production_id;
  END IF;

  IF v_session_id IS NOT NULL THEN
    BEGIN
      SELECT
        count(*),
        count(*) FILTER (WHERE statut_correction IN ('corrige', 'refuse')),
        coalesce(sum(score), 0)
      INTO v_prods_ee_count, v_prods_ee_done, v_prods_ee_sum
      FROM public.productions
      WHERE session_id = v_session_id AND epreuve = 'expression_ecrite';

      SELECT
        count(*),
        count(*) FILTER (WHERE statut_correction IN ('corrige', 'refuse')),
        coalesce(sum(score), 0)
      INTO v_prods_eo_count, v_prods_eo_done, v_prods_eo_sum
      FROM public.productions
      WHERE session_id = v_session_id AND epreuve = 'expression_orale';

      SELECT id, mode, score_oral, score_ecrit, score_expression_ecrite, score_expression_orale
      INTO v_sess
      FROM public.sessions_examen
      WHERE id = v_session_id;

      IF v_sess.id IS NOT NULL THEN
        IF v_prods_ee_count > 0 AND v_prods_ee_count = v_prods_ee_done THEN
          v_score_ee_final := round((v_prods_ee_sum / (v_max_ee * v_prods_ee_count)) * 699);
        ELSE
          v_score_ee_final := v_sess.score_expression_ecrite;
        END IF;

        IF v_prods_eo_count > 0 AND v_prods_eo_count = v_prods_eo_done THEN
          v_score_eo_final := round((v_prods_eo_sum / (v_max_eo * v_prods_eo_count)) * 699);
        ELSE
          v_score_eo_final := v_sess.score_expression_orale;
        END IF;

        IF (v_prods_ee_count = 0 OR v_prods_ee_count = v_prods_ee_done)
           AND (v_prods_eo_count = 0 OR v_prods_eo_count = v_prods_eo_done)
           AND (v_prods_ee_count > 0 OR v_prods_eo_count > 0) THEN

          v_scores_arr := ARRAY[]::integer[];
          IF v_sess.score_oral IS NOT NULL THEN v_scores_arr := array_append(v_scores_arr, v_sess.score_oral); END IF;
          IF v_sess.score_ecrit IS NOT NULL THEN v_scores_arr := array_append(v_scores_arr, v_sess.score_ecrit); END IF;
          IF v_score_ee_final IS NOT NULL THEN v_scores_arr := array_append(v_scores_arr, v_score_ee_final); END IF;
          IF v_score_eo_final IS NOT NULL THEN v_scores_arr := array_append(v_scores_arr, v_score_eo_final); END IF;

          IF array_length(v_scores_arr, 1) IS NOT NULL AND array_length(v_scores_arr, 1) > 0 THEN
            SELECT round(avg(val)) INTO v_score_global FROM unnest(v_scores_arr) AS val;

            IF v_score_global >= 549 THEN v_niveau_cecrl := 'C2';
            ELSIF v_score_global >= 499 THEN v_niveau_cecrl := 'C1';
            ELSIF v_score_global >= 406 THEN v_niveau_cecrl := 'B2';
            ELSIF v_score_global >= 301 THEN v_niveau_cecrl := 'B1';
            ELSIF v_score_global >= 226 THEN v_niveau_cecrl := 'A2';
            ELSE v_niveau_cecrl := 'A1';
            END IF;
          END IF;

          UPDATE public.sessions_examen
          SET
            score_expression_ecrite = v_score_ee_final,
            score_expression_orale  = v_score_eo_final,
            score_global            = coalesce(v_score_global, score_global),
            niveau_cecrl            = CASE WHEN v_niveau_cecrl IS NOT NULL THEN v_niveau_cecrl::public.niveau_cecrl ELSE niveau_cecrl END,
            correction_complete     = true
          WHERE id = v_session_id;
        ELSE
          UPDATE public.sessions_examen
          SET
            score_expression_ecrite = v_score_ee_final,
            score_expression_orale  = v_score_eo_final
          WHERE id = v_session_id;
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  IF v_etudiant_id IS NOT NULL THEN
    BEGIN
      v_epreuve_label := CASE WHEN v_epreuve = 'expression_ecrite' THEN 'Expression écrite' ELSE 'Expression orale' END;

      IF p_statut = 'refuse' THEN
        INSERT INTO public.notifications (utilisateur_id, titre, message, lien)
        VALUES (
          v_etudiant_id,
          'Production refusée — Note 0',
          CASE WHEN p_raison_refus IS NOT NULL AND length(trim(p_raison_refus)) > 0
               THEN 'Votre ' || v_epreuve_label || ' — Tâche ' || v_numero_tache || ' a été refusée (note : 0/20). Motif : ' || trim(p_raison_refus)
               ELSE 'Votre ' || v_epreuve_label || ' — Tâche ' || v_numero_tache || ' a été refusée par votre professeur. Note attribuée : 0/20.'
          END,
          '/etudiant/historique'
        );
      ELSE
        INSERT INTO public.notifications (utilisateur_id, titre, message, lien)
        VALUES (
          v_etudiant_id,
          'Correction disponible',
          'Votre ' || v_epreuve_label || ' — Tâche ' || v_numero_tache || ' a été évaluée (' || p_score || '/20 pts).',
          '/etudiant/historique'
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'production_id', p_production_id,
    'score', CASE WHEN p_statut = 'refuse' THEN 0 ELSE p_score END,
    'statut', p_statut
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.can_admin_manage_profile(admin_uid uuid, target_id uuid, target_role public.user_role, target_cree_par uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_super_admin(admin_uid)
    OR (
      public.is_admin_or_super(admin_uid)
      AND (
        admin_uid = target_id
        OR (target_role = 'etudiant')
        OR (target_role = 'professeur' AND (target_cree_par = admin_uid OR target_cree_par IS NULL))
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_examen_blanc(manager_uid uuid, student_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = manager_uid
      AND (
        p.role IN ('super_admin', 'admin')
        OR (
          p.role = 'professeur'
          AND EXISTS (
            SELECT 1 FROM public.attributions a
            WHERE a.professeur_id = manager_uid
              AND a.etudiant_id = student_uid
          )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_prof_view_student(prof_uid uuid, student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = prof_uid AND role = 'professeur'
  )
  AND (
    EXISTS (
      SELECT 1 FROM public.attributions
      WHERE professeur_id = prof_uid AND etudiant_id = student_id
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = student_id AND role = 'etudiant'
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_prof_update_student(prof_uid uuid, student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = prof_uid AND role = 'professeur'
  )
  AND EXISTS (
    SELECT 1 FROM public.attributions
    WHERE professeur_id = prof_uid AND etudiant_id = student_id
  );
$$;

CREATE OR REPLACE FUNCTION public.get_own_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.can_prof_update_session(prof_uid uuid, session_etudiant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = prof_uid AND role = 'professeur'
  )
  AND (
    EXISTS (
      SELECT 1 FROM public.attributions
      WHERE professeur_id = prof_uid AND etudiant_id = session_etudiant_id
    )
    OR EXISTS (
      SELECT 1 FROM public.productions
      WHERE etudiant_id = session_etudiant_id AND professeur_id = prof_uid
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.sync_last_active_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.last_sign_in_at IS DISTINCT FROM OLD.last_sign_in_at AND NEW.last_sign_in_at IS NOT NULL THEN
    UPDATE public.profiles
    SET last_active_at = NEW.last_sign_in_at
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_profile_bloque(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT bloque FROM public.profiles WHERE id = uid),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.is_access_blocked(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT
        p.bloque
        OR (
          p.role = 'etudiant'
          AND COALESCE(p.last_active_at, p.created_at) < (now() - interval '30 days')
        )
      FROM public.profiles p
      WHERE p.id = uid
    ),
    false
  );
$$;

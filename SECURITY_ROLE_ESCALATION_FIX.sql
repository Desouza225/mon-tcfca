-- ==============================================================================
-- MON TCFCA — CORRECTIF DE SÉCURITÉ : ÉLÉVATION DE PRIVILÈGES VIA LES MÉTADONNÉES
-- Exécutez ce script dans Supabase Dashboard > SQL Editor > New Query > Run
--
-- Problème corrigé :
--   Les métadonnées utilisateur (raw_user_meta_data) sont choisies par l'utilisateur
--   à l'inscription ET modifiables par lui à tout moment (supabase.auth.updateUser).
--   Plusieurs fonctions s'en servaient pour attribuer un rôle (admin / professeur).
--
-- Règles appliquées :
--   1. À l'inscription, le rôle est TOUJOURS 'etudiant' (sauf l'email admin officiel).
--   2. Un utilisateur ne peut plus écrire/modifier la clé 'role' de ses métadonnées.
--   3. Seul un admin/super_admin (ou le service role) peut changer un rôle.
--      Un admin ne peut ni promouvoir en admin/super_admin ni rétrograder un admin.
--   4. Un utilisateur ne peut pas se débloquer lui-même.
--   5. Les vérifications de rôle se basent uniquement sur public.profiles.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. INSCRIPTION : rôle forcé à 'etudiant'
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nom, prenom, role, bloque, examen_blanc_actif)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'nom',
    NEW.raw_user_meta_data->>'prenom',
    CASE
      WHEN lower(NEW.email) = 'moralessedesouza@gmail.com' THEN 'admin'::public.user_role
      ELSE 'etudiant'::public.user_role
    END,
    false,
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    email  = EXCLUDED.email,
    nom    = COALESCE(EXCLUDED.nom, public.profiles.nom),
    prenom = COALESCE(EXCLUDED.prenom, public.profiles.prenom);
    -- Le rôle et le blocage d'un profil existant ne sont JAMAIS modifiés ici.
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 2. MÉTADONNÉES : la clé 'role' ne peut être ni ajoutée ni modifiée par l'utilisateur
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_user_metadata_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Ignorer tout rôle auto-déclaré à l'inscription
    IF NEW.raw_user_meta_data ? 'role' THEN
      NEW.raw_user_meta_data := NEW.raw_user_meta_data - 'role';
    END IF;
  ELSE
    -- Conserver la valeur précédente (ou son absence) de la clé 'role'
    IF (OLD.raw_user_meta_data ? 'role') THEN
      NEW.raw_user_meta_data := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb)
        || jsonb_build_object('role', OLD.raw_user_meta_data->'role');
    ELSIF NEW.raw_user_meta_data ? 'role' THEN
      NEW.raw_user_meta_data := NEW.raw_user_meta_data - 'role';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_user_metadata_role ON auth.users;
CREATE TRIGGER protect_user_metadata_role
  BEFORE INSERT OR UPDATE OF raw_user_meta_data ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_user_metadata_role();

-- ------------------------------------------------------------------------------
-- 3. PROFILS : protection des colonnes 'role' et 'bloque'
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_profile_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_caller      uuid := auth.uid();
  v_caller_role public.user_role;
BEGIN
  -- Service role (Edge Functions), SQL Editor et triggers d'auth : pas de restriction
  IF v_caller IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_caller;

  IF v_caller_role = 'super_admin' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Un utilisateur qui crée lui-même son profil est forcément étudiant
    IF v_caller_role IS DISTINCT FROM 'admin' THEN
      NEW.role := CASE
        WHEN lower(NEW.email) = 'moralessedesouza@gmail.com' AND NEW.id = v_caller
          THEN 'admin'::public.user_role
        ELSE 'etudiant'::public.user_role
      END;
      NEW.bloque := false;
    ELSIF NEW.role IN ('admin', 'super_admin') THEN
      RAISE EXCEPTION 'Un admin ne peut pas créer un compte admin ou super_admin.';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF v_caller_role IS DISTINCT FROM 'admin' THEN
      RAISE EXCEPTION 'Modification du rôle non autorisée.';
    END IF;
    IF NEW.role IN ('admin', 'super_admin') OR OLD.role IN ('admin', 'super_admin') THEN
      RAISE EXCEPTION 'Un admin ne peut pas attribuer ou retirer un rôle admin/super_admin.';
    END IF;
  END IF;

  IF NEW.bloque IS DISTINCT FROM OLD.bloque AND NEW.id = v_caller THEN
    RAISE EXCEPTION 'Vous ne pouvez pas modifier votre propre statut de blocage.';
  END IF;

  IF NEW.examen_blanc_actif IS DISTINCT FROM OLD.examen_blanc_actif
     AND v_caller_role IS DISTINCT FROM 'admin'
     AND NOT public.can_manage_examen_blanc(v_caller, NEW.id) THEN
    RAISE EXCEPTION 'Modification du statut examen blanc non autorisée.';
  END IF;

  IF NEW.cree_par IS DISTINCT FROM OLD.cree_par AND v_caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Modification de cree_par non autorisée.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_privileged_columns ON public.profiles;
CREATE TRIGGER protect_profile_privileged_columns
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_privileged_columns();

-- ------------------------------------------------------------------------------
-- 4. FONCTIONS DE VÉRIFICATION DE RÔLE : basées uniquement sur public.profiles
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_role_professeur()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'professeur'
  );
$$;

-- submit_professeur_correction : on remplace uniquement le contrôle d'accès.
-- La fonction est redéfinie à l'identique de la version 00036, sans le repli
-- sur les métadonnées et sans auto-création d'un profil 'professeur'.
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

  -- Contrôle d'accès basé uniquement sur public.profiles
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

  -- Synchroniser la session
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

  -- Notifier l'étudiant
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

-- ------------------------------------------------------------------------------
-- 5. AUDIT : comptes dont le rôle n'est pas 'etudiant' (à vérifier manuellement)
-- ------------------------------------------------------------------------------
SELECT p.email, p.role, p.created_at, p.cree_par
FROM public.profiles p
WHERE p.role <> 'etudiant'
ORDER BY p.created_at DESC;

-- ==============================================================================
-- Migration 00050: Correction et décrémentation persistante du quota d'examen blanc
-- ==============================================================================

-- 1. Fonction RPC dédiée SECURITY DEFINER pour décrémenter le quota d'examen blanc
CREATE OR REPLACE FUNCTION public.consommer_quota_examen_blanc(p_user_id UUID DEFAULT auth.uid())
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
  v_abonnement RECORD;
  v_remaining INTEGER;
BEGIN
  v_uid := COALESCE(p_user_id, auth.uid());
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHENTICATED');
  END IF;

  -- 1. Récupérer l'abonnement actif le plus récent de l'utilisateur
  SELECT * INTO v_abonnement
  FROM public.abonnements
  WHERE (user_id = v_uid OR etudiant_id = v_uid)
    AND (status = 'active' OR statut = 'actif')
    AND (current_period_end IS NULL OR current_period_end > now())
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'NO_ACTIVE_SUBSCRIPTION', 
      'message', 'Aucun abonnement actif trouvé pour ce compte.'
    );
  END IF;

  -- 2. Vérifier s'il reste du quota
  IF COALESCE(v_abonnement.quota_examen_blanc_restant, 0) <= 0 THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'QUOTA_EXHAUSTED', 
      'remaining', 0,
      'message', 'Votre quota d''examens blancs est épuisé.'
    );
  END IF;

  -- 3. Décrémenter le quota de 1 de manière atomique
  UPDATE public.abonnements
  SET quota_examen_blanc_restant = GREATEST(0, quota_examen_blanc_restant - 1),
      updated_at = now()
  WHERE id = v_abonnement.id;

  v_remaining := GREATEST(0, v_abonnement.quota_examen_blanc_restant - 1);

  RETURN jsonb_build_object(
    'success', true,
    'remaining', v_remaining,
    'subscription_id', v_abonnement.id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.consommer_quota_examen_blanc(UUID) TO authenticated;


-- 2. Étendre `check_user_quota` et `decrement_user_quota` pour supporter également 'examen_blanc'
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
  ELSIF lower(p_type) IN ('examen_blanc', 'examen', 'eb') THEN
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

GRANT EXECUTE ON FUNCTION public.check_user_quota(UUID, TEXT) TO authenticated;


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
        'message', 'Votre quota de corrections écrites est épuisé.'
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
        'message', 'Votre quota de corrections orales est épuisé.'
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

  ELSIF lower(p_type) IN ('examen_blanc', 'examen', 'eb') THEN
    RETURN public.consommer_quota_examen_blanc(p_user_id);

  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_TYPE');
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.decrement_user_quota(UUID, TEXT) TO authenticated;


-- 3. Autoriser les étudiants authentifiés à mettre à jour leur propre quota dans abonnements
DROP POLICY IF EXISTS "Student can update own abonnement quota" ON public.abonnements;
CREATE POLICY "Student can update own abonnement quota" ON public.abonnements
  FOR UPDATE TO authenticated
  USING (etudiant_id = auth.uid() OR user_id = auth.uid())
  WITH CHECK (etudiant_id = auth.uid() OR user_id = auth.uid());


-- 4. Déduction rétroactive pour les sessions d'examens blancs déjà complétées mais non décomptées
DO $$
DECLARE
  r RECORD;
  v_completed_count INTEGER;
  v_new_quota INTEGER;
BEGIN
  FOR r IN (
    SELECT a.id, COALESCE(a.user_id, a.etudiant_id) as uid, a.quota_examen_blanc_restant
    FROM public.abonnements a
    WHERE (a.status = 'active' OR a.statut = 'actif')
  ) LOOP
    SELECT COUNT(*) INTO v_completed_count
    FROM public.sessions_examen s
    WHERE s.etudiant_id = r.uid
      AND s.mode = 'examen_blanc'
      AND s.statut IN ('termine');

    IF v_completed_count > 0 AND r.quota_examen_blanc_restant = 20 THEN
      v_new_quota := GREATEST(0, r.quota_examen_blanc_restant - v_completed_count);
      UPDATE public.abonnements
      SET quota_examen_blanc_restant = v_new_quota,
          updated_at = now()
      WHERE id = r.id;
    END IF;
  END LOOP;
END $$;

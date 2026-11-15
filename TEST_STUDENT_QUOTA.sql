-- ==============================================================================
-- MON TCFCA — COMPTE ÉTUDIANT TEST : traore.edudesk@gmail.com
-- 200 corrections EE + 200 corrections EO, valable 1 an
-- Exécutez ce script dans Supabase Dashboard > SQL Editor > New Query > Run
-- ==============================================================================

DO $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'traore.edudesk@gmail.com';
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Utilisateur traore.edudesk@gmail.com introuvable dans auth.users';
  END IF;

  -- S'assurer que le profil existe et a bien le rôle étudiant (non bloqué)
  UPDATE public.profiles
  SET role = 'etudiant', bloque = false
  WHERE id = v_user_id;

  -- Désactiver d'éventuels anciens abonnements de ce compte
  UPDATE public.abonnements
  SET statut = 'annule', status = 'canceled'
  WHERE etudiant_id = v_user_id OR user_id = v_user_id;

  -- Créer l'abonnement test avec 200 quotas EE et EO
  INSERT INTO public.abonnements (
    etudiant_id, user_id, plan, plan_id, statut, status,
    quota_ee_restant, quota_eo_restant, quota_examen_blanc_restant,
    date_debut, date_fin, current_period_start, current_period_end
  ) VALUES (
    v_user_id, v_user_id, 'premium', 'intensif', 'actif', 'active',
    200, 200, 20,
    now(), now() + interval '1 year', now(), now() + interval '1 year'
  );
END $$;

-- Vérification
SELECT a.id, p.email, a.plan_id, a.statut, a.quota_ee_restant, a.quota_eo_restant, a.current_period_end
FROM public.abonnements a
JOIN public.profiles p ON p.id = COALESCE(a.user_id, a.etudiant_id)
WHERE p.email = 'traore.edudesk@gmail.com'
ORDER BY a.created_at DESC;

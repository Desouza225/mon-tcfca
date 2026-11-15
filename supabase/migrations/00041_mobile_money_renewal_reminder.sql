-- Migration 00041: Support Mobile Money non-récurrent & relances de renouvellement

-- 1. Ajout des colonnes de gestion de renouvellement dans abonnements
ALTER TABLE public.abonnements ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.abonnements ADD COLUMN IF NOT EXISTS plan_id TEXT;
ALTER TABLE public.abonnements ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.abonnements ADD COLUMN IF NOT EXISTS provider TEXT;
ALTER TABLE public.abonnements ADD COLUMN IF NOT EXISTS provider_subscription_id TEXT;
ALTER TABLE public.abonnements ADD COLUMN IF NOT EXISTS quota_ee_restant INTEGER DEFAULT 0;
ALTER TABLE public.abonnements ADD COLUMN IF NOT EXISTS quota_eo_restant INTEGER DEFAULT 0;
ALTER TABLE public.abonnements ADD COLUMN IF NOT EXISTS quota_examen_blanc_restant INTEGER DEFAULT 0;
ALTER TABLE public.abonnements ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.abonnements ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;
ALTER TABLE public.abonnements ADD COLUMN IF NOT EXISTS methode TEXT;
ALTER TABLE public.abonnements ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN DEFAULT false;
ALTER TABLE public.abonnements ADD COLUMN IF NOT EXISTS derniere_relance_at TIMESTAMPTZ;

-- 2. Fonction RPC pour vérifier et notifier les abonnements Mobile Money expirant bientôt (sous 3 jours)
CREATE OR REPLACE FUNCTION public.verifier_et_notifier_expirations_abonnements()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  r RECORD;
  v_nom_formule text;
  v_date_expiration text;
BEGIN
  FOR r IN
    SELECT 
      a.id AS abonnement_id,
      COALESCE(a.user_id, a.etudiant_id) AS user_id,
      COALESCE(a.plan_id, a.plan::text) AS plan_id,
      COALESCE(a.current_period_end, a.date_fin) AS expiration_date,
      a.methode,
      CASE COALESCE(a.plan_id, a.plan::text)
        WHEN 'essentiel' THEN 'Essentiel'
        WHEN 'standard' THEN 'Standard'
        WHEN 'intensif' THEN 'Intensif'
        WHEN 'express' THEN 'Express'
        WHEN 'pack_express' THEN 'Express'
        ELSE initcap(replace(COALESCE(a.plan_id, a.plan::text, 'Mon TCFCA'), '_', ' '))
      END AS plan_nom
    FROM public.abonnements a
    WHERE (a.status IN ('active', 'actif') OR a.statut::text IN ('active', 'actif'))
      AND COALESCE(a.current_period_end, a.date_fin) IS NOT NULL
      -- Expire dans moins de 3 jours et pas encore expiré depuis plus de 24h
      AND COALESCE(a.current_period_end, a.date_fin) <= (now() + interval '3 days')
      AND COALESCE(a.current_period_end, a.date_fin) >= (now() - interval '1 day')
      -- Paiement Mobile Money ou non-récurrent
      AND (a.auto_renew IS FALSE OR a.methode = 'mobile_money' OR a.methode IS NULL)
      -- Pas de relance déjà envoyée dans les dernières 48h
      AND (a.derniere_relance_at IS NULL OR a.derniere_relance_at < (now() - interval '2 days'))
  LOOP
    v_nom_formule := COALESCE(r.plan_nom, 'Mon TCFCA');
    v_date_expiration := to_char(r.expiration_date, 'DD/MM/YYYY');

    -- Insérer la notification avec lien direct vers le renouvellement
    INSERT INTO public.notifications (
      utilisateur_id,
      titre,
      message,
      lien,
      created_at
    ) VALUES (
      r.user_id,
      '⚠️ Votre formule ' || v_nom_formule || ' expire le ' || v_date_expiration,
      'Votre formule ' || v_nom_formule || ' arrive bientôt à expiration. Le paiement par Mobile Money ne se renouvelant pas automatiquement, renouvelez votre abonnement dès maintenant pour conserver vos devoirs, corrections et accès illimité.',
      '/etudiant/abonnement?renew=' || COALESCE(r.plan_id, 'standard'),
      now()
    );

    -- Marquer la date de relance
    UPDATE public.abonnements
    SET derniere_relance_at = now()
    WHERE id = r.abonnement_id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- Permettre aux utilisateurs authentifiés d'exécuter la vérification
GRANT EXECUTE ON FUNCTION public.verifier_et_notifier_expirations_abonnements() TO authenticated, service_role;

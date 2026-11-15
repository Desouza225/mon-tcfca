-- ==============================================================================
-- MON TCFCA — MIGRATION 00042 : CORRECTION AUTOMATIQUE IA (SUBMISSIONS & CORRECTIONS)
-- Pipeline : Gemini (transcription audio EO) + Claude Sonnet (notation EE & EO)
-- ==============================================================================

-- 1. TABLE DES SOUMISSIONS (SUBMISSIONS)
CREATE TABLE IF NOT EXISTS public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL CHECK (
    task_type IN ('EE_tache1', 'EE_tache2', 'EE_tache3', 'EO_tache1', 'EO_tache2', 'EO_tache3')
  ),
  raw_text TEXT,
  file_url TEXT,
  consigne TEXT,
  reference TEXT,
  session_id UUID REFERENCES public.sessions_examen(id) ON DELETE SET NULL,
  production_id UUID REFERENCES public.productions(id) ON DELETE SET NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index pour recherches rapides
CREATE INDEX IF NOT EXISTS idx_submissions_user_id ON public.submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_task_type ON public.submissions(task_type);
CREATE INDEX IF NOT EXISTS idx_submissions_submitted_at ON public.submissions(submitted_at DESC);

-- Activer RLS sur submissions
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour submissions
DROP POLICY IF EXISTS "Les étudiants peuvent voir leurs propres soumissions" ON public.submissions;
CREATE POLICY "Les étudiants peuvent voir leurs propres soumissions"
  ON public.submissions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Les étudiants peuvent créer leurs soumissions" ON public.submissions;
CREATE POLICY "Les étudiants peuvent créer leurs soumissions"
  ON public.submissions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Les administrateurs et professeurs peuvent voir toutes les soumissions" ON public.submissions;
CREATE POLICY "Les administrateurs et professeurs peuvent voir toutes les soumissions"
  ON public.submissions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'super_admin', 'professeur')
    )
  );

-- 2. TABLE DES CORRECTIONS IA (CORRECTIONS)
CREATE TABLE IF NOT EXISTS public.corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  note_linguistique JSONB NOT NULL DEFAULT '{}'::jsonb,
  note_pragmatique JSONB NOT NULL DEFAULT '{}'::jsonb,
  note_sociolinguistique JSONB NOT NULL DEFAULT '{}'::jsonb,
  total NUMERIC(4,2) NOT NULL DEFAULT 0,
  niveau_cecrl TEXT NOT NULL,
  feedback_par_critere JSONB NOT NULL DEFAULT '{}'::jsonb,
  erreurs_et_corrections JSONB DEFAULT '[]'::jsonb,
  analyse_consigne TEXT,
  version_amelioree TEXT,
  plan_progression JSONB DEFAULT '{}'::jsonb,
  ai_model_used TEXT NOT NULL DEFAULT 'claude-sonnet-5-5',
  prompt_version TEXT NOT NULL DEFAULT 'v1.0',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index pour jointures rapides
CREATE INDEX IF NOT EXISTS idx_corrections_submission_id ON public.corrections(submission_id);
CREATE INDEX IF NOT EXISTS idx_corrections_created_at ON public.corrections(created_at DESC);

-- Activer RLS sur corrections
ALTER TABLE public.corrections ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour corrections
DROP POLICY IF EXISTS "Les étudiants peuvent voir les corrections de leurs soumissions" ON public.corrections;
CREATE POLICY "Les étudiants peuvent voir les corrections de leurs soumissions"
  ON public.corrections FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.submissions
      WHERE submissions.id = corrections.submission_id AND submissions.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Les administrateurs et professeurs peuvent voir toutes les corrections" ON public.corrections;
CREATE POLICY "Les administrateurs et professeurs peuvent voir toutes les corrections"
  ON public.corrections FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'super_admin', 'professeur')
    )
  );

DROP POLICY IF EXISTS "Le service role et edge functions peuvent insérer les corrections" ON public.corrections;
CREATE POLICY "Le service role et edge functions peuvent insérer les corrections"
  ON public.corrections FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 3. FONCTIONS RPC SÉCURISÉES POUR LA GESTION DES QUOTAS

-- Fonction de vérification du quota d'un utilisateur
CREATE OR REPLACE FUNCTION public.check_user_quota(
  p_user_id UUID,
  p_type TEXT -- 'ee' ou 'eo'
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
  -- Récupérer l'abonnement actif le plus récent
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
  ELSE
    RETURN jsonb_build_object('has_active_sub', true, 'remaining', 0, 'error', 'Type invalide (ee ou eo attendu).');
  END IF;

  RETURN jsonb_build_object(
    'has_active_sub', true,
    'remaining', v_remaining,
    'plan_id', v_abonnement.plan_id,
    'expiration', v_abonnement.current_period_end
  );
END;
$$;

-- Fonction de décrémentation atomique du quota
CREATE OR REPLACE FUNCTION public.decrement_user_quota(
  p_user_id UUID,
  p_type TEXT -- 'ee' ou 'eo'
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
  ELSE
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_TYPE',
      'message', 'Type de quota inconnu.'
    );
  END IF;
END;
$$;

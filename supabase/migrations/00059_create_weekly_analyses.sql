-- ==============================================================================
-- MON TCFCA — MIGRATION 00059 : ANALYSE COMPARATIVE & RETOUR INDIVIDUALISÉ (INTENSIF)
-- Bilan pédagogique hebdomadaire (tous les 7 jours) réservé à la formule Intensif
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.analyses_comparatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  abonnement_id UUID REFERENCES public.abonnements(id) ON DELETE SET NULL,
  periode_debut TIMESTAMPTZ NOT NULL,
  periode_fin TIMESTAMPTZ NOT NULL DEFAULT now(),
  numero_bilan INTEGER NOT NULL DEFAULT 1,
  professeur_nom TEXT NOT NULL DEFAULT 'Prof. Claire Beaumont',
  professeur_titre TEXT NOT NULL DEFAULT 'Professeure & Formatrice Certifiée TCF Canada',
  statistiques_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  analyse_contenu JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_model_used TEXT NOT NULL DEFAULT 'claude-sonnet-5-5',
  lu_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index pour accès rapide par étudiant et vérification du délai de 7 jours
CREATE INDEX IF NOT EXISTS idx_analyses_comparatives_user_created
  ON public.analyses_comparatives(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analyses_comparatives_abonnement
  ON public.analyses_comparatives(abonnement_id);

-- Activer RLS
ALTER TABLE public.analyses_comparatives ENABLE ROW LEVEL SECURITY;

-- Politiques RLS
DROP POLICY IF EXISTS "Les étudiants peuvent voir leurs propres bilans hebdomadaires" ON public.analyses_comparatives;
CREATE POLICY "Les étudiants peuvent voir leurs propres bilans hebdomadaires"
  ON public.analyses_comparatives FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Les étudiants peuvent marquer leur bilan comme lu" ON public.analyses_comparatives;
CREATE POLICY "Les étudiants peuvent marquer leur bilan comme lu"
  ON public.analyses_comparatives FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Les administrateurs et professeurs peuvent voir tous les bilans" ON public.analyses_comparatives;
CREATE POLICY "Les administrateurs et professeurs peuvent voir tous les bilans"
  ON public.analyses_comparatives FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'super_admin', 'professeur')
    )
  );

-- ==============================================================================
-- MON TCFCA — MIGRATION 00040 : ANALYTICS DES VISITES & TÉLÉMÉTRIE ADMIN
-- ==============================================================================

-- 1. TABLE DU TRACKING DES VISITES DU SITE
CREATE TABLE IF NOT EXISTS public.site_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  page_path TEXT NOT NULL,
  page_title TEXT,
  referrer TEXT DEFAULT 'direct',
  device_type TEXT DEFAULT 'desktop', -- 'desktop', 'mobile', 'tablet'
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index optimisés pour les requêtes d'agrégation d'analytics
CREATE INDEX IF NOT EXISTS idx_site_visits_created_at ON public.site_visits(created_at);
CREATE INDEX IF NOT EXISTS idx_site_visits_session_id ON public.site_visits(session_id);
CREATE INDEX IF NOT EXISTS idx_site_visits_page_path ON public.site_visits(page_path);
CREATE INDEX IF NOT EXISTS idx_site_visits_user_id ON public.site_visits(user_id);

-- Activer Row Level Security
ALTER TABLE public.site_visits ENABLE ROW LEVEL SECURITY;

-- Autoriser l'insertion pour tous (anonymes et connectés) pour le suivi
DROP POLICY IF EXISTS "Insertion publique des visites" ON public.site_visits;
CREATE POLICY "Insertion publique des visites"
  ON public.site_visits FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Lecture réservée aux administrateurs
DROP POLICY IF EXISTS "Lecture des visites réservée aux administrateurs" ON public.site_visits;
CREATE POLICY "Lecture des visites réservée aux administrateurs"
  ON public.site_visits FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'super_admin')
    )
  );

GRANT INSERT ON TABLE public.site_visits TO anon, authenticated;
GRANT SELECT ON TABLE public.site_visits TO authenticated;

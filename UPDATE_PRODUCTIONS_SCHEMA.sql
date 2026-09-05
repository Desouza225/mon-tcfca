-- MIGRATION: Sauvegarde de la consigne et du code de référence dans les productions
-- À exécuter dans le Supabase SQL Editor de votre projet

ALTER TABLE public.productions ADD COLUMN IF NOT EXISTS consigne text;
ALTER TABLE public.productions ADD COLUMN IF NOT EXISTS ref_code text;

-- Index pour optimiser les recherches de référence
CREATE INDEX IF NOT EXISTS idx_productions_ref_code ON public.productions(ref_code);

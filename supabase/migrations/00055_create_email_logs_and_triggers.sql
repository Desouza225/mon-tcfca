-- ══════════════════════════════════════════════════════════════════════════════
-- MON TCFCA — MIGRATION 00055 : TABLE EMAIL_LOGS, PRÉFÉRENCES & IDEMPOTENCE
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Table de journalisation des emails envoyés (email_logs)
CREATE TABLE IF NOT EXISTS public.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  type TEXT NOT NULL, -- 'auth_password_changed', 'subscription_confirmed', 'payment_receipt', 'payment_failed', 'expiration_reminder', 'subscription_expired', 'renewal_confirmed', 'inactivity_reminder', 'test_email'
  destinataire TEXT NOT NULL,
  sujet TEXT,
  statut TEXT NOT NULL DEFAULT 'sent', -- 'sent', 'failed', 'rate_limited', 'skipped_idempotent'
  resend_id TEXT,
  idempotency_key TEXT,
  erreur TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index pour les performances de recherche et le respect des quotas
CREATE INDEX IF NOT EXISTS idx_email_logs_user_id ON public.email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_type ON public.email_logs(type);
CREATE INDEX IF NOT EXISTS idx_email_logs_destinataire ON public.email_logs(destinataire);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON public.email_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_email_logs_statut ON public.email_logs(statut);

-- Index d'idempotence conditionnel : empêche les doubles envois avec la même clé
CREATE UNIQUE INDEX IF NOT EXISTS uq_email_logs_idempotency
  ON public.email_logs(type, user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL AND statut = 'sent';

-- 2. Sécurité RLS sur email_logs (Admins uniquement)
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Les administrateurs peuvent voir tous les logs d'emails" ON public.email_logs;
CREATE POLICY "Les administrateurs peuvent voir tous les logs d'emails"
  ON public.email_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- Permettre l'insertion par le service role (Edge Functions)
DROP POLICY IF EXISTS "Service role can insert email logs" ON public.email_logs;
CREATE POLICY "Service role can insert email logs"
  ON public.email_logs FOR INSERT
  TO service_role
  WITH CHECK (true);

-- 3. Ajout de colonnes de suivi d'activité et de préférences dans profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_reminders_enabled BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_activity_reminder_at TIMESTAMPTZ;

-- 4. Table des désinscriptions (pour les emails non obligatoires type rappels)
CREATE TABLE IF NOT EXISTS public.email_unsubscribes (
  email TEXT PRIMARY KEY,
  raison TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.email_unsubscribes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lecture publique restreinte des désinscriptions" ON public.email_unsubscribes;
CREATE POLICY "Lecture publique restreinte des désinscriptions"
  ON public.email_unsubscribes FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Insertion publique de désinscription" ON public.email_unsubscribes;
CREATE POLICY "Insertion publique de désinscription"
  ON public.email_unsubscribes FOR INSERT
  WITH CHECK (true);

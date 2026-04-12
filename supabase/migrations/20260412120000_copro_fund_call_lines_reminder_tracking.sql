-- =====================================================
-- Migration: Ajouter le tracking des relances sur copro_fund_call_lines
-- Date: 2026-04-12
-- Sprint: S3-1 — claude/talok-account-audit-78zaW
--
-- Contexte :
--   Le cron `copro-fund-call-reminders` (S3-1) doit envoyer des relances
--   aux copropriétaires en retard à J+10, J+30, J+60. Pour éviter de
--   spammer (et pour tracer l'historique), il faut pouvoir vérifier
--   quand la dernière relance a été envoyée et combien au total.
--
--   Ces colonnes n'existaient pas sur `copro_fund_call_lines`. Elles
--   existent déjà sur `invoices` pour le cron payment-reminders — on
--   copie ce pattern.
--
-- Colonnes ajoutées :
--   - reminder_count INTEGER DEFAULT 0 : compteur total de relances
--   - last_reminder_at TIMESTAMPTZ : timestamp de la dernière relance
-- =====================================================

BEGIN;

ALTER TABLE public.copro_fund_call_lines
  ADD COLUMN IF NOT EXISTS reminder_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.copro_fund_call_lines
  ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMPTZ;

COMMENT ON COLUMN public.copro_fund_call_lines.reminder_count IS
  'Nombre total de relances envoyées pour cette ligne (cron copro-fund-call-reminders, S3-1).';

COMMENT ON COLUMN public.copro_fund_call_lines.last_reminder_at IS
  'Timestamp de la dernière relance envoyée. NULL si aucune relance envoyée.';

-- Index pour éviter le seq scan du cron qui filtre sur reminder_count
CREATE INDEX IF NOT EXISTS idx_copro_fund_call_lines_reminder_tracking
  ON public.copro_fund_call_lines(reminder_count, last_reminder_at)
  WHERE payment_status IN ('pending', 'partial');

COMMIT;

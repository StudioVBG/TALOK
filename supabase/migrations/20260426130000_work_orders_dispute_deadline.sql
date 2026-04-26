-- =====================================================
-- Migration : Délai de contestation 7j avant libération du solde
-- Date : 2026-04-26
--
-- Contexte :
--   Sprint B du flux escrow. Quand le proprio paie le solde (70%) après que
--   les travaux sont marqués 'completed', les fonds restent en escrow le
--   temps d'un délai de contestation de 7 jours. Passé ce délai sans dispute,
--   un cron quotidien libère automatiquement les fonds vers le compte
--   Connect du prestataire (Stripe Transfer).
--
-- Changements :
--   1. Ajout work_order_payments.dispute_deadline TIMESTAMPTZ — date après
--      laquelle le cron peut libérer automatiquement les fonds.
--   2. Ajout work_order_payments.released_by_profile_id UUID — qui a
--      déclenché la libération (proprio si validation explicite, NULL si
--      cron auto, prestataire jamais).
--   3. Index partiel pour accélérer le cron (escrow_status='held' AND
--      dispute_deadline IS NOT NULL).
-- =====================================================

BEGIN;

-- 1. Colonnes
ALTER TABLE public.work_order_payments
  ADD COLUMN IF NOT EXISTS dispute_deadline TIMESTAMPTZ;

ALTER TABLE public.work_order_payments
  ADD COLUMN IF NOT EXISTS released_by_profile_id UUID
    REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.work_order_payments.dispute_deadline IS
  'Date limite de contestation. Si escrow_status=''held'' et NOW() > dispute_deadline, le cron libère les fonds vers le compte Connect du prestataire. NULL = libération immédiate possible (acompte au démarrage).';

COMMENT ON COLUMN public.work_order_payments.released_by_profile_id IS
  'Profil qui a déclenché la libération (proprio si validation explicite). NULL = libération automatique par cron après dispute_deadline.';

-- 2. Index pour le cron de libération automatique
CREATE INDEX IF NOT EXISTS idx_wo_payments_pending_release
  ON public.work_order_payments (dispute_deadline)
  WHERE escrow_status = 'held' AND dispute_deadline IS NOT NULL;

COMMIT;

-- =====================================================
-- Migration: Harden payments CHECK constraints for manual flows
-- Date: 2026-04-11
--
-- CONTEXT:
-- The manual payment modal (`ManualPaymentDialog.tsx`) POSTs to
-- /api/invoices/[id]/mark-paid with `moyen` ∈ {especes, cheque, virement,
-- autre}. The corresponding CHECK on `payments.moyen` was updated to
-- this set by 20241129000002_cash_payments.sql, but the block was
-- wrapped in `EXCEPTION WHEN others THEN NULL` — meaning if the ALTER
-- failed for any reason (e.g. unnamed legacy constraint, parallel
-- migration race, existing row violation), the DB silently kept the
-- original check `('cb', 'virement', 'prelevement')`. On an environment
-- where the update never landed, inserting a `moyen = 'cheque'` row
-- raises:
--
--     new row for relation "payments" violates check constraint
--     "payments_moyen_check"
--
-- …which in mark-paid bubbles up to the outer catch and returns a
-- plain 500 "Erreur serveur" — exactly what the user sees on the
-- chèque / virement / espèces flows.
--
-- Similarly, `syncInvoiceStatusFromPayments` (lib/services/invoice-
-- status.service.ts) cancels stale pending payments by setting
-- `statut = 'cancelled'`, but the current CHECK only allows
-- ('pending', 'succeeded', 'failed', 'refunded'). The update silently
-- fails because the JS client doesn't throw on constraint errors for
-- bulk updates — we've been leaking orphan `pending` rows in the
-- background.
--
-- FIX:
-- Re-assert both constraints with the canonical allowed sets. No
-- EXCEPTION catch-all this time: if this ALTER fails, we want to know
-- loudly (the prior silent path is precisely why the prod DB drifted
-- from the migration history in the first place).
--
-- Safe to re-run: the DROP is IF EXISTS and the ADD is idempotent in
-- the sense that re-running the migration against an already-good DB
-- simply replaces the constraint with an equivalent one.
-- =====================================================

BEGIN;

-- ============================================
-- 1. payments.moyen — all manual + provider methods
-- ============================================
--
-- Allowed:
--   cb           Stripe card (tenant)
--   virement     Manual bank transfer (owner marks paid) OR Stripe SEPA
--   prelevement  SEPA Direct Debit
--   especes      Cash receipt (two-step signature flow)
--   cheque       Paper cheque (owner marks paid)
--   autre        Fallback (no specific method)
--
ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_moyen_check;

ALTER TABLE public.payments
  ADD CONSTRAINT payments_moyen_check
  CHECK (moyen IN ('cb', 'virement', 'prelevement', 'especes', 'cheque', 'autre'));

-- ============================================
-- 2. payments.statut — include 'cancelled' for pending cleanup
-- ============================================
--
-- Allowed:
--   pending      Created, awaiting provider confirmation
--   processing   Provider is processing (e.g. SEPA in flight)
--   succeeded    Settled
--   failed       Provider rejected
--   refunded     Chargeback / manual refund
--   cancelled    Superseded by another payment (used by
--                syncInvoiceStatusFromPayments when a full manual
--                payment makes a Stripe PaymentIntent orphaned)
--
ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_statut_check;

ALTER TABLE public.payments
  ADD CONSTRAINT payments_statut_check
  CHECK (statut IN ('pending', 'processing', 'succeeded', 'failed', 'refunded', 'cancelled'));

-- ============================================
-- 3. Reload PostgREST schema cache
-- ============================================
-- Required for existing PostgREST workers to pick up the new
-- constraint definitions without a restart.

NOTIFY pgrst, 'reload schema';

COMMIT;

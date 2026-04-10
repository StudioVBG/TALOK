-- =============================================================================
-- Migration : Backfill invoice paid dates for historical PAID invoices
-- Date      : 2026-04-10
-- Bug       : Some invoices display as "En attente" in the owner dashboard
--             even though they are marked statut = 'paid'. Root cause: the
--             script that mass-migrated invoices on 2026-03-24 set
--             statut = 'paid' without writing date_paiement, and a latent
--             bug in syncInvoiceStatusFromPayments() overwrote existing
--             dates on webhook retries.
--
-- Fix (code side, same PR):
--   - lib/services/invoice-status.service.ts now preserves an existing
--     date_paiement when called repeatedly.
--   - app/api/webhooks/stripe/route.ts payment_intent.succeeded handler
--     now only writes paid_at when it is still NULL (idempotent).
--
-- Fix (data side, this migration):
--   - Historical invoices with statut = 'paid' and date_paiement IS NULL
--     get backfilled from the best available timestamp: prefer paid_at
--     (TIMESTAMPTZ written by the direct webhook update), fall back to
--     updated_at (reasonable proxy for "last write that flipped the
--     status to paid").
--   - Symmetrically, backfill paid_at from updated_at when it is still
--     NULL on a paid invoice so the two columns stay coherent.
-- =============================================================================

BEGIN;

-- Backfill date_paiement (DATE) for paid invoices that never received one.
UPDATE invoices
SET date_paiement = COALESCE(paid_at::DATE, updated_at::DATE)
WHERE statut = 'paid'
  AND date_paiement IS NULL;

-- Backfill paid_at (TIMESTAMPTZ) for paid invoices that never received one.
UPDATE invoices
SET paid_at = updated_at
WHERE statut = 'paid'
  AND paid_at IS NULL;

COMMIT;

-- =============================================================================
-- Rollback notes :
--   There is no exact rollback because we cannot distinguish rows that were
--   backfilled from rows that were correctly written by this migration's
--   timestamp. If a rollback is ever needed, restore the specific rows from
--   a pre-migration snapshot.
-- =============================================================================

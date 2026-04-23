-- =====================================================
-- MIGRATION: Relax legacy NOT NULL on accounting_entries
-- Date: 2026-04-23
--
-- The initial migration 20260110000001_accounting_tables.sql created the
-- agency-style accounting_entries schema, where each row was one side of a
-- booking and carried its own compte/piece/ecriture_lib/ecriture_num inline.
--
-- The current double-entry engine (lib/accounting/engine.ts) and its auto
-- bridges (receipt-entry, deposit-entry, subscription-entry) treat
-- accounting_entries as the header row and push the account-level detail into
-- accounting_entry_lines. They populate the new columns introduced by
-- 20260407120000_accounting_reconcile_schemas.sql (entry_number, entry_date,
-- label, ...) and leave the legacy columns unset.
--
-- That reconcile migration added the new columns but never relaxed the
-- original NOT NULL constraints, so every engine-driven INSERT fails with:
--   null value in column "ecriture_num" of relation "accounting_entries"
--   violates not-null constraint
--
-- Reproduction: the "Lancer l'import historique" button in
-- /owner/accounting/settings (POST /api/accounting/backfill) calls the
-- ensure* helpers for rent payments, deposits received, deposit refunds and
-- Talok subscription invoices; all of them fail with this error.
--
-- This migration drops NOT NULL on the legacy-only columns so both code paths
-- can coexist. Legacy rows keep their values; engine-driven rows leave them
-- NULL and expose their detail via accounting_entry_lines.
-- =====================================================

ALTER TABLE public.accounting_entries
  ALTER COLUMN ecriture_num  DROP NOT NULL,
  ALTER COLUMN ecriture_date DROP NOT NULL,
  ALTER COLUMN compte_num    DROP NOT NULL,
  ALTER COLUMN compte_lib    DROP NOT NULL,
  ALTER COLUMN piece_ref     DROP NOT NULL,
  ALTER COLUMN piece_date    DROP NOT NULL,
  ALTER COLUMN ecriture_lib  DROP NOT NULL;

COMMENT ON COLUMN public.accounting_entries.ecriture_num IS
  'Legacy agency-style entry identifier. Nullable since 2026-04-23: the '
  'double-entry engine uses entry_number and stores line detail in '
  'accounting_entry_lines. Populated only for rows created by the legacy '
  'agency bookkeeping path.';

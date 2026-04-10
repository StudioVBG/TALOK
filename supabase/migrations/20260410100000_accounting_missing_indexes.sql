-- =====================================================
-- MIGRATION: Accounting — missing indexes for hot queries
-- Date: 2026-04-10
--
-- Audit P2-4 follow-up. Adds composite / trigram indexes that
-- accelerate the three slowest owner-accounting queries:
--
--  1. Grand-livre par exercice + compte
--     (join accounting_entries × accounting_entry_lines filtered by
--      exercise_id and account_number)
--
--  2. Dashboard rapprochement bancaire
--     (bank_transactions filtered by connection_id + reconciliation_status
--      and sorted by transaction_date DESC)
--
--  3. Recherche plein-texte sur le libellé des écritures
--     (EntriesPageClient search input → ilike on accounting_entries.label)
--
-- All statements are idempotent (CREATE INDEX IF NOT EXISTS).
-- pg_trgm is already enabled by supabase/migrations/20240101000000_initial_schema.sql:6
-- so no CREATE EXTENSION is needed here.
-- =====================================================

-- ---------------------------------------------------------------
-- 1. Grand-livre acceleration
-- ---------------------------------------------------------------
-- `accounting_entry_lines` does NOT carry `exercise_id` (the exercise
-- lives on the parent `accounting_entries`), so the canonical composite
-- `(exercise_id, account_number)` would have to live on the parent
-- table. We add the two indexes that together cover the join:
--
--   SELECT ... FROM accounting_entry_lines l
--   JOIN accounting_entries e ON e.id = l.entry_id
--   WHERE e.exercise_id = $1 AND l.account_number LIKE $2
--   ORDER BY e.entry_date ASC;

CREATE INDEX IF NOT EXISTS idx_entries_exercise_date
  ON accounting_entries(exercise_id, entry_date DESC);

CREATE INDEX IF NOT EXISTS idx_entry_lines_account_entry
  ON accounting_entry_lines(account_number, entry_id);

-- ---------------------------------------------------------------
-- 2. Bank reconciliation dashboard
-- ---------------------------------------------------------------
-- `bank_transactions` has no `entity_id` column — the entity is
-- resolved via bank_connections. The composite index therefore uses
-- `connection_id` + `reconciliation_status` + `transaction_date`, which
-- matches /api/accounting/bank/reconciliation/route.ts query shape.

CREATE INDEX IF NOT EXISTS idx_bank_tx_connection_status_date
  ON bank_transactions(connection_id, reconciliation_status, transaction_date DESC);

-- ---------------------------------------------------------------
-- 3. Full-text search on entry labels
-- ---------------------------------------------------------------
-- Powers the search box in EntriesPageClient which runs
--   .or('label.ilike.%X%,piece_ref.ilike.%X%')
-- A GIN trigram index makes ILIKE %X% selective instead of a seq scan.
-- pg_trgm is enabled globally in 20240101000000_initial_schema.sql.

CREATE INDEX IF NOT EXISTS idx_entries_label_trgm
  ON accounting_entries USING gin(label gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_entries_piece_ref_trgm
  ON accounting_entries USING gin(piece_ref gin_trgm_ops);

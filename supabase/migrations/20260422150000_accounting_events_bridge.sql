-- Migration: accounting events bridge foundations
--
-- Goal: wire business events (rent receipts, security deposits, provider invoices,
-- Talok subscriptions) to the existing double-entry engine (lib/accounting/engine.ts,
-- 14 auto-entry events already implemented).
--
-- This migration does NOT recreate the accounting schema — 15 tables already
-- exist from 20260406210000_accounting_complete.sql. It only adds:
--   1. Per-entity accounting opt-in toggle (distinct from plan-level gating)
--   2. Declaration mode (micro_foncier / reel / is_comptable), orthogonal to
--      the juridical regime_fiscal (ir/is)
--   3. Informational flag on entries (for micro_foncier mode, excluded from FEC)

BEGIN;

-- ============================================================================
-- 1. legal_entities: user-level toggle + declaration mode
-- ============================================================================

ALTER TABLE legal_entities
  ADD COLUMN IF NOT EXISTS accounting_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE legal_entities
  ADD COLUMN IF NOT EXISTS declaration_mode text NOT NULL DEFAULT 'reel';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'legal_entities_declaration_mode_check'
  ) THEN
    ALTER TABLE legal_entities
      ADD CONSTRAINT legal_entities_declaration_mode_check
      CHECK (declaration_mode IN ('micro_foncier', 'reel', 'is_comptable'));
  END IF;
END $$;

COMMENT ON COLUMN legal_entities.accounting_enabled IS
  'User-level switch to activate automatic accounting entry generation for this entity. '
  'Distinct from plan-level feature gating (copro_module): even on eligible plans, '
  'owners must opt-in per entity to avoid noise during initial setup.';

COMMENT ON COLUMN legal_entities.declaration_mode IS
  'Tax-declaration mode, orthogonal to regime_fiscal (ir/is). '
  'Values: micro_foncier (<=15k/an, abattement 30%%, entries are informational), '
  'reel (standard cash-basis accounting, default), '
  'is_comptable (full commercial accounting for SCI IS / SARL).';

-- ============================================================================
-- 2. accounting_entries: informational flag
-- ============================================================================

ALTER TABLE accounting_entries
  ADD COLUMN IF NOT EXISTS informational boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN accounting_entries.informational IS
  'True when the entry was created for information only (micro_foncier preparation). '
  'Informational entries must be excluded from FEC exports and official reports.';

-- Partial index used by FEC and reports to skip informational entries efficiently
CREATE INDEX IF NOT EXISTS idx_accounting_entries_non_informational
  ON accounting_entries(entity_id, entry_date DESC)
  WHERE informational = false;

COMMIT;

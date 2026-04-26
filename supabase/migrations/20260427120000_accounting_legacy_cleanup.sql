-- =====================================================
-- ACCOUNTING — LEGACY CLEANUP (PHASE 1, NON-DESTRUCTIVE)
-- =====================================================
-- Prepares the eventual removal of the agency-era columns from
-- accounting_entries (ecriture_num, compte_num, debit, etc.) without
-- dropping anything yet. We :
--
--   1. Backfill entity_id on legacy rows that still rely on owner_id
--      so all reads can move to the entity_id-only path.
--   2. Add a CHECK constraint (NOT VALID) that forbids new rows from
--      mixing modes — a row created by the engine MUST carry the new
--      canonical columns.
--   3. Tag every legacy column with COMMENT 'DEPRECATED — removal
--      planned 2026-Q4'.
--
-- Safe to run repeatedly. No DROP COLUMN here — the actual physical
-- drop will be a follow-up migration once analytics confirm zero new
-- rows are written via the legacy path.
-- =====================================================

SET lock_timeout = '10s';

-- =====================================================
-- 1. Backfill entity_id from owner_id where missing
-- =====================================================

-- A legacy row's entity is the owner's primary legal entity (the one
-- carrying accounting_enabled=true if any, otherwise the first one).
WITH owner_entity AS (
  SELECT
    le.owner_profile_id,
    le.id            AS entity_id,
    ROW_NUMBER() OVER (
      PARTITION BY le.owner_profile_id
      ORDER BY le.accounting_enabled DESC NULLS LAST,
               le.created_at ASC
    ) AS rn
  FROM legal_entities le
)
UPDATE accounting_entries ae
   SET entity_id = oe.entity_id
  FROM owner_entity oe
 WHERE ae.entity_id IS NULL
   AND ae.owner_id IS NOT NULL
   AND oe.owner_profile_id = ae.owner_id
   AND oe.rn = 1;

-- =====================================================
-- 2. Integrity guard for engine-driven rows
--    Any row carrying entity_id (new schema) must also carry the
--    canonical header columns. NOT VALID so we don't scan the whole
--    table at install time.
-- =====================================================

ALTER TABLE accounting_entries
  DROP CONSTRAINT IF EXISTS chk_engine_row_canonical;

ALTER TABLE accounting_entries
  ADD CONSTRAINT chk_engine_row_canonical CHECK (
    entity_id IS NULL
    OR (
      entry_number IS NOT NULL
      AND entry_date IS NOT NULL
      AND label IS NOT NULL
      AND journal_code IS NOT NULL
    )
  ) NOT VALID;

-- Validate concurrently friendly (ShareUpdateExclusive lock)
DO $$
BEGIN
  PERFORM 1 FROM accounting_entries
   WHERE entity_id IS NOT NULL
     AND (entry_number IS NULL OR entry_date IS NULL
          OR label IS NULL OR journal_code IS NULL)
   LIMIT 1;
  IF FOUND THEN
    RAISE NOTICE 'chk_engine_row_canonical not validated: legacy rows would fail. '
                 'Backfill manually then run ALTER TABLE ... VALIDATE CONSTRAINT.';
  ELSE
    EXECUTE 'ALTER TABLE accounting_entries VALIDATE CONSTRAINT chk_engine_row_canonical';
  END IF;
END $$;

-- =====================================================
-- 3. Deprecation comments on legacy columns
-- =====================================================

COMMENT ON COLUMN accounting_entries.ecriture_num IS
  'DEPRECATED — superseded by entry_number. Removal planned 2026-Q4. '
  'Populated only for rows created by the legacy agency bookkeeping path.';

COMMENT ON COLUMN accounting_entries.ecriture_date IS
  'DEPRECATED — superseded by entry_date. Removal planned 2026-Q4.';

COMMENT ON COLUMN accounting_entries.ecriture_lib IS
  'DEPRECATED — superseded by label. Removal planned 2026-Q4.';

COMMENT ON COLUMN accounting_entries.compte_num IS
  'DEPRECATED — moved to accounting_entry_lines.account_number. '
  'Removal planned 2026-Q4.';

COMMENT ON COLUMN accounting_entries.compte_lib IS
  'DEPRECATED — moved to chart_of_accounts.label / accounting_entry_lines.label. '
  'Removal planned 2026-Q4.';

COMMENT ON COLUMN accounting_entries.piece_ref IS
  'DEPRECATED — superseded by reference. Removal planned 2026-Q4.';

COMMENT ON COLUMN accounting_entries.piece_date IS
  'DEPRECATED — entry_date is the canonical date. Removal planned 2026-Q4.';

COMMENT ON COLUMN accounting_entries.debit IS
  'DEPRECATED — moved to accounting_entry_lines.debit_cents (integer cents). '
  'Removal planned 2026-Q4.';

COMMENT ON COLUMN accounting_entries.credit IS
  'DEPRECATED — moved to accounting_entry_lines.credit_cents (integer cents). '
  'Removal planned 2026-Q4.';

COMMENT ON COLUMN accounting_entries.valid_date IS
  'DEPRECATED — superseded by is_validated + validated_at + validated_by. '
  'Removal planned 2026-Q4.';

COMMENT ON COLUMN accounting_entries.owner_id IS
  'DEPRECATED — replaced by entity_id (multi-entity tenancy). '
  'Removal planned 2026-Q4.';

-- =====================================================
-- 4. Index hint for the canonical access path
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_accounting_entries_canonical
  ON accounting_entries(entity_id, exercise_id, entry_date DESC, journal_code)
  WHERE entity_id IS NOT NULL;

COMMENT ON INDEX idx_accounting_entries_canonical IS
  'Composite index for the engine-driven access path. Use this on every '
  'new query; legacy owner_id queries are scheduled for deprecation.';

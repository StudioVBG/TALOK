-- =====================================================
-- MIGRATION: Enforce fiscal year dates on legal_entities
-- Date: 2026-04-18
--
-- Problem: legal_entities created without fiscal year dates left the
-- accounting module unusable (no exercise, no FK target for
-- accounting_entries.exercise_id).
--
-- This migration:
--   1. Backfills NULL fiscal date fields on existing entities.
--   2. Creates the matching accounting_exercises row for each entity
--      that lacks one.
--   3. Enforces NOT NULL on premier_exercice_debut / premier_exercice_fin
--      / date_cloture_exercice.
--   4. Adds a BEFORE INSERT trigger that auto-computes sane defaults so
--      future inserts can never land with NULL fiscal dates again.
--   5. Adds an AFTER INSERT trigger that guarantees a matching
--      accounting_exercises row exists.
-- =====================================================

-- -----------------------------------------------------
-- 1. BACKFILL NULL fiscal dates
-- -----------------------------------------------------
-- Rule: if date_creation is set, use its year; otherwise use the current
-- calendar year. Regime IR/null -> full calendar year. Regime IS -> full
-- calendar year as well (users can refine via the edit wizard).

UPDATE legal_entities
SET
  premier_exercice_debut = COALESCE(
    premier_exercice_debut,
    CASE
      WHEN date_creation IS NOT NULL
        THEN make_date(EXTRACT(YEAR FROM date_creation)::INT, 1, 1)
      ELSE make_date(EXTRACT(YEAR FROM CURRENT_DATE)::INT, 1, 1)
    END
  ),
  premier_exercice_fin = COALESCE(
    premier_exercice_fin,
    CASE
      WHEN date_creation IS NOT NULL
        THEN make_date(EXTRACT(YEAR FROM date_creation)::INT, 12, 31)
      ELSE make_date(EXTRACT(YEAR FROM CURRENT_DATE)::INT, 12, 31)
    END
  ),
  date_cloture_exercice = COALESCE(date_cloture_exercice, '12-31')
WHERE premier_exercice_debut IS NULL
   OR premier_exercice_fin IS NULL
   OR date_cloture_exercice IS NULL;

-- -----------------------------------------------------
-- 2. BACKFILL missing accounting_exercises rows
-- -----------------------------------------------------
-- For every legal_entity without any exercise row, insert one open
-- exercise matching the entity's fiscal year.

INSERT INTO accounting_exercises (entity_id, start_date, end_date, status)
SELECT
  le.id,
  le.premier_exercice_debut,
  le.premier_exercice_fin,
  'open'
FROM legal_entities le
WHERE NOT EXISTS (
  SELECT 1 FROM accounting_exercises ae WHERE ae.entity_id = le.id
)
  AND le.premier_exercice_debut IS NOT NULL
  AND le.premier_exercice_fin IS NOT NULL
ON CONFLICT (entity_id, start_date, end_date) DO NOTHING;

-- -----------------------------------------------------
-- 3. NOT NULL constraints
-- -----------------------------------------------------
ALTER TABLE legal_entities
  ALTER COLUMN premier_exercice_debut SET NOT NULL,
  ALTER COLUMN premier_exercice_fin   SET NOT NULL,
  ALTER COLUMN date_cloture_exercice  SET NOT NULL;

-- Consistency: fin must be after debut
ALTER TABLE legal_entities
  DROP CONSTRAINT IF EXISTS legal_entities_fiscal_year_range;
ALTER TABLE legal_entities
  ADD CONSTRAINT legal_entities_fiscal_year_range
  CHECK (premier_exercice_fin > premier_exercice_debut);

-- Format check for date_cloture_exercice (MM-DD, two digits each)
ALTER TABLE legal_entities
  DROP CONSTRAINT IF EXISTS legal_entities_date_cloture_format;
ALTER TABLE legal_entities
  ADD CONSTRAINT legal_entities_date_cloture_format
  CHECK (date_cloture_exercice ~ '^[0-9]{2}-[0-9]{2}$');

-- -----------------------------------------------------
-- 4. BEFORE INSERT trigger — last-line defaults
-- -----------------------------------------------------
-- Safety net: even if app code forgets to set these, we compute sane
-- defaults (calendar year of creation_date, or today's year).

CREATE OR REPLACE FUNCTION fn_legal_entities_default_fiscal_year()
RETURNS TRIGGER AS $$
DECLARE
  v_ref_date DATE;
  v_year INT;
BEGIN
  v_ref_date := COALESCE(NEW.date_creation, CURRENT_DATE);
  v_year := EXTRACT(YEAR FROM v_ref_date)::INT;

  IF NEW.premier_exercice_debut IS NULL THEN
    NEW.premier_exercice_debut := make_date(v_year, 1, 1);
  END IF;

  IF NEW.premier_exercice_fin IS NULL THEN
    NEW.premier_exercice_fin := make_date(v_year, 12, 31);
  END IF;

  IF NEW.date_cloture_exercice IS NULL THEN
    NEW.date_cloture_exercice :=
      to_char(NEW.premier_exercice_fin, 'MM-DD');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_legal_entities_default_fiscal_year ON legal_entities;
CREATE TRIGGER trg_legal_entities_default_fiscal_year
  BEFORE INSERT ON legal_entities
  FOR EACH ROW
  EXECUTE FUNCTION fn_legal_entities_default_fiscal_year();

-- -----------------------------------------------------
-- 5. AFTER INSERT trigger — guarantee an accounting_exercises row
-- -----------------------------------------------------
-- Runs after trg_auto_entity_member (which creates the entity_members
-- record). By using SECURITY DEFINER we bypass RLS on
-- accounting_exercises, which is gated by entity_members but may race
-- with the same-transaction insert above.

CREATE OR REPLACE FUNCTION fn_legal_entities_bootstrap_exercise()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO accounting_exercises (entity_id, start_date, end_date, status)
  VALUES (
    NEW.id,
    NEW.premier_exercice_debut,
    NEW.premier_exercice_fin,
    'open'
  )
  ON CONFLICT (entity_id, start_date, end_date) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_legal_entities_bootstrap_exercise ON legal_entities;
CREATE TRIGGER trg_legal_entities_bootstrap_exercise
  AFTER INSERT ON legal_entities
  FOR EACH ROW
  EXECUTE FUNCTION fn_legal_entities_bootstrap_exercise();

COMMENT ON FUNCTION fn_legal_entities_default_fiscal_year() IS
  'Garantit que premier_exercice_debut/fin/date_cloture_exercice ne sont jamais NULL lors de INSERT sur legal_entities.';

COMMENT ON FUNCTION fn_legal_entities_bootstrap_exercise() IS
  'Crée automatiquement l''exercice comptable d''ouverture dans accounting_exercises à la création d''une legal_entity.';

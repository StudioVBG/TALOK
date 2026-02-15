-- ============================================================================
-- MIGRATION CORRECTIVE: Ajouter ON DELETE aux FK copropriété
-- Date: 2026-02-15
-- ============================================================================
-- PROBLÈME: Les FK suivantes n'ont pas de clause ON DELETE, ce qui peut
--           causer des erreurs de contrainte si un profil ou une propriété
--           est supprimé(e).
--
-- Tables affectées :
--   - copro_units.owner_profile_id → profiles(id)  → SET NULL
--   - copro_units.property_id → properties(id)      → SET NULL
--   - sites.syndic_profile_id → profiles(id)        → SET NULL
-- ============================================================================

-- 1. copro_units.owner_profile_id
DO $$
BEGIN
  -- Trouver et supprimer la contrainte FK existante
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'copro_units' AND constraint_type = 'FOREIGN KEY'
    AND constraint_name IN (
      SELECT constraint_name FROM information_schema.key_column_usage
      WHERE table_name = 'copro_units' AND column_name = 'owner_profile_id'
    )
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE copro_units DROP CONSTRAINT ' || constraint_name
      FROM information_schema.key_column_usage
      WHERE table_name = 'copro_units' AND column_name = 'owner_profile_id'
      LIMIT 1
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'copro_units.owner_profile_id FK not found, skipping drop';
END $$;

ALTER TABLE copro_units
  ADD CONSTRAINT copro_units_owner_profile_id_fkey
  FOREIGN KEY (owner_profile_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- 2. copro_units.property_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'copro_units' AND constraint_type = 'FOREIGN KEY'
    AND constraint_name IN (
      SELECT constraint_name FROM information_schema.key_column_usage
      WHERE table_name = 'copro_units' AND column_name = 'property_id'
    )
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE copro_units DROP CONSTRAINT ' || constraint_name
      FROM information_schema.key_column_usage
      WHERE table_name = 'copro_units' AND column_name = 'property_id'
      LIMIT 1
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'copro_units.property_id FK not found, skipping drop';
END $$;

ALTER TABLE copro_units
  ADD CONSTRAINT copro_units_property_id_fkey
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE SET NULL;

-- 3. sites.syndic_profile_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'sites' AND constraint_type = 'FOREIGN KEY'
    AND constraint_name IN (
      SELECT constraint_name FROM information_schema.key_column_usage
      WHERE table_name = 'sites' AND column_name = 'syndic_profile_id'
    )
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE sites DROP CONSTRAINT ' || constraint_name
      FROM information_schema.key_column_usage
      WHERE table_name = 'sites' AND column_name = 'syndic_profile_id'
      LIMIT 1
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'sites.syndic_profile_id FK not found, skipping drop';
END $$;

ALTER TABLE sites
  ADD CONSTRAINT sites_syndic_profile_id_fkey
  FOREIGN KEY (syndic_profile_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- Log
DO $$
BEGIN
  RAISE NOTICE '[MIGRATION] FK ON DELETE SET NULL ajoutées pour copro_units et sites';
END $$;

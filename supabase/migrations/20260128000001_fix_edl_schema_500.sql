-- ============================================================================
-- MIGRATION: Fix EDL table schema - Resolve 500 error on EDL creation
-- Date: 2026-01-28
-- Fixes:
--   1. Add property_id FK column (used by POST /api/properties/[id]/inspections)
--   2. Add scheduled_at TIMESTAMPTZ column (used by wizard creation flow)
--   3. Extend status CHECK constraint to include 'scheduled' and 'closed'
--   4. Backfill property_id from leases.property_id for existing records
-- ============================================================================

-- 1. Add property_id column to edl table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'edl' AND column_name = 'property_id'
    ) THEN
        ALTER TABLE edl ADD COLUMN property_id UUID REFERENCES properties(id) ON DELETE SET NULL;
        RAISE NOTICE 'Added property_id column to edl table';
    END IF;
END $$;

-- 2. Add scheduled_at TIMESTAMPTZ column (more precise than scheduled_date DATE)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'edl' AND column_name = 'scheduled_at'
    ) THEN
        ALTER TABLE edl ADD COLUMN scheduled_at TIMESTAMPTZ;
        RAISE NOTICE 'Added scheduled_at column to edl table';
    END IF;
END $$;

-- 3. Extend status CHECK constraint to include 'scheduled' and 'closed'
-- Drop existing constraint and recreate with all valid statuses
DO $$
BEGIN
    -- Drop existing constraint (may have different names depending on migration order)
    ALTER TABLE edl DROP CONSTRAINT IF EXISTS edl_status_check;

    -- Recreate with all statuses used in the codebase
    ALTER TABLE edl ADD CONSTRAINT edl_status_check
        CHECK (status IN (
            'draft',           -- Brouillon initial
            'scheduled',       -- Planifie (cree via le wizard)
            'in_progress',     -- En cours de saisie
            'completed',       -- Complete, en attente de signatures
            'signed',          -- Signe par toutes les parties
            'disputed',        -- Conteste
            'closed'           -- Cloture (archive)
        ));

    RAISE NOTICE 'Updated status CHECK constraint on edl table';
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Could not update status constraint: %', SQLERRM;
END $$;

-- 4. Backfill property_id from leases.property_id for existing records
UPDATE edl e
SET property_id = l.property_id
FROM leases l
WHERE e.lease_id = l.id
AND e.property_id IS NULL
AND l.property_id IS NOT NULL;

-- 5. Backfill scheduled_at from scheduled_date for existing records
UPDATE edl
SET scheduled_at = scheduled_date::timestamptz
WHERE scheduled_at IS NULL
AND scheduled_date IS NOT NULL;

-- 6. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_edl_property_id ON edl(property_id);
CREATE INDEX IF NOT EXISTS idx_edl_scheduled_at ON edl(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_edl_status ON edl(status);

-- 7. Comments
COMMENT ON COLUMN edl.property_id IS 'FK directe vers le bien immobilier (denormalise depuis leases.property_id pour faciliter les requetes)';
COMMENT ON COLUMN edl.scheduled_at IS 'Date et heure planifiees pour la realisation de l''EDL';

SELECT 'Migration fix_edl_schema_500 applied successfully' AS status;

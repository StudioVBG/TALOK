-- =============================================================================
-- MIGRATION: Align database schema with code audit fixes (2026-02-11)
-- =============================================================================
-- This migration ensures schema alignment after the 47-issue code audit:
--
--   1. audit_log: Add missing columns (profile_id, entity_type, created_at, etc.)
--      The table may have been created with the original admin_architecture schema
--      (actor_type, actor_id, resource, ts) but code now references the enhanced
--      schema (user_id, profile_id, entity_type, created_at).
--
--   2. audit_log: Add index on profile_id for owner dashboard queries
--
--   3. audit_log: Add RLS policy allowing users to query by profile_id
--
--   4. photos: Extend tag CHECK constraint to include all tags used in the app
--      (emplacement, acces, facade, interieur, vitrine, autre)
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Ensure audit_log has all required columns
-- ─────────────────────────────────────────────────────────────────────────────

-- Add user_id if missing (for RLS: user_id = auth.uid())
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS user_id UUID;

-- Add profile_id if missing (for owner dashboard: profile_id = owner profile ID)
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS profile_id UUID;

-- Add entity_type if missing (used by dashboard to categorize activity)
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS entity_type TEXT;

-- Add entity_id if missing
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS entity_id TEXT;

-- Add created_at if missing (the original schema uses 'ts')
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Add metadata if missing
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add risk_level if missing
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS risk_level TEXT DEFAULT 'low';

-- Add success flag if missing
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS success BOOLEAN DEFAULT true;

-- Add ip_address if missing
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS ip_address INET;

-- Add user_agent if missing
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- Add error_message if missing
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Backfill: if old schema had 'ts' but no 'created_at', copy values
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_log' AND column_name = 'ts'
  ) THEN
    UPDATE audit_log SET created_at = ts WHERE created_at IS NULL AND ts IS NOT NULL;
    RAISE NOTICE 'Backfilled created_at from ts column';
  END IF;
END $$;

-- Backfill: if old schema had 'actor_id' but no 'user_id', copy values
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_log' AND column_name = 'actor_id'
  ) THEN
    UPDATE audit_log SET user_id = actor_id WHERE user_id IS NULL AND actor_id IS NOT NULL;
    RAISE NOTICE 'Backfilled user_id from actor_id column';
  END IF;
END $$;

-- Backfill: if old schema had 'resource' but no 'entity_type', copy values
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_log' AND column_name = 'resource'
  ) THEN
    UPDATE audit_log SET entity_type = resource WHERE entity_type IS NULL AND resource IS NOT NULL;
    RAISE NOTICE 'Backfilled entity_type from resource column';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Add index on profile_id for owner dashboard queries
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_audit_log_profile_id
  ON audit_log(profile_id);

CREATE INDEX IF NOT EXISTS idx_audit_log_profile_created
  ON audit_log(profile_id, created_at DESC)
  WHERE profile_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RLS policy: users can query audit_log by profile_id
-- ─────────────────────────────────────────────────────────────────────────────
-- The existing "Users can view own audit logs" uses user_id = auth.uid()
-- Add a complementary policy for profile_id lookups via the profiles table
DO $$ BEGIN
  -- Drop if already exists (idempotent)
  DROP POLICY IF EXISTS "Users can view own audit logs via profile" ON audit_log;

  CREATE POLICY "Users can view own audit logs via profile"
    ON audit_log FOR SELECT
    USING (
      profile_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = audit_log.profile_id
        AND p.user_id = auth.uid()
      )
    );

  RAISE NOTICE 'Added RLS policy for audit_log profile_id access';
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Extend photos.tag CHECK constraint
-- ─────────────────────────────────────────────────────────────────────────────
-- Current constraint: tag IN ('vue_generale','plan','detail','exterieur')
-- App uses: vue_generale, plan, detail, exterieur, emplacement, acces, facade,
--           interieur, vitrine, autre
DO $$ BEGIN
  -- Drop the existing constraint
  ALTER TABLE photos DROP CONSTRAINT IF EXISTS photos_tag_check;

  -- Recreate with all tags used in the application
  ALTER TABLE photos ADD CONSTRAINT photos_tag_check
    CHECK (
      tag IS NULL OR tag IN (
        'vue_generale', 'plan', 'detail', 'exterieur',
        'emplacement', 'acces', 'facade', 'interieur',
        'vitrine', 'autre'
      )
    );

  RAISE NOTICE 'Extended photos.tag constraint with all application tags';
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Done
-- ─────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  RAISE NOTICE '=== Migration 20260211100000_fix_audit_code_alignment completed ===';
END $$;

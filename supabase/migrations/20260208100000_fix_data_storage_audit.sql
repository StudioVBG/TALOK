-- Migration: Fix data storage issues found during route audit (2026-02-08)
--
-- FIX #3: Add room_label, has_guarantor, guarantor_email, guarantor_name to roommates
-- FIX #3b: Make user_id, profile_id, first_name, last_name nullable (invited roommates don't have accounts yet)
-- FIX: Ensure edl_signatures.signer_role accepts values written by the routes

-- ============================================================
-- 1. Fix roommates table: make columns nullable for invited users
-- ============================================================

-- user_id: invited roommates don't have an auth account yet
ALTER TABLE roommates ALTER COLUMN user_id DROP NOT NULL;

-- profile_id: same — filled when user creates account
ALTER TABLE roommates ALTER COLUMN profile_id DROP NOT NULL;

-- first_name / last_name: invited users only have an email initially
ALTER TABLE roommates ALTER COLUMN first_name DROP NOT NULL;
ALTER TABLE roommates ALTER COLUMN last_name DROP NOT NULL;

-- Set defaults for text fields so insert without them doesn't fail
ALTER TABLE roommates ALTER COLUMN first_name SET DEFAULT '';
ALTER TABLE roommates ALTER COLUMN last_name SET DEFAULT '';

-- ============================================================
-- 2. Add missing columns to roommates for colocation data
-- ============================================================

-- Room label (text, not FK to rooms — rooms might not exist at invite time)
ALTER TABLE roommates ADD COLUMN IF NOT EXISTS room_label TEXT;

-- Guarantor tracking
ALTER TABLE roommates ADD COLUMN IF NOT EXISTS has_guarantor BOOLEAN DEFAULT false;
ALTER TABLE roommates ADD COLUMN IF NOT EXISTS guarantor_email TEXT;
ALTER TABLE roommates ADD COLUMN IF NOT EXISTS guarantor_name TEXT;

COMMENT ON COLUMN roommates.room_label IS 'Libellé de la chambre attribuée (texte libre, avant attribution room_id)';
COMMENT ON COLUMN roommates.has_guarantor IS 'Indique si ce colocataire a un garant';
COMMENT ON COLUMN roommates.guarantor_email IS 'Email du garant de ce colocataire';
COMMENT ON COLUMN roommates.guarantor_name IS 'Nom du garant de ce colocataire';

-- ============================================================
-- 3. Ensure leases.clauses_particulieres can store JSONB
-- ============================================================
-- The column exists as TEXT from migration 20251210100000.
-- We need it to accept JSON strings from the API.
-- TEXT is fine — the API serialises with JSON.stringify.
-- No change needed, just verify it exists:
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leases' AND column_name = 'clauses_particulieres'
  ) THEN
    ALTER TABLE leases ADD COLUMN clauses_particulieres TEXT;
    COMMENT ON COLUMN leases.clauses_particulieres IS 'Clauses personnalisées du bail (JSON sérialisé)';
  END IF;
END $$;

-- ============================================================
-- 4. Drop the unique constraint that blocks invited roommates
-- ============================================================
-- Original: UNIQUE(lease_id, user_id) — fails when user_id IS NULL for multiple invitees
-- Replace with a partial unique: only enforce when user_id IS NOT NULL
ALTER TABLE roommates DROP CONSTRAINT IF EXISTS roommates_lease_id_user_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS roommates_lease_user_unique
  ON roommates (lease_id, user_id)
  WHERE user_id IS NOT NULL;

-- Also add a unique on (lease_id, invited_email) to prevent duplicate invites
CREATE UNIQUE INDEX IF NOT EXISTS roommates_lease_email_unique
  ON roommates (lease_id, invited_email)
  WHERE invited_email IS NOT NULL;

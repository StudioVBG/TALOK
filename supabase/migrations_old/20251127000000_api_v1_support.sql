-- Migration: API v1 Support Tables
-- Adds tables for idempotency, invitations, and outbox events

-- ============================================
-- 1. IDEMPOTENCY KEYS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS idempotency_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  response_body JSONB NOT NULL,
  response_status INTEGER NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(key, resource_type)
);

CREATE INDEX idx_idempotency_keys_key ON idempotency_keys(key);
CREATE INDEX idx_idempotency_keys_expires ON idempotency_keys(expires_at);

-- Auto-cleanup expired keys
CREATE OR REPLACE FUNCTION cleanup_expired_idempotency_keys()
RETURNS void AS $$
BEGIN
  DELETE FROM idempotency_keys WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 2. INVITATIONS TABLE (if not exists)
-- ============================================

CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  email TEXT,
  role TEXT NOT NULL CHECK (role IN ('locataire_principal', 'colocataire', 'garant')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES profiles(id),
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES profiles(id),
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invitations_property_id ON invitations(property_id);
CREATE INDEX idx_invitations_token ON invitations(token);
CREATE INDEX idx_invitations_email ON invitations(email) WHERE email IS NOT NULL;
CREATE INDEX idx_invitations_status ON invitations(status);

-- Note: invitation token/code is NEVER reused even after revocation
-- This constraint is enforced by the UNIQUE constraint on token

-- ============================================
-- 3. OUTBOX TABLE FOR EVENT SOURCING
-- ============================================

CREATE TABLE IF NOT EXISTS outbox (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT false,
  processed_at TIMESTAMPTZ,
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_outbox_processed ON outbox(processed) WHERE processed = false;
CREATE INDEX idx_outbox_event_type ON outbox(event_type);
CREATE INDEX idx_outbox_created_at ON outbox(created_at);

-- ============================================
-- 4. TWO FACTOR SETTINGS (if not exists)
-- ============================================

CREATE TABLE IF NOT EXISTS two_factor_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  secret TEXT,
  backup_codes TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_two_factor_user ON two_factor_settings(user_id);

-- ============================================
-- 5. RLS POLICIES
-- ============================================

-- Enable RLS
ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE two_factor_settings ENABLE ROW LEVEL SECURITY;

-- Idempotency keys: service only (no direct access)
CREATE POLICY "idempotency_keys_service_only" ON idempotency_keys
  FOR ALL TO authenticated
  USING (false);

-- Invitations: owners can manage their properties' invitations
CREATE POLICY "invitations_owner_all" ON invitations
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = invitations.property_id
      AND p.owner_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- Invitations: users can view invitations sent to their email
CREATE POLICY "invitations_email_select" ON invitations
  FOR SELECT TO authenticated
  USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Outbox: admin only
CREATE POLICY "outbox_admin_only" ON outbox
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Two factor: users can manage their own
CREATE POLICY "two_factor_own" ON two_factor_settings
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================
-- 6. TRIGGERS
-- ============================================

CREATE TRIGGER update_invitations_updated_at 
  BEFORE UPDATE ON invitations 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_two_factor_updated_at 
  BEFORE UPDATE ON two_factor_settings 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 7. ADD MISSING COLUMNS TO EXISTING TABLES
-- ============================================

-- Add 'paused' status to tickets if not exists
DO $$
BEGIN
  ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_statut_check;
  ALTER TABLE tickets ADD CONSTRAINT tickets_statut_check 
    CHECK (statut IN ('open', 'in_progress', 'paused', 'resolved', 'closed'));
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Add date_paiement to payments if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payments' AND column_name = 'date_paiement'
  ) THEN
    ALTER TABLE payments ADD COLUMN date_paiement DATE;
  END IF;
END $$;

-- ============================================
-- 8. HELPER FUNCTIONS
-- ============================================

-- Function to check if invitation is valid (not expired, not revoked)
CREATE OR REPLACE FUNCTION is_invitation_valid(invitation_token TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  inv RECORD;
BEGIN
  SELECT * INTO inv FROM invitations
  WHERE token = invitation_token
  AND status = 'pending'
  AND expires_at > NOW();
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to accept an invitation
CREATE OR REPLACE FUNCTION accept_invitation(
  invitation_token TEXT,
  accepting_profile_id UUID
)
RETURNS UUID AS $$
DECLARE
  inv RECORD;
BEGIN
  -- Get and lock the invitation
  SELECT * INTO inv FROM invitations
  WHERE token = invitation_token
  AND status = 'pending'
  AND expires_at > NOW()
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired invitation';
  END IF;
  
  -- Mark as accepted
  UPDATE invitations SET
    status = 'accepted',
    accepted_at = NOW(),
    accepted_by = accepting_profile_id
  WHERE id = inv.id;
  
  RETURN inv.property_id;
END;
$$ LANGUAGE plpgsql;


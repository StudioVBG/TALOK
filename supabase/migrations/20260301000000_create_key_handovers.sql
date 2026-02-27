-- Migration: Create key_handovers table for digital key handover with QR code proof
-- This table records the formal handover of keys from owner to tenant,
-- with cryptographic proof, geolocation, and signature.

CREATE TABLE IF NOT EXISTS key_handovers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id uuid NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  property_id uuid REFERENCES properties(id) ON DELETE SET NULL,

  -- Participants
  owner_profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  tenant_profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,

  -- QR token
  token text NOT NULL,
  expires_at timestamptz NOT NULL,

  -- Keys handed over (JSON array from EDL)
  keys_list jsonb DEFAULT '[]'::jsonb,

  -- Tenant confirmation
  confirmed_at timestamptz,
  tenant_signature_path text,
  tenant_ip text,
  tenant_user_agent text,
  geolocation jsonb,

  -- Proof
  proof_id text,
  proof_metadata jsonb,

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_key_handovers_lease_id ON key_handovers(lease_id);
CREATE INDEX IF NOT EXISTS idx_key_handovers_token ON key_handovers(token);
CREATE INDEX IF NOT EXISTS idx_key_handovers_confirmed ON key_handovers(lease_id) WHERE confirmed_at IS NOT NULL;

-- RLS
ALTER TABLE key_handovers ENABLE ROW LEVEL SECURITY;

-- Owner can see and create handovers for their leases
CREATE POLICY "owner_key_handovers" ON key_handovers
  FOR ALL
  USING (
    owner_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Tenant can see and confirm handovers for their leases
CREATE POLICY "tenant_key_handovers" ON key_handovers
  FOR ALL
  USING (
    tenant_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
    OR
    lease_id IN (
      SELECT lease_id FROM lease_signers
      WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- Updated at trigger
CREATE OR REPLACE TRIGGER set_key_handovers_updated_at
  BEFORE UPDATE ON key_handovers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE key_handovers IS 'Remise des clés digitale avec preuve QR code, signature et géolocalisation';

-- Migration: Table pour les demandes 2FA (SMS + email) lors des changements d'identité
-- SOTA 2026 - Vérification à deux facteurs pour renouvellement / mise à jour CNI

CREATE TABLE IF NOT EXISTS identity_2fa_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('renew', 'initial', 'update')),
  lease_id UUID REFERENCES leases(id) ON DELETE SET NULL,
  otp_hash TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  verified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_identity_2fa_requests_token ON identity_2fa_requests(token);
CREATE INDEX IF NOT EXISTS idx_identity_2fa_requests_profile_id ON identity_2fa_requests(profile_id);
CREATE INDEX IF NOT EXISTS idx_identity_2fa_requests_expires_at ON identity_2fa_requests(expires_at) WHERE verified_at IS NULL;

ALTER TABLE identity_2fa_requests ENABLE ROW LEVEL SECURITY;

-- Le locataire ne peut voir que ses propres demandes
DROP POLICY IF EXISTS "identity_2fa_requests_tenant_own" ON identity_2fa_requests;
CREATE POLICY "identity_2fa_requests_tenant_own"
  ON identity_2fa_requests FOR ALL TO authenticated
  USING (
    profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

COMMENT ON TABLE identity_2fa_requests IS 'Demandes 2FA (OTP SMS + lien email) pour changement d''identité CNI';

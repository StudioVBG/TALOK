-- Workflow signature digitale pour les mandats agency
-- Le mandant (owner) reçoit un email avec un token qui lui permet de signer
-- Une fois signé, le mandat passe automatiquement de draft → active

ALTER TABLE agency_mandates
  ADD COLUMN IF NOT EXISTS signature_status TEXT
    CHECK (signature_status IS NULL OR signature_status IN ('pending', 'signed', 'refused', 'expired')),
  ADD COLUMN IF NOT EXISTS signature_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS signature_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signature_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signature_ip TEXT,
  ADD COLUMN IF NOT EXISTS signature_user_agent TEXT;

CREATE INDEX IF NOT EXISTS idx_agency_mandates_signature_token
  ON agency_mandates(signature_token)
  WHERE signature_token IS NOT NULL;

COMMENT ON COLUMN agency_mandates.signature_status IS
  'Workflow signature mandant : pending → signed/refused/expired. NULL si signature pas encore initiée.';
COMMENT ON COLUMN agency_mandates.signature_token IS
  'Token unique envoyé par email au mandant pour accéder à la page de signature.';

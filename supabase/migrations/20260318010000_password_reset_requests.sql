-- =============================================================================
-- Migration : Password reset requests SOTA 2026
-- Objectif  : Introduire une couche applicative one-time au-dessus du recovery
--             Supabase pour sécuriser le changement de mot de passe.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS password_reset_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'expired', 'revoked')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  requested_ip INET,
  requested_user_agent TEXT,
  completed_ip INET,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_requests_user_status
  ON password_reset_requests(user_id, status);

CREATE INDEX IF NOT EXISTS idx_password_reset_requests_expires_at
  ON password_reset_requests(expires_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_password_reset_requests_single_pending
  ON password_reset_requests(user_id)
  WHERE status = 'pending';

CREATE OR REPLACE FUNCTION set_password_reset_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_password_reset_requests_updated_at ON password_reset_requests;
CREATE TRIGGER trg_password_reset_requests_updated_at
  BEFORE UPDATE ON password_reset_requests
  FOR EACH ROW
  EXECUTE FUNCTION set_password_reset_requests_updated_at();

ALTER TABLE password_reset_requests ENABLE ROW LEVEL SECURITY;

COMMIT;

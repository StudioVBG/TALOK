-- =====================================================
-- FEC MANIFESTS — RFC 3161 timestamp token columns
-- =====================================================
-- Stores the eIDAS-style RFC 3161 TimeStampToken returned by an
-- external Time-Stamp Authority alongside the SHA-256 manifest. The
-- token is opaque DER bytes (typically ~5 kB) that prove the file
-- existed at a precise moment as observed by the TSA.
--
-- Columns are nullable: the FEC export route attempts the timestamp
-- best-effort and continues without it on TSA failure. The manifest
-- (sha256_hex) remains authoritative; the token is the bonus eIDAS
-- evidence layer.
-- =====================================================

SET lock_timeout = '10s';

ALTER TABLE fec_manifests
  ADD COLUMN IF NOT EXISTS rfc3161_token_b64 TEXT,
  ADD COLUMN IF NOT EXISTS rfc3161_tsa_url   TEXT,
  ADD COLUMN IF NOT EXISTS rfc3161_received_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rfc3161_token_bytes INTEGER;

COMMENT ON COLUMN fec_manifests.rfc3161_token_b64 IS
  'Base64-encoded DER TimeStampToken (RFC 3161). Optional — absent when '
  'the TSA was unavailable at export time.';

COMMENT ON COLUMN fec_manifests.rfc3161_tsa_url IS
  'TSA endpoint that issued the token. Defaults to FreeTSA in dev, '
  'qualified eIDAS TSA (Universign / Certinomis) in production via '
  'the TALOK_TSA_URL environment variable.';

COMMENT ON COLUMN fec_manifests.rfc3161_received_at IS
  'Client-side wall-clock when the TSA response arrived. Indicative '
  'only; the authoritative time is encoded inside the token itself.';

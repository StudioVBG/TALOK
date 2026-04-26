-- =====================================================
-- FEC MANIFESTS — file integrity tracking
-- =====================================================
-- Records SHA-256 + metadata for every FEC export so the company can
-- prove later that the file delivered to the tax authority was not
-- tampered with after generation. Acts as a lightweight pre-eIDAS
-- audit trail (the FEC content + this row are sufficient to bind the
-- file to a moment in time and a known user).
-- =====================================================

SET lock_timeout = '10s';

CREATE TABLE IF NOT EXISTS fec_manifests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  exercise_id UUID REFERENCES accounting_exercises(id) ON DELETE SET NULL,
  fec_year INTEGER NOT NULL CHECK (fec_year BETWEEN 2000 AND 2100),
  siren TEXT,
  filename TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes > 0),
  line_count INTEGER NOT NULL CHECK (line_count >= 0),
  sha256_hex TEXT NOT NULL CHECK (sha256_hex ~ '^[0-9a-f]{64}$'),
  generated_by UUID REFERENCES auth.users(id),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fec_manifests_entity_year
  ON fec_manifests(entity_id, fec_year DESC, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_fec_manifests_sha256
  ON fec_manifests(sha256_hex);

ALTER TABLE fec_manifests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fec_manifests_select" ON fec_manifests
  FOR SELECT TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

-- Inserts come from the API route under service-role context; no policy
-- exposed to authenticated users to prevent forged manifests.

COMMENT ON TABLE fec_manifests IS
  'SHA-256 + metadata audit trail for every FEC export. Bound to entity_id and exercise.';
COMMENT ON COLUMN fec_manifests.sha256_hex IS
  'Lowercase hex SHA-256 of the exact bytes returned by the FEC export endpoint.';

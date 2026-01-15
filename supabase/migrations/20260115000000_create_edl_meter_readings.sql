-- Migration: Créer la table edl_meter_readings
-- Date: 2026-01-15
-- Raison: La table était référencée dans le code mais n'existait pas dans les migrations

-- 1. Créer la table edl_meter_readings si elle n'existe pas
CREATE TABLE IF NOT EXISTS edl_meter_readings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  edl_id UUID NOT NULL REFERENCES edl(id) ON DELETE CASCADE,
  meter_id UUID REFERENCES meters(id) ON DELETE SET NULL,

  -- Valeur du relevé
  reading_value NUMERIC(12, 2),
  reading_unit TEXT DEFAULT 'kWh',

  -- Photo preuve
  photo_path TEXT,
  photo_taken_at TIMESTAMPTZ,

  -- Résultat OCR
  ocr_value NUMERIC(12, 2),
  ocr_confidence INTEGER DEFAULT 0 CHECK (ocr_confidence >= 0 AND ocr_confidence <= 100),
  ocr_provider TEXT,
  ocr_raw_text TEXT,

  -- Validation humaine
  is_validated BOOLEAN DEFAULT false,
  validated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  validated_at TIMESTAMPTZ,
  validation_comment TEXT,

  -- Qui a effectué le relevé
  recorded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  recorded_by_role TEXT DEFAULT 'owner' CHECK (recorded_by_role IN ('owner', 'tenant')),

  -- Métadonnées
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Index pour performance
CREATE INDEX IF NOT EXISTS idx_edl_meter_readings_edl_id ON edl_meter_readings(edl_id);
CREATE INDEX IF NOT EXISTS idx_edl_meter_readings_meter_id ON edl_meter_readings(meter_id);

-- 3. Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_edl_meter_readings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_edl_meter_readings_updated_at ON edl_meter_readings;
CREATE TRIGGER trigger_edl_meter_readings_updated_at
  BEFORE UPDATE ON edl_meter_readings
  FOR EACH ROW
  EXECUTE FUNCTION update_edl_meter_readings_updated_at();

-- 4. RLS Policies
ALTER TABLE edl_meter_readings ENABLE ROW LEVEL SECURITY;

-- Policy: Les admins voient tout
DROP POLICY IF EXISTS "edl_meter_readings_admin_all" ON edl_meter_readings;
CREATE POLICY "edl_meter_readings_admin_all" ON edl_meter_readings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy: Les propriétaires voient les relevés de leurs biens
DROP POLICY IF EXISTS "edl_meter_readings_owner_select" ON edl_meter_readings;
CREATE POLICY "edl_meter_readings_owner_select" ON edl_meter_readings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM edl
      JOIN leases ON leases.id = edl.lease_id
      JOIN properties ON properties.id = leases.property_id
      JOIN owner_profiles ON owner_profiles.id = properties.owner_id
      JOIN profiles ON profiles.id = owner_profiles.profile_id
      WHERE edl.id = edl_meter_readings.edl_id
      AND profiles.user_id = auth.uid()
    )
  );

-- Policy: Les propriétaires peuvent créer/modifier les relevés
DROP POLICY IF EXISTS "edl_meter_readings_owner_insert" ON edl_meter_readings;
CREATE POLICY "edl_meter_readings_owner_insert" ON edl_meter_readings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM edl
      JOIN leases ON leases.id = edl.lease_id
      JOIN properties ON properties.id = leases.property_id
      JOIN owner_profiles ON owner_profiles.id = properties.owner_id
      JOIN profiles ON profiles.id = owner_profiles.profile_id
      WHERE edl.id = edl_meter_readings.edl_id
      AND profiles.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "edl_meter_readings_owner_update" ON edl_meter_readings;
CREATE POLICY "edl_meter_readings_owner_update" ON edl_meter_readings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM edl
      JOIN leases ON leases.id = edl.lease_id
      JOIN properties ON properties.id = leases.property_id
      JOIN owner_profiles ON owner_profiles.id = properties.owner_id
      JOIN profiles ON profiles.id = owner_profiles.profile_id
      WHERE edl.id = edl_meter_readings.edl_id
      AND profiles.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "edl_meter_readings_owner_delete" ON edl_meter_readings;
CREATE POLICY "edl_meter_readings_owner_delete" ON edl_meter_readings
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM edl
      JOIN leases ON leases.id = edl.lease_id
      JOIN properties ON properties.id = leases.property_id
      JOIN owner_profiles ON owner_profiles.id = properties.owner_id
      JOIN profiles ON profiles.id = owner_profiles.profile_id
      WHERE edl.id = edl_meter_readings.edl_id
      AND profiles.user_id = auth.uid()
    )
  );

-- Policy: Les locataires voient leurs propres relevés
DROP POLICY IF EXISTS "edl_meter_readings_tenant_select" ON edl_meter_readings;
CREATE POLICY "edl_meter_readings_tenant_select" ON edl_meter_readings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM edl
      JOIN leases ON leases.id = edl.lease_id
      JOIN lease_signers ON lease_signers.lease_id = leases.id
      JOIN profiles ON profiles.id = lease_signers.profile_id
      WHERE edl.id = edl_meter_readings.edl_id
      AND profiles.user_id = auth.uid()
    )
  );

-- Policy: Les locataires peuvent créer des relevés sur leurs EDL
DROP POLICY IF EXISTS "edl_meter_readings_tenant_insert" ON edl_meter_readings;
CREATE POLICY "edl_meter_readings_tenant_insert" ON edl_meter_readings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM edl
      JOIN leases ON leases.id = edl.lease_id
      JOIN lease_signers ON lease_signers.lease_id = leases.id
      JOIN profiles ON profiles.id = lease_signers.profile_id
      WHERE edl.id = edl_meter_readings.edl_id
      AND profiles.user_id = auth.uid()
    )
  );

-- 5. Commentaires
COMMENT ON TABLE edl_meter_readings IS 'Relevés de compteurs associés aux états des lieux (EDL)';
COMMENT ON COLUMN edl_meter_readings.meter_id IS 'Référence vers le compteur (peut être null si compteur créé dynamiquement)';
COMMENT ON COLUMN edl_meter_readings.reading_value IS 'Valeur finale du relevé (manuelle ou OCR validée)';
COMMENT ON COLUMN edl_meter_readings.ocr_confidence IS 'Confiance OCR de 0 à 100';
COMMENT ON COLUMN edl_meter_readings.is_validated IS 'True si le relevé a été validé manuellement';

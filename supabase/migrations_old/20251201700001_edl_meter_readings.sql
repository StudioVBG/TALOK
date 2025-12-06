-- Migration: Relevés de compteurs liés aux États des Lieux (EDL)
-- Conforme au décret n°2016-382 du 30 mars 2016
-- Les relevés de compteurs DOIVENT figurer dans l'EDL d'entrée et de sortie

BEGIN;

-- ============================================
-- Table de liaison EDL ↔ Relevés de compteurs
-- ============================================

CREATE TABLE IF NOT EXISTS edl_meter_readings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Références
  edl_id UUID NOT NULL REFERENCES edl(id) ON DELETE CASCADE,
  meter_id UUID NOT NULL REFERENCES meters(id) ON DELETE CASCADE,
  
  -- Valeur du relevé (obligatoire)
  reading_value NUMERIC(12, 2) NOT NULL,
  reading_unit TEXT NOT NULL DEFAULT 'kWh' CHECK (reading_unit IN ('kWh', 'm³', 'L')),
  
  -- Photo preuve (OBLIGATOIRE pour preuve juridique)
  photo_path TEXT NOT NULL,
  photo_taken_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Résultat OCR automatique
  ocr_value NUMERIC(12, 2),          -- Valeur lue automatiquement par OCR
  ocr_confidence NUMERIC(5, 2)       -- Pourcentage de confiance (0-100)
    CHECK (ocr_confidence IS NULL OR (ocr_confidence >= 0 AND ocr_confidence <= 100)),
  ocr_provider TEXT                   -- 'tesseract', 'google_vision', 'mindee'
    CHECK (ocr_provider IS NULL OR ocr_provider IN ('tesseract', 'google_vision', 'mindee')),
  ocr_raw_text TEXT,                  -- Texte brut extrait par OCR
  
  -- Validation humaine (si OCR pas assez confiant)
  is_validated BOOLEAN DEFAULT false,
  validated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  validated_at TIMESTAMPTZ,
  validation_comment TEXT,            -- Commentaire si correction manuelle
  
  -- Qui a effectué le relevé ?
  recorded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recorded_by_role TEXT NOT NULL CHECK (recorded_by_role IN ('owner', 'tenant')),
  
  -- Métadonnées
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Un seul relevé par compteur par EDL
  UNIQUE(edl_id, meter_id)
);

-- Index pour les recherches
CREATE INDEX idx_edl_meter_readings_edl ON edl_meter_readings(edl_id);
CREATE INDEX idx_edl_meter_readings_meter ON edl_meter_readings(meter_id);
CREATE INDEX idx_edl_meter_readings_recorded_by ON edl_meter_readings(recorded_by);
CREATE INDEX idx_edl_meter_readings_validation ON edl_meter_readings(is_validated) WHERE NOT is_validated;

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_edl_meter_readings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_edl_meter_readings_updated_at
  BEFORE UPDATE ON edl_meter_readings
  FOR EACH ROW
  EXECUTE FUNCTION update_edl_meter_readings_timestamp();

-- ============================================
-- Row Level Security (RLS)
-- ============================================

ALTER TABLE edl_meter_readings ENABLE ROW LEVEL SECURITY;

-- Admins peuvent tout faire
CREATE POLICY "admin_full_access_edl_meter_readings" ON edl_meter_readings
  FOR ALL 
  USING (public.user_role() = 'admin')
  WITH CHECK (public.user_role() = 'admin');

-- Propriétaires et locataires du bail concerné peuvent voir les relevés
CREATE POLICY "signers_can_view_edl_meter_readings" ON edl_meter_readings
  FOR SELECT
  USING (
    edl_id IN (
      SELECT e.id FROM edl e
      JOIN leases l ON e.lease_id = l.id
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE ls.profile_id = public.user_profile_id()
    )
  );

-- Propriétaires et locataires peuvent créer des relevés (tant que l'EDL n'est pas signé)
CREATE POLICY "signers_can_create_edl_meter_readings" ON edl_meter_readings
  FOR INSERT
  WITH CHECK (
    edl_id IN (
      SELECT e.id FROM edl e
      JOIN leases l ON e.lease_id = l.id
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE ls.profile_id = public.user_profile_id()
        AND e.status IN ('draft', 'in_progress', 'completed') -- Pas encore signé
    )
  );

-- Propriétaires et locataires peuvent mettre à jour les relevés (tant que l'EDL n'est pas signé)
CREATE POLICY "signers_can_update_edl_meter_readings" ON edl_meter_readings
  FOR UPDATE
  USING (
    edl_id IN (
      SELECT e.id FROM edl e
      JOIN leases l ON e.lease_id = l.id
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE ls.profile_id = public.user_profile_id()
        AND e.status IN ('draft', 'in_progress', 'completed')
    )
  )
  WITH CHECK (
    edl_id IN (
      SELECT e.id FROM edl e
      JOIN leases l ON e.lease_id = l.id
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE ls.profile_id = public.user_profile_id()
        AND e.status IN ('draft', 'in_progress', 'completed')
    )
  );

-- Seul le propriétaire peut supprimer (si EDL pas signé)
CREATE POLICY "owner_can_delete_edl_meter_readings" ON edl_meter_readings
  FOR DELETE
  USING (
    public.user_role() = 'owner'
    AND edl_id IN (
      SELECT e.id FROM edl e
      JOIN leases l ON e.lease_id = l.id
      JOIN properties p ON l.property_id = p.id
      WHERE p.owner_id = public.user_profile_id()
        AND e.status IN ('draft', 'in_progress')
    )
  );

-- ============================================
-- Vue pour faciliter les requêtes
-- ============================================

CREATE OR REPLACE VIEW v_edl_meter_readings_details AS
SELECT 
  emr.*,
  m.type AS meter_type,
  m.meter_number,
  m.location AS meter_location,
  m.provider AS meter_provider,
  e.type AS edl_type,
  e.status AS edl_status,
  e.lease_id,
  l.property_id,
  recorder.email AS recorded_by_email,
  CONCAT(recorder_profile.prenom, ' ', recorder_profile.nom) AS recorded_by_name,
  validator.email AS validated_by_email
FROM edl_meter_readings emr
JOIN meters m ON emr.meter_id = m.id
JOIN edl e ON emr.edl_id = e.id
JOIN leases l ON e.lease_id = l.id
LEFT JOIN auth.users recorder ON emr.recorded_by = recorder.id
LEFT JOIN profiles recorder_profile ON recorder.id = recorder_profile.user_id
LEFT JOIN auth.users validator ON emr.validated_by = validator.id;

-- ============================================
-- Fonction pour vérifier si tous les compteurs sont relevés
-- ============================================

CREATE OR REPLACE FUNCTION check_edl_meters_complete(p_edl_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  total_meters INT;
  recorded_meters INT;
BEGIN
  -- Compter les compteurs actifs du logement
  SELECT COUNT(*) INTO total_meters
  FROM meters m
  JOIN edl e ON e.id = p_edl_id
  JOIN leases l ON e.lease_id = l.id
  WHERE m.property_id = l.property_id
    AND m.is_active = true;
  
  -- Compter les relevés enregistrés pour cet EDL
  SELECT COUNT(*) INTO recorded_meters
  FROM edl_meter_readings
  WHERE edl_id = p_edl_id;
  
  RETURN recorded_meters >= total_meters;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Fonction pour obtenir la différence entre EDL entrée et sortie
-- ============================================

CREATE OR REPLACE FUNCTION get_meter_consumption_between_edl(
  p_lease_id UUID,
  p_meter_id UUID
)
RETURNS TABLE (
  meter_id UUID,
  meter_type TEXT,
  entry_value NUMERIC,
  entry_date TIMESTAMPTZ,
  exit_value NUMERIC,
  exit_date TIMESTAMPTZ,
  consumption NUMERIC,
  unit TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p_meter_id AS meter_id,
    m.type AS meter_type,
    entry_reading.reading_value AS entry_value,
    entry_reading.photo_taken_at AS entry_date,
    exit_reading.reading_value AS exit_value,
    exit_reading.photo_taken_at AS exit_date,
    (exit_reading.reading_value - entry_reading.reading_value) AS consumption,
    entry_reading.reading_unit AS unit
  FROM meters m
  LEFT JOIN (
    SELECT emr.* 
    FROM edl_meter_readings emr
    JOIN edl e ON emr.edl_id = e.id
    WHERE e.lease_id = p_lease_id 
      AND e.type = 'entree'
      AND emr.meter_id = p_meter_id
  ) entry_reading ON true
  LEFT JOIN (
    SELECT emr.* 
    FROM edl_meter_readings emr
    JOIN edl e ON emr.edl_id = e.id
    WHERE e.lease_id = p_lease_id 
      AND e.type = 'sortie'
      AND emr.meter_id = p_meter_id
  ) exit_reading ON true
  WHERE m.id = p_meter_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;


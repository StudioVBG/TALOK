-- Migration: Rendre photo_path nullable dans edl_meter_readings
-- Date: 2026-01-05
-- Raison: Permettre l'enregistrement de relevés de compteurs sans photo (saisie manuelle)

-- 1. Supprimer la contrainte NOT NULL sur photo_path
ALTER TABLE edl_meter_readings ALTER COLUMN photo_path DROP NOT NULL;

-- 2. Ajouter les colonnes OCR et validation si elles n'existent pas
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_meter_readings' AND column_name = 'ocr_value') THEN
        ALTER TABLE edl_meter_readings ADD COLUMN ocr_value NUMERIC;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_meter_readings' AND column_name = 'ocr_confidence') THEN
        ALTER TABLE edl_meter_readings ADD COLUMN ocr_confidence INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_meter_readings' AND column_name = 'ocr_provider') THEN
        ALTER TABLE edl_meter_readings ADD COLUMN ocr_provider TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_meter_readings' AND column_name = 'ocr_raw_text') THEN
        ALTER TABLE edl_meter_readings ADD COLUMN ocr_raw_text TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_meter_readings' AND column_name = 'is_validated') THEN
        ALTER TABLE edl_meter_readings ADD COLUMN is_validated BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_meter_readings' AND column_name = 'validated_by') THEN
        ALTER TABLE edl_meter_readings ADD COLUMN validated_by UUID REFERENCES auth.users(id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_meter_readings' AND column_name = 'validated_at') THEN
        ALTER TABLE edl_meter_readings ADD COLUMN validated_at TIMESTAMPTZ;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_meter_readings' AND column_name = 'validation_comment') THEN
        ALTER TABLE edl_meter_readings ADD COLUMN validation_comment TEXT;
    END IF;
END $$;

-- 3. Commentaires
COMMENT ON COLUMN edl_meter_readings.photo_path IS 'Chemin vers la photo du compteur (optionnel)';
COMMENT ON COLUMN edl_meter_readings.ocr_value IS 'Valeur détectée par OCR';
COMMENT ON COLUMN edl_meter_readings.ocr_confidence IS 'Niveau de confiance de l''OCR (0-100)';
COMMENT ON COLUMN edl_meter_readings.is_validated IS 'Indique si le relevé a été validé manuellement';


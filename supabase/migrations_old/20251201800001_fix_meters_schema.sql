-- Migration: Corriger le schéma des compteurs
-- Unifie les deux définitions conflictuelles de la table meters

BEGIN;

-- Rendre lease_id nullable (certains compteurs peuvent être liés directement à une propriété)
ALTER TABLE meters 
  ALTER COLUMN lease_id DROP NOT NULL;

-- Ajouter la colonne serial_number si elle n'existe pas (alias de meter_number)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'meters' AND column_name = 'serial_number'
  ) THEN
    ALTER TABLE meters ADD COLUMN serial_number TEXT;
    -- Copier les valeurs de meter_number vers serial_number
    UPDATE meters SET serial_number = meter_number WHERE serial_number IS NULL;
  END IF;
END $$;

-- Ajouter la colonne location si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'meters' AND column_name = 'location'
  ) THEN
    ALTER TABLE meters ADD COLUMN location TEXT;
  END IF;
END $$;

-- Ajouter la colonne is_active si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'meters' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE meters ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;
END $$;

-- Ajouter la colonne notes si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'meters' AND column_name = 'notes'
  ) THEN
    ALTER TABLE meters ADD COLUMN notes TEXT;
  END IF;
END $$;

-- S'assurer que provider et is_connected existent (de l'ancienne migration)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'meters' AND column_name = 'provider'
  ) THEN
    ALTER TABLE meters ADD COLUMN provider TEXT;
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'meters' AND column_name = 'is_connected'
  ) THEN
    ALTER TABLE meters ADD COLUMN is_connected BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Ajouter 'heating' au type si pas déjà présent
-- D'abord, on vérifie si la contrainte existe et on la supprime
ALTER TABLE meters DROP CONSTRAINT IF EXISTS meters_type_check;

-- Recréer la contrainte avec tous les types
ALTER TABLE meters ADD CONSTRAINT meters_type_check 
  CHECK (type IN ('electricity', 'gas', 'water', 'heating'));

-- Mettre à jour la contrainte sur unit
ALTER TABLE meters DROP CONSTRAINT IF EXISTS meters_unit_check;

-- Commentaire sur les colonnes pour clarifier
COMMENT ON COLUMN meters.serial_number IS 'Numéro de série du compteur (équivalent à meter_number)';
COMMENT ON COLUMN meters.meter_number IS 'Ancien nom pour serial_number - conservé pour compatibilité';
COMMENT ON COLUMN meters.lease_id IS 'Optionnel - le compteur peut être lié directement à la propriété';

COMMIT;


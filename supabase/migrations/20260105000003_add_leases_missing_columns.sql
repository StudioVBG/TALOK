-- ============================================
-- Migration: Ajouter les colonnes manquantes à leases
-- Date: 2026-01-05
-- Description: Ajoute charges_type, coloc_config et autres colonnes manquantes
-- ============================================

-- Ajouter charges_type si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leases' AND column_name = 'charges_type') THEN
    ALTER TABLE leases ADD COLUMN charges_type TEXT DEFAULT 'forfait' 
      CHECK (charges_type IN ('forfait', 'provisions'));
  END IF;
END $$;

-- Ajouter coloc_config (pour la configuration colocation) si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leases' AND column_name = 'coloc_config') THEN
    ALTER TABLE leases ADD COLUMN coloc_config JSONB;
  END IF;
END $$;

-- Mettre à jour la contrainte type_bail pour inclure les nouveaux types
ALTER TABLE leases DROP CONSTRAINT IF EXISTS leases_type_bail_check;
ALTER TABLE leases ADD CONSTRAINT leases_type_bail_check 
  CHECK (type_bail IN ('nu', 'meuble', 'colocation', 'saisonnier', 'etudiant', 'mobilite'));

-- Ajouter un index sur charges_type pour les requêtes filtrées
CREATE INDEX IF NOT EXISTS idx_leases_charges_type ON leases(charges_type);

COMMENT ON COLUMN leases.charges_type IS 'Type de charges: forfait (fixe) ou provisions (régularisation annuelle)';
COMMENT ON COLUMN leases.coloc_config IS 'Configuration colocation: nb_places, bail_type, solidarite, split_mode, etc.';


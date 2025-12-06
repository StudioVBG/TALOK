-- ============================================
-- Migration: Ajouter champs investissement propriétés
-- Pour le calcul ROI/rendement dans le dashboard
-- ============================================

-- Ajouter colonne prix_achat si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'properties' AND column_name = 'prix_achat'
    ) THEN
        ALTER TABLE properties ADD COLUMN prix_achat NUMERIC(12, 2);
        COMMENT ON COLUMN properties.prix_achat IS 'Prix d''achat du bien pour calcul de rendement';
    END IF;
END $$;

-- Ajouter colonne date_achat si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'properties' AND column_name = 'date_achat'
    ) THEN
        ALTER TABLE properties ADD COLUMN date_achat DATE;
        COMMENT ON COLUMN properties.date_achat IS 'Date d''achat du bien';
    END IF;
END $$;

-- Ajouter colonne frais_notaire si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'properties' AND column_name = 'frais_notaire'
    ) THEN
        ALTER TABLE properties ADD COLUMN frais_notaire NUMERIC(10, 2);
        COMMENT ON COLUMN properties.frais_notaire IS 'Frais de notaire pour calcul investissement total';
    END IF;
END $$;

-- Ajouter colonne frais_agence si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'properties' AND column_name = 'frais_agence'
    ) THEN
        ALTER TABLE properties ADD COLUMN frais_agence NUMERIC(10, 2);
        COMMENT ON COLUMN properties.frais_agence IS 'Frais d''agence pour calcul investissement total';
    END IF;
END $$;

-- Ajouter colonne travaux_initiaux si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'properties' AND column_name = 'travaux_initiaux'
    ) THEN
        ALTER TABLE properties ADD COLUMN travaux_initiaux NUMERIC(10, 2);
        COMMENT ON COLUMN properties.travaux_initiaux IS 'Montant des travaux initiaux pour calcul investissement total';
    END IF;
END $$;

-- Ajouter colonne dpe_date_expiration si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'properties' AND column_name = 'dpe_date_expiration'
    ) THEN
        ALTER TABLE properties ADD COLUMN dpe_date_expiration DATE;
        COMMENT ON COLUMN properties.dpe_date_expiration IS 'Date d''expiration du DPE (10 ans après réalisation)';
    END IF;
END $$;

-- Index pour requêtes de performance
CREATE INDEX IF NOT EXISTS idx_properties_prix_achat ON properties(prix_achat) WHERE prix_achat IS NOT NULL;

-- ============================================
-- Fin de la migration
-- ============================================


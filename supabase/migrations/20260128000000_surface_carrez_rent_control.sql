-- Migration : Surface Carrez et encadrement des loyers SOTA 2026
-- Ajoute les colonnes pour la conformite loi ALUR et decret decence
BEGIN;

-- ============================================
-- SURFACE CARREZ (Loi du 18 decembre 1996)
-- ============================================
-- Surface privative certifiee, obligatoire en copropriete
-- Doit etre <= surface_habitable_m2

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS surface_carrez NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS surface_carrez_certifiee BOOLEAN DEFAULT false;

-- Commentaire pour documentation
COMMENT ON COLUMN properties.surface_carrez IS 'Surface privative loi Carrez (m2), obligatoire en copropriete';
COMMENT ON COLUMN properties.surface_carrez_certifiee IS 'Surface Carrez certifiee par un diagnostiqueur agree';

-- ============================================
-- ENCADREMENT DES LOYERS (Loi ALUR / ELAN)
-- ============================================
-- Pour les zones tendues avec encadrement (Paris, Lille, Lyon, etc.)

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS loyer_reference NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS loyer_reference_majore NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS complement_loyer NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS complement_loyer_justification TEXT;

ALTER TABLE properties DROP CONSTRAINT IF EXISTS properties_loyer_reference_check;
ALTER TABLE properties DROP CONSTRAINT IF EXISTS properties_zone_encadrement_check;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'properties' AND column_name = 'zone_encadrement' AND data_type = 'boolean'
  ) THEN
    DROP VIEW IF EXISTS active_properties CASCADE;
    ALTER TABLE properties ALTER COLUMN zone_encadrement TYPE TEXT USING CASE WHEN zone_encadrement THEN 'aucune' ELSE NULL END;
    CREATE OR REPLACE VIEW active_properties AS
      SELECT * FROM properties WHERE deleted_at IS NULL AND (etat IS NULL OR etat != 'deleted');
  ELSE
    ALTER TABLE properties ADD COLUMN IF NOT EXISTS zone_encadrement TEXT;
  END IF;
END $$;

ALTER TABLE properties
  ADD CONSTRAINT properties_zone_encadrement_check
    CHECK (zone_encadrement IS NULL OR zone_encadrement IN (
      'paris',
      'paris_agglo',
      'lille',
      'lyon',
      'villeurbanne',
      'montpellier',
      'bordeaux',
      'aucune'
    ));

COMMENT ON COLUMN properties.zone_encadrement IS 'Zone d encadrement des loyers (Paris, Lille, Lyon, etc.)';
COMMENT ON COLUMN properties.loyer_reference IS 'Loyer de reference median pour la zone (EUR/m2)';
COMMENT ON COLUMN properties.loyer_reference_majore IS 'Loyer de reference majore (loyer_reference * 1.2)';
COMMENT ON COLUMN properties.complement_loyer IS 'Complement de loyer exceptionnel (EUR/mois)';
COMMENT ON COLUMN properties.complement_loyer_justification IS 'Justification du complement de loyer (caracteristiques exceptionnelles)';

-- ============================================
-- DPE COMPLET (Loi Climat et Resilience 2021)
-- ============================================
-- Champs DPE detailles pour conformite

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS dpe_classe_energie TEXT,
  ADD COLUMN IF NOT EXISTS dpe_classe_climat TEXT,
  ADD COLUMN IF NOT EXISTS dpe_consommation NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS dpe_emissions NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS dpe_date_realisation DATE,
  ADD COLUMN IF NOT EXISTS dpe_numero TEXT;

-- Contraintes DPE
ALTER TABLE properties
  DROP CONSTRAINT IF EXISTS properties_dpe_classe_energie_check,
  DROP CONSTRAINT IF EXISTS properties_dpe_classe_climat_check;

ALTER TABLE properties
  ADD CONSTRAINT properties_dpe_classe_energie_check
    CHECK (dpe_classe_energie IS NULL OR dpe_classe_energie IN ('A','B','C','D','E','F','G','NC')),
  ADD CONSTRAINT properties_dpe_classe_climat_check
    CHECK (dpe_classe_climat IS NULL OR dpe_classe_climat IN ('A','B','C','D','E','F','G','NC'));

COMMENT ON COLUMN properties.dpe_classe_energie IS 'Classe energie DPE (A-G ou NC)';
COMMENT ON COLUMN properties.dpe_classe_climat IS 'Classe emissions GES (A-G ou NC)';
COMMENT ON COLUMN properties.dpe_consommation IS 'Consommation energetique (kWh/m2/an)';
COMMENT ON COLUMN properties.dpe_emissions IS 'Emissions GES (kg CO2/m2/an)';

-- ============================================
-- INDEX POUR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_properties_dpe_classe ON properties(dpe_classe_energie);
CREATE INDEX IF NOT EXISTS idx_properties_zone_encadrement ON properties(zone_encadrement);
CREATE INDEX IF NOT EXISTS idx_properties_surface_carrez ON properties(surface_carrez);

COMMIT;

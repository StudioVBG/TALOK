-- Migration: Ajouter les colonnes manquantes à la table properties
-- Cette migration ajoute toutes les colonnes V3 nécessaires si elles n'existent pas

BEGIN;

-- Colonnes de base V3
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS surface_habitable_m2 NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS nb_chambres INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loyer_hc NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loyer_base NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS type_bien TEXT,
  ADD COLUMN IF NOT EXISTS meuble BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS encadrement_loyers BOOLEAN DEFAULT false;

-- Colonnes chauffage
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS chauffage_type TEXT,
  ADD COLUMN IF NOT EXISTS chauffage_energie TEXT,
  ADD COLUMN IF NOT EXISTS eau_chaude_type TEXT,
  ADD COLUMN IF NOT EXISTS clim_presence TEXT,
  ADD COLUMN IF NOT EXISTS clim_type TEXT;

-- Colonnes géolocalisation
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Colonnes charges et financier (si manquantes)
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS charges_mensuelles NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS depot_garantie NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS zone_encadrement BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS loyer_reference_majoré NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS complement_loyer NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS complement_justification TEXT;

-- Colonnes état et workflow (si manquantes)
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS etat TEXT DEFAULT 'draft';

-- Synchroniser type_bien avec type pour les propriétés existantes
UPDATE properties 
SET type_bien = type 
WHERE type_bien IS NULL AND type IS NOT NULL;

-- Synchroniser surface_habitable_m2 avec surface pour les propriétés existantes
UPDATE properties 
SET surface_habitable_m2 = surface 
WHERE surface_habitable_m2 IS NULL AND surface IS NOT NULL AND surface > 0;

-- Synchroniser loyer_hc avec loyer_base si loyer_hc est vide
UPDATE properties 
SET loyer_hc = COALESCE(loyer_base, 0) 
WHERE loyer_hc IS NULL OR loyer_hc = 0;

COMMIT;


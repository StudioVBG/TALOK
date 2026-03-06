-- Add digicode and interphone text columns to properties table
-- These store the actual access codes/names for tenant display

ALTER TABLE properties ADD COLUMN IF NOT EXISTS digicode TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS interphone TEXT;

COMMENT ON COLUMN properties.digicode IS 'Code digicode de l''immeuble';
COMMENT ON COLUMN properties.interphone IS 'Nom/numéro interphone du logement';

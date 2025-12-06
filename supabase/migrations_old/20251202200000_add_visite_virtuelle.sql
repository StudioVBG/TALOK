-- ========================================
-- Migration: Ajouter le champ visite_virtuelle_url
-- ========================================

-- Ajouter la colonne pour stocker l'URL de la visite virtuelle (Matterport, Nodalview, etc.)
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS visite_virtuelle_url TEXT;

-- Commentaire pour documentation
COMMENT ON COLUMN properties.visite_virtuelle_url IS 'URL externe vers une visite virtuelle (Matterport, Nodalview, Previsite, etc.)';

-- Index pour recherche (optionnel, si on veut filtrer les biens avec visite virtuelle)
CREATE INDEX IF NOT EXISTS idx_properties_visite_virtuelle 
ON properties ((visite_virtuelle_url IS NOT NULL));


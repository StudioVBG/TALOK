-- Migration: Ajouter l'état "neuf" aux conditions d'éléments EDL
-- Date: 2026-01-05
-- Description: Ajoute "neuf" comme option de condition pour les éléments d'état des lieux

-- ============================================================================
-- 1. Mettre à jour la contrainte CHECK sur la colonne condition de edl_items
-- ============================================================================

-- Supprimer l'ancienne contrainte si elle existe
ALTER TABLE edl_items DROP CONSTRAINT IF EXISTS edl_items_condition_check;

-- Ajouter la nouvelle contrainte avec "neuf"
ALTER TABLE edl_items ADD CONSTRAINT edl_items_condition_check 
  CHECK (condition IN ('neuf', 'bon', 'moyen', 'mauvais', 'tres_mauvais'));

-- ============================================================================
-- 2. Ajouter un commentaire sur la colonne pour documentation
-- ============================================================================

COMMENT ON COLUMN edl_items.condition IS 'État de l''élément: neuf, bon, moyen, mauvais, tres_mauvais';

-- ============================================================================
-- 3. Confirmation
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Migration réussie: état "neuf" ajouté aux conditions EDL';
END $$;


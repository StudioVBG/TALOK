-- ============================================
-- Migration: Mise à jour contrainte type_piece pour rooms
-- Date: 2026-01-05
-- Description: Ajoute les nouveaux types de pièces V3 et pro/parking
-- ============================================

-- Supprimer l'ancienne contrainte
ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_type_piece_check;

-- Ajouter la nouvelle contrainte avec tous les types
ALTER TABLE rooms ADD CONSTRAINT rooms_type_piece_check 
  CHECK (type_piece IN (
    -- Types principaux habitation
    'sejour',
    'chambre',
    'cuisine',
    'salle_de_bain',
    'wc',
    'entree',
    'couloir',
    'balcon',
    'terrasse',
    'cave',
    'autre',
    -- Types additionnels V3
    'salon_cuisine',
    'bureau',
    'dressing',
    'suite_parentale',
    'mezzanine',
    'buanderie',
    'cellier',
    'jardin',
    -- Types pro/parking
    'stockage',
    'emplacement',
    'box'
  ));

COMMENT ON CONSTRAINT rooms_type_piece_check ON rooms IS 
'Types de pièces valides incluant habitation, V3 additionnels et pro/parking';


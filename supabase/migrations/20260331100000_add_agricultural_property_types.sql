-- ============================================
-- Migration: Ajouter les types agricoles au CHECK constraint properties
-- Alignement avec le skill SOTA 2026 (14 types)
-- Ref: .cursor/skills/sota-property-system/SKILL.md §1
-- ============================================

ALTER TABLE properties
  DROP CONSTRAINT IF EXISTS properties_type_check;

ALTER TABLE properties
  ADD CONSTRAINT properties_type_check
  CHECK (type IN (
    'appartement',
    'maison',
    'studio',
    'colocation',
    'saisonnier',
    'parking',
    'box',
    'local_commercial',
    'bureaux',
    'entrepot',
    'fonds_de_commerce',
    'immeuble',
    'terrain_agricole',
    'exploitation_agricole'
  ));

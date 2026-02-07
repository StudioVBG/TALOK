-- Migration: owner_profiles société data → legal_entities
-- Date: 2026-02-06
-- Purpose: For each owner_profiles row with type='societe' and raison_sociale set,
--          create a legal_entities row if none already exists, then link
--          properties and leases to the new entity.
--
-- SAFETY:
--   - Does NOT delete or modify existing owner_profiles columns
--   - Only creates legal_entities rows for owners who don't already have one
--   - Only sets legal_entity_id / signatory_entity_id where currently NULL
--   - Fully idempotent: safe to run multiple times

BEGIN;

-- ============================================
-- 1. Create legal_entities from owner_profiles
-- ============================================
-- Only for owners who:
--   a) Have type='societe' and raison_sociale filled
--   b) Don't already have a legal_entity row

INSERT INTO legal_entities (
  id,
  owner_profile_id,
  entity_type,
  nom,
  siret,
  forme_juridique,
  adresse_siege,
  numero_tva,
  is_active,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  op.profile_id,
  -- Map forme_juridique to entity_type
  CASE
    WHEN op.forme_juridique = 'SCI'  THEN 'sci_ir'
    WHEN op.forme_juridique = 'SARL' THEN 'sarl'
    WHEN op.forme_juridique = 'SAS'  THEN 'sas'
    WHEN op.forme_juridique = 'SASU' THEN 'sasu'
    WHEN op.forme_juridique = 'EURL' THEN 'eurl'
    WHEN op.forme_juridique = 'EI'   THEN 'eurl' -- closest match
    WHEN op.forme_juridique = 'SA'   THEN 'sa'
    WHEN op.forme_juridique = 'SCPI' THEN 'sci_ir' -- closest match
    ELSE 'sarl' -- default fallback
  END,
  op.raison_sociale,
  op.siret,
  op.forme_juridique,
  COALESCE(op.adresse_siege, op.adresse_facturation),
  NULL, -- owner_profiles n'a pas de colonne tva
  true,
  NOW(),
  NOW()
FROM owner_profiles op
WHERE op.type = 'societe'
  AND op.raison_sociale IS NOT NULL
  AND op.raison_sociale != ''
  AND NOT EXISTS (
    SELECT 1 FROM legal_entities le
    WHERE le.owner_profile_id = op.profile_id
      AND le.is_active = true
  );

-- ============================================
-- 2. Link properties to the new entity
-- ============================================
-- For properties owned by société owners where legal_entity_id is NULL

UPDATE properties p
SET legal_entity_id = le.id
FROM owner_profiles op
JOIN legal_entities le ON le.owner_profile_id = op.profile_id AND le.is_active = true
WHERE p.owner_id = op.profile_id
  AND p.legal_entity_id IS NULL
  AND op.type = 'societe'
  AND op.raison_sociale IS NOT NULL;

-- ============================================
-- 3. Link active leases to the new entity
-- ============================================
-- For leases on properties just linked, where signatory_entity_id is NULL

UPDATE leases l
SET signatory_entity_id = p.legal_entity_id
FROM properties p
WHERE l.property_id = p.id
  AND l.signatory_entity_id IS NULL
  AND p.legal_entity_id IS NOT NULL
  AND l.statut IN ('active', 'pending_signature', 'draft');

COMMIT;

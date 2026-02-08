-- Migration consolidée: Legal Entities - Application et cohérence
-- SOTA 2026 - S'assure que l'architecture multi-entités est complète et cohérente
-- IDEMPOTENT: Peut être exécuté plusieurs fois sans erreur

BEGIN;

-- ============================================
-- 1. Vérification / Création des tables de base
-- ============================================
-- (Les tables sont créées par 20260115000000_multi_entity_architecture.sql)
-- Cette migration ne fait que s'assurer de la cohérence et des compléments

-- Colonne entity_id sur documents (référence GED → legal_entities)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS entity_id UUID REFERENCES legal_entities(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_documents_entity_id ON documents(entity_id) WHERE entity_id IS NOT NULL;

-- ============================================
-- 2. Index supplémentaires pour performance
-- ============================================

-- Index composite pour requêtes filtrées (owner + actif)
CREATE INDEX IF NOT EXISTS idx_legal_entities_owner_active
  ON legal_entities(owner_profile_id) WHERE is_active = true;

-- ============================================
-- 3. Contraintes de cohérence
-- ============================================
-- S'assure que les propriétés ont soit legal_entity_id soit restent sur owner_id legacy

DO $$
BEGIN
  -- Vérifier que detention_mode est bien défini pour les propriétés avec legal_entity_id
  UPDATE properties
  SET detention_mode = COALESCE(detention_mode, 'societe')
  WHERE legal_entity_id IS NOT NULL
    AND (detention_mode IS NULL OR detention_mode = 'direct');

  -- Pour les propriétés sans legal_entity_id, garder 'direct'
  UPDATE properties
  SET detention_mode = COALESCE(detention_mode, 'direct')
  WHERE legal_entity_id IS NULL
    AND detention_mode IS NULL;
END $$;

-- ============================================
-- 4. Backfill: entités par défaut manquantes
-- ============================================

INSERT INTO legal_entities (
  owner_profile_id,
  entity_type,
  nom,
  regime_fiscal,
  is_active,
  siret,
  adresse_siege,
  iban
)
SELECT
  op.profile_id,
  CASE
    WHEN op.type = 'societe' THEN 'sci_ir'
    ELSE 'particulier'
  END,
  COALESCE(
    op.raison_sociale,
    (SELECT CONCAT(p.prenom, ' ', p.nom) FROM profiles p WHERE p.id = op.profile_id),
    'Patrimoine personnel'
  ),
  'ir',
  true,
  op.siret,
  op.adresse_facturation,
  op.iban
FROM owner_profiles op
WHERE NOT EXISTS (
  SELECT 1 FROM legal_entities le
  WHERE le.owner_profile_id = op.profile_id
);

-- Lier les propriétés orphelines à l'entité par défaut du propriétaire
UPDATE properties p
SET legal_entity_id = (
  SELECT le.id
  FROM legal_entities le
  WHERE le.owner_profile_id = p.owner_id
  ORDER BY le.created_at ASC
  LIMIT 1
),
detention_mode = COALESCE(p.detention_mode, 'direct')
WHERE p.legal_entity_id IS NULL
  AND EXISTS (
    SELECT 1 FROM legal_entities le
    WHERE le.owner_profile_id = p.owner_id
  );

-- Créer property_ownership manquants pour les propriétés liées à une entité
INSERT INTO property_ownership (
  property_id,
  legal_entity_id,
  profile_id,
  quote_part_numerateur,
  quote_part_denominateur,
  detention_type,
  date_acquisition,
  mode_acquisition,
  is_current
)
SELECT
  p.id,
  p.legal_entity_id,
  NULL,
  1,
  1,
  'pleine_propriete',
  p.created_at::DATE,
  'achat',
  true
FROM properties p
WHERE p.legal_entity_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM property_ownership po
    WHERE po.property_id = p.id
  );

COMMIT;

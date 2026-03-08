-- ============================================
-- Migration: Ajout status sur legal_entities + anti-doublons + déduplication
-- Date: 2026-03-09
-- Description:
--   1. Ajout colonne `status` ('draft','active','archived') avec sync `is_active`
--   2. Index partiel anti-doublons pour entités sans SIRET
--   3. Fonction admin de déduplication des entités
-- ============================================

BEGIN;

-- ============================================
-- 1. Ajout de la colonne `status`
-- ============================================

ALTER TABLE legal_entities
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('draft', 'active', 'archived'));

-- Backfill des valeurs existantes
UPDATE legal_entities SET status = 'active'  WHERE is_active = true  AND status IS DISTINCT FROM 'active';
UPDATE legal_entities SET status = 'archived' WHERE is_active = false AND status IS DISTINCT FROM 'archived';

-- Index sur status
CREATE INDEX IF NOT EXISTS idx_legal_entities_status ON legal_entities(status);

-- ============================================
-- 2. Trigger de synchronisation is_active <-> status
-- ============================================

CREATE OR REPLACE FUNCTION sync_entity_status_and_is_active()
RETURNS TRIGGER AS $$
BEGIN
  -- Si status a changé, mettre à jour is_active
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.is_active := (NEW.status = 'active');
  -- Si is_active a changé mais pas status, mettre à jour status
  ELSIF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    IF NEW.is_active THEN
      NEW.status := 'active';
    ELSE
      NEW.status := 'archived';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_entity_status ON legal_entities;
CREATE TRIGGER trg_sync_entity_status
  BEFORE INSERT OR UPDATE ON legal_entities
  FOR EACH ROW
  EXECUTE FUNCTION sync_entity_status_and_is_active();

-- ============================================
-- 3. Index partiel anti-doublons (entités sans SIRET)
-- ============================================
-- Empêche de créer deux entités actives avec le même (owner, type, nom)
-- quand aucun SIRET n'est renseigné (typiquement les "particulier")

CREATE UNIQUE INDEX IF NOT EXISTS idx_legal_entities_no_siret_unique
  ON legal_entities(owner_profile_id, entity_type, nom)
  WHERE siret IS NULL AND status = 'active';

-- ============================================
-- 4. Fonction de déduplication admin
-- ============================================

CREATE OR REPLACE FUNCTION admin_deduplicate_entities(p_owner_profile_id UUID)
RETURNS TABLE(deleted_count INTEGER, reassigned_properties INTEGER, reassigned_leases INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted INTEGER := 0;
  v_reassigned_props INTEGER := 0;
  v_reassigned_leases INTEGER := 0;
  v_group RECORD;
  v_keep_id UUID;
  v_dup RECORD;
  v_props_moved INTEGER;
  v_leases_moved INTEGER;
BEGIN
  -- Pour chaque groupe de doublons (même owner, type, nom, tous actifs)
  FOR v_group IN
    SELECT le.owner_profile_id, le.entity_type, le.nom, COUNT(*) AS cnt
    FROM legal_entities le
    WHERE le.owner_profile_id = p_owner_profile_id
      AND le.status = 'active'
      AND le.siret IS NULL
    GROUP BY le.owner_profile_id, le.entity_type, le.nom
    HAVING COUNT(*) > 1
  LOOP
    -- Garder la plus ancienne (created_at ASC)
    SELECT id INTO v_keep_id
    FROM legal_entities
    WHERE owner_profile_id = v_group.owner_profile_id
      AND entity_type = v_group.entity_type
      AND nom = v_group.nom
      AND status = 'active'
      AND siret IS NULL
    ORDER BY created_at ASC
    LIMIT 1;

    -- Pour chaque doublon (hors la gardée)
    FOR v_dup IN
      SELECT id FROM legal_entities
      WHERE owner_profile_id = v_group.owner_profile_id
        AND entity_type = v_group.entity_type
        AND nom = v_group.nom
        AND status = 'active'
        AND siret IS NULL
        AND id != v_keep_id
    LOOP
      -- Réassigner les propriétés orphelines
      UPDATE properties
      SET legal_entity_id = v_keep_id
      WHERE legal_entity_id = v_dup.id
        AND deleted_at IS NULL;
      GET DIAGNOSTICS v_props_moved = ROW_COUNT;
      v_reassigned_props := v_reassigned_props + v_props_moved;

      -- Réassigner les property_ownership
      UPDATE property_ownership
      SET legal_entity_id = v_keep_id
      WHERE legal_entity_id = v_dup.id;

      -- Réassigner les baux
      UPDATE leases
      SET signatory_entity_id = v_keep_id
      WHERE signatory_entity_id = v_dup.id;
      GET DIAGNOSTICS v_leases_moved = ROW_COUNT;
      v_reassigned_leases := v_reassigned_leases + v_leases_moved;

      -- Réassigner les factures
      UPDATE invoices
      SET issuer_entity_id = v_keep_id
      WHERE issuer_entity_id = v_dup.id;

      -- Supprimer les associés du doublon
      DELETE FROM entity_associates WHERE legal_entity_id = v_dup.id;

      -- Supprimer le doublon
      DELETE FROM legal_entities WHERE id = v_dup.id;
      v_deleted := v_deleted + 1;
    END LOOP;
  END LOOP;

  RETURN QUERY SELECT v_deleted, v_reassigned_props, v_reassigned_leases;
END;
$$;

COMMIT;

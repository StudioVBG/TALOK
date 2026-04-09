-- ============================================
-- Migration : FK building_unit_id sur leases et documents
-- Sprint 2+3 : Permettre baux et documents par lot d'immeuble
-- ============================================

-- 1. FK leases → building_units
-- ============================================
ALTER TABLE leases
  ADD COLUMN IF NOT EXISTS building_unit_id UUID
    REFERENCES building_units(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leases_building_unit_id
  ON leases(building_unit_id) WHERE building_unit_id IS NOT NULL;

COMMENT ON COLUMN leases.building_unit_id IS
  'Lot d''immeuble associé (si le bail concerne un lot spécifique)';

-- 2. FK documents → building_units
-- ============================================
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS building_unit_id UUID
    REFERENCES building_units(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_documents_building_unit_id
  ON documents(building_unit_id) WHERE building_unit_id IS NOT NULL;

COMMENT ON COLUMN documents.building_unit_id IS
  'Lot d''immeuble associé (diagnostics lot, bail lot, EDL lot)';

-- 3. Colonne parent_property_id sur properties
-- ============================================
-- Les properties créées pour des lots d'immeuble pointent vers la property parent (type=immeuble).
-- Permet de les exclure de "Mes biens" et de les rattacher à l'immeuble.
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS parent_property_id UUID
    REFERENCES properties(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_properties_parent_property
  ON properties(parent_property_id) WHERE parent_property_id IS NOT NULL;

COMMENT ON COLUMN properties.parent_property_id IS
  'Si non-null, cette property est un lot d''immeuble rattaché à la property parent';

-- 4. Mise à jour building_units.status depuis les baux actifs
-- ============================================
-- Quand un bail actif est lié à un lot, le lot passe en "occupe"
CREATE OR REPLACE FUNCTION sync_building_unit_status_from_lease()
RETURNS TRIGGER AS $$
BEGIN
  -- Bail activé → lot occupé
  IF NEW.statut = 'active' AND NEW.building_unit_id IS NOT NULL THEN
    UPDATE building_units
    SET status = 'occupe', current_lease_id = NEW.id
    WHERE id = NEW.building_unit_id;
  END IF;

  -- Bail terminé → lot vacant
  IF NEW.statut IN ('terminated', 'archived', 'cancelled')
     AND OLD.statut = 'active'
     AND NEW.building_unit_id IS NOT NULL THEN
    UPDATE building_units
    SET status = 'vacant', current_lease_id = NULL
    WHERE id = NEW.building_unit_id AND current_lease_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_unit_status_on_lease ON leases;
CREATE TRIGGER trigger_sync_unit_status_on_lease
  AFTER UPDATE ON leases
  FOR EACH ROW
  WHEN (OLD.statut IS DISTINCT FROM NEW.statut)
  EXECUTE FUNCTION sync_building_unit_status_from_lease();

-- ============================================
-- GAP-002: Inventaire meublé pour EDL
-- Décret n°2015-981 du 31/07/2015
-- ============================================
--
-- Cette migration crée la table pour stocker l'inventaire du mobilier
-- lors des états des lieux pour les baux meublés et mobilité.
--
-- Référence légale:
-- "L'état des lieux doit être accompagné d'un inventaire détaillé du mobilier"
-- - Décret n°2015-981 du 31 juillet 2015

-- Type enum pour les catégories de mobilier
CREATE TYPE furniture_category AS ENUM (
  'literie',
  'occultation',
  'cuisine',
  'rangement',
  'luminaire',
  'vaisselle',
  'entretien'
);

-- Type enum pour l'état du mobilier
CREATE TYPE furniture_condition AS ENUM (
  'neuf',
  'tres_bon',
  'bon',
  'usage',
  'mauvais',
  'absent'
);

-- Table principale des inventaires de mobilier
CREATE TABLE IF NOT EXISTS furniture_inventories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edl_id UUID NOT NULL REFERENCES etats_des_lieux(id) ON DELETE CASCADE,
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('entree', 'sortie')),
  is_complete BOOLEAN DEFAULT FALSE,
  total_items INTEGER DEFAULT 0,
  items_present INTEGER DEFAULT 0,
  items_missing INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(edl_id) -- Un seul inventaire par EDL
);

-- Table des items de mobilier
CREATE TABLE IF NOT EXISTS furniture_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID NOT NULL REFERENCES furniture_inventories(id) ON DELETE CASCADE,
  category furniture_category NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  legal_requirement TEXT, -- Référence légale (ex: "Décret 2015-981 Art.2 - 1°")
  is_mandatory BOOLEAN DEFAULT FALSE,
  quantity INTEGER DEFAULT 1,
  condition furniture_condition NOT NULL DEFAULT 'bon',
  notes TEXT,
  photos TEXT[], -- URLs des photos
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour les requêtes fréquentes
CREATE INDEX idx_furniture_inventories_edl_id ON furniture_inventories(edl_id);
CREATE INDEX idx_furniture_inventories_lease_id ON furniture_inventories(lease_id);
CREATE INDEX idx_furniture_items_inventory_id ON furniture_items(inventory_id);
CREATE INDEX idx_furniture_items_category ON furniture_items(category);
CREATE INDEX idx_furniture_items_condition ON furniture_items(condition);

-- Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_furniture_inventory_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_furniture_inventories_updated_at
  BEFORE UPDATE ON furniture_inventories
  FOR EACH ROW
  EXECUTE FUNCTION update_furniture_inventory_updated_at();

CREATE TRIGGER trigger_furniture_items_updated_at
  BEFORE UPDATE ON furniture_items
  FOR EACH ROW
  EXECUTE FUNCTION update_furniture_inventory_updated_at();

-- Trigger pour calculer automatiquement les compteurs de l'inventaire
CREATE OR REPLACE FUNCTION update_inventory_counts()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE furniture_inventories
  SET
    total_items = (
      SELECT COUNT(*) FROM furniture_items WHERE inventory_id = COALESCE(NEW.inventory_id, OLD.inventory_id)
    ),
    items_present = (
      SELECT COUNT(*) FROM furniture_items
      WHERE inventory_id = COALESCE(NEW.inventory_id, OLD.inventory_id)
      AND condition != 'absent'
    ),
    items_missing = (
      SELECT COUNT(*) FROM furniture_items
      WHERE inventory_id = COALESCE(NEW.inventory_id, OLD.inventory_id)
      AND condition = 'absent'
      AND is_mandatory = TRUE
    ),
    is_complete = (
      SELECT NOT EXISTS (
        SELECT 1 FROM furniture_items
        WHERE inventory_id = COALESCE(NEW.inventory_id, OLD.inventory_id)
        AND condition = 'absent'
        AND is_mandatory = TRUE
      )
    )
  WHERE id = COALESCE(NEW.inventory_id, OLD.inventory_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_inventory_counts_insert
  AFTER INSERT ON furniture_items
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_counts();

CREATE TRIGGER trigger_update_inventory_counts_update
  AFTER UPDATE ON furniture_items
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_counts();

CREATE TRIGGER trigger_update_inventory_counts_delete
  AFTER DELETE ON furniture_items
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_counts();

-- RLS Policies
ALTER TABLE furniture_inventories ENABLE ROW LEVEL SECURITY;
ALTER TABLE furniture_items ENABLE ROW LEVEL SECURITY;

-- Policy: Les propriétaires peuvent gérer les inventaires de leurs baux
CREATE POLICY furniture_inventories_owner_policy ON furniture_inventories
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON l.property_id = p.id
      WHERE l.id = furniture_inventories.lease_id
      AND p.owner_id = auth.uid()
    )
  );

-- Policy: Les locataires peuvent voir les inventaires de leurs baux
CREATE POLICY furniture_inventories_tenant_policy ON furniture_inventories
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM leases l
      WHERE l.id = furniture_inventories.lease_id
      AND l.tenant_id = auth.uid()
    )
  );

-- Policy: Les propriétaires peuvent gérer les items de leurs inventaires
CREATE POLICY furniture_items_owner_policy ON furniture_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM furniture_inventories fi
      JOIN leases l ON fi.lease_id = l.id
      JOIN properties p ON l.property_id = p.id
      WHERE fi.id = furniture_items.inventory_id
      AND p.owner_id = auth.uid()
    )
  );

-- Policy: Les locataires peuvent voir les items de leurs inventaires
CREATE POLICY furniture_items_tenant_policy ON furniture_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM furniture_inventories fi
      JOIN leases l ON fi.lease_id = l.id
      WHERE fi.id = furniture_items.inventory_id
      AND l.tenant_id = auth.uid()
    )
  );

-- Commentaires
COMMENT ON TABLE furniture_inventories IS 'Inventaires de mobilier pour EDL (Décret 2015-981)';
COMMENT ON TABLE furniture_items IS 'Items de mobilier dans les inventaires';
COMMENT ON COLUMN furniture_items.legal_requirement IS 'Référence légale de l''obligation (ex: Décret 2015-981 Art.2)';
COMMENT ON COLUMN furniture_items.is_mandatory IS 'Si true, l''item est obligatoire selon le décret';

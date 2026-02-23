-- ============================================
-- Migration : Support des Immeubles (Buildings) SOTA 2026
-- 
-- Cette migration ajoute le support complet pour la gestion 
-- d'immeubles entiers avec plusieurs lots/unités.
-- ============================================

-- 1. Ajout du type "immeuble" dans properties
-- ============================================

-- Supprimer l'ancienne contrainte si elle existe
ALTER TABLE properties 
  DROP CONSTRAINT IF EXISTS properties_type_check;

-- Ajouter la nouvelle contrainte avec "immeuble"
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
    'immeuble'  -- NOUVEAU SOTA 2026
  ));

-- 2. Table buildings (Immeubles)
-- ============================================
-- La table buildings peut déjà exister (module copropriété, migration 20251208).
-- On ajoute les colonnes manquantes pour le support immeuble locatif.

CREATE TABLE IF NOT EXISTS buildings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  name TEXT NOT NULL DEFAULT 'Immeuble',
  adresse_complete TEXT,
  code_postal TEXT,
  ville TEXT,
  departement TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  floors INTEGER DEFAULT 1,
  construction_year INTEGER,
  surface_totale DECIMAL(10, 2),
  has_ascenseur BOOLEAN DEFAULT false,
  has_gardien BOOLEAN DEFAULT false,
  has_interphone BOOLEAN DEFAULT false,
  has_digicode BOOLEAN DEFAULT false,
  has_local_velo BOOLEAN DEFAULT false,
  has_local_poubelles BOOLEAN DEFAULT false,
  has_parking_commun BOOLEAN DEFAULT false,
  has_jardin_commun BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ajouter les colonnes manquantes si la table existait déjà
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id) ON DELETE SET NULL;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS adresse_complete TEXT;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS code_postal TEXT;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS ville TEXT;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS departement TEXT;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8);
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS floors INTEGER DEFAULT 1;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS surface_totale DECIMAL(10, 2);
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS has_ascenseur BOOLEAN DEFAULT false;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS has_gardien BOOLEAN DEFAULT false;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS has_interphone BOOLEAN DEFAULT false;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS has_digicode BOOLEAN DEFAULT false;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS has_local_velo BOOLEAN DEFAULT false;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS has_local_poubelles BOOLEAN DEFAULT false;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS has_parking_commun BOOLEAN DEFAULT false;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS has_jardin_commun BOOLEAN DEFAULT false;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS notes TEXT;

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_buildings_owner ON buildings(owner_id);
CREATE INDEX IF NOT EXISTS idx_buildings_property ON buildings(property_id);
CREATE INDEX IF NOT EXISTS idx_buildings_ville ON buildings(ville);
CREATE INDEX IF NOT EXISTS idx_buildings_code_postal ON buildings(code_postal);

-- 3. Table building_units (Lots d'un immeuble)
-- ============================================

CREATE TABLE IF NOT EXISTS building_units (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  building_id UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  
  -- Position dans l'immeuble
  floor INTEGER NOT NULL DEFAULT 0 CHECK (floor >= -5 AND floor <= 50),
  position TEXT NOT NULL DEFAULT 'A',
  
  -- Type et caractéristiques
  type TEXT NOT NULL CHECK (type IN (
    'appartement', 
    'studio', 
    'local_commercial', 
    'parking', 
    'cave', 
    'bureau'
  )),
  template TEXT CHECK (template IN (
    'studio', 't1', 't2', 't3', 't4', 't5', 
    'local', 'parking', 'cave'
  )),
  
  surface DECIMAL(8, 2) NOT NULL CHECK (surface > 0),
  nb_pieces INTEGER DEFAULT 1 CHECK (nb_pieces >= 0),
  
  -- Conditions de location
  loyer_hc DECIMAL(10, 2) DEFAULT 0 CHECK (loyer_hc >= 0),
  charges DECIMAL(10, 2) DEFAULT 0 CHECK (charges >= 0),
  depot_garantie DECIMAL(10, 2) DEFAULT 0 CHECK (depot_garantie >= 0),
  
  -- Statut
  status TEXT DEFAULT 'vacant' CHECK (status IN (
    'vacant', 
    'occupe', 
    'travaux', 
    'reserve'
  )),
  
  -- Liaison avec bail actif (optionnel)
  current_lease_id UUID REFERENCES leases(id) ON DELETE SET NULL,
  
  -- Métadonnées
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Contrainte d'unicité : un seul lot par position/étage/immeuble
  UNIQUE(building_id, floor, position)
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_building_units_building ON building_units(building_id);
CREATE INDEX IF NOT EXISTS idx_building_units_status ON building_units(status);
CREATE INDEX IF NOT EXISTS idx_building_units_type ON building_units(type);
CREATE INDEX IF NOT EXISTS idx_building_units_floor ON building_units(floor);
CREATE INDEX IF NOT EXISTS idx_building_units_lease ON building_units(current_lease_id);

-- 4. Vue pour statistiques des immeubles
-- ============================================

CREATE OR REPLACE VIEW building_stats AS
SELECT 
  b.id,
  b.name,
  b.owner_id,
  b.adresse_complete,
  b.ville,
  b.floors,
  
  -- Comptages par type
  COUNT(bu.id) FILTER (WHERE bu.type NOT IN ('parking', 'cave')) as total_units,
  COUNT(bu.id) FILTER (WHERE bu.type = 'parking') as total_parkings,
  COUNT(bu.id) FILTER (WHERE bu.type = 'cave') as total_caves,
  
  -- Surface
  COALESCE(SUM(bu.surface), 0) as surface_totale,
  
  -- Revenus
  COALESCE(SUM(bu.loyer_hc + bu.charges), 0) as revenus_potentiels,
  COALESCE(SUM(bu.loyer_hc + bu.charges) FILTER (WHERE bu.status = 'occupe'), 0) as revenus_actuels,
  
  -- Taux d'occupation (uniquement logements, pas parking/cave)
  ROUND(
    COUNT(bu.id) FILTER (WHERE bu.status = 'occupe' AND bu.type NOT IN ('parking', 'cave'))::DECIMAL / 
    NULLIF(COUNT(bu.id) FILTER (WHERE bu.type NOT IN ('parking', 'cave')), 0) * 100, 
    1
  ) as occupancy_rate,
  
  -- Comptages par statut
  COUNT(bu.id) FILTER (WHERE bu.status = 'vacant' AND bu.type NOT IN ('parking', 'cave')) as vacant_units,
  COUNT(bu.id) FILTER (WHERE bu.status = 'occupe' AND bu.type NOT IN ('parking', 'cave')) as occupied_units,
  COUNT(bu.id) FILTER (WHERE bu.status = 'travaux') as units_en_travaux

FROM buildings b
LEFT JOIN building_units bu ON bu.building_id = b.id
GROUP BY b.id;

-- 5. Triggers pour mise à jour automatique
-- ============================================

-- Trigger pour updated_at sur buildings
CREATE OR REPLACE FUNCTION update_buildings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_buildings_updated_at ON buildings;
CREATE TRIGGER trigger_buildings_updated_at
  BEFORE UPDATE ON buildings
  FOR EACH ROW
  EXECUTE FUNCTION update_buildings_updated_at();

-- Trigger pour updated_at sur building_units
DROP TRIGGER IF EXISTS trigger_building_units_updated_at ON building_units;
CREATE TRIGGER trigger_building_units_updated_at
  BEFORE UPDATE ON building_units
  FOR EACH ROW
  EXECUTE FUNCTION update_buildings_updated_at();

-- 6. Row Level Security (RLS)
-- ============================================

ALTER TABLE buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE building_units ENABLE ROW LEVEL SECURITY;

-- Policies pour buildings
DROP POLICY IF EXISTS "Owners can view their buildings" ON buildings;
CREATE POLICY "Owners can view their buildings" ON buildings
  FOR SELECT USING (
    owner_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Owners can create buildings" ON buildings;
CREATE POLICY "Owners can create buildings" ON buildings
  FOR INSERT WITH CHECK (
    owner_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Owners can update their buildings" ON buildings;
CREATE POLICY "Owners can update their buildings" ON buildings
  FOR UPDATE USING (
    owner_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Owners can delete their buildings" ON buildings;
CREATE POLICY "Owners can delete their buildings" ON buildings
  FOR DELETE USING (
    owner_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Policies pour building_units
DROP POLICY IF EXISTS "Owners can view their building units" ON building_units;
CREATE POLICY "Owners can view their building units" ON building_units
  FOR SELECT USING (
    building_id IN (
      SELECT id FROM buildings 
      WHERE owner_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Owners can create building units" ON building_units;
CREATE POLICY "Owners can create building units" ON building_units
  FOR INSERT WITH CHECK (
    building_id IN (
      SELECT id FROM buildings 
      WHERE owner_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Owners can update their building units" ON building_units;
CREATE POLICY "Owners can update their building units" ON building_units
  FOR UPDATE USING (
    building_id IN (
      SELECT id FROM buildings 
      WHERE owner_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Owners can delete their building units" ON building_units;
CREATE POLICY "Owners can delete their building units" ON building_units
  FOR DELETE USING (
    building_id IN (
      SELECT id FROM buildings 
      WHERE owner_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- 7. Fonctions utilitaires
-- ============================================

-- Fonction pour calculer les stats d'un immeuble
CREATE OR REPLACE FUNCTION get_building_stats(p_building_id UUID)
RETURNS TABLE (
  total_units INTEGER,
  total_parkings INTEGER,
  total_caves INTEGER,
  surface_totale DECIMAL,
  revenus_potentiels DECIMAL,
  revenus_actuels DECIMAL,
  occupancy_rate DECIMAL,
  vacant_units INTEGER,
  occupied_units INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(bu.id) FILTER (WHERE bu.type NOT IN ('parking', 'cave'))::INTEGER,
    COUNT(bu.id) FILTER (WHERE bu.type = 'parking')::INTEGER,
    COUNT(bu.id) FILTER (WHERE bu.type = 'cave')::INTEGER,
    COALESCE(SUM(bu.surface), 0)::DECIMAL,
    COALESCE(SUM(bu.loyer_hc + bu.charges), 0)::DECIMAL,
    COALESCE(SUM(bu.loyer_hc + bu.charges) FILTER (WHERE bu.status = 'occupe'), 0)::DECIMAL,
    ROUND(
      COUNT(bu.id) FILTER (WHERE bu.status = 'occupe' AND bu.type NOT IN ('parking', 'cave'))::DECIMAL / 
      NULLIF(COUNT(bu.id) FILTER (WHERE bu.type NOT IN ('parking', 'cave')), 0) * 100, 
      1
    )::DECIMAL,
    COUNT(bu.id) FILTER (WHERE bu.status = 'vacant' AND bu.type NOT IN ('parking', 'cave'))::INTEGER,
    COUNT(bu.id) FILTER (WHERE bu.status = 'occupe' AND bu.type NOT IN ('parking', 'cave'))::INTEGER
  FROM building_units bu
  WHERE bu.building_id = p_building_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- Fonction pour dupliquer un lot sur plusieurs étages
CREATE OR REPLACE FUNCTION duplicate_unit_to_floors(
  p_unit_id UUID,
  p_target_floors INTEGER[]
)
RETURNS SETOF building_units AS $$
DECLARE
  v_unit building_units;
  v_floor INTEGER;
  v_position TEXT;
  v_new_unit building_units;
BEGIN
  -- Récupérer le lot source
  SELECT * INTO v_unit FROM building_units WHERE id = p_unit_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unit not found: %', p_unit_id;
  END IF;
  
  -- Dupliquer sur chaque étage cible
  FOREACH v_floor IN ARRAY p_target_floors
  LOOP
    -- Calculer la prochaine position disponible
    SELECT COALESCE(
      CHR(65 + COUNT(*)::INTEGER), 
      'A'
    ) INTO v_position
    FROM building_units 
    WHERE building_id = v_unit.building_id AND floor = v_floor;
    
    -- Insérer le nouveau lot
    INSERT INTO building_units (
      building_id, floor, position, type, template, 
      surface, nb_pieces, loyer_hc, charges, depot_garantie, status
    ) VALUES (
      v_unit.building_id, v_floor, v_position, v_unit.type, v_unit.template,
      v_unit.surface, v_unit.nb_pieces, v_unit.loyer_hc, v_unit.charges, 
      v_unit.depot_garantie, 'vacant'
    )
    RETURNING * INTO v_new_unit;
    
    RETURN NEXT v_new_unit;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql;

-- 8. Commentaires de documentation
-- ============================================

COMMENT ON TABLE buildings IS 'Immeubles entiers avec plusieurs lots/unités (SOTA 2026)';
COMMENT ON TABLE building_units IS 'Lots individuels appartenant à un immeuble';
COMMENT ON VIEW building_stats IS 'Vue agrégée des statistiques par immeuble';
COMMENT ON FUNCTION get_building_stats IS 'Calcule les stats détaillées d''un immeuble';
COMMENT ON FUNCTION duplicate_unit_to_floors IS 'Duplique un lot sur plusieurs étages';


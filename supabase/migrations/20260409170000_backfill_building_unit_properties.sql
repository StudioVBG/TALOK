-- ============================================
-- Migration : Compléter le schéma buildings + backfill lots
--
-- La table buildings existait depuis la migration copropriété (20251208)
-- avec un schéma minimal (site_id, name, code, floors_count, has_elevator).
-- Cette migration ajoute les colonnes nécessaires pour le module immeuble
-- locatif (property_id, owner_id, adresse, amenities) puis crée les
-- properties individuelles pour chaque lot.
-- ============================================

-- ============================================
-- 1. Colonnes manquantes sur buildings
-- ============================================
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

CREATE INDEX IF NOT EXISTS idx_buildings_owner ON buildings(owner_id);
CREATE INDEX IF NOT EXISTS idx_buildings_property ON buildings(property_id);
CREATE INDEX IF NOT EXISTS idx_buildings_ville ON buildings(ville);
CREATE INDEX IF NOT EXISTS idx_buildings_code_postal ON buildings(code_postal);

-- ============================================
-- 2. Table building_units si elle n'existe pas
-- ============================================
CREATE TABLE IF NOT EXISTS building_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  floor INTEGER NOT NULL DEFAULT 0 CHECK (floor >= -5 AND floor <= 50),
  position TEXT NOT NULL DEFAULT 'A',
  type TEXT NOT NULL CHECK (type IN (
    'appartement', 'studio', 'local_commercial', 'parking', 'cave', 'bureau'
  )),
  template TEXT CHECK (template IN (
    'studio', 't1', 't2', 't3', 't4', 't5', 'local', 'parking', 'cave'
  )),
  surface DECIMAL(8, 2) NOT NULL CHECK (surface > 0),
  nb_pieces INTEGER DEFAULT 1 CHECK (nb_pieces >= 0),
  loyer_hc DECIMAL(10, 2) DEFAULT 0 CHECK (loyer_hc >= 0),
  charges DECIMAL(10, 2) DEFAULT 0 CHECK (charges >= 0),
  depot_garantie DECIMAL(10, 2) DEFAULT 0 CHECK (depot_garantie >= 0),
  status TEXT DEFAULT 'vacant' CHECK (status IN ('vacant', 'occupe', 'travaux', 'reserve')),
  current_lease_id UUID REFERENCES leases(id) ON DELETE SET NULL,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(building_id, floor, position)
);

-- Colonnes manquantes sur building_units si la table existait déjà
ALTER TABLE building_units ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id) ON DELETE SET NULL;
ALTER TABLE building_units ADD COLUMN IF NOT EXISTS template TEXT;
ALTER TABLE building_units ADD COLUMN IF NOT EXISTS loyer_hc DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE building_units ADD COLUMN IF NOT EXISTS charges DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE building_units ADD COLUMN IF NOT EXISTS depot_garantie DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE building_units ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'vacant';
ALTER TABLE building_units ADD COLUMN IF NOT EXISTS current_lease_id UUID REFERENCES leases(id) ON DELETE SET NULL;
ALTER TABLE building_units ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE INDEX IF NOT EXISTS idx_building_units_building ON building_units(building_id);
CREATE INDEX IF NOT EXISTS idx_building_units_property ON building_units(property_id);
CREATE INDEX IF NOT EXISTS idx_building_units_status ON building_units(status);

-- ============================================
-- 3. Triggers updated_at
-- ============================================
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

DROP TRIGGER IF EXISTS trigger_building_units_updated_at ON building_units;
CREATE TRIGGER trigger_building_units_updated_at
  BEFORE UPDATE ON building_units
  FOR EACH ROW
  EXECUTE FUNCTION update_buildings_updated_at();

-- ============================================
-- 4. RLS
-- ============================================
ALTER TABLE buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE building_units ENABLE ROW LEVEL SECURITY;

-- Service role bypass (pour les API routes)
DROP POLICY IF EXISTS "Service role full access buildings" ON buildings;
CREATE POLICY "Service role full access buildings" ON buildings
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access building_units" ON building_units;
CREATE POLICY "Service role full access building_units" ON building_units
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 5. Backfill : property par lot (si des lots existent)
-- ============================================

-- Fonction utilitaire temporaire
CREATE OR REPLACE FUNCTION _gen_prop_code()
RETURNS TEXT AS $$
DECLARE
  charset TEXT := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  result TEXT;
  i INT;
BEGIN
  LOOP
    result := 'PROP-';
    FOR i IN 1..4 LOOP
      result := result || substr(charset, floor(random() * length(charset) + 1)::int, 1);
    END LOOP;
    result := result || '-';
    FOR i IN 1..4 LOOP
      result := result || substr(charset, floor(random() * length(charset) + 1)::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM properties WHERE unique_code = result);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  rec RECORD;
  new_pid UUID;
  new_code TEXT;
  pp RECORD;
  lot_addr TEXT;
  fl TEXT;
BEGIN
  -- Parcourir building_units sans property_id, reliés à un building ayant property_id
  FOR rec IN
    SELECT
      bu.id AS unit_id, bu.building_id, bu.floor, bu.position,
      bu.type, bu.surface, bu.nb_pieces, bu.loyer_hc, bu.charges,
      bu.depot_garantie, bu.status,
      b.property_id AS parent_pid, b.has_ascenseur
    FROM building_units bu
    JOIN buildings b ON b.id = bu.building_id
    WHERE bu.property_id IS NULL
      AND b.property_id IS NOT NULL
  LOOP
    -- Parent property
    SELECT owner_id, legal_entity_id, adresse_complete, code_postal, ville, departement, etat
    INTO pp FROM properties WHERE id = rec.parent_pid;

    IF pp IS NULL THEN CONTINUE; END IF;

    -- Floor label
    IF rec.floor < 0 THEN fl := 'SS' || abs(rec.floor);
    ELSIF rec.floor = 0 THEN fl := 'RDC';
    ELSE fl := 'Étage ' || rec.floor;
    END IF;

    lot_addr := COALESCE(pp.adresse_complete, '') || ' - Lot ' || rec.position || ', ' || fl;
    new_code := _gen_prop_code();

    INSERT INTO properties (
      owner_id, legal_entity_id, parent_property_id, type, etat, unique_code,
      adresse_complete, code_postal, ville, departement,
      surface, nb_pieces, nb_chambres, ascenseur, meuble, loyer_hc, charges_mensuelles
    ) VALUES (
      pp.owner_id, pp.legal_entity_id, rec.parent_pid, rec.type,
      CASE WHEN pp.etat = 'published' THEN 'published' ELSE 'draft' END,
      new_code, lot_addr,
      COALESCE(pp.code_postal, ''), COALESCE(pp.ville, ''), COALESCE(pp.departement, ''),
      rec.surface, rec.nb_pieces, 0,
      COALESCE(rec.has_ascenseur, false),
      rec.type IN ('studio', 'local_commercial'),
      COALESCE(rec.loyer_hc, 0), COALESCE(rec.charges, 0)
    ) RETURNING id INTO new_pid;

    UPDATE building_units SET property_id = new_pid WHERE id = rec.unit_id;
    RAISE NOTICE 'Lot %/% → property %', rec.position, fl, new_pid;
  END LOOP;

  -- Backfill parent_property_id pour lots existants qui l'ont pas
  UPDATE properties p
  SET parent_property_id = b.property_id
  FROM building_units bu
  JOIN buildings b ON b.id = bu.building_id
  WHERE bu.property_id = p.id
    AND p.parent_property_id IS NULL
    AND b.property_id IS NOT NULL
    AND b.property_id != p.id;
END;
$$;

DROP FUNCTION IF EXISTS _gen_prop_code();

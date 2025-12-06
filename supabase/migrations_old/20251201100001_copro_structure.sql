-- =====================================================
-- MIGRATION: Structure physique COPRO
-- Description: Sites, bâtiments, étages, lots, tantièmes, propriétés
-- =====================================================

-- Extension UUID si pas déjà présente
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TABLE: sites (copropriétés)
-- =====================================================
CREATE TABLE IF NOT EXISTS sites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID, -- Pour multi-tenant SaaS
  
  -- Identification
  name TEXT NOT NULL,
  code TEXT UNIQUE, -- Code interne unique
  type TEXT NOT NULL DEFAULT 'copropriete' 
    CHECK (type IN ('copropriete', 'lotissement', 'residence_mixte', 'asl', 'aful')),
  
  -- Adresse
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  postal_code TEXT NOT NULL,
  city TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'FR',
  
  -- Informations légales
  siret TEXT,
  numero_immatriculation TEXT, -- Registre des copropriétés
  date_reglement TEXT, -- Date du règlement de copropriété
  
  -- Configuration comptable
  bank_account_id UUID,
  iban TEXT,
  bic TEXT,
  fiscal_year_start_month INTEGER DEFAULT 1 CHECK (fiscal_year_start_month BETWEEN 1 AND 12),
  
  -- Tantièmes totaux
  total_tantiemes_general INTEGER DEFAULT 10000,
  total_tantiemes_eau INTEGER DEFAULT 0,
  total_tantiemes_chauffage INTEGER DEFAULT 0,
  total_tantiemes_ascenseur INTEGER DEFAULT 0,
  
  -- Syndic
  syndic_type TEXT DEFAULT 'professionnel' CHECK (syndic_type IN ('professionnel', 'benevole', 'cooperatif')),
  syndic_profile_id UUID REFERENCES profiles(id),
  syndic_company_name TEXT,
  syndic_siret TEXT,
  syndic_address TEXT,
  syndic_email TEXT,
  syndic_phone TEXT,
  
  -- État
  is_active BOOLEAN NOT NULL DEFAULT true,
  archived_at TIMESTAMPTZ,
  
  -- Métadonnées
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_sites_tenant_id ON sites(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sites_syndic_profile ON sites(syndic_profile_id);
CREATE INDEX IF NOT EXISTS idx_sites_is_active ON sites(is_active);

-- =====================================================
-- TABLE: buildings (immeubles/bâtiments)
-- =====================================================
CREATE TABLE IF NOT EXISTS buildings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  tenant_id UUID,
  
  -- Identification
  name TEXT NOT NULL,
  code TEXT, -- Ex: "BAT-A", "Immeuble Principal"
  building_type TEXT DEFAULT 'immeuble' 
    CHECK (building_type IN ('immeuble', 'maison', 'parking', 'local_commercial', 'autre')),
  
  -- Adresse (si différente du site)
  address_line1 TEXT,
  address_line2 TEXT,
  
  -- Structure
  floors_count INTEGER DEFAULT 0,
  has_basement BOOLEAN DEFAULT false,
  basement_levels INTEGER DEFAULT 0,
  has_elevator BOOLEAN DEFAULT false,
  elevator_count INTEGER DEFAULT 0,
  
  -- Année construction
  construction_year INTEGER,
  renovation_year INTEGER,
  
  -- Caractéristiques techniques
  heating_type TEXT CHECK (heating_type IN ('collectif', 'individuel', 'mixte', 'aucun')),
  water_type TEXT CHECK (water_type IN ('collectif', 'individuel', 'compteurs_divisionnaires')),
  
  -- Ordre d'affichage
  display_order INTEGER DEFAULT 0,
  
  -- État
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Métadonnées
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_buildings_site_id ON buildings(site_id);
CREATE INDEX IF NOT EXISTS idx_buildings_tenant_id ON buildings(tenant_id);

-- =====================================================
-- TABLE: floors (étages)
-- =====================================================
CREATE TABLE IF NOT EXISTS floors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  building_id UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  
  -- Identification
  level INTEGER NOT NULL, -- -2, -1, 0, 1, 2... (0 = RDC)
  name TEXT, -- "RDC", "1er étage", "Sous-sol 1"
  
  -- Ordre d'affichage
  display_order INTEGER DEFAULT 0,
  
  -- Métadonnées
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(building_id, level)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_floors_building_id ON floors(building_id);

-- =====================================================
-- TABLE: copro_units (lots de copropriété)
-- =====================================================
CREATE TABLE IF NOT EXISTS copro_units (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  building_id UUID REFERENCES buildings(id) ON DELETE SET NULL,
  floor_id UUID REFERENCES floors(id) ON DELETE SET NULL,
  
  -- Identification
  lot_number TEXT NOT NULL, -- Numéro de lot officiel
  lot_suffix TEXT, -- Pour lots divisés: "A", "B"
  cadastral_reference TEXT, -- Référence cadastrale
  
  -- Type de lot
  unit_type TEXT NOT NULL DEFAULT 'appartement'
    CHECK (unit_type IN (
      'appartement', 'maison', 'studio', 'duplex', 'triplex',
      'local_commercial', 'bureau', 
      'cave', 'parking', 'box', 'garage',
      'jardin', 'terrasse', 'balcon',
      'local_technique', 'loge_gardien',
      'autre'
    )),
  
  -- Caractéristiques
  surface_carrez NUMERIC(10,2), -- Surface loi Carrez
  surface_habitable NUMERIC(10,2),
  surface_utile NUMERIC(10,2),
  rooms_count INTEGER DEFAULT 0,
  
  -- Emplacement
  floor_level INTEGER, -- Étage (redondant mais pratique)
  door_number TEXT, -- Numéro de porte
  staircase TEXT, -- Escalier A, B, C...
  position TEXT, -- "Gauche", "Droite", "Face"
  
  -- Tantièmes (millièmes)
  tantieme_general INTEGER DEFAULT 0 CHECK (tantieme_general >= 0),
  tantieme_eau INTEGER DEFAULT 0 CHECK (tantieme_eau >= 0),
  tantieme_chauffage INTEGER DEFAULT 0 CHECK (tantieme_chauffage >= 0),
  tantieme_ascenseur INTEGER DEFAULT 0 CHECK (tantieme_ascenseur >= 0),
  
  -- Mode d'occupation
  occupation_mode TEXT DEFAULT 'vacant'
    CHECK (occupation_mode IN ('owner_occupied', 'rented', 'vacant', 'secondary')),
  
  -- Lien avec le module locatif existant
  linked_property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  
  -- État
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Métadonnées
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(site_id, lot_number, lot_suffix)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_copro_units_site_id ON copro_units(site_id);
CREATE INDEX IF NOT EXISTS idx_copro_units_building_id ON copro_units(building_id);
CREATE INDEX IF NOT EXISTS idx_copro_units_floor_id ON copro_units(floor_id);
CREATE INDEX IF NOT EXISTS idx_copro_units_lot_number ON copro_units(lot_number);
CREATE INDEX IF NOT EXISTS idx_copro_units_linked_property ON copro_units(linked_property_id);
CREATE INDEX IF NOT EXISTS idx_copro_units_occupation ON copro_units(occupation_mode);

-- =====================================================
-- TABLE: copro_lots (tantièmes détaillés par clé)
-- Pour gérer plusieurs clés de répartition
-- =====================================================
CREATE TABLE IF NOT EXISTS copro_lots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  unit_id UUID NOT NULL REFERENCES copro_units(id) ON DELETE CASCADE,
  
  -- Clé de répartition
  repartition_key TEXT NOT NULL 
    CHECK (repartition_key IN (
      'general', 'eau', 'chauffage', 'ascenseur', 
      'ordures', 'eclairage', 'espaces_verts',
      'parking', 'interphone', 'antenne',
      'custom_1', 'custom_2', 'custom_3'
    )),
  repartition_key_label TEXT, -- Label personnalisé pour custom
  
  -- Tantièmes pour cette clé
  tantiemes INTEGER NOT NULL DEFAULT 0 CHECK (tantiemes >= 0),
  
  -- Métadonnées
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(unit_id, repartition_key)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_copro_lots_unit_id ON copro_lots(unit_id);
CREATE INDEX IF NOT EXISTS idx_copro_lots_key ON copro_lots(repartition_key);

-- =====================================================
-- TABLE: ownerships (propriétés / propriétaires)
-- =====================================================
CREATE TABLE IF NOT EXISTS ownerships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  unit_id UUID NOT NULL REFERENCES copro_units(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Détails de propriété
  ownership_type TEXT NOT NULL DEFAULT 'pleine_propriete'
    CHECK (ownership_type IN (
      'pleine_propriete', 'nue_propriete', 'usufruit', 
      'indivision', 'sci', 'autre'
    )),
  ownership_share NUMERIC(5,4) NOT NULL DEFAULT 1.0 
    CHECK (ownership_share > 0 AND ownership_share <= 1),
  
  -- Dates
  acquisition_date DATE,
  acquisition_type TEXT CHECK (acquisition_type IN ('achat', 'donation', 'heritage', 'autre')),
  end_date DATE, -- Date de fin (vente, etc.)
  
  -- Droits de vote
  can_vote BOOLEAN NOT NULL DEFAULT true,
  vote_delegation_to UUID REFERENCES profiles(id), -- Délégation permanente
  
  -- État
  is_current BOOLEAN NOT NULL DEFAULT true,
  
  -- Métadonnées
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Un propriétaire actif par lot/profil
  UNIQUE(unit_id, profile_id, is_current) 
);

-- Index
CREATE INDEX IF NOT EXISTS idx_ownerships_unit_id ON ownerships(unit_id);
CREATE INDEX IF NOT EXISTS idx_ownerships_profile_id ON ownerships(profile_id);
CREATE INDEX IF NOT EXISTS idx_ownerships_is_current ON ownerships(is_current);

-- =====================================================
-- TABLE: ownership_history (historique des transferts)
-- =====================================================
CREATE TABLE IF NOT EXISTS ownership_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  unit_id UUID NOT NULL REFERENCES copro_units(id) ON DELETE CASCADE,
  
  -- Ancien propriétaire
  previous_owner_id UUID REFERENCES profiles(id),
  previous_ownership_share NUMERIC(5,4),
  
  -- Nouveau propriétaire
  new_owner_id UUID REFERENCES profiles(id),
  new_ownership_share NUMERIC(5,4),
  
  -- Détails du transfert
  transfer_type TEXT NOT NULL 
    CHECK (transfer_type IN ('vente', 'donation', 'heritage', 'division', 'fusion', 'autre')),
  transfer_date DATE NOT NULL,
  transfer_price NUMERIC(15,2), -- Prix de vente si applicable
  notary_name TEXT,
  notary_reference TEXT,
  
  -- Documents
  deed_document_id UUID,
  
  -- Métadonnées
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_ownership_history_unit ON ownership_history(unit_id);
CREATE INDEX IF NOT EXISTS idx_ownership_history_date ON ownership_history(transfer_date);

-- =====================================================
-- VIEWS: Vues utilitaires
-- =====================================================

-- Vue: Lots avec tantièmes consolidés
CREATE OR REPLACE VIEW v_copro_units_with_tantiemes AS
SELECT 
  cu.*,
  b.name as building_name,
  b.building_type,
  f.level as floor_level_name,
  f.name as floor_name,
  s.name as site_name,
  s.total_tantiemes_general,
  CASE 
    WHEN s.total_tantiemes_general > 0 
    THEN ROUND((cu.tantieme_general::NUMERIC / s.total_tantiemes_general) * 100, 4)
    ELSE 0 
  END as percentage_general,
  COALESCE(
    (SELECT jsonb_object_agg(cl.repartition_key, cl.tantiemes)
     FROM copro_lots cl WHERE cl.unit_id = cu.id),
    '{}'::jsonb
  ) as all_tantiemes
FROM copro_units cu
LEFT JOIN buildings b ON b.id = cu.building_id
LEFT JOIN floors f ON f.id = cu.floor_id
LEFT JOIN sites s ON s.id = cu.site_id
WHERE cu.is_active = true;

-- Vue: Propriétaires actuels avec leurs lots
CREATE OR REPLACE VIEW v_current_ownerships AS
SELECT 
  o.*,
  cu.lot_number,
  cu.unit_type,
  cu.tantieme_general,
  cu.surface_carrez,
  p.first_name as owner_first_name,
  p.last_name as owner_last_name,
  p.email as owner_email,
  s.id as site_id,
  s.name as site_name
FROM ownerships o
JOIN copro_units cu ON cu.id = o.unit_id
JOIN profiles p ON p.id = o.profile_id
JOIN sites s ON s.id = cu.site_id
WHERE o.is_current = true;

-- Vue: Structure complète d'un site
CREATE OR REPLACE VIEW v_site_structure AS
SELECT 
  s.id as site_id,
  s.name as site_name,
  s.type as site_type,
  b.id as building_id,
  b.name as building_name,
  b.building_type,
  f.id as floor_id,
  f.level as floor_level,
  f.name as floor_name,
  cu.id as unit_id,
  cu.lot_number,
  cu.unit_type,
  cu.tantieme_general,
  cu.occupation_mode
FROM sites s
LEFT JOIN buildings b ON b.site_id = s.id
LEFT JOIN floors f ON f.building_id = b.id
LEFT JOIN copro_units cu ON cu.floor_id = f.id OR (cu.building_id = b.id AND cu.floor_id IS NULL)
WHERE s.is_active = true
ORDER BY s.name, b.display_order, f.level, cu.lot_number;

-- =====================================================
-- FUNCTIONS: Fonctions utilitaires
-- =====================================================

-- Fonction: Générer un code unique pour un site
CREATE OR REPLACE FUNCTION generate_site_code()
RETURNS TEXT AS $$
DECLARE
  new_code TEXT;
  exists_count INTEGER;
BEGIN
  LOOP
    new_code := 'CPR-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));
    SELECT COUNT(*) INTO exists_count FROM sites WHERE code = new_code;
    EXIT WHEN exists_count = 0;
  END LOOP;
  RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- Fonction: Calculer le total des tantièmes d'un site
CREATE OR REPLACE FUNCTION calculate_site_tantiemes(p_site_id UUID)
RETURNS TABLE (
  key TEXT,
  total INTEGER,
  units_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'general'::TEXT as key,
    COALESCE(SUM(cu.tantieme_general), 0)::INTEGER as total,
    COUNT(*)::INTEGER as units_count
  FROM copro_units cu
  WHERE cu.site_id = p_site_id AND cu.is_active = true
  
  UNION ALL
  
  SELECT 
    cl.repartition_key as key,
    COALESCE(SUM(cl.tantiemes), 0)::INTEGER as total,
    COUNT(DISTINCT cl.unit_id)::INTEGER as units_count
  FROM copro_lots cl
  JOIN copro_units cu ON cu.id = cl.unit_id
  WHERE cu.site_id = p_site_id AND cu.is_active = true
  GROUP BY cl.repartition_key;
END;
$$ LANGUAGE plpgsql;

-- Fonction: Vérifier la cohérence des tantièmes
CREATE OR REPLACE FUNCTION validate_site_tantiemes(p_site_id UUID)
RETURNS TABLE (
  is_valid BOOLEAN,
  expected_total INTEGER,
  actual_total INTEGER,
  difference INTEGER,
  message TEXT
) AS $$
DECLARE
  v_expected INTEGER;
  v_actual INTEGER;
BEGIN
  SELECT total_tantiemes_general INTO v_expected FROM sites WHERE id = p_site_id;
  SELECT COALESCE(SUM(tantieme_general), 0) INTO v_actual 
  FROM copro_units WHERE site_id = p_site_id AND is_active = true;
  
  RETURN QUERY
  SELECT 
    (v_expected = v_actual) as is_valid,
    v_expected as expected_total,
    v_actual as actual_total,
    (v_expected - v_actual) as difference,
    CASE 
      WHEN v_expected = v_actual THEN 'Tantièmes cohérents'
      WHEN v_actual < v_expected THEN 'Tantièmes insuffisants: ' || (v_expected - v_actual) || ' millièmes manquants'
      ELSE 'Tantièmes excédentaires: ' || (v_actual - v_expected) || ' millièmes en trop'
    END as message;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS: Mise à jour automatique
-- =====================================================

-- Trigger: Générer code site automatiquement
CREATE OR REPLACE FUNCTION trigger_generate_site_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.code IS NULL THEN
    NEW.code := generate_site_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_site_code ON sites;
CREATE TRIGGER trg_generate_site_code
  BEFORE INSERT ON sites
  FOR EACH ROW
  EXECUTE FUNCTION trigger_generate_site_code();

-- Trigger: Mettre à jour updated_at
CREATE OR REPLACE FUNCTION trigger_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sites_updated_at ON sites;
CREATE TRIGGER trg_sites_updated_at
  BEFORE UPDATE ON sites
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_timestamp();

DROP TRIGGER IF EXISTS trg_buildings_updated_at ON buildings;
CREATE TRIGGER trg_buildings_updated_at
  BEFORE UPDATE ON buildings
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_timestamp();

DROP TRIGGER IF EXISTS trg_copro_units_updated_at ON copro_units;
CREATE TRIGGER trg_copro_units_updated_at
  BEFORE UPDATE ON copro_units
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_timestamp();

DROP TRIGGER IF EXISTS trg_ownerships_updated_at ON ownerships;
CREATE TRIGGER trg_ownerships_updated_at
  BEFORE UPDATE ON ownerships
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_timestamp();

-- Trigger: Synchroniser les tantièmes dans copro_lots
CREATE OR REPLACE FUNCTION trigger_sync_unit_tantiemes()
RETURNS TRIGGER AS $$
BEGIN
  -- Upsert tantième général
  INSERT INTO copro_lots (unit_id, repartition_key, tantiemes)
  VALUES (NEW.id, 'general', NEW.tantieme_general)
  ON CONFLICT (unit_id, repartition_key) 
  DO UPDATE SET tantiemes = NEW.tantieme_general, updated_at = NOW();
  
  -- Upsert tantième eau si défini
  IF NEW.tantieme_eau > 0 THEN
    INSERT INTO copro_lots (unit_id, repartition_key, tantiemes)
    VALUES (NEW.id, 'eau', NEW.tantieme_eau)
    ON CONFLICT (unit_id, repartition_key) 
    DO UPDATE SET tantiemes = NEW.tantieme_eau, updated_at = NOW();
  END IF;
  
  -- Upsert tantième chauffage si défini
  IF NEW.tantieme_chauffage > 0 THEN
    INSERT INTO copro_lots (unit_id, repartition_key, tantiemes)
    VALUES (NEW.id, 'chauffage', NEW.tantieme_chauffage)
    ON CONFLICT (unit_id, repartition_key) 
    DO UPDATE SET tantiemes = NEW.tantieme_chauffage, updated_at = NOW();
  END IF;
  
  -- Upsert tantième ascenseur si défini
  IF NEW.tantieme_ascenseur > 0 THEN
    INSERT INTO copro_lots (unit_id, repartition_key, tantiemes)
    VALUES (NEW.id, 'ascenseur', NEW.tantieme_ascenseur)
    ON CONFLICT (unit_id, repartition_key) 
    DO UPDATE SET tantiemes = NEW.tantieme_ascenseur, updated_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_unit_tantiemes ON copro_units;
CREATE TRIGGER trg_sync_unit_tantiemes
  AFTER INSERT OR UPDATE OF tantieme_general, tantieme_eau, tantieme_chauffage, tantieme_ascenseur
  ON copro_units
  FOR EACH ROW
  EXECUTE FUNCTION trigger_sync_unit_tantiemes();

-- =====================================================
-- COMMENTS: Documentation des tables
-- =====================================================
COMMENT ON TABLE sites IS 'Copropriétés (sites) gérées par le syndic';
COMMENT ON TABLE buildings IS 'Bâtiments/immeubles appartenant à une copropriété';
COMMENT ON TABLE floors IS 'Étages au sein d''un bâtiment';
COMMENT ON TABLE copro_units IS 'Lots de copropriété (appartements, caves, parkings, etc.)';
COMMENT ON TABLE copro_lots IS 'Tantièmes détaillés par clé de répartition';
COMMENT ON TABLE ownerships IS 'Relation propriétaire-lot avec historique';
COMMENT ON TABLE ownership_history IS 'Historique des transferts de propriété';

COMMENT ON COLUMN copro_units.tantieme_general IS 'Tantièmes généraux (millièmes) pour charges communes';
COMMENT ON COLUMN copro_units.occupation_mode IS 'Mode d''occupation: owner_occupied (propriétaire occupant), rented (loué), vacant, secondary (résidence secondaire)';
COMMENT ON COLUMN ownerships.ownership_share IS 'Quote-part de propriété (1.0 = 100%, 0.5 = 50% en indivision)';


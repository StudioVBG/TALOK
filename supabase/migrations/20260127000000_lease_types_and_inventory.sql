-- ============================================
-- Migration: Types de baux complets + Inventaire mobilier
-- Date: 2026-01-27
-- Description: Ajout des types de baux manquants et de l'inventaire mobilier pour EDL
-- Conformité: Décret 2015-981, Loi ELAN, Code commerce, Code rural
-- ============================================

BEGIN;

-- ============================================
-- 1. MISE À JOUR DE LA CONTRAINTE TYPE_BAIL
-- ============================================

ALTER TABLE leases DROP CONSTRAINT IF EXISTS leases_type_bail_check;

ALTER TABLE leases ADD CONSTRAINT leases_type_bail_check
  CHECK (
    type_bail IN (
      -- Habitation
      'nu',
      'meuble',
      'colocation',
      'saisonnier',
      'bail_mobilite',
      'etudiant',
      'bail_mixte',
      -- Commercial
      'commercial_3_6_9',
      'commercial_derogatoire',
      'professionnel',
      'location_gerance',
      -- Stationnement
      'contrat_parking',
      -- Agricole
      'bail_rural'
    )
  );

COMMENT ON CONSTRAINT leases_type_bail_check ON leases IS
  'Types de baux légaux français - SSOT 2026 - Conforme ALUR, ELAN, Code commerce, Code rural';

-- ============================================
-- 2. TABLE INVENTAIRE MOBILIER (Décret 2015-981)
-- ============================================

CREATE TABLE IF NOT EXISTS edl_furniture_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edl_id UUID NOT NULL REFERENCES edl(id) ON DELETE CASCADE,
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,

  -- Statut
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'completed', 'signed')),
  completed_at TIMESTAMPTZ,

  -- Signatures
  signed_by_owner BOOLEAN DEFAULT FALSE,
  signed_by_tenant BOOLEAN DEFAULT FALSE,
  owner_signed_at TIMESTAMPTZ,
  tenant_signed_at TIMESTAMPTZ,

  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(edl_id)
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_edl_furniture_inventory_edl_id ON edl_furniture_inventory(edl_id);
CREATE INDEX IF NOT EXISTS idx_edl_furniture_inventory_lease_id ON edl_furniture_inventory(lease_id);

COMMENT ON TABLE edl_furniture_inventory IS
  'Inventaire mobilier pour baux meublés - Décret n°2015-981 du 31 juillet 2015';

-- ============================================
-- 3. ÉLÉMENTS OBLIGATOIRES DU MOBILIER
-- ============================================

CREATE TABLE IF NOT EXISTS edl_mandatory_furniture (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID NOT NULL REFERENCES edl_furniture_inventory(id) ON DELETE CASCADE,

  -- Clé de l'élément obligatoire (conforme au décret)
  item_key TEXT NOT NULL CHECK (
    item_key IN (
      'literie_couette_couverture',
      'volets_rideaux_chambres',
      'plaques_cuisson',
      'four_ou_micro_ondes',
      'refrigerateur_congelateur',
      'vaisselle_ustensiles',
      'table_sieges',
      'rangements',
      'luminaires',
      'materiel_entretien'
    )
  ),

  -- État de l'élément
  present BOOLEAN NOT NULL DEFAULT FALSE,
  quantity INTEGER DEFAULT 1 CHECK (quantity >= 0),
  condition TEXT CHECK (condition IN ('neuf', 'bon_etat', 'usage', 'mauvais_etat')),
  notes TEXT,
  photo_url TEXT,

  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(inventory_id, item_key)
);

CREATE INDEX IF NOT EXISTS idx_edl_mandatory_furniture_inventory_id ON edl_mandatory_furniture(inventory_id);

COMMENT ON TABLE edl_mandatory_furniture IS
  'Éléments obligatoires selon Article 25-4 de la loi du 6 juillet 1989';

-- ============================================
-- 4. MOBILIER SUPPLÉMENTAIRE
-- ============================================

CREATE TABLE IF NOT EXISTS edl_additional_furniture (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID NOT NULL REFERENCES edl_furniture_inventory(id) ON DELETE CASCADE,

  -- Description
  designation TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  condition TEXT NOT NULL CHECK (condition IN ('neuf', 'bon_etat', 'usage', 'mauvais_etat')),
  room TEXT,
  notes TEXT,
  photo_url TEXT,

  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edl_additional_furniture_inventory_id ON edl_additional_furniture(inventory_id);

COMMENT ON TABLE edl_additional_furniture IS
  'Mobilier supplémentaire au-delà des éléments obligatoires';

-- ============================================
-- 5. DIAGNOSTICS DOM-TOM
-- ============================================

-- Table pour les diagnostics termites (obligatoire en DOM-TOM)
CREATE TABLE IF NOT EXISTS property_diagnostic_termites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,

  -- Informations diagnostiqueur
  diagnostiqueur_nom TEXT NOT NULL,
  diagnostiqueur_certification TEXT,

  -- Dates
  date_realisation DATE NOT NULL,
  date_validite DATE NOT NULL, -- 6 mois de validité

  -- Résultats
  presence_termites BOOLEAN NOT NULL DEFAULT FALSE,
  zones_infestees JSONB, -- Liste des zones affectées
  traitement_realise BOOLEAN DEFAULT FALSE,
  date_traitement DATE,
  type_traitement TEXT,

  -- Localisation
  departement TEXT NOT NULL, -- Code département (971, 972, 973, 974, 976)

  -- Document
  document_url TEXT,

  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_property_diagnostic_termites_property_id ON property_diagnostic_termites(property_id);
CREATE INDEX IF NOT EXISTS idx_property_diagnostic_termites_departement ON property_diagnostic_termites(departement);

COMMENT ON TABLE property_diagnostic_termites IS
  'Diagnostic termites obligatoire en DOM-TOM et zones infestées métropole';

-- Table pour les risques naturels spécifiques DOM-TOM
CREATE TABLE IF NOT EXISTS property_risques_naturels_domtom (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,

  -- Dates
  date_realisation DATE NOT NULL,

  -- Risque cyclonique
  zone_cyclonique TEXT CHECK (zone_cyclonique IN ('forte', 'moyenne', 'faible')),
  construction_paracyclonique BOOLEAN,

  -- Risque sismique (zones 3, 4, 5 pour DOM-TOM)
  zone_sismique TEXT CHECK (zone_sismique IN ('3', '4', '5')),
  norme_parasismique BOOLEAN,

  -- Risque volcanique
  zone_volcanique BOOLEAN DEFAULT FALSE,
  proximite_volcan_actif BOOLEAN DEFAULT FALSE,

  -- Risque tsunami
  zone_tsunami BOOLEAN DEFAULT FALSE,

  -- Mouvements de terrain
  zone_mouvement_terrain BOOLEAN DEFAULT FALSE,
  type_mouvement TEXT CHECK (type_mouvement IN ('glissement', 'eboulement', 'affaissement')),

  -- Inondations
  zone_inondation BOOLEAN DEFAULT FALSE,
  niveau_risque_inondation TEXT CHECK (niveau_risque_inondation IN ('fort', 'moyen', 'faible')),

  -- Document
  document_url TEXT,

  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(property_id)
);

CREATE INDEX IF NOT EXISTS idx_property_risques_naturels_domtom_property_id ON property_risques_naturels_domtom(property_id);

COMMENT ON TABLE property_risques_naturels_domtom IS
  'Risques naturels spécifiques aux DOM-TOM (cyclones, séismes, volcans, tsunamis)';

-- ============================================
-- 6. FONCTION POUR INITIALISER L'INVENTAIRE
-- ============================================

CREATE OR REPLACE FUNCTION initialize_furniture_inventory(p_edl_id UUID, p_lease_id UUID)
RETURNS UUID AS $$
DECLARE
  v_inventory_id UUID;
  v_item_key TEXT;
BEGIN
  -- Créer l'inventaire
  INSERT INTO edl_furniture_inventory (edl_id, lease_id)
  VALUES (p_edl_id, p_lease_id)
  ON CONFLICT (edl_id) DO UPDATE SET updated_at = NOW()
  RETURNING id INTO v_inventory_id;

  -- Initialiser les éléments obligatoires
  FOR v_item_key IN
    SELECT unnest(ARRAY[
      'literie_couette_couverture',
      'volets_rideaux_chambres',
      'plaques_cuisson',
      'four_ou_micro_ondes',
      'refrigerateur_congelateur',
      'vaisselle_ustensiles',
      'table_sieges',
      'rangements',
      'luminaires',
      'materiel_entretien'
    ])
  LOOP
    INSERT INTO edl_mandatory_furniture (inventory_id, item_key, present, quantity, condition)
    VALUES (v_inventory_id, v_item_key, FALSE, 1, 'bon_etat')
    ON CONFLICT (inventory_id, item_key) DO NOTHING;
  END LOOP;

  RETURN v_inventory_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION initialize_furniture_inventory IS
  'Initialise un inventaire mobilier avec les 10 éléments obligatoires du décret 2015-981';

-- ============================================
-- 7. TRIGGER POUR MISE À JOUR AUTOMATIQUE
-- ============================================

CREATE OR REPLACE FUNCTION update_furniture_inventory_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_edl_furniture_inventory_updated ON edl_furniture_inventory;
CREATE TRIGGER trg_edl_furniture_inventory_updated
  BEFORE UPDATE ON edl_furniture_inventory
  FOR EACH ROW
  EXECUTE FUNCTION update_furniture_inventory_timestamp();

DROP TRIGGER IF EXISTS trg_edl_mandatory_furniture_updated ON edl_mandatory_furniture;
CREATE TRIGGER trg_edl_mandatory_furniture_updated
  BEFORE UPDATE ON edl_mandatory_furniture
  FOR EACH ROW
  EXECUTE FUNCTION update_furniture_inventory_timestamp();

DROP TRIGGER IF EXISTS trg_edl_additional_furniture_updated ON edl_additional_furniture;
CREATE TRIGGER trg_edl_additional_furniture_updated
  BEFORE UPDATE ON edl_additional_furniture
  FOR EACH ROW
  EXECUTE FUNCTION update_furniture_inventory_timestamp();

-- ============================================
-- 8. RLS POLICIES
-- ============================================

ALTER TABLE edl_furniture_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE edl_mandatory_furniture ENABLE ROW LEVEL SECURITY;
ALTER TABLE edl_additional_furniture ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_diagnostic_termites ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_risques_naturels_domtom ENABLE ROW LEVEL SECURITY;

-- Policies pour edl_furniture_inventory
CREATE POLICY "Owners can manage furniture inventory for their leases" ON edl_furniture_inventory
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON l.property_id = p.id
      WHERE l.id = edl_furniture_inventory.lease_id
      AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "Tenants can view furniture inventory for their leases" ON edl_furniture_inventory
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM lease_signers ls
      WHERE ls.lease_id = edl_furniture_inventory.lease_id
      AND ls.profile_id = auth.uid()
    )
  );

-- Policies pour edl_mandatory_furniture
CREATE POLICY "Users can manage mandatory furniture via inventory" ON edl_mandatory_furniture
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM edl_furniture_inventory fi
      JOIN leases l ON fi.lease_id = l.id
      JOIN properties p ON l.property_id = p.id
      WHERE fi.id = edl_mandatory_furniture.inventory_id
      AND (p.owner_id = auth.uid() OR EXISTS (
        SELECT 1 FROM lease_signers ls WHERE ls.lease_id = l.id AND ls.profile_id = auth.uid()
      ))
    )
  );

-- Policies pour edl_additional_furniture
CREATE POLICY "Users can manage additional furniture via inventory" ON edl_additional_furniture
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM edl_furniture_inventory fi
      JOIN leases l ON fi.lease_id = l.id
      JOIN properties p ON l.property_id = p.id
      WHERE fi.id = edl_additional_furniture.inventory_id
      AND (p.owner_id = auth.uid() OR EXISTS (
        SELECT 1 FROM lease_signers ls WHERE ls.lease_id = l.id AND ls.profile_id = auth.uid()
      ))
    )
  );

-- Policies pour diagnostics termites
CREATE POLICY "Owners can manage termites diagnostics" ON property_diagnostic_termites
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = property_diagnostic_termites.property_id
      AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "Tenants can view termites diagnostics" ON property_diagnostic_termites
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN lease_signers ls ON l.id = ls.lease_id
      WHERE l.property_id = property_diagnostic_termites.property_id
      AND ls.profile_id = auth.uid()
    )
  );

-- Policies pour risques naturels DOM-TOM
CREATE POLICY "Owners can manage risques naturels domtom" ON property_risques_naturels_domtom
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = property_risques_naturels_domtom.property_id
      AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "Tenants can view risques naturels domtom" ON property_risques_naturels_domtom
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN lease_signers ls ON l.id = ls.lease_id
      WHERE l.property_id = property_risques_naturels_domtom.property_id
      AND ls.profile_id = auth.uid()
    )
  );

-- ============================================
-- 9. VÉRIFICATION
-- ============================================

DO $$
BEGIN
  RAISE NOTICE 'Migration 20260127000000_lease_types_and_inventory completed successfully';
  RAISE NOTICE 'New lease types: etudiant, bail_mixte, bail_rural added';
  RAISE NOTICE 'Furniture inventory tables created (Décret 2015-981)';
  RAISE NOTICE 'DOM-TOM diagnostics tables created (termites, risques naturels)';
END $$;

COMMIT;

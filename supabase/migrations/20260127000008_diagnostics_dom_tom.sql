-- ============================================
-- Migration: Diagnostics DOM-TOM - GAP-009/010/011 SOTA 2026
-- ============================================
-- Spécificités réglementaires des départements d'outre-mer:
-- - 971: Guadeloupe, 972: Martinique, 973: Guyane
-- - 974: La Réunion, 976: Mayotte
--
-- Conformité:
-- - Loi n°99-471 du 8 juin 1999 (termites)
-- - Code de l'environnement (risques naturels DOM)
-- ============================================

-- ============================================
-- ENUMS
-- ============================================

-- États d'infestation termites
CREATE TYPE etat_termites AS ENUM (
  'absence',
  'indices_anciens',
  'presence_active',
  'non_visible'
);

-- Types de termites tropicaux
CREATE TYPE type_termite AS ENUM (
  'reticulitermes',
  'cryptotermes',
  'coptotermes',
  'nasutitermes',
  'heterotermes'
);

-- Zones d'inspection termites
CREATE TYPE zone_diagnostic_termites AS ENUM (
  'interieur',
  'exterieur',
  'parties_communes',
  'dependances'
);

-- Risques naturels spécifiques DOM
CREATE TYPE risque_naturel_dom AS ENUM (
  'cyclone',
  'seisme',
  'volcan',
  'tsunami',
  'inondation',
  'mouvement_terrain',
  'submersion_marine',
  'erosion_cotiere',
  'recul_trait_cote',
  'radon',
  'feu_foret'
);

-- Zones volcaniques
CREATE TYPE zone_volcanique AS ENUM (
  'zone_interdite',
  'zone_danger_immediat',
  'zone_proximite',
  'zone_eloignee'
);

-- ============================================
-- TABLE: diagnostics_termites
-- Diagnostic termites obligatoire en DOM
-- ============================================
CREATE TABLE diagnostics_termites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Bien concerné
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Diagnostiqueur
  diagnostiqueur_nom VARCHAR(255) NOT NULL,
  diagnostiqueur_certification VARCHAR(100) NOT NULL,
  numero_certification VARCHAR(50) NOT NULL,
  assurance_rc VARCHAR(100) NOT NULL,
  date_validite_certification DATE NOT NULL,

  -- Dates
  date_diagnostic DATE NOT NULL,
  date_validite DATE NOT NULL, -- 6 mois après diagnostic

  -- Localisation
  departement VARCHAR(3) NOT NULL,
  commune VARCHAR(255) NOT NULL,
  zone_arrete_prefectoral BOOLEAN NOT NULL DEFAULT true, -- Tout DOM est en zone arrêté
  reference_arrete VARCHAR(100),

  -- Résultat global
  conclusion etat_termites NOT NULL,
  presence_active BOOLEAN NOT NULL DEFAULT false,

  -- Types identifiés
  types_termites_identifies type_termite[] DEFAULT '{}',

  -- Traitement existant
  traitement_preventif_existant BOOLEAN NOT NULL DEFAULT false,
  date_dernier_traitement DATE,

  -- Recommandations
  recommandations TEXT[] DEFAULT '{}',

  -- Document
  document_id UUID REFERENCES documents(id),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Contrainte de validité (6 mois)
  CONSTRAINT validite_6_mois CHECK (date_validite = date_diagnostic + INTERVAL '6 months')
);

-- Index
CREATE INDEX idx_diagnostics_termites_property ON diagnostics_termites(property_id);
CREATE INDEX idx_diagnostics_termites_owner ON diagnostics_termites(owner_id);
CREATE INDEX idx_diagnostics_termites_departement ON diagnostics_termites(departement);
CREATE INDEX idx_diagnostics_termites_validite ON diagnostics_termites(date_validite);
CREATE INDEX idx_diagnostics_termites_actifs ON diagnostics_termites(property_id)
  WHERE presence_active = true;

-- ============================================
-- TABLE: diagnostics_termites_zones
-- Détail par zone inspectée
-- ============================================
CREATE TABLE diagnostics_termites_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  diagnostic_id UUID NOT NULL REFERENCES diagnostics_termites(id) ON DELETE CASCADE,

  zone zone_diagnostic_termites NOT NULL,
  localisation VARCHAR(255) NOT NULL,
  etat etat_termites NOT NULL,
  elements_infestes TEXT[] DEFAULT '{}',
  observations TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_termites_zones_diagnostic ON diagnostics_termites_zones(diagnostic_id);

-- ============================================
-- TABLE: erp_dom_tom
-- État des Risques et Pollutions spécifique DOM
-- ============================================
CREATE TABLE erp_dom_tom (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Bien concerné
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Localisation
  departement VARCHAR(3) NOT NULL CHECK (departement IN ('971', '972', '973', '974', '976')),
  commune VARCHAR(255) NOT NULL,

  -- Dates
  date_erp DATE NOT NULL,
  date_validite DATE NOT NULL, -- 6 mois

  -- Zone sismique (tous les DOM sont >= 2)
  zone_sismique INTEGER NOT NULL CHECK (zone_sismique BETWEEN 1 AND 5),

  -- Zone cyclonique
  zone_cyclonique BOOLEAN NOT NULL DEFAULT false,
  normes_paracycloniques BOOLEAN NOT NULL DEFAULT false,

  -- Zone volcanique
  zone_volcanique zone_volcanique,
  distance_volcan_km NUMERIC(10,2),
  volcan_reference VARCHAR(100),

  -- Tsunami
  risque_tsunami BOOLEAN NOT NULL DEFAULT false,

  -- Submersion marine
  zone_submersion_marine BOOLEAN NOT NULL DEFAULT false,

  -- Inondation
  zone_inondable BOOLEAN NOT NULL DEFAULT false,

  -- PPRN
  pprn_existe BOOLEAN NOT NULL DEFAULT false,
  pprn_reference VARCHAR(100),
  pprn_date_approbation DATE,
  pprn_prescriptions TEXT[] DEFAULT '{}',

  -- Mouvement de terrain
  mouvement_terrain BOOLEAN NOT NULL DEFAULT false,

  -- Érosion côtière
  erosion_cotiere BOOLEAN NOT NULL DEFAULT false,

  -- Recul du trait de côte (loi Climat et Résilience)
  recul_trait_cote_concerne BOOLEAN NOT NULL DEFAULT false,
  recul_trait_cote_30_ans BOOLEAN NOT NULL DEFAULT false,
  recul_trait_cote_100_ans BOOLEAN NOT NULL DEFAULT false,

  -- Risques technologiques
  seveso_proximite BOOLEAN NOT NULL DEFAULT false,
  distance_seveso_m NUMERIC(10,2),

  -- Pollution
  sis BOOLEAN NOT NULL DEFAULT false, -- Secteur d'information sur les sols

  -- Radon (zones volcaniques)
  zone_radon INTEGER CHECK (zone_radon BETWEEN 1 AND 3),

  -- IAL
  ial_annexe BOOLEAN NOT NULL DEFAULT true,

  -- Document
  document_id UUID REFERENCES documents(id),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX idx_erp_dom_tom_property ON erp_dom_tom(property_id);
CREATE INDEX idx_erp_dom_tom_departement ON erp_dom_tom(departement);
CREATE INDEX idx_erp_dom_tom_validite ON erp_dom_tom(date_validite);

-- ============================================
-- TABLE: dom_referentiel
-- Référentiel des DOM et leurs caractéristiques
-- ============================================
CREATE TABLE dom_referentiel (
  departement VARCHAR(3) PRIMARY KEY CHECK (departement IN ('971', '972', '973', '974', '976')),

  nom VARCHAR(100) NOT NULL,
  region VARCHAR(100) NOT NULL,
  chef_lieu VARCHAR(100) NOT NULL,
  fuseau_horaire VARCHAR(50) NOT NULL,

  -- Risques
  risques_specifiques risque_naturel_dom[] NOT NULL,
  zone_sismique INTEGER NOT NULL CHECK (zone_sismique BETWEEN 1 AND 5),
  zone_cyclonique BOOLEAN NOT NULL DEFAULT false,
  zone_volcanique BOOLEAN NOT NULL DEFAULT false,
  volcan_actif VARCHAR(100),

  -- Obligations
  termites_obligatoire BOOLEAN NOT NULL DEFAULT true,
  normes_paracycloniques BOOLEAN NOT NULL DEFAULT false,
  normes_parasismiques BOOLEAN NOT NULL DEFAULT false,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Données de référence DOM
INSERT INTO dom_referentiel (departement, nom, region, chef_lieu, fuseau_horaire, risques_specifiques, zone_sismique, zone_cyclonique, zone_volcanique, volcan_actif, normes_paracycloniques, normes_parasismiques) VALUES
  ('971', 'Guadeloupe', 'Guadeloupe', 'Basse-Terre', 'America/Guadeloupe',
   ARRAY['cyclone', 'seisme', 'volcan', 'tsunami', 'inondation', 'mouvement_terrain']::risque_naturel_dom[],
   5, true, true, 'La Soufrière', true, true),
  ('972', 'Martinique', 'Martinique', 'Fort-de-France', 'America/Martinique',
   ARRAY['cyclone', 'seisme', 'volcan', 'tsunami', 'inondation', 'mouvement_terrain']::risque_naturel_dom[],
   5, true, true, 'Montagne Pelée', true, true),
  ('973', 'Guyane', 'Guyane', 'Cayenne', 'America/Cayenne',
   ARRAY['inondation', 'mouvement_terrain', 'feu_foret']::risque_naturel_dom[],
   2, false, false, NULL, false, false),
  ('974', 'La Réunion', 'La Réunion', 'Saint-Denis', 'Indian/Reunion',
   ARRAY['cyclone', 'seisme', 'volcan', 'tsunami', 'inondation', 'mouvement_terrain', 'erosion_cotiere']::risque_naturel_dom[],
   4, true, true, 'Piton de la Fournaise', true, true),
  ('976', 'Mayotte', 'Mayotte', 'Mamoudzou', 'Indian/Mayotte',
   ARRAY['cyclone', 'seisme', 'tsunami', 'inondation', 'mouvement_terrain', 'volcan']::risque_naturel_dom[],
   4, true, true, 'Volcan sous-marin Fani Maoré', true, true);

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE diagnostics_termites ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnostics_termites_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_dom_tom ENABLE ROW LEVEL SECURITY;
ALTER TABLE dom_referentiel ENABLE ROW LEVEL SECURITY;

-- Référentiel DOM: lecture publique
CREATE POLICY "Référentiel DOM lisible par tous" ON dom_referentiel
  FOR SELECT USING (true);

-- Diagnostics termites: accès propriétaire
CREATE POLICY "Diagnostics termites visibles par propriétaire" ON diagnostics_termites
  FOR SELECT USING (
    owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Diagnostics termites créables par propriétaire" ON diagnostics_termites
  FOR INSERT WITH CHECK (
    owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Diagnostics termites modifiables par propriétaire" ON diagnostics_termites
  FOR UPDATE USING (
    owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Zones termites: accès via diagnostic parent
CREATE POLICY "Zones termites visibles si diagnostic visible" ON diagnostics_termites_zones
  FOR SELECT USING (
    diagnostic_id IN (
      SELECT id FROM diagnostics_termites
      WHERE owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Zones termites créables si diagnostic propriétaire" ON diagnostics_termites_zones
  FOR INSERT WITH CHECK (
    diagnostic_id IN (
      SELECT id FROM diagnostics_termites
      WHERE owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- ERP DOM: accès propriétaire
CREATE POLICY "ERP DOM visibles par propriétaire" ON erp_dom_tom
  FOR SELECT USING (
    owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "ERP DOM créables par propriétaire" ON erp_dom_tom
  FOR INSERT WITH CHECK (
    owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "ERP DOM modifiables par propriétaire" ON erp_dom_tom
  FOR UPDATE USING (
    owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- ============================================
-- TRIGGERS
-- ============================================

-- Updated_at triggers
CREATE TRIGGER set_updated_at_diagnostics_termites
  BEFORE UPDATE ON diagnostics_termites
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_erp_dom_tom
  BEFORE UPDATE ON erp_dom_tom
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================
-- FONCTIONS RPC
-- ============================================

-- Vérifie si un diagnostic termites est requis pour un bien
CREATE OR REPLACE FUNCTION is_termites_required(p_property_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_departement VARCHAR(3);
BEGIN
  SELECT departement INTO v_departement
  FROM properties
  WHERE id = p_property_id;

  -- Tous les DOM nécessitent un diagnostic termites
  IF v_departement IN ('971', '972', '973', '974', '976') THEN
    RETURN true;
  END IF;

  -- En métropole, vérifier si zone à arrêté préfectoral
  -- (non implémenté - retourne false par défaut)
  RETURN false;
END;
$$;

-- Vérifie si un diagnostic termites est valide pour un bien
CREATE OR REPLACE FUNCTION is_termites_valid(p_property_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_diagnostic diagnostics_termites%ROWTYPE;
  v_valid BOOLEAN;
  v_message TEXT;
BEGIN
  -- Récupérer le diagnostic le plus récent
  SELECT * INTO v_diagnostic
  FROM diagnostics_termites
  WHERE property_id = p_property_id
  ORDER BY date_diagnostic DESC
  LIMIT 1;

  IF v_diagnostic IS NULL THEN
    RETURN jsonb_build_object(
      'valid', false,
      'exists', false,
      'message', 'Aucun diagnostic termites trouvé'
    );
  END IF;

  v_valid := v_diagnostic.date_validite >= CURRENT_DATE;

  IF v_valid THEN
    v_message := 'Diagnostic valide jusqu''au ' || v_diagnostic.date_validite::text;
  ELSE
    v_message := 'Diagnostic expiré depuis le ' || v_diagnostic.date_validite::text;
  END IF;

  RETURN jsonb_build_object(
    'valid', v_valid,
    'exists', true,
    'diagnostic_id', v_diagnostic.id,
    'date_diagnostic', v_diagnostic.date_diagnostic,
    'date_validite', v_diagnostic.date_validite,
    'conclusion', v_diagnostic.conclusion,
    'presence_active', v_diagnostic.presence_active,
    'message', v_message
  );
END;
$$;

-- Récupère les diagnostics obligatoires pour un bien DOM
CREATE OR REPLACE FUNCTION get_diagnostics_obligatoires_dom(
  p_property_id UUID,
  p_is_vente BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_departement VARCHAR(3);
  v_dom_info dom_referentiel%ROWTYPE;
  v_diagnostics JSONB := '[]'::jsonb;
BEGIN
  -- Récupérer le département du bien
  SELECT departement INTO v_departement
  FROM properties
  WHERE id = p_property_id;

  IF v_departement NOT IN ('971', '972', '973', '974', '976') THEN
    RETURN jsonb_build_object(
      'is_dom', false,
      'diagnostics', '[]'::jsonb
    );
  END IF;

  -- Récupérer les infos du DOM
  SELECT * INTO v_dom_info
  FROM dom_referentiel
  WHERE departement = v_departement;

  -- Construire la liste des diagnostics
  v_diagnostics := v_diagnostics || jsonb_build_object(
    'type', 'termites',
    'nom', 'Diagnostic termites (état parasitaire)',
    'obligatoire', true,
    'validite_mois', 6,
    'specificite', 'Espèces tropicales agressives'
  );

  v_diagnostics := v_diagnostics || jsonb_build_object(
    'type', 'erp',
    'nom', 'État des Risques et Pollutions DOM',
    'obligatoire', true,
    'validite_mois', 6,
    'risques', v_dom_info.risques_specifiques
  );

  IF v_dom_info.normes_paracycloniques THEN
    v_diagnostics := v_diagnostics || jsonb_build_object(
      'type', 'paracyclonique',
      'nom', 'Attestation normes paracycloniques',
      'obligatoire', true,
      'validite_mois', NULL
    );
  END IF;

  IF v_dom_info.normes_parasismiques THEN
    v_diagnostics := v_diagnostics || jsonb_build_object(
      'type', 'parasismique',
      'nom', 'Attestation normes parasismiques',
      'obligatoire', true,
      'zone_sismique', v_dom_info.zone_sismique
    );
  END IF;

  RETURN jsonb_build_object(
    'is_dom', true,
    'departement', v_departement,
    'nom', v_dom_info.nom,
    'zone_sismique', v_dom_info.zone_sismique,
    'zone_cyclonique', v_dom_info.zone_cyclonique,
    'zone_volcanique', v_dom_info.zone_volcanique,
    'volcan_actif', v_dom_info.volcan_actif,
    'diagnostics', v_diagnostics
  );
END;
$$;

-- ============================================
-- VUES
-- ============================================

-- Diagnostics termites expirés ou à renouveler
CREATE OR REPLACE VIEW v_diagnostics_termites_a_renouveler AS
SELECT
  dt.*,
  p.adresse_complete,
  p.code_postal,
  p.ville,
  p.departement,
  CASE
    WHEN dt.date_validite < CURRENT_DATE THEN 'expiré'
    WHEN dt.date_validite < CURRENT_DATE + INTERVAL '30 days' THEN 'expire_bientot'
    ELSE 'valide'
  END as statut_validite,
  dt.date_validite - CURRENT_DATE as jours_restants
FROM diagnostics_termites dt
JOIN properties p ON dt.property_id = p.id
WHERE dt.date_validite < CURRENT_DATE + INTERVAL '60 days';

-- Biens DOM sans diagnostic termites valide
CREATE OR REPLACE VIEW v_biens_dom_sans_termites AS
SELECT
  p.id as property_id,
  p.owner_id,
  p.adresse_complete,
  p.code_postal,
  p.ville,
  p.departement,
  dr.nom as nom_dom,
  dr.zone_sismique,
  dr.zone_cyclonique,
  dr.zone_volcanique,
  dr.volcan_actif
FROM properties p
JOIN dom_referentiel dr ON p.departement = dr.departement
LEFT JOIN diagnostics_termites dt ON p.id = dt.property_id AND dt.date_validite >= CURRENT_DATE
WHERE dt.id IS NULL;

-- ============================================
-- COMMENTAIRES
-- ============================================

COMMENT ON TABLE diagnostics_termites IS 'Diagnostics termites obligatoires en DOM - Loi du 8 juin 1999';
COMMENT ON TABLE erp_dom_tom IS 'État des Risques et Pollutions spécifique aux DOM';
COMMENT ON TABLE dom_referentiel IS 'Référentiel des caractéristiques et obligations par DOM';

COMMENT ON FUNCTION is_termites_required IS 'Vérifie si un diagnostic termites est requis pour un bien';
COMMENT ON FUNCTION is_termites_valid IS 'Vérifie la validité du diagnostic termites d''un bien';
COMMENT ON FUNCTION get_diagnostics_obligatoires_dom IS 'Liste les diagnostics obligatoires pour un bien DOM';

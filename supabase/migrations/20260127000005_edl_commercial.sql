-- Migration: État des lieux commercial et professionnel
-- GAP-007: EDL spécifique pour les locaux commerciaux et professionnels
-- Date: 2026-01-27

-- =============================================================================
-- 1. TABLE: edl_commercial
-- État des lieux principal pour locaux commerciaux/professionnels
-- =============================================================================

CREATE TABLE IF NOT EXISTS edl_commercial (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,

  -- Type d'EDL
  type_edl VARCHAR(10) NOT NULL CHECK (type_edl IN ('entree', 'sortie')),
  type_local VARCHAR(50) NOT NULL,
  type_bail VARCHAR(50) NOT NULL CHECK (type_bail IN ('commercial', 'commercial_derogatoire', 'professionnel')),

  -- Dates et heures
  date_edl DATE NOT NULL,
  heure_debut TIME NOT NULL,
  heure_fin TIME,

  -- Surfaces
  surface_totale_m2 DECIMAL(10,2) NOT NULL,
  surface_vente_m2 DECIMAL(10,2),
  surface_reserve_m2 DECIMAL(10,2),
  surface_bureaux_m2 DECIMAL(10,2),
  surface_annexes_m2 DECIMAL(10,2),

  -- Représentant bailleur
  bailleur_nom VARCHAR(100) NOT NULL,
  bailleur_prenom VARCHAR(100) NOT NULL,
  bailleur_qualite VARCHAR(100) NOT NULL,
  bailleur_signature TEXT,
  bailleur_signature_date TIMESTAMPTZ,

  -- Représentant preneur
  preneur_nom VARCHAR(100) NOT NULL,
  preneur_prenom VARCHAR(100) NOT NULL,
  preneur_qualite VARCHAR(100) NOT NULL,
  preneur_raison_sociale VARCHAR(255),
  preneur_signature TEXT,
  preneur_signature_date TIMESTAMPTZ,

  -- Observations
  observations_generales TEXT,
  reserves_preneur TEXT,
  reserves_bailleur TEXT,

  -- État global
  etat_general VARCHAR(20) DEFAULT 'bon',
  conformite_globale VARCHAR(20) DEFAULT 'conforme',

  -- Référence EDL entrée (pour sortie)
  edl_entree_id UUID REFERENCES edl_commercial(id) ON DELETE SET NULL,

  -- Statut et validation
  status VARCHAR(20) DEFAULT 'brouillon' CHECK (status IN ('brouillon', 'en_cours', 'a_valider', 'valide', 'conteste')),

  -- Génération PDF
  pdf_generated BOOLEAN DEFAULT FALSE,
  pdf_path VARCHAR(500),

  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  UNIQUE(lease_id, type_edl)
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_edl_commercial_lease_id ON edl_commercial(lease_id);
CREATE INDEX IF NOT EXISTS idx_edl_commercial_property_id ON edl_commercial(property_id);
CREATE INDEX IF NOT EXISTS idx_edl_commercial_type_bail ON edl_commercial(type_bail);
CREATE INDEX IF NOT EXISTS idx_edl_commercial_status ON edl_commercial(status);

-- =============================================================================
-- 2. TABLE: edl_commercial_securite_incendie
-- Conformité ERP et sécurité incendie
-- =============================================================================

CREATE TABLE IF NOT EXISTS edl_commercial_securite_incendie (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edl_commercial_id UUID NOT NULL REFERENCES edl_commercial(id) ON DELETE CASCADE,

  -- Classification ERP
  erp_categorie VARCHAR(10), -- 1, 2, 3, 4, 5, non_erp
  erp_type VARCHAR(10), -- M, N, O, W, J, U
  erp_capacite_max INTEGER,

  -- Extincteurs
  extincteurs_presents BOOLEAN DEFAULT FALSE,
  extincteurs_nombre INTEGER DEFAULT 0,
  extincteurs_types TEXT[], -- eau, co2, poudre, mousse
  extincteurs_date_verification DATE,
  extincteurs_conformes BOOLEAN,

  -- Alarme incendie
  alarme_incendie_presente BOOLEAN DEFAULT FALSE,
  alarme_incendie_type VARCHAR(20), -- type_1, type_2a, type_2b, type_3, type_4
  alarme_incendie_centrale BOOLEAN DEFAULT FALSE,
  alarme_incendie_nb_detecteurs INTEGER DEFAULT 0,
  alarme_incendie_date_verification DATE,

  -- Issues de secours
  issues_secours_nombre INTEGER DEFAULT 0,
  issues_secours_conformes BOOLEAN DEFAULT FALSE,
  issues_secours_eclairage_securite BOOLEAN DEFAULT FALSE,
  issues_secours_balisage BOOLEAN DEFAULT FALSE,

  -- Désenfumage
  desenfumage_present BOOLEAN DEFAULT FALSE,
  desenfumage_type VARCHAR(20), -- naturel, mecanique
  desenfumage_conforme BOOLEAN,

  -- Documents et contrôles
  registre_securite_present BOOLEAN DEFAULT FALSE,
  registre_securite_a_jour BOOLEAN DEFAULT FALSE,
  dernier_controle_commission DATE,
  avis_commission VARCHAR(20), -- favorable, defavorable, sursis

  observations TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(edl_commercial_id)
);

-- =============================================================================
-- 3. TABLE: edl_commercial_accessibilite_pmr
-- Conformité accessibilité PMR
-- =============================================================================

CREATE TABLE IF NOT EXISTS edl_commercial_accessibilite_pmr (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edl_commercial_id UUID NOT NULL REFERENCES edl_commercial(id) ON DELETE CASCADE,

  -- Attestation/Ad'AP
  ad_ap_presente BOOLEAN DEFAULT FALSE,
  ad_ap_date DATE,
  ad_ap_reference VARCHAR(100),

  -- Accès extérieur
  acces_plain_pied BOOLEAN DEFAULT FALSE,
  rampe_acces_presente BOOLEAN,
  rampe_acces_conforme BOOLEAN,
  rampe_pente_pct DECIMAL(5,2),
  largeur_porte_entree_cm INTEGER,

  -- Circulation intérieure
  circulation_largeur_min_cm INTEGER,
  circulation_libre BOOLEAN DEFAULT FALSE,
  escalier_present BOOLEAN DEFAULT FALSE,
  ascenseur_present BOOLEAN,
  ascenseur_conforme_pmr BOOLEAN,

  -- Sanitaires PMR
  sanitaire_pmr_present BOOLEAN DEFAULT FALSE,
  sanitaire_pmr_conforme BOOLEAN,
  sanitaire_pmr_dimensions VARCHAR(50),

  -- Stationnement
  place_pmr_presente BOOLEAN DEFAULT FALSE,
  place_pmr_signalee BOOLEAN,

  -- Signalétique
  signaletique_pmr_presente BOOLEAN DEFAULT FALSE,
  bande_guidage_presente BOOLEAN,

  conformite_globale VARCHAR(20) DEFAULT 'a_verifier', -- conforme, non_conforme, a_verifier, derogation
  observations TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(edl_commercial_id)
);

-- =============================================================================
-- 4. TABLE: edl_commercial_facade_vitrine
-- Inspection façade et vitrine (commerces)
-- =============================================================================

CREATE TABLE IF NOT EXISTS edl_commercial_facade_vitrine (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edl_commercial_id UUID NOT NULL REFERENCES edl_commercial(id) ON DELETE CASCADE,

  -- Vitrine
  vitrine_etat VARCHAR(20) DEFAULT 'bon',
  vitrine_type VARCHAR(20), -- simple, double, securit, autre
  vitrine_surface_m2 DECIMAL(10,2),
  vitrine_film_adhesif BOOLEAN DEFAULT FALSE,
  vitrine_observations TEXT,

  -- Façade
  facade_etat VARCHAR(20) DEFAULT 'bon',
  facade_materiau VARCHAR(100),
  facade_peinture_date DATE,
  facade_observations TEXT,

  -- Store/Banne
  store_present BOOLEAN DEFAULT FALSE,
  store_type VARCHAR(20), -- banne, venitien, roulant, autre
  store_motorise BOOLEAN,
  store_etat VARCHAR(20),
  store_observations TEXT,

  -- Porte d'entrée
  porte_entree_etat VARCHAR(20) DEFAULT 'bon',
  porte_entree_type VARCHAR(20), -- vitree, pleine, rideau_metallique, autre
  porte_entree_serrure_type VARCHAR(50),
  porte_entree_nb_cles INTEGER DEFAULT 0,

  -- Rideau métallique
  rideau_metallique_present BOOLEAN DEFAULT FALSE,
  rideau_metallique_etat VARCHAR(20),
  rideau_metallique_motorise BOOLEAN,
  rideau_metallique_observations TEXT,

  photos JSONB DEFAULT '[]'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(edl_commercial_id)
);

-- =============================================================================
-- 5. TABLE: edl_commercial_enseigne
-- Inspection enseigne et signalétique
-- =============================================================================

CREATE TABLE IF NOT EXISTS edl_commercial_enseigne (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edl_commercial_id UUID NOT NULL REFERENCES edl_commercial(id) ON DELETE CASCADE,

  -- Enseigne principale
  enseigne_presente BOOLEAN DEFAULT FALSE,
  enseigne_type VARCHAR(30), -- bandeau, caisson, lettres_decoupees, drapeau, autre
  enseigne_eclairee BOOLEAN,
  enseigne_etat VARCHAR(20),
  enseigne_dimensions VARCHAR(50),
  enseigne_autorisation_mairie BOOLEAN,
  enseigne_observations TEXT,

  -- Signalétique intérieure
  signaletique_interieure BOOLEAN DEFAULT FALSE,
  signaletique_sortie_secours BOOLEAN DEFAULT FALSE,
  signaletique_sanitaires BOOLEAN DEFAULT FALSE,
  signaletique_accessibilite BOOLEAN DEFAULT FALSE,
  signaletique_observations TEXT,

  photos JSONB DEFAULT '[]'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(edl_commercial_id)
);

-- =============================================================================
-- 6. TABLE: edl_commercial_installations_techniques
-- Installations techniques (clim, chauffage, électricité, etc.)
-- =============================================================================

CREATE TABLE IF NOT EXISTS edl_commercial_installations_techniques (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edl_commercial_id UUID NOT NULL REFERENCES edl_commercial(id) ON DELETE CASCADE,

  -- Climatisation
  climatisation_presente BOOLEAN DEFAULT FALSE,
  climatisation_type VARCHAR(30), -- split, centralisee, vmc_double_flux, autre
  climatisation_marque VARCHAR(100),
  climatisation_puissance_kw DECIMAL(10,2),
  climatisation_date_entretien DATE,
  climatisation_etat VARCHAR(20),
  climatisation_observations TEXT,

  -- Chauffage
  chauffage_type VARCHAR(30), -- electrique, gaz, fioul, pompe_chaleur, autre
  chauffage_equipements TEXT[],
  chauffage_etat VARCHAR(20),
  chauffage_date_entretien DATE,
  chauffage_observations TEXT,

  -- Ventilation
  ventilation_type VARCHAR(30), -- naturelle, vmc_simple, vmc_double, extraction
  ventilation_etat VARCHAR(20),
  ventilation_observations TEXT,

  -- Électricité
  electricite_puissance_kva DECIMAL(10,2),
  electricite_tableau_conforme BOOLEAN DEFAULT FALSE,
  electricite_differentiel_present BOOLEAN DEFAULT FALSE,
  electricite_nb_prises INTEGER,
  electricite_nb_circuits INTEGER,
  electricite_date_diagnostic DATE,
  electricite_observations TEXT,

  -- Plomberie
  plomberie_arrivee_eau BOOLEAN DEFAULT TRUE,
  plomberie_evacuation BOOLEAN DEFAULT TRUE,
  plomberie_chauffe_eau_type VARCHAR(50),
  plomberie_chauffe_eau_capacite_l INTEGER,
  plomberie_etat VARCHAR(20),
  plomberie_observations TEXT,

  -- Télécom/IT
  telecom_lignes_telephoniques INTEGER DEFAULT 0,
  telecom_fibre_optique BOOLEAN DEFAULT FALSE,
  telecom_prises_rj45 INTEGER DEFAULT 0,
  telecom_baie_brassage BOOLEAN DEFAULT FALSE,
  telecom_observations TEXT,

  photos JSONB DEFAULT '[]'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(edl_commercial_id)
);

-- =============================================================================
-- 7. TABLE: edl_commercial_compteurs
-- Relevés des compteurs
-- =============================================================================

CREATE TABLE IF NOT EXISTS edl_commercial_compteurs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edl_commercial_id UUID NOT NULL REFERENCES edl_commercial(id) ON DELETE CASCADE,

  -- Compteur électrique
  compteur_elec_numero VARCHAR(50),
  compteur_elec_index DECIMAL(15,2),
  compteur_elec_type VARCHAR(30), -- linky, electronique, mecanique
  compteur_elec_puissance_kva DECIMAL(10,2),
  compteur_elec_photo TEXT,

  -- Compteur gaz
  compteur_gaz_present BOOLEAN DEFAULT FALSE,
  compteur_gaz_numero VARCHAR(50),
  compteur_gaz_index_m3 DECIMAL(15,2),
  compteur_gaz_photo TEXT,

  -- Compteur eau
  compteur_eau_numero VARCHAR(50),
  compteur_eau_index_m3 DECIMAL(15,2),
  compteur_eau_divisionnaire BOOLEAN DEFAULT FALSE,
  compteur_eau_photo TEXT,

  -- Télécom
  ligne_telephonique_numero VARCHAR(50),
  acces_internet_type VARCHAR(20), -- adsl, fibre, cable, autre
  debit_internet_mbps INTEGER,

  observations TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(edl_commercial_id)
);

-- =============================================================================
-- 8. TABLE: edl_commercial_zones
-- Zones/Pièces du local
-- =============================================================================

CREATE TABLE IF NOT EXISTS edl_commercial_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edl_commercial_id UUID NOT NULL REFERENCES edl_commercial(id) ON DELETE CASCADE,

  -- Identification
  categorie VARCHAR(50) NOT NULL, -- facade_vitrine, zone_accueil, zone_vente, etc.
  nom VARCHAR(100) NOT NULL,
  surface_m2 DECIMAL(10,2),

  -- État
  etat_general VARCHAR(20) DEFAULT 'bon',
  conformite VARCHAR(20) DEFAULT 'conforme',

  -- Détails
  observations TEXT,

  -- Ordre d'affichage
  ordre INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edl_commercial_zones_edl_id ON edl_commercial_zones(edl_commercial_id);

-- =============================================================================
-- 9. TABLE: edl_commercial_items
-- Éléments d'inspection détaillés
-- =============================================================================

CREATE TABLE IF NOT EXISTS edl_commercial_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edl_commercial_id UUID NOT NULL REFERENCES edl_commercial(id) ON DELETE CASCADE,
  zone_id UUID REFERENCES edl_commercial_zones(id) ON DELETE CASCADE,

  -- Identification
  categorie VARCHAR(50) NOT NULL,
  sous_categorie VARCHAR(50),
  nom VARCHAR(255) NOT NULL,
  description TEXT,

  -- État
  etat VARCHAR(20) DEFAULT 'bon',
  conformite VARCHAR(20),
  quantite INTEGER DEFAULT 1,

  -- Dimensions (optionnel)
  longueur_m DECIMAL(10,2),
  largeur_m DECIMAL(10,2),
  hauteur_m DECIMAL(10,2),
  surface_m2 DECIMAL(10,2),

  -- Observations
  observations TEXT,
  defauts TEXT[],
  action_requise TEXT,
  estimation_reparation DECIMAL(12,2),

  -- Photos
  photos JSONB DEFAULT '[]'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edl_commercial_items_edl_id ON edl_commercial_items(edl_commercial_id);
CREATE INDEX IF NOT EXISTS idx_edl_commercial_items_zone_id ON edl_commercial_items(zone_id);
CREATE INDEX IF NOT EXISTS idx_edl_commercial_items_categorie ON edl_commercial_items(categorie);

-- =============================================================================
-- 10. TABLE: edl_commercial_equipements
-- Équipements fournis par le bailleur
-- =============================================================================

CREATE TABLE IF NOT EXISTS edl_commercial_equipements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edl_commercial_id UUID NOT NULL REFERENCES edl_commercial(id) ON DELETE CASCADE,

  categorie VARCHAR(100) NOT NULL,
  designation VARCHAR(255) NOT NULL,
  marque VARCHAR(100),
  modele VARCHAR(100),
  numero_serie VARCHAR(100),
  date_installation DATE,
  etat VARCHAR(20) DEFAULT 'bon',
  valeur_estimee DECIMAL(12,2),
  photo TEXT,
  observations TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edl_commercial_equipements_edl_id ON edl_commercial_equipements(edl_commercial_id);

-- =============================================================================
-- 11. TABLE: edl_commercial_cles
-- Clés et badges remis
-- =============================================================================

CREATE TABLE IF NOT EXISTS edl_commercial_cles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edl_commercial_id UUID NOT NULL REFERENCES edl_commercial(id) ON DELETE CASCADE,

  type_cle VARCHAR(50) NOT NULL, -- porte_principale, porte_service, rideau_metallique, etc.
  description VARCHAR(255),
  quantite INTEGER DEFAULT 1,
  numero_badge VARCHAR(50),
  photo TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edl_commercial_cles_edl_id ON edl_commercial_cles(edl_commercial_id);

-- =============================================================================
-- 12. TABLE: edl_commercial_documents
-- Documents annexés
-- =============================================================================

CREATE TABLE IF NOT EXISTS edl_commercial_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edl_commercial_id UUID NOT NULL REFERENCES edl_commercial(id) ON DELETE CASCADE,

  type_document VARCHAR(50) NOT NULL, -- diagnostic, attestation, photo, plan, facture, autre
  nom VARCHAR(255) NOT NULL,
  description TEXT,
  chemin_fichier VARCHAR(500) NOT NULL,
  date_document DATE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edl_commercial_documents_edl_id ON edl_commercial_documents(edl_commercial_id);

-- =============================================================================
-- 13. TABLE: edl_commercial_differences
-- Différences constatées (EDL sortie)
-- =============================================================================

CREATE TABLE IF NOT EXISTS edl_commercial_differences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edl_commercial_id UUID NOT NULL REFERENCES edl_commercial(id) ON DELETE CASCADE,

  categorie VARCHAR(50) NOT NULL,
  element VARCHAR(255) NOT NULL,
  etat_entree VARCHAR(20),
  etat_sortie VARCHAR(20),
  description_degradation TEXT,
  photos_entree JSONB DEFAULT '[]'::jsonb,
  photos_sortie JSONB DEFAULT '[]'::jsonb,
  imputable_preneur BOOLEAN DEFAULT FALSE,
  estimation_reparation DECIMAL(12,2),
  observations TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edl_commercial_differences_edl_id ON edl_commercial_differences(edl_commercial_id);

-- =============================================================================
-- 14. TRIGGERS: Mise à jour automatique updated_at
-- =============================================================================

-- Fonction générique
CREATE OR REPLACE FUNCTION update_edl_commercial_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers pour toutes les tables
DO $$
DECLARE
  tables TEXT[] := ARRAY[
    'edl_commercial',
    'edl_commercial_securite_incendie',
    'edl_commercial_accessibilite_pmr',
    'edl_commercial_facade_vitrine',
    'edl_commercial_enseigne',
    'edl_commercial_installations_techniques',
    'edl_commercial_compteurs',
    'edl_commercial_zones',
    'edl_commercial_items',
    'edl_commercial_equipements',
    'edl_commercial_differences'
  ];
  t TEXT;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trigger_update_%s_timestamp ON %I', t, t);
    EXECUTE format('CREATE TRIGGER trigger_update_%s_timestamp
      BEFORE UPDATE ON %I
      FOR EACH ROW
      EXECUTE FUNCTION update_edl_commercial_timestamp()', t, t);
  END LOOP;
END $$;

-- =============================================================================
-- 15. RLS POLICIES
-- =============================================================================

-- Activer RLS sur toutes les tables
ALTER TABLE edl_commercial ENABLE ROW LEVEL SECURITY;
ALTER TABLE edl_commercial_securite_incendie ENABLE ROW LEVEL SECURITY;
ALTER TABLE edl_commercial_accessibilite_pmr ENABLE ROW LEVEL SECURITY;
ALTER TABLE edl_commercial_facade_vitrine ENABLE ROW LEVEL SECURITY;
ALTER TABLE edl_commercial_enseigne ENABLE ROW LEVEL SECURITY;
ALTER TABLE edl_commercial_installations_techniques ENABLE ROW LEVEL SECURITY;
ALTER TABLE edl_commercial_compteurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE edl_commercial_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE edl_commercial_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE edl_commercial_equipements ENABLE ROW LEVEL SECURITY;
ALTER TABLE edl_commercial_cles ENABLE ROW LEVEL SECURITY;
ALTER TABLE edl_commercial_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE edl_commercial_differences ENABLE ROW LEVEL SECURITY;

-- Policies pour edl_commercial (table principale)
CREATE POLICY "edl_commercial_select_policy" ON edl_commercial
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = edl_commercial.property_id
        AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "edl_commercial_insert_policy" ON edl_commercial
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = edl_commercial.property_id
        AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "edl_commercial_update_policy" ON edl_commercial
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = edl_commercial.property_id
        AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "edl_commercial_delete_policy" ON edl_commercial
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = edl_commercial.property_id
        AND p.owner_id = auth.uid()
    )
    AND status = 'brouillon' -- Seuls les brouillons peuvent être supprimés
  );

-- Macro pour créer les policies des tables liées
DO $$
DECLARE
  child_tables TEXT[] := ARRAY[
    'edl_commercial_securite_incendie',
    'edl_commercial_accessibilite_pmr',
    'edl_commercial_facade_vitrine',
    'edl_commercial_enseigne',
    'edl_commercial_installations_techniques',
    'edl_commercial_compteurs',
    'edl_commercial_zones',
    'edl_commercial_items',
    'edl_commercial_equipements',
    'edl_commercial_cles',
    'edl_commercial_documents',
    'edl_commercial_differences'
  ];
  t TEXT;
BEGIN
  FOREACH t IN ARRAY child_tables LOOP
    -- Policy SELECT
    EXECUTE format('CREATE POLICY "%s_select_policy" ON %I
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM edl_commercial ec
          JOIN properties p ON ec.property_id = p.id
          WHERE ec.id = %I.edl_commercial_id
            AND p.owner_id = auth.uid()
        )
      )', t, t, t);

    -- Policy INSERT
    EXECUTE format('CREATE POLICY "%s_insert_policy" ON %I
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM edl_commercial ec
          JOIN properties p ON ec.property_id = p.id
          WHERE ec.id = %I.edl_commercial_id
            AND p.owner_id = auth.uid()
        )
      )', t, t, t);

    -- Policy UPDATE
    EXECUTE format('CREATE POLICY "%s_update_policy" ON %I
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM edl_commercial ec
          JOIN properties p ON ec.property_id = p.id
          WHERE ec.id = %I.edl_commercial_id
            AND p.owner_id = auth.uid()
        )
      )', t, t, t);

    -- Policy DELETE
    EXECUTE format('CREATE POLICY "%s_delete_policy" ON %I
      FOR DELETE USING (
        EXISTS (
          SELECT 1 FROM edl_commercial ec
          JOIN properties p ON ec.property_id = p.id
          WHERE ec.id = %I.edl_commercial_id
            AND p.owner_id = auth.uid()
            AND ec.status = ''brouillon''
        )
      )', t, t, t);
  END LOOP;
END $$;

-- =============================================================================
-- 16. FONCTION RPC: Obtenir un EDL commercial complet
-- =============================================================================

CREATE OR REPLACE FUNCTION get_edl_commercial_complet(p_edl_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'edl', row_to_json(ec.*),
    'securite_incendie', (SELECT row_to_json(s.*) FROM edl_commercial_securite_incendie s WHERE s.edl_commercial_id = ec.id),
    'accessibilite_pmr', (SELECT row_to_json(a.*) FROM edl_commercial_accessibilite_pmr a WHERE a.edl_commercial_id = ec.id),
    'facade_vitrine', (SELECT row_to_json(f.*) FROM edl_commercial_facade_vitrine f WHERE f.edl_commercial_id = ec.id),
    'enseigne', (SELECT row_to_json(e.*) FROM edl_commercial_enseigne e WHERE e.edl_commercial_id = ec.id),
    'installations_techniques', (SELECT row_to_json(i.*) FROM edl_commercial_installations_techniques i WHERE i.edl_commercial_id = ec.id),
    'compteurs', (SELECT row_to_json(c.*) FROM edl_commercial_compteurs c WHERE c.edl_commercial_id = ec.id),
    'zones', (SELECT COALESCE(jsonb_agg(row_to_json(z.*) ORDER BY z.ordre), '[]'::jsonb) FROM edl_commercial_zones z WHERE z.edl_commercial_id = ec.id),
    'items', (SELECT COALESCE(jsonb_agg(row_to_json(it.*)), '[]'::jsonb) FROM edl_commercial_items it WHERE it.edl_commercial_id = ec.id),
    'equipements', (SELECT COALESCE(jsonb_agg(row_to_json(eq.*)), '[]'::jsonb) FROM edl_commercial_equipements eq WHERE eq.edl_commercial_id = ec.id),
    'cles', (SELECT COALESCE(jsonb_agg(row_to_json(cl.*)), '[]'::jsonb) FROM edl_commercial_cles cl WHERE cl.edl_commercial_id = ec.id),
    'documents', (SELECT COALESCE(jsonb_agg(row_to_json(d.*)), '[]'::jsonb) FROM edl_commercial_documents d WHERE d.edl_commercial_id = ec.id),
    'differences', (SELECT COALESCE(jsonb_agg(row_to_json(df.*)), '[]'::jsonb) FROM edl_commercial_differences df WHERE df.edl_commercial_id = ec.id)
  ) INTO v_result
  FROM edl_commercial ec
  WHERE ec.id = p_edl_id;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 17. FONCTION RPC: Comparer EDL entrée/sortie
-- =============================================================================

CREATE OR REPLACE FUNCTION compare_edl_commercial(p_edl_sortie_id UUID)
RETURNS TABLE (
  categorie VARCHAR,
  element VARCHAR,
  etat_entree VARCHAR,
  etat_sortie VARCHAR,
  changement BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  WITH edl_sortie AS (
    SELECT ec.id, ec.edl_entree_id
    FROM edl_commercial ec
    WHERE ec.id = p_edl_sortie_id AND ec.type_edl = 'sortie'
  ),
  items_entree AS (
    SELECT categorie, nom, etat
    FROM edl_commercial_items
    WHERE edl_commercial_id = (SELECT edl_entree_id FROM edl_sortie)
  ),
  items_sortie AS (
    SELECT categorie, nom, etat
    FROM edl_commercial_items
    WHERE edl_commercial_id = p_edl_sortie_id
  )
  SELECT
    COALESCE(ie.categorie, is_.categorie)::VARCHAR AS categorie,
    COALESCE(ie.nom, is_.nom)::VARCHAR AS element,
    ie.etat::VARCHAR AS etat_entree,
    is_.etat::VARCHAR AS etat_sortie,
    (ie.etat IS DISTINCT FROM is_.etat) AS changement
  FROM items_entree ie
  FULL OUTER JOIN items_sortie is_ ON ie.categorie = is_.categorie AND ie.nom = is_.nom
  WHERE ie.etat IS DISTINCT FROM is_.etat;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 18. VUE: EDL commerciaux en cours
-- =============================================================================

CREATE OR REPLACE VIEW v_edl_commercial_en_cours AS
SELECT
  ec.id,
  ec.lease_id,
  ec.property_id,
  ec.type_edl,
  ec.type_local,
  ec.type_bail,
  ec.date_edl,
  ec.status,
  ec.surface_totale_m2,
  ec.preneur_raison_sociale,
  p.adresse_complete,
  p.ville,
  l.date_debut AS bail_date_debut,
  ec.created_at,
  ec.updated_at
FROM edl_commercial ec
JOIN properties p ON ec.property_id = p.id
JOIN leases l ON ec.lease_id = l.id
WHERE ec.status IN ('brouillon', 'en_cours', 'a_valider')
ORDER BY ec.date_edl DESC;

-- =============================================================================
-- 19. COMMENTAIRES
-- =============================================================================

COMMENT ON TABLE edl_commercial IS 'État des lieux pour locaux commerciaux et professionnels - GAP-007';
COMMENT ON TABLE edl_commercial_securite_incendie IS 'Conformité ERP et sécurité incendie';
COMMENT ON TABLE edl_commercial_accessibilite_pmr IS 'Conformité accessibilité PMR';
COMMENT ON TABLE edl_commercial_facade_vitrine IS 'Inspection façade et vitrine (commerces)';
COMMENT ON TABLE edl_commercial_enseigne IS 'Inspection enseigne et signalétique';
COMMENT ON TABLE edl_commercial_installations_techniques IS 'Installations techniques (clim, chauffage, électricité, etc.)';
COMMENT ON TABLE edl_commercial_compteurs IS 'Relevés des compteurs';
COMMENT ON TABLE edl_commercial_zones IS 'Zones/Pièces du local';
COMMENT ON TABLE edl_commercial_items IS 'Éléments d''inspection détaillés';
COMMENT ON TABLE edl_commercial_equipements IS 'Équipements fournis par le bailleur';
COMMENT ON TABLE edl_commercial_cles IS 'Clés et badges remis';
COMMENT ON TABLE edl_commercial_documents IS 'Documents annexés à l''EDL';
COMMENT ON TABLE edl_commercial_differences IS 'Différences constatées entre EDL entrée et sortie';

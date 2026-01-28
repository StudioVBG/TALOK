-- Migration: Location-Gérance (Gérance Libre de Fonds de Commerce)
-- GAP-005: Support des contrats de location-gérance
-- Cadre légal: Articles L144-1 à L144-13 du Code de commerce
-- Date: 2026-01-27

-- =============================================================================
-- 1. EXTENSION DU TYPE ENUM lease_type
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'location_gerance'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'lease_type')
  ) THEN
    ALTER TYPE lease_type ADD VALUE IF NOT EXISTS 'location_gerance';
  END IF;
END$$;

-- =============================================================================
-- 2. TABLE: fonds_commerce
-- Référentiel des fonds de commerce
-- =============================================================================

CREATE TABLE IF NOT EXISTS fonds_commerce (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Identification
  nom_commercial VARCHAR(255) NOT NULL,
  enseigne VARCHAR(255),
  type_fonds VARCHAR(50) NOT NULL, -- commerce_detail, restaurant, hotel, etc.
  activite_principale VARCHAR(255) NOT NULL,
  activites_secondaires TEXT[],
  code_ape VARCHAR(10),

  -- Localisation
  adresse_exploitation VARCHAR(500) NOT NULL,
  code_postal VARCHAR(10) NOT NULL,
  ville VARCHAR(100) NOT NULL,
  local_surface_m2 DECIMAL(10,2),

  -- Bail commercial sous-jacent
  bail_commercial_id UUID REFERENCES leases(id) ON DELETE SET NULL,
  bail_commercial_reference VARCHAR(100),
  bail_date_fin DATE,
  bailleur_local_nom VARCHAR(255),

  -- Éléments incorporels
  clientele BOOLEAN DEFAULT TRUE,
  achalandage BOOLEAN DEFAULT TRUE,
  nom_commercial_inclus BOOLEAN DEFAULT TRUE,
  enseigne_incluse BOOLEAN DEFAULT TRUE,
  droit_au_bail BOOLEAN DEFAULT TRUE,
  brevets TEXT[],
  marques TEXT[],
  contrats_exclusivite TEXT[],

  -- Valeur
  valeur_estimee DECIMAL(15,2),
  date_evaluation DATE,
  methode_evaluation VARCHAR(100),

  -- Historique
  date_creation_fonds DATE,
  origine_fonds VARCHAR(50), -- creation, acquisition, heritage, autre
  chiffre_affaires_dernier_exercice DECIMAL(15,2),
  resultat_dernier_exercice DECIMAL(15,2),

  -- Statut
  en_location_gerance BOOLEAN DEFAULT FALSE,
  location_gerance_id UUID, -- Référence au contrat actif

  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fonds_commerce_owner_id ON fonds_commerce(owner_id);
CREATE INDEX IF NOT EXISTS idx_fonds_commerce_type_fonds ON fonds_commerce(type_fonds);
CREATE INDEX IF NOT EXISTS idx_fonds_commerce_ville ON fonds_commerce(ville);

-- =============================================================================
-- 3. TABLE: fonds_commerce_licences
-- Licences et autorisations du fonds
-- =============================================================================

CREATE TABLE IF NOT EXISTS fonds_commerce_licences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fonds_id UUID NOT NULL REFERENCES fonds_commerce(id) ON DELETE CASCADE,

  type_licence VARCHAR(50) NOT NULL, -- licence_4, licence_3, debit_tabac, pharmacie, etc.
  numero VARCHAR(100),
  date_obtention DATE,
  date_expiration DATE,
  transferable BOOLEAN DEFAULT TRUE,
  observations TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fonds_licences_fonds_id ON fonds_commerce_licences(fonds_id);

-- =============================================================================
-- 4. TABLE: fonds_commerce_equipements
-- Matériel et équipements du fonds
-- =============================================================================

CREATE TABLE IF NOT EXISTS fonds_commerce_equipements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fonds_id UUID NOT NULL REFERENCES fonds_commerce(id) ON DELETE CASCADE,

  designation VARCHAR(255) NOT NULL,
  marque VARCHAR(100),
  modele VARCHAR(100),
  numero_serie VARCHAR(100),
  annee_acquisition INTEGER,
  valeur_acquisition DECIMAL(12,2),
  valeur_actuelle DECIMAL(12,2),
  etat VARCHAR(20) DEFAULT 'bon', -- neuf, bon, usage, a_remplacer
  inclus_dans_gerance BOOLEAN DEFAULT TRUE,
  observations TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fonds_equipements_fonds_id ON fonds_commerce_equipements(fonds_id);

-- =============================================================================
-- 5. TABLE: location_gerance_contracts
-- Contrats de location-gérance
-- =============================================================================

CREATE TABLE IF NOT EXISTS location_gerance_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference VARCHAR(50) UNIQUE NOT NULL,
  version INTEGER DEFAULT 1,

  -- Fonds de commerce
  fonds_id UUID NOT NULL REFERENCES fonds_commerce(id) ON DELETE RESTRICT,

  -- Loueur (propriétaire du fonds)
  loueur_type VARCHAR(20) NOT NULL, -- personne_physique, personne_morale
  loueur_civilite VARCHAR(20),
  loueur_nom VARCHAR(100),
  loueur_prenom VARCHAR(100),
  loueur_date_naissance DATE,
  loueur_lieu_naissance VARCHAR(100),
  loueur_nationalite VARCHAR(50),
  loueur_raison_sociale VARCHAR(255),
  loueur_forme_juridique VARCHAR(50),
  loueur_capital DECIMAL(15,2),
  loueur_siret VARCHAR(20),
  loueur_rcs VARCHAR(100),
  loueur_representant_nom VARCHAR(100),
  loueur_representant_qualite VARCHAR(100),
  loueur_adresse VARCHAR(500) NOT NULL,
  loueur_code_postal VARCHAR(10) NOT NULL,
  loueur_ville VARCHAR(100) NOT NULL,
  loueur_telephone VARCHAR(20),
  loueur_email VARCHAR(255),
  loueur_regime_fiscal VARCHAR(10),
  loueur_tva_assujetti BOOLEAN DEFAULT FALSE,
  loueur_numero_tva VARCHAR(20),

  -- Gérant (locataire-gérant)
  gerant_type VARCHAR(20) NOT NULL,
  gerant_civilite VARCHAR(20),
  gerant_nom VARCHAR(100),
  gerant_prenom VARCHAR(100),
  gerant_date_naissance DATE,
  gerant_lieu_naissance VARCHAR(100),
  gerant_nationalite VARCHAR(50),
  gerant_raison_sociale VARCHAR(255),
  gerant_forme_juridique VARCHAR(50),
  gerant_capital DECIMAL(15,2),
  gerant_siret VARCHAR(20),
  gerant_rcs VARCHAR(100),
  gerant_rcs_date DATE,
  gerant_rm_numero VARCHAR(100),
  gerant_rm_ville VARCHAR(100),
  gerant_representant_nom VARCHAR(100),
  gerant_representant_qualite VARCHAR(100),
  gerant_adresse VARCHAR(500) NOT NULL,
  gerant_code_postal VARCHAR(10) NOT NULL,
  gerant_ville VARCHAR(100) NOT NULL,
  gerant_telephone VARCHAR(20),
  gerant_email VARCHAR(255),
  gerant_assurance_rc BOOLEAN DEFAULT TRUE,
  gerant_assurance_rc_compagnie VARCHAR(255),
  gerant_assurance_rc_numero VARCHAR(100),
  gerant_assurance_multirisque BOOLEAN DEFAULT FALSE,
  gerant_assurance_multirisque_compagnie VARCHAR(255),

  -- Durée
  duree_type VARCHAR(20) NOT NULL, -- determinee, indeterminee
  duree_mois INTEGER,
  date_debut DATE NOT NULL,
  date_fin DATE,
  tacite_reconduction BOOLEAN DEFAULT TRUE,
  preavis_non_reconduction_mois INTEGER DEFAULT 6,

  -- Redevance
  redevance_type VARCHAR(20) NOT NULL, -- fixe, pourcentage_ca, mixte, progressive
  redevance_montant_fixe_mensuel DECIMAL(12,2),
  redevance_pourcentage_ca DECIMAL(5,2),
  redevance_minimum_garanti DECIMAL(12,2),
  redevance_paliers JSONB, -- Pour type progressive
  redevance_indexation BOOLEAN DEFAULT TRUE,
  redevance_indice VARCHAR(10) DEFAULT 'ILC',
  redevance_indice_base DECIMAL(10,2),
  redevance_indice_trimestre VARCHAR(20),
  redevance_date_revision VARCHAR(5) DEFAULT '01-01',
  redevance_tva_applicable BOOLEAN DEFAULT TRUE,
  redevance_tva_taux DECIMAL(5,2) DEFAULT 20,
  redevance_echeance_jour INTEGER DEFAULT 1,
  redevance_mode_paiement VARCHAR(20) DEFAULT 'virement',

  -- Cautionnement
  cautionnement_type VARCHAR(30), -- depot_especes, garantie_bancaire, caution_solidaire
  cautionnement_montant DECIMAL(12,2),
  cautionnement_banque_nom VARCHAR(255),
  cautionnement_numero VARCHAR(100),
  cautionnement_date_emission DATE,
  cautionnement_caution_nom VARCHAR(255),
  cautionnement_caution_adresse VARCHAR(500),

  -- Stock
  reprise_stock BOOLEAN DEFAULT FALSE,
  stock_valeur_entree DECIMAL(12,2),
  stock_mode_evaluation VARCHAR(50),
  stock_taux_minoration DECIMAL(5,2),
  stock_inventaire_date DATE,

  -- Charges
  charges_locatives_gerant BOOLEAN DEFAULT TRUE,
  taxe_fonciere_gerant BOOLEAN DEFAULT FALSE,
  cfe_gerant BOOLEAN DEFAULT TRUE,
  assurances_gerant TEXT[],

  -- Obligations
  obligation_exploitation_personnelle BOOLEAN DEFAULT TRUE,
  obligation_continuation_activite BOOLEAN DEFAULT TRUE,
  interdiction_sous_location BOOLEAN DEFAULT TRUE,
  interdiction_cession BOOLEAN DEFAULT TRUE,
  obligation_non_concurrence_loueur BOOLEAN DEFAULT TRUE,

  -- Clause non-concurrence gérant
  non_concurrence_active BOOLEAN DEFAULT FALSE,
  non_concurrence_duree_mois INTEGER,
  non_concurrence_perimetre_km INTEGER,
  non_concurrence_activites TEXT[],

  -- Fin de contrat
  clause_resiliation_anticipee BOOLEAN DEFAULT TRUE,
  preavis_resiliation_mois INTEGER DEFAULT 3,
  indemnite_resiliation DECIMAL(12,2),
  conditions_restitution TEXT,

  -- Solidarité (Art. L144-7)
  solidarite_duree_mois INTEGER DEFAULT 6,

  -- Publication JAL
  publication_journal_nom VARCHAR(255),
  publication_date DATE,
  publication_reference VARCHAR(100),

  -- Statut
  status VARCHAR(30) DEFAULT 'draft', -- draft, pending_publication, published, active, suspended, terminated, expired

  -- Signatures
  signed_at TIMESTAMPTZ,
  loueur_signature TEXT,
  loueur_signature_date TIMESTAMPTZ,
  gerant_signature TEXT,
  gerant_signature_date TIMESTAMPTZ,

  -- PDF
  pdf_generated BOOLEAN DEFAULT FALSE,
  pdf_path VARCHAR(500),

  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_location_gerance_fonds_id ON location_gerance_contracts(fonds_id);
CREATE INDEX IF NOT EXISTS idx_location_gerance_status ON location_gerance_contracts(status);
CREATE INDEX IF NOT EXISTS idx_location_gerance_date_debut ON location_gerance_contracts(date_debut);
CREATE INDEX IF NOT EXISTS idx_location_gerance_date_fin ON location_gerance_contracts(date_fin);

-- =============================================================================
-- 6. TABLE: location_gerance_redevances
-- Historique des paiements de redevance
-- =============================================================================

CREATE TABLE IF NOT EXISTS location_gerance_redevances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES location_gerance_contracts(id) ON DELETE CASCADE,

  periode VARCHAR(7) NOT NULL, -- Format YYYY-MM
  date_echeance DATE NOT NULL,
  montant_base_ht DECIMAL(12,2) NOT NULL,
  montant_tva DECIMAL(12,2) DEFAULT 0,
  montant_ttc DECIMAL(12,2) NOT NULL,

  -- Si pourcentage CA
  chiffre_affaires_mois DECIMAL(15,2),
  montant_variable DECIMAL(12,2),

  -- Indexation
  indice_applique DECIMAL(10,2),
  coefficient_revision DECIMAL(8,4),

  -- Paiement
  date_paiement DATE,
  mode_paiement VARCHAR(20),
  reference_paiement VARCHAR(100),
  statut VARCHAR(20) DEFAULT 'pending', -- pending, paid, late, partial

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lg_redevances_contract ON location_gerance_redevances(contract_id);
CREATE INDEX IF NOT EXISTS idx_lg_redevances_periode ON location_gerance_redevances(periode);
CREATE INDEX IF NOT EXISTS idx_lg_redevances_statut ON location_gerance_redevances(statut);

-- =============================================================================
-- 7. TABLE: location_gerance_publications
-- Historique des publications JAL
-- =============================================================================

CREATE TABLE IF NOT EXISTS location_gerance_publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES location_gerance_contracts(id) ON DELETE CASCADE,

  type_publication VARCHAR(20) NOT NULL, -- debut, modification, fin
  journal_nom VARCHAR(255) NOT NULL,
  date_publication DATE NOT NULL,
  reference VARCHAR(100),
  texte_publication TEXT,
  document_path VARCHAR(500),
  cout DECIMAL(10,2),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lg_publications_contract ON location_gerance_publications(contract_id);

-- =============================================================================
-- 8. TABLE: location_gerance_documents
-- Documents du contrat
-- =============================================================================

CREATE TABLE IF NOT EXISTS location_gerance_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES location_gerance_contracts(id) ON DELETE CASCADE,

  type_document VARCHAR(50) NOT NULL, -- contrat_signe, publication_jal, kbis_gerant, inventaire, etc.
  nom VARCHAR(255) NOT NULL,
  description TEXT,
  chemin_fichier VARCHAR(500) NOT NULL,
  obligatoire BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lg_documents_contract ON location_gerance_documents(contract_id);

-- =============================================================================
-- 9. TRIGGERS
-- =============================================================================

-- Trigger mise à jour updated_at
CREATE OR REPLACE FUNCTION update_location_gerance_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Appliquer aux tables
DROP TRIGGER IF EXISTS trigger_update_fonds_commerce_timestamp ON fonds_commerce;
CREATE TRIGGER trigger_update_fonds_commerce_timestamp
  BEFORE UPDATE ON fonds_commerce
  FOR EACH ROW
  EXECUTE FUNCTION update_location_gerance_timestamp();

DROP TRIGGER IF EXISTS trigger_update_lg_contracts_timestamp ON location_gerance_contracts;
CREATE TRIGGER trigger_update_lg_contracts_timestamp
  BEFORE UPDATE ON location_gerance_contracts
  FOR EACH ROW
  EXECUTE FUNCTION update_location_gerance_timestamp();

DROP TRIGGER IF EXISTS trigger_update_lg_redevances_timestamp ON location_gerance_redevances;
CREATE TRIGGER trigger_update_lg_redevances_timestamp
  BEFORE UPDATE ON location_gerance_redevances
  FOR EACH ROW
  EXECUTE FUNCTION update_location_gerance_timestamp();

-- Trigger: Mettre à jour le statut du fonds quand un contrat devient actif
CREATE OR REPLACE FUNCTION update_fonds_location_gerance_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Si le contrat passe à "active"
  IF NEW.status = 'active' AND (OLD.status IS NULL OR OLD.status != 'active') THEN
    UPDATE fonds_commerce
    SET en_location_gerance = TRUE, location_gerance_id = NEW.id
    WHERE id = NEW.fonds_id;
  END IF;

  -- Si le contrat n'est plus actif
  IF NEW.status IN ('terminated', 'expired') AND OLD.status = 'active' THEN
    UPDATE fonds_commerce
    SET en_location_gerance = FALSE, location_gerance_id = NULL
    WHERE id = NEW.fonds_id AND location_gerance_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_fonds_lg_status ON location_gerance_contracts;
CREATE TRIGGER trigger_update_fonds_lg_status
  AFTER UPDATE ON location_gerance_contracts
  FOR EACH ROW
  EXECUTE FUNCTION update_fonds_location_gerance_status();

-- =============================================================================
-- 10. RLS POLICIES
-- =============================================================================

-- Activer RLS
ALTER TABLE fonds_commerce ENABLE ROW LEVEL SECURITY;
ALTER TABLE fonds_commerce_licences ENABLE ROW LEVEL SECURITY;
ALTER TABLE fonds_commerce_equipements ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_gerance_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_gerance_redevances ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_gerance_publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_gerance_documents ENABLE ROW LEVEL SECURITY;

-- Policies pour fonds_commerce
CREATE POLICY "fonds_commerce_select_policy" ON fonds_commerce
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "fonds_commerce_insert_policy" ON fonds_commerce
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "fonds_commerce_update_policy" ON fonds_commerce
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "fonds_commerce_delete_policy" ON fonds_commerce
  FOR DELETE USING (owner_id = auth.uid() AND NOT en_location_gerance);

-- Policies pour location_gerance_contracts (accès via fonds)
CREATE POLICY "lg_contracts_select_policy" ON location_gerance_contracts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM fonds_commerce f
      WHERE f.id = location_gerance_contracts.fonds_id
        AND f.owner_id = auth.uid()
    )
  );

CREATE POLICY "lg_contracts_insert_policy" ON location_gerance_contracts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM fonds_commerce f
      WHERE f.id = location_gerance_contracts.fonds_id
        AND f.owner_id = auth.uid()
    )
  );

CREATE POLICY "lg_contracts_update_policy" ON location_gerance_contracts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM fonds_commerce f
      WHERE f.id = location_gerance_contracts.fonds_id
        AND f.owner_id = auth.uid()
    )
  );

CREATE POLICY "lg_contracts_delete_policy" ON location_gerance_contracts
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM fonds_commerce f
      WHERE f.id = location_gerance_contracts.fonds_id
        AND f.owner_id = auth.uid()
    )
    AND status = 'draft'
  );

-- Policies pour tables liées (via contrat)
CREATE POLICY "fonds_licences_policy" ON fonds_commerce_licences
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM fonds_commerce f
      WHERE f.id = fonds_commerce_licences.fonds_id
        AND f.owner_id = auth.uid()
    )
  );

CREATE POLICY "fonds_equipements_policy" ON fonds_commerce_equipements
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM fonds_commerce f
      WHERE f.id = fonds_commerce_equipements.fonds_id
        AND f.owner_id = auth.uid()
    )
  );

CREATE POLICY "lg_redevances_policy" ON location_gerance_redevances
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM location_gerance_contracts c
      JOIN fonds_commerce f ON c.fonds_id = f.id
      WHERE c.id = location_gerance_redevances.contract_id
        AND f.owner_id = auth.uid()
    )
  );

CREATE POLICY "lg_publications_policy" ON location_gerance_publications
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM location_gerance_contracts c
      JOIN fonds_commerce f ON c.fonds_id = f.id
      WHERE c.id = location_gerance_publications.contract_id
        AND f.owner_id = auth.uid()
    )
  );

CREATE POLICY "lg_documents_policy" ON location_gerance_documents
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM location_gerance_contracts c
      JOIN fonds_commerce f ON c.fonds_id = f.id
      WHERE c.id = location_gerance_documents.contract_id
        AND f.owner_id = auth.uid()
    )
  );

-- =============================================================================
-- 11. FONCTIONS RPC
-- =============================================================================

-- Générer référence contrat
CREATE OR REPLACE FUNCTION generate_location_gerance_reference()
RETURNS TEXT AS $$
DECLARE
  v_year TEXT;
  v_count INTEGER;
  v_ref TEXT;
BEGIN
  v_year := TO_CHAR(NOW(), 'YYYY');

  SELECT COUNT(*) + 1 INTO v_count
  FROM location_gerance_contracts
  WHERE reference LIKE 'LG-' || v_year || '-%';

  v_ref := 'LG-' || v_year || '-' || LPAD(v_count::TEXT, 4, '0');

  RETURN v_ref;
END;
$$ LANGUAGE plpgsql;

-- Calcul de la redevance avec indexation
CREATE OR REPLACE FUNCTION calculate_location_gerance_redevance(
  p_contract_id UUID,
  p_periode VARCHAR(7),
  p_chiffre_affaires DECIMAL DEFAULT NULL
)
RETURNS TABLE (
  montant_base_ht DECIMAL,
  montant_variable DECIMAL,
  montant_total_ht DECIMAL,
  montant_tva DECIMAL,
  montant_ttc DECIMAL,
  indice_applique DECIMAL,
  coefficient_revision DECIMAL
) AS $$
DECLARE
  v_contract location_gerance_contracts%ROWTYPE;
  v_base DECIMAL;
  v_variable DECIMAL := 0;
  v_total_ht DECIMAL;
  v_tva DECIMAL;
  v_coef DECIMAL := 1;
BEGIN
  -- Récupérer le contrat
  SELECT * INTO v_contract
  FROM location_gerance_contracts
  WHERE id = p_contract_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contrat non trouvé';
  END IF;

  -- Calcul du montant de base selon le type
  CASE v_contract.redevance_type
    WHEN 'fixe' THEN
      v_base := v_contract.redevance_montant_fixe_mensuel;

    WHEN 'pourcentage_ca' THEN
      IF p_chiffre_affaires IS NULL THEN
        RAISE EXCEPTION 'Chiffre d''affaires requis pour ce type de redevance';
      END IF;
      v_base := 0;
      v_variable := p_chiffre_affaires * (v_contract.redevance_pourcentage_ca / 100);

    WHEN 'mixte' THEN
      v_base := COALESCE(v_contract.redevance_minimum_garanti, 0);
      IF p_chiffre_affaires IS NOT NULL THEN
        v_variable := GREATEST(0, p_chiffre_affaires * (v_contract.redevance_pourcentage_ca / 100) - v_base);
      END IF;

    ELSE
      v_base := v_contract.redevance_montant_fixe_mensuel;
  END CASE;

  -- TODO: Appliquer l'indexation si activée
  -- (Nécessite une table des indices INSEE)

  v_total_ht := v_base + v_variable;

  -- Calcul TVA
  IF v_contract.redevance_tva_applicable THEN
    v_tva := v_total_ht * (v_contract.redevance_tva_taux / 100);
  ELSE
    v_tva := 0;
  END IF;

  RETURN QUERY SELECT
    v_base AS montant_base_ht,
    v_variable AS montant_variable,
    v_total_ht AS montant_total_ht,
    v_tva AS montant_tva,
    (v_total_ht + v_tva) AS montant_ttc,
    v_contract.redevance_indice_base AS indice_applique,
    v_coef AS coefficient_revision;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Obtenir contrat complet avec fonds
CREATE OR REPLACE FUNCTION get_location_gerance_complet(p_contract_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'contrat', row_to_json(c.*),
    'fonds', row_to_json(f.*),
    'licences', (
      SELECT COALESCE(jsonb_agg(row_to_json(l.*)), '[]'::jsonb)
      FROM fonds_commerce_licences l WHERE l.fonds_id = c.fonds_id
    ),
    'equipements', (
      SELECT COALESCE(jsonb_agg(row_to_json(e.*)), '[]'::jsonb)
      FROM fonds_commerce_equipements e WHERE e.fonds_id = c.fonds_id
    ),
    'redevances', (
      SELECT COALESCE(jsonb_agg(row_to_json(r.*) ORDER BY r.periode DESC), '[]'::jsonb)
      FROM location_gerance_redevances r WHERE r.contract_id = c.id
    ),
    'publications', (
      SELECT COALESCE(jsonb_agg(row_to_json(p.*) ORDER BY p.date_publication), '[]'::jsonb)
      FROM location_gerance_publications p WHERE p.contract_id = c.id
    ),
    'documents', (
      SELECT COALESCE(jsonb_agg(row_to_json(d.*)), '[]'::jsonb)
      FROM location_gerance_documents d WHERE d.contract_id = c.id
    )
  ) INTO v_result
  FROM location_gerance_contracts c
  JOIN fonds_commerce f ON c.fonds_id = f.id
  WHERE c.id = p_contract_id;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 12. VUES
-- =============================================================================

-- Vue des contrats de location-gérance actifs
CREATE OR REPLACE VIEW v_location_gerance_actifs AS
SELECT
  c.id,
  c.reference,
  c.status,
  c.date_debut,
  c.date_fin,
  c.duree_type,
  c.redevance_type,
  c.redevance_montant_fixe_mensuel,
  c.redevance_pourcentage_ca,
  f.nom_commercial,
  f.enseigne,
  f.type_fonds,
  f.activite_principale,
  f.adresse_exploitation,
  f.ville,
  CASE c.gerant_type
    WHEN 'personne_physique' THEN c.gerant_nom || ' ' || c.gerant_prenom
    ELSE c.gerant_raison_sociale
  END AS gerant_nom_complet,
  c.gerant_email,
  c.created_at,
  c.updated_at
FROM location_gerance_contracts c
JOIN fonds_commerce f ON c.fonds_id = f.id
WHERE c.status IN ('published', 'active')
ORDER BY c.date_debut DESC;

-- Vue des redevances en retard
CREATE OR REPLACE VIEW v_location_gerance_redevances_retard AS
SELECT
  r.*,
  c.reference AS contrat_reference,
  f.nom_commercial,
  CASE c.gerant_type
    WHEN 'personne_physique' THEN c.gerant_nom || ' ' || c.gerant_prenom
    ELSE c.gerant_raison_sociale
  END AS gerant_nom,
  c.gerant_email,
  CURRENT_DATE - r.date_echeance AS jours_retard
FROM location_gerance_redevances r
JOIN location_gerance_contracts c ON r.contract_id = c.id
JOIN fonds_commerce f ON c.fonds_id = f.id
WHERE r.statut IN ('pending', 'late')
  AND r.date_echeance < CURRENT_DATE
ORDER BY r.date_echeance;

-- =============================================================================
-- 13. COMMENTAIRES
-- =============================================================================

COMMENT ON TABLE fonds_commerce IS
  'Fonds de commerce - Articles L141-1 et suivants du Code de commerce';

COMMENT ON TABLE location_gerance_contracts IS
  'Contrats de location-gérance - Articles L144-1 à L144-13 du Code de commerce';

COMMENT ON COLUMN location_gerance_contracts.solidarite_duree_mois IS
  'Durée de solidarité fiscale et sociale du loueur (Art. L144-7) - 6 mois par défaut après publication';

COMMENT ON TABLE location_gerance_publications IS
  'Publications JAL obligatoires - Art. L144-6 du Code de commerce';

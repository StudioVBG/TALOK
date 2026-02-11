-- Migration: Architecture Multi-Entités pour gestion multi-SCI/sociétés
-- SOTA 2026 - Support complet des structures juridiques françaises
-- Permet à un propriétaire de gérer plusieurs sociétés (SCI, SARL, etc.)

BEGIN;

-- ============================================
-- TABLE: legal_entities (Entités juridiques)
-- ============================================
-- Représente les structures juridiques: SCI, SARL, SAS, etc.
-- Un owner_profile peut avoir plusieurs legal_entities

CREATE TABLE IF NOT EXISTS legal_entities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_profile_id UUID NOT NULL REFERENCES owner_profiles(profile_id) ON DELETE CASCADE,

  -- Type d'entité juridique
  entity_type TEXT NOT NULL CHECK (entity_type IN (
    'particulier',            -- Détention directe (personne physique)
    'sci_ir',                 -- SCI à l'Impôt sur le Revenu
    'sci_is',                 -- SCI à l'Impôt sur les Sociétés
    'sci_construction_vente', -- SCCV (promotion)
    'sarl',                   -- SARL classique
    'sarl_famille',           -- SARL de famille (option IR possible)
    'eurl',                   -- EURL
    'sas',                    -- SAS
    'sasu',                   -- SASU
    'sa',                     -- SA
    'snc',                    -- Société en Nom Collectif
    'indivision',             -- Indivision (héritage, achat commun)
    'demembrement_usufruit',  -- Usufruit seul
    'demembrement_nue_propriete', -- Nue-propriété seule
    'holding'                 -- Société holding
  )),

  -- Identité de l'entité
  nom TEXT NOT NULL,                          -- Raison sociale ou "Patrimoine personnel"
  nom_commercial TEXT,                        -- Nom d'usage/enseigne

  -- Immatriculation (pour sociétés)
  siren TEXT CHECK (siren IS NULL OR LENGTH(siren) = 9),
  siret TEXT CHECK (siret IS NULL OR LENGTH(siret) = 14),
  rcs_ville TEXT,                             -- Ville du RCS
  rcs_numero TEXT,                            -- Numéro RCS complet
  numero_tva TEXT,                            -- Numéro TVA intracommunautaire
  code_ape TEXT,                              -- Code APE/NAF

  -- Adresse du siège social
  adresse_siege TEXT,
  complement_adresse TEXT,
  code_postal_siege TEXT,
  ville_siege TEXT,
  pays_siege TEXT DEFAULT 'France',

  -- Forme juridique détaillée
  forme_juridique TEXT,                       -- "SCI", "SARL", etc.
  capital_social DECIMAL(12,2),               -- Capital en euros
  capital_variable BOOLEAN DEFAULT false,     -- Capital variable ?
  capital_min DECIMAL(12,2),                  -- Si variable: minimum
  capital_max DECIMAL(12,2),                  -- Si variable: maximum

  -- Parts sociales
  nombre_parts INTEGER,                       -- Nombre total de parts
  valeur_nominale_part DECIMAL(10,2),         -- Valeur nominale d'une part

  -- Fiscalité
  regime_fiscal TEXT CHECK (regime_fiscal IN ('ir', 'is', 'ir_option_is', 'is_option_ir')) DEFAULT 'ir',
  date_option_fiscale DATE,                   -- Date de l'option IS/IR
  tva_assujetti BOOLEAN DEFAULT false,
  tva_regime TEXT CHECK (tva_regime IS NULL OR tva_regime IN (
    'franchise',              -- Franchise en base (pas de TVA)
    'reel_simplifie',         -- Réel simplifié
    'reel_normal',            -- Réel normal
    'mini_reel'               -- Mini-réel
  )),
  tva_taux_defaut DECIMAL(5,2) DEFAULT 20.00,

  -- Exercice comptable
  date_creation DATE,                         -- Date de création/immatriculation
  date_cloture_exercice TEXT,                 -- Format "MM-DD" (ex: "12-31")
  duree_exercice_mois INTEGER DEFAULT 12,
  premier_exercice_debut DATE,
  premier_exercice_fin DATE,

  -- Coordonnées bancaires
  iban TEXT,
  bic TEXT,
  banque_nom TEXT,
  titulaire_compte TEXT,                      -- Nom sur le compte

  -- Gérance/Direction
  type_gerance TEXT CHECK (type_gerance IS NULL OR type_gerance IN (
    'gerant_unique',
    'co_gerance',
    'gerance_collegiale',
    'president',
    'directeur_general',
    'conseil_administration'
  )),

  -- Statut
  is_active BOOLEAN DEFAULT true,
  date_radiation DATE,                        -- Si société radiée
  motif_radiation TEXT,

  -- Métadonnées
  couleur TEXT,                               -- Couleur pour l'UI (hex)
  icone TEXT,                                 -- Icône pour l'UI
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour legal_entities
CREATE INDEX idx_legal_entities_owner ON legal_entities(owner_profile_id);
CREATE INDEX idx_legal_entities_type ON legal_entities(entity_type);
CREATE INDEX idx_legal_entities_siren ON legal_entities(siren) WHERE siren IS NOT NULL;
CREATE INDEX idx_legal_entities_siret ON legal_entities(siret) WHERE siret IS NOT NULL;
CREATE INDEX idx_legal_entities_active ON legal_entities(is_active);
CREATE INDEX idx_legal_entities_regime ON legal_entities(regime_fiscal);

-- ============================================
-- TABLE: entity_associates (Associés des entités)
-- ============================================
-- Gère les associés/actionnaires des sociétés

CREATE TABLE IF NOT EXISTS entity_associates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  legal_entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,

  -- L'associé peut être une personne ou une autre entité (holding)
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  parent_entity_id UUID REFERENCES legal_entities(id) ON DELETE SET NULL,

  -- Identité (si associé externe non enregistré)
  civilite TEXT CHECK (civilite IS NULL OR civilite IN ('M', 'Mme', 'Société')),
  nom TEXT,
  prenom TEXT,
  date_naissance DATE,
  lieu_naissance TEXT,
  nationalite TEXT DEFAULT 'Française',
  adresse TEXT,
  code_postal TEXT,
  ville TEXT,

  -- Pour les personnes morales associées
  denomination_sociale TEXT,
  forme_juridique_associe TEXT,
  siren_associe TEXT,
  representant_legal TEXT,

  -- Participation
  nombre_parts INTEGER NOT NULL DEFAULT 0,
  pourcentage_capital DECIMAL(6,3),           -- Précision 0.001%
  pourcentage_droits_vote DECIMAL(6,3),       -- Peut différer du capital
  valeur_parts DECIMAL(12,2),                 -- Valeur totale des parts

  -- Apports
  apport_initial DECIMAL(12,2),
  type_apport TEXT CHECK (type_apport IS NULL OR type_apport IN (
    'numeraire',              -- Apport en argent
    'nature_immobilier',      -- Apport d'immeuble
    'nature_mobilier',        -- Apport de biens mobiliers
    'industrie'               -- Apport en industrie (travail)
  )),
  date_apport DATE,

  -- Type de détention
  type_detention TEXT DEFAULT 'pleine_propriete' CHECK (type_detention IN (
    'pleine_propriete',
    'nue_propriete',
    'usufruit',
    'indivision'
  )),

  -- Rôles
  is_gerant BOOLEAN DEFAULT false,
  is_president BOOLEAN DEFAULT false,
  is_directeur_general BOOLEAN DEFAULT false,
  is_associe_fondateur BOOLEAN DEFAULT false,
  role_autre TEXT,

  -- Dates mandat gérance
  date_debut_mandat DATE,
  date_fin_mandat DATE,
  duree_mandat_annees INTEGER,

  -- Pouvoirs
  pouvoirs TEXT,                              -- Description des pouvoirs
  limitations_pouvoirs TEXT,
  signature_autorisee BOOLEAN DEFAULT false,
  plafond_engagement DECIMAL(12,2),           -- Montant max engagement sans AG

  -- Statut
  is_current BOOLEAN DEFAULT true,            -- Associé actuel ?
  date_entree DATE,
  date_sortie DATE,
  motif_sortie TEXT,

  -- Documents
  piece_identite_document_id UUID,
  justificatif_domicile_document_id UUID,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Contraintes
  CONSTRAINT check_associate_identity CHECK (
    profile_id IS NOT NULL OR
    parent_entity_id IS NOT NULL OR
    (nom IS NOT NULL AND prenom IS NOT NULL) OR
    denomination_sociale IS NOT NULL
  )
);

-- Index pour entity_associates
CREATE INDEX idx_entity_associates_entity ON entity_associates(legal_entity_id);
CREATE INDEX idx_entity_associates_profile ON entity_associates(profile_id) WHERE profile_id IS NOT NULL;
CREATE INDEX idx_entity_associates_parent ON entity_associates(parent_entity_id) WHERE parent_entity_id IS NOT NULL;
CREATE INDEX idx_entity_associates_gerant ON entity_associates(legal_entity_id) WHERE is_gerant = true;
CREATE INDEX idx_entity_associates_current ON entity_associates(legal_entity_id) WHERE is_current = true;

-- ============================================
-- TABLE: property_ownership (Détention des biens)
-- ============================================
-- Permet la multi-détention, l'indivision et le démembrement

CREATE TABLE IF NOT EXISTS property_ownership (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,

  -- Détenteur (entité juridique ou personne directe)
  legal_entity_id UUID REFERENCES legal_entities(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,

  -- Quote-part (pour indivision)
  quote_part_numerateur INTEGER NOT NULL DEFAULT 1,
  quote_part_denominateur INTEGER NOT NULL DEFAULT 1,
  pourcentage_detention DECIMAL(6,3) GENERATED ALWAYS AS (
    (quote_part_numerateur::DECIMAL / quote_part_denominateur::DECIMAL) * 100
  ) STORED,

  -- Type de détention
  detention_type TEXT NOT NULL DEFAULT 'pleine_propriete' CHECK (detention_type IN (
    'pleine_propriete',       -- Propriété pleine et entière
    'nue_propriete',          -- Nue-propriété (sans usufruit)
    'usufruit',               -- Usufruit (droit de jouissance)
    'usufruit_temporaire',    -- Usufruit à durée limitée
    'indivision'              -- Part d'indivision
  )),

  -- Pour usufruit temporaire
  usufruit_duree_annees INTEGER,
  usufruit_date_fin DATE,

  -- Acquisition
  date_acquisition DATE,
  mode_acquisition TEXT CHECK (mode_acquisition IS NULL OR mode_acquisition IN (
    'achat',
    'apport',                 -- Apport à société
    'donation',
    'succession',
    'echange',
    'construction',
    'licitation'              -- Sortie d'indivision
  )),
  prix_acquisition DECIMAL(12,2),
  frais_acquisition DECIMAL(12,2),            -- Frais de notaire, etc.

  -- Notaire
  notaire_nom TEXT,
  notaire_ville TEXT,
  reference_acte TEXT,
  date_acte DATE,

  -- Financement
  finance_par_emprunt BOOLEAN DEFAULT false,
  montant_emprunt DECIMAL(12,2),
  banque_emprunt TEXT,

  -- Sortie
  date_cession DATE,
  mode_cession TEXT CHECK (mode_cession IS NULL OR mode_cession IN (
    'vente',
    'donation',
    'apport_societe',
    'succession',
    'echange',
    'expropriation'
  )),
  prix_cession DECIMAL(12,2),

  -- Statut
  is_current BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Un bien doit avoir soit une entité soit un profil comme détenteur
  CONSTRAINT check_ownership_holder CHECK (
    (legal_entity_id IS NOT NULL AND profile_id IS NULL) OR
    (legal_entity_id IS NULL AND profile_id IS NOT NULL)
  )
);

-- Index pour property_ownership
CREATE INDEX idx_property_ownership_property ON property_ownership(property_id);
CREATE INDEX idx_property_ownership_entity ON property_ownership(legal_entity_id) WHERE legal_entity_id IS NOT NULL;
CREATE INDEX idx_property_ownership_profile ON property_ownership(profile_id) WHERE profile_id IS NOT NULL;
CREATE INDEX idx_property_ownership_current ON property_ownership(property_id) WHERE is_current = true;
CREATE INDEX idx_property_ownership_type ON property_ownership(detention_type);

-- ============================================
-- MODIFICATIONS: Table properties
-- ============================================
-- Ajout du lien vers l'entité juridique

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS legal_entity_id UUID REFERENCES legal_entities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS detention_mode TEXT DEFAULT 'direct' CHECK (detention_mode IN (
    'direct',                 -- Détention directe (via owner_id)
    'societe',                -- Via une société (legal_entity_id)
    'indivision',             -- Multi-détenteurs
    'demembrement'            -- Démembrement NP/usufruit
  ));

CREATE INDEX IF NOT EXISTS idx_properties_legal_entity ON properties(legal_entity_id) WHERE legal_entity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_properties_detention_mode ON properties(detention_mode);

-- ============================================
-- MODIFICATIONS: Table leases
-- ============================================
-- Le bailleur peut être une entité juridique

ALTER TABLE leases
  ADD COLUMN IF NOT EXISTS signatory_entity_id UUID REFERENCES legal_entities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS bailleur_nom TEXT,
  ADD COLUMN IF NOT EXISTS bailleur_adresse TEXT,
  ADD COLUMN IF NOT EXISTS bailleur_siret TEXT;

CREATE INDEX IF NOT EXISTS idx_leases_signatory_entity ON leases(signatory_entity_id) WHERE signatory_entity_id IS NOT NULL;

-- ============================================
-- MODIFICATIONS: Table invoices
-- ============================================
-- La facture est émise par l'entité juridique

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS issuer_entity_id UUID REFERENCES legal_entities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS issuer_nom TEXT,
  ADD COLUMN IF NOT EXISTS issuer_adresse TEXT,
  ADD COLUMN IF NOT EXISTS issuer_siret TEXT,
  ADD COLUMN IF NOT EXISTS issuer_tva TEXT;

CREATE INDEX IF NOT EXISTS idx_invoices_issuer_entity ON invoices(issuer_entity_id) WHERE issuer_entity_id IS NOT NULL;

-- ============================================
-- FONCTION: Créer une entité "particulier" par défaut
-- ============================================
-- Crée automatiquement une entité "particulier" pour les propriétaires existants

CREATE OR REPLACE FUNCTION create_default_particulier_entity()
RETURNS TRIGGER AS $$
BEGIN
  -- Créer une entité "particulier" par défaut pour le nouveau propriétaire
  INSERT INTO legal_entities (
    owner_profile_id,
    entity_type,
    nom,
    regime_fiscal,
    is_active
  )
  SELECT
    NEW.profile_id,
    'particulier',
    COALESCE(
      (SELECT CONCAT(prenom, ' ', nom) FROM profiles WHERE id = NEW.profile_id),
      'Patrimoine personnel'
    ),
    'ir',
    true
  WHERE NEW.type = 'particulier';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour créer l'entité par défaut
DROP TRIGGER IF EXISTS trigger_create_default_entity ON owner_profiles;
CREATE TRIGGER trigger_create_default_entity
  AFTER INSERT ON owner_profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_default_particulier_entity();

-- ============================================
-- FONCTION: Calculer le pourcentage de détention
-- ============================================

CREATE OR REPLACE FUNCTION calculate_ownership_percentage(
  p_property_id UUID
) RETURNS TABLE (
  holder_type TEXT,
  holder_id UUID,
  holder_name TEXT,
  detention_type TEXT,
  percentage DECIMAL(6,3)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    CASE
      WHEN po.legal_entity_id IS NOT NULL THEN 'entity'
      ELSE 'profile'
    END AS holder_type,
    COALESCE(po.legal_entity_id, po.profile_id) AS holder_id,
    COALESCE(le.nom, CONCAT(p.prenom, ' ', p.nom)) AS holder_name,
    po.detention_type,
    po.pourcentage_detention AS percentage
  FROM property_ownership po
  LEFT JOIN legal_entities le ON po.legal_entity_id = le.id
  LEFT JOIN profiles p ON po.profile_id = p.id
  WHERE po.property_id = p_property_id
    AND po.is_current = true
  ORDER BY po.pourcentage_detention DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FONCTION: Obtenir les stats par entité
-- ============================================

CREATE OR REPLACE FUNCTION get_entity_stats(
  p_owner_profile_id UUID
) RETURNS TABLE (
  entity_id UUID,
  entity_name TEXT,
  entity_type TEXT,
  regime_fiscal TEXT,
  properties_count BIGINT,
  total_value DECIMAL(14,2),
  monthly_rent DECIMAL(12,2),
  active_leases BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    le.id AS entity_id,
    le.nom AS entity_name,
    le.entity_type,
    le.regime_fiscal,
    COUNT(DISTINCT p.id) AS properties_count,
    COALESCE(SUM(
      CASE WHEN po.is_current THEN po.prix_acquisition ELSE 0 END
    ), 0) AS total_value,
    COALESCE(SUM(p.loyer_hc), 0) AS monthly_rent,
    COUNT(DISTINCT CASE WHEN l.statut = 'active' THEN l.id END) AS active_leases
  FROM legal_entities le
  LEFT JOIN property_ownership po ON po.legal_entity_id = le.id AND po.is_current = true
  LEFT JOIN properties p ON po.property_id = p.id
  LEFT JOIN leases l ON l.property_id = p.id
  WHERE le.owner_profile_id = p_owner_profile_id
    AND le.is_active = true
  GROUP BY le.id, le.nom, le.entity_type, le.regime_fiscal
  ORDER BY properties_count DESC, le.nom;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Activer RLS
ALTER TABLE legal_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_associates ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_ownership ENABLE ROW LEVEL SECURITY;

-- Policies pour legal_entities
CREATE POLICY "Users can view their own entities"
  ON legal_entities FOR SELECT
  USING (
    owner_profile_id IN (
      SELECT profile_id FROM owner_profiles
      WHERE profile_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert their own entities"
  ON legal_entities FOR INSERT
  WITH CHECK (
    owner_profile_id IN (
      SELECT profile_id FROM owner_profiles
      WHERE profile_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update their own entities"
  ON legal_entities FOR UPDATE
  USING (
    owner_profile_id IN (
      SELECT profile_id FROM owner_profiles
      WHERE profile_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete their own entities"
  ON legal_entities FOR DELETE
  USING (
    owner_profile_id IN (
      SELECT profile_id FROM owner_profiles
      WHERE profile_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

-- Policies pour entity_associates
CREATE POLICY "Users can view associates of their entities"
  ON entity_associates FOR SELECT
  USING (
    legal_entity_id IN (
      SELECT id FROM legal_entities WHERE owner_profile_id IN (
        SELECT profile_id FROM owner_profiles
        WHERE profile_id IN (
          SELECT id FROM profiles WHERE user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can manage associates of their entities"
  ON entity_associates FOR ALL
  USING (
    legal_entity_id IN (
      SELECT id FROM legal_entities WHERE owner_profile_id IN (
        SELECT profile_id FROM owner_profiles
        WHERE profile_id IN (
          SELECT id FROM profiles WHERE user_id = auth.uid()
        )
      )
    )
  );

-- Policies pour property_ownership
CREATE POLICY "Users can view ownership of their properties"
  ON property_ownership FOR SELECT
  USING (
    property_id IN (
      SELECT id FROM properties WHERE owner_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
    )
    OR
    legal_entity_id IN (
      SELECT id FROM legal_entities WHERE owner_profile_id IN (
        SELECT profile_id FROM owner_profiles
        WHERE profile_id IN (
          SELECT id FROM profiles WHERE user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can manage ownership of their properties"
  ON property_ownership FOR ALL
  USING (
    property_id IN (
      SELECT id FROM properties WHERE owner_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

-- Policy admin pour toutes les tables
CREATE POLICY "Admins can do everything on legal_entities"
  ON legal_entities FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can do everything on entity_associates"
  ON entity_associates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can do everything on property_ownership"
  ON property_ownership FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- TRIGGERS updated_at
-- ============================================

CREATE TRIGGER update_legal_entities_updated_at
  BEFORE UPDATE ON legal_entities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_entity_associates_updated_at
  BEFORE UPDATE ON entity_associates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_property_ownership_updated_at
  BEFORE UPDATE ON property_ownership
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- MIGRATION DES DONNÉES EXISTANTES
-- ============================================

-- Créer une entité "particulier" pour chaque propriétaire existant qui n'en a pas
INSERT INTO legal_entities (
  owner_profile_id,
  entity_type,
  nom,
  regime_fiscal,
  is_active,
  siret,
  adresse_siege,
  iban
)
SELECT
  op.profile_id,
  CASE
    WHEN op.type = 'societe' THEN 'sci_ir'
    ELSE 'particulier'
  END,
  COALESCE(
    op.raison_sociale,
    CONCAT(p.prenom, ' ', p.nom),
    'Patrimoine personnel'
  ),
  'ir',
  true,
  op.siret,
  op.adresse_facturation,
  op.iban
FROM owner_profiles op
JOIN profiles p ON op.profile_id = p.id
WHERE NOT EXISTS (
  SELECT 1 FROM legal_entities le
  WHERE le.owner_profile_id = op.profile_id
);

-- Lier les propriétés existantes à l'entité par défaut
UPDATE properties p
SET legal_entity_id = (
  SELECT le.id
  FROM legal_entities le
  WHERE le.owner_profile_id = p.owner_id
  ORDER BY le.created_at ASC
  LIMIT 1
),
detention_mode = 'direct'
WHERE p.legal_entity_id IS NULL
  AND EXISTS (
    SELECT 1 FROM legal_entities le
    WHERE le.owner_profile_id = p.owner_id
  );

-- Créer les enregistrements property_ownership pour les propriétés existantes
INSERT INTO property_ownership (
  property_id,
  legal_entity_id,
  profile_id,
  quote_part_numerateur,
  quote_part_denominateur,
  detention_type,
  date_acquisition,
  mode_acquisition,
  is_current
)
SELECT
  p.id,
  p.legal_entity_id,
  NULL,
  1,
  1,
  'pleine_propriete',
  p.created_at::DATE,
  'achat',
  true
FROM properties p
WHERE p.legal_entity_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM property_ownership po
    WHERE po.property_id = p.id
  );

COMMIT;

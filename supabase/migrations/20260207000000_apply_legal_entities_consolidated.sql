-- ============================================================
-- MIGRATION CONSOLIDÉE: Architecture Multi-Entités Juridiques
-- ============================================================
-- Combine les migrations 20260115 + 20260206 en un seul script
-- Prêt à copier-coller dans l'éditeur SQL Supabase
--
-- Ce script:
--   1. Crée les tables legal_entities, entity_associates, property_ownership
--   2. Ajoute les colonnes FK sur properties, leases, invoices
--   3. Configure RLS, triggers, fonctions
--   4. Migre les données existantes de owner_profiles
--
-- SÉCURITÉ: idempotent, utilise IF NOT EXISTS partout

BEGIN;

-- ============================================
-- TABLE: legal_entities (Entités juridiques)
-- ============================================

CREATE TABLE IF NOT EXISTS legal_entities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_profile_id UUID NOT NULL REFERENCES owner_profiles(profile_id) ON DELETE CASCADE,

  -- Type d'entité juridique
  entity_type TEXT NOT NULL CHECK (entity_type IN (
    'particulier',
    'sci_ir',
    'sci_is',
    'sci_construction_vente',
    'sarl',
    'sarl_famille',
    'eurl',
    'sas',
    'sasu',
    'sa',
    'snc',
    'indivision',
    'demembrement_usufruit',
    'demembrement_nue_propriete',
    'holding'
  )),

  -- Identité
  nom TEXT NOT NULL,
  nom_commercial TEXT,

  -- Immatriculation
  siren TEXT CHECK (siren IS NULL OR LENGTH(siren) = 9),
  siret TEXT CHECK (siret IS NULL OR LENGTH(siret) = 14),
  rcs_ville TEXT,
  rcs_numero TEXT,
  numero_tva TEXT,
  code_ape TEXT,

  -- Adresse du siège social
  adresse_siege TEXT,
  complement_adresse TEXT,
  code_postal_siege TEXT,
  ville_siege TEXT,
  pays_siege TEXT DEFAULT 'France',

  -- Forme juridique détaillée
  forme_juridique TEXT,
  capital_social DECIMAL(12,2),
  capital_variable BOOLEAN DEFAULT false,
  capital_min DECIMAL(12,2),
  capital_max DECIMAL(12,2),

  -- Parts sociales
  nombre_parts INTEGER,
  valeur_nominale_part DECIMAL(10,2),

  -- Fiscalité
  regime_fiscal TEXT CHECK (regime_fiscal IN ('ir', 'is', 'ir_option_is', 'is_option_ir')) DEFAULT 'ir',
  date_option_fiscale DATE,
  tva_assujetti BOOLEAN DEFAULT false,
  tva_regime TEXT CHECK (tva_regime IS NULL OR tva_regime IN (
    'franchise', 'reel_simplifie', 'reel_normal', 'mini_reel'
  )),
  tva_taux_defaut DECIMAL(5,2) DEFAULT 20.00,

  -- Exercice comptable
  date_creation DATE,
  date_cloture_exercice TEXT,
  duree_exercice_mois INTEGER DEFAULT 12,
  premier_exercice_debut DATE,
  premier_exercice_fin DATE,

  -- Coordonnées bancaires
  iban TEXT,
  bic TEXT,
  banque_nom TEXT,
  titulaire_compte TEXT,

  -- Gérance/Direction
  type_gerance TEXT CHECK (type_gerance IS NULL OR type_gerance IN (
    'gerant_unique', 'co_gerance', 'gerance_collegiale',
    'president', 'directeur_general', 'conseil_administration'
  )),

  -- Statut
  is_active BOOLEAN DEFAULT true,
  date_radiation DATE,
  motif_radiation TEXT,

  -- Métadonnées
  couleur TEXT,
  icone TEXT,
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index legal_entities (IF NOT EXISTS non supporté pour CREATE INDEX sans nom, on utilise DO block)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_legal_entities_owner') THEN
    CREATE INDEX idx_legal_entities_owner ON legal_entities(owner_profile_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_legal_entities_type') THEN
    CREATE INDEX idx_legal_entities_type ON legal_entities(entity_type);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_legal_entities_siren') THEN
    CREATE INDEX idx_legal_entities_siren ON legal_entities(siren) WHERE siren IS NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_legal_entities_siret') THEN
    CREATE INDEX idx_legal_entities_siret ON legal_entities(siret) WHERE siret IS NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_legal_entities_active') THEN
    CREATE INDEX idx_legal_entities_active ON legal_entities(is_active);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_legal_entities_regime') THEN
    CREATE INDEX idx_legal_entities_regime ON legal_entities(regime_fiscal);
  END IF;
END $$;

-- ============================================
-- TABLE: entity_associates (Associés)
-- ============================================

CREATE TABLE IF NOT EXISTS entity_associates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  legal_entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,

  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  parent_entity_id UUID REFERENCES legal_entities(id) ON DELETE SET NULL,

  -- Identité
  civilite TEXT CHECK (civilite IS NULL OR civilite IN ('M', 'Mme', 'Société')),
  nom TEXT,
  prenom TEXT,
  date_naissance DATE,
  lieu_naissance TEXT,
  nationalite TEXT DEFAULT 'Française',
  adresse TEXT,
  code_postal TEXT,
  ville TEXT,

  -- Personne morale associée
  denomination_sociale TEXT,
  forme_juridique_associe TEXT,
  siren_associe TEXT,
  representant_legal TEXT,

  -- Participation
  nombre_parts INTEGER NOT NULL DEFAULT 0,
  pourcentage_capital DECIMAL(6,3),
  pourcentage_droits_vote DECIMAL(6,3),
  valeur_parts DECIMAL(12,2),

  -- Apports
  apport_initial DECIMAL(12,2),
  type_apport TEXT CHECK (type_apport IS NULL OR type_apport IN (
    'numeraire', 'nature_immobilier', 'nature_mobilier', 'industrie'
  )),
  date_apport DATE,

  -- Détention
  type_detention TEXT DEFAULT 'pleine_propriete' CHECK (type_detention IN (
    'pleine_propriete', 'nue_propriete', 'usufruit', 'indivision'
  )),

  -- Rôles
  is_gerant BOOLEAN DEFAULT false,
  is_president BOOLEAN DEFAULT false,
  is_directeur_general BOOLEAN DEFAULT false,
  is_associe_fondateur BOOLEAN DEFAULT false,
  role_autre TEXT,

  -- Mandat
  date_debut_mandat DATE,
  date_fin_mandat DATE,
  duree_mandat_annees INTEGER,

  -- Pouvoirs
  pouvoirs TEXT,
  limitations_pouvoirs TEXT,
  signature_autorisee BOOLEAN DEFAULT false,
  plafond_engagement DECIMAL(12,2),

  -- Statut
  is_current BOOLEAN DEFAULT true,
  date_entree DATE,
  date_sortie DATE,
  motif_sortie TEXT,

  -- Documents
  piece_identite_document_id UUID,
  justificatif_domicile_document_id UUID,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT check_associate_identity CHECK (
    profile_id IS NOT NULL OR
    parent_entity_id IS NOT NULL OR
    (nom IS NOT NULL AND prenom IS NOT NULL) OR
    denomination_sociale IS NOT NULL
  )
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_entity_associates_entity') THEN
    CREATE INDEX idx_entity_associates_entity ON entity_associates(legal_entity_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_entity_associates_profile') THEN
    CREATE INDEX idx_entity_associates_profile ON entity_associates(profile_id) WHERE profile_id IS NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_entity_associates_parent') THEN
    CREATE INDEX idx_entity_associates_parent ON entity_associates(parent_entity_id) WHERE parent_entity_id IS NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_entity_associates_gerant') THEN
    CREATE INDEX idx_entity_associates_gerant ON entity_associates(legal_entity_id) WHERE is_gerant = true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_entity_associates_current') THEN
    CREATE INDEX idx_entity_associates_current ON entity_associates(legal_entity_id) WHERE is_current = true;
  END IF;
END $$;

-- ============================================
-- TABLE: property_ownership (Détention)
-- ============================================

CREATE TABLE IF NOT EXISTS property_ownership (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,

  legal_entity_id UUID REFERENCES legal_entities(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,

  -- Quote-part
  quote_part_numerateur INTEGER NOT NULL DEFAULT 1,
  quote_part_denominateur INTEGER NOT NULL DEFAULT 1,
  pourcentage_detention DECIMAL(6,3) GENERATED ALWAYS AS (
    (quote_part_numerateur::DECIMAL / quote_part_denominateur::DECIMAL) * 100
  ) STORED,

  -- Type
  detention_type TEXT NOT NULL DEFAULT 'pleine_propriete' CHECK (detention_type IN (
    'pleine_propriete', 'nue_propriete', 'usufruit', 'usufruit_temporaire', 'indivision'
  )),

  usufruit_duree_annees INTEGER,
  usufruit_date_fin DATE,

  -- Acquisition
  date_acquisition DATE,
  mode_acquisition TEXT CHECK (mode_acquisition IS NULL OR mode_acquisition IN (
    'achat', 'apport', 'donation', 'succession', 'echange', 'construction', 'licitation'
  )),
  prix_acquisition DECIMAL(12,2),
  frais_acquisition DECIMAL(12,2),

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
    'vente', 'donation', 'apport_societe', 'succession', 'echange', 'expropriation'
  )),
  prix_cession DECIMAL(12,2),

  is_current BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT check_ownership_holder CHECK (
    (legal_entity_id IS NOT NULL AND profile_id IS NULL) OR
    (legal_entity_id IS NULL AND profile_id IS NOT NULL)
  )
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_property_ownership_property') THEN
    CREATE INDEX idx_property_ownership_property ON property_ownership(property_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_property_ownership_entity') THEN
    CREATE INDEX idx_property_ownership_entity ON property_ownership(legal_entity_id) WHERE legal_entity_id IS NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_property_ownership_profile') THEN
    CREATE INDEX idx_property_ownership_profile ON property_ownership(profile_id) WHERE profile_id IS NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_property_ownership_current') THEN
    CREATE INDEX idx_property_ownership_current ON property_ownership(property_id) WHERE is_current = true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_property_ownership_type') THEN
    CREATE INDEX idx_property_ownership_type ON property_ownership(detention_type);
  END IF;
END $$;

-- ============================================
-- ALTER TABLE: properties
-- ============================================

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS legal_entity_id UUID REFERENCES legal_entities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS detention_mode TEXT DEFAULT 'direct' CHECK (detention_mode IN (
    'direct', 'societe', 'indivision', 'demembrement'
  ));

CREATE INDEX IF NOT EXISTS idx_properties_legal_entity ON properties(legal_entity_id) WHERE legal_entity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_properties_detention_mode ON properties(detention_mode);

-- ============================================
-- ALTER TABLE: leases
-- ============================================

ALTER TABLE leases
  ADD COLUMN IF NOT EXISTS signatory_entity_id UUID REFERENCES legal_entities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS bailleur_nom TEXT,
  ADD COLUMN IF NOT EXISTS bailleur_adresse TEXT,
  ADD COLUMN IF NOT EXISTS bailleur_siret TEXT;

CREATE INDEX IF NOT EXISTS idx_leases_signatory_entity ON leases(signatory_entity_id) WHERE signatory_entity_id IS NOT NULL;

-- ============================================
-- ALTER TABLE: invoices
-- ============================================

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS issuer_entity_id UUID REFERENCES legal_entities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS issuer_nom TEXT,
  ADD COLUMN IF NOT EXISTS issuer_adresse TEXT,
  ADD COLUMN IF NOT EXISTS issuer_siret TEXT,
  ADD COLUMN IF NOT EXISTS issuer_tva TEXT;

CREATE INDEX IF NOT EXISTS idx_invoices_issuer_entity ON invoices(issuer_entity_id) WHERE issuer_entity_id IS NOT NULL;

-- ============================================
-- FONCTION: Créer entité par défaut (trigger)
-- ============================================

CREATE OR REPLACE FUNCTION create_default_particulier_entity()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO legal_entities (
    owner_profile_id, entity_type, nom, regime_fiscal, is_active
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

DROP TRIGGER IF EXISTS trigger_create_default_entity ON owner_profiles;
CREATE TRIGGER trigger_create_default_entity
  AFTER INSERT ON owner_profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_default_particulier_entity();

-- ============================================
-- FONCTION: Stats par entité
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
    COALESCE(SUM(CASE WHEN po.is_current THEN po.prix_acquisition ELSE 0 END), 0) AS total_value,
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
-- FONCTION: Pourcentage de détention
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
    CASE WHEN po.legal_entity_id IS NOT NULL THEN 'entity' ELSE 'profile' END AS holder_type,
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
-- RLS POLICIES
-- ============================================

ALTER TABLE legal_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_associates ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_ownership ENABLE ROW LEVEL SECURITY;

-- legal_entities policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own entities' AND tablename = 'legal_entities') THEN
    CREATE POLICY "Users can view their own entities"
      ON legal_entities FOR SELECT
      USING (owner_profile_id IN (
        SELECT profile_id FROM owner_profiles
        WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
      ));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert their own entities' AND tablename = 'legal_entities') THEN
    CREATE POLICY "Users can insert their own entities"
      ON legal_entities FOR INSERT
      WITH CHECK (owner_profile_id IN (
        SELECT profile_id FROM owner_profiles
        WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
      ));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update their own entities' AND tablename = 'legal_entities') THEN
    CREATE POLICY "Users can update their own entities"
      ON legal_entities FOR UPDATE
      USING (owner_profile_id IN (
        SELECT profile_id FROM owner_profiles
        WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
      ));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete their own entities' AND tablename = 'legal_entities') THEN
    CREATE POLICY "Users can delete their own entities"
      ON legal_entities FOR DELETE
      USING (owner_profile_id IN (
        SELECT profile_id FROM owner_profiles
        WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
      ));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can do everything on legal_entities' AND tablename = 'legal_entities') THEN
    CREATE POLICY "Admins can do everything on legal_entities"
      ON legal_entities FOR ALL
      USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'));
  END IF;
END $$;

-- entity_associates policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view associates of their entities' AND tablename = 'entity_associates') THEN
    CREATE POLICY "Users can view associates of their entities"
      ON entity_associates FOR SELECT
      USING (legal_entity_id IN (
        SELECT id FROM legal_entities WHERE owner_profile_id IN (
          SELECT profile_id FROM owner_profiles
          WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
        )
      ));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage associates of their entities' AND tablename = 'entity_associates') THEN
    CREATE POLICY "Users can manage associates of their entities"
      ON entity_associates FOR ALL
      USING (legal_entity_id IN (
        SELECT id FROM legal_entities WHERE owner_profile_id IN (
          SELECT profile_id FROM owner_profiles
          WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
        )
      ));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can do everything on entity_associates' AND tablename = 'entity_associates') THEN
    CREATE POLICY "Admins can do everything on entity_associates"
      ON entity_associates FOR ALL
      USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'));
  END IF;
END $$;

-- property_ownership policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view ownership of their properties' AND tablename = 'property_ownership') THEN
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
            WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
          )
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage ownership of their properties' AND tablename = 'property_ownership') THEN
    CREATE POLICY "Users can manage ownership of their properties"
      ON property_ownership FOR ALL
      USING (property_id IN (
        SELECT id FROM properties WHERE owner_id IN (
          SELECT id FROM profiles WHERE user_id = auth.uid()
        )
      ));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can do everything on property_ownership' AND tablename = 'property_ownership') THEN
    CREATE POLICY "Admins can do everything on property_ownership"
      ON property_ownership FOR ALL
      USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'));
  END IF;
END $$;

-- ============================================
-- TRIGGERS updated_at
-- ============================================

DROP TRIGGER IF EXISTS update_legal_entities_updated_at ON legal_entities;
CREATE TRIGGER update_legal_entities_updated_at
  BEFORE UPDATE ON legal_entities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_entity_associates_updated_at ON entity_associates;
CREATE TRIGGER update_entity_associates_updated_at
  BEFORE UPDATE ON entity_associates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_property_ownership_updated_at ON property_ownership;
CREATE TRIGGER update_property_ownership_updated_at
  BEFORE UPDATE ON property_ownership
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- MIGRATION DES DONNÉES EXISTANTES
-- ============================================

-- 1. Créer une entité pour chaque propriétaire existant
--    Société: mapping intelligent forme_juridique → entity_type
--    Particulier: entité "particulier"
INSERT INTO legal_entities (
  owner_profile_id,
  entity_type,
  nom,
  forme_juridique,
  regime_fiscal,
  is_active,
  siret,
  adresse_siege,
  iban
)
SELECT
  op.profile_id,
  CASE
    WHEN op.type = 'societe' THEN
      CASE
        WHEN op.forme_juridique = 'SCI'  THEN 'sci_ir'
        WHEN op.forme_juridique = 'SARL' THEN 'sarl'
        WHEN op.forme_juridique = 'SAS'  THEN 'sas'
        WHEN op.forme_juridique = 'SASU' THEN 'sasu'
        WHEN op.forme_juridique = 'EURL' THEN 'eurl'
        WHEN op.forme_juridique = 'EI'   THEN 'eurl'
        WHEN op.forme_juridique = 'SA'   THEN 'sa'
        WHEN op.forme_juridique = 'SCPI' THEN 'sci_ir'
        WHEN op.forme_juridique = 'SNC'  THEN 'snc'
        ELSE 'sarl'
      END
    ELSE 'particulier'
  END,
  COALESCE(
    op.raison_sociale,
    CONCAT(p.prenom, ' ', p.nom),
    'Patrimoine personnel'
  ),
  op.forme_juridique,
  'ir',
  true,
  op.siret,
  COALESCE(op.adresse_siege, op.adresse_facturation),
  op.iban
FROM owner_profiles op
JOIN profiles p ON op.profile_id = p.id
WHERE NOT EXISTS (
  SELECT 1 FROM legal_entities le
  WHERE le.owner_profile_id = op.profile_id
);

-- 2. Lier les propriétés à l'entité par défaut
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

-- 3. Lier les baux actifs à l'entité via la propriété
UPDATE leases l
SET signatory_entity_id = p.legal_entity_id
FROM properties p
WHERE l.property_id = p.id
  AND l.signatory_entity_id IS NULL
  AND p.legal_entity_id IS NOT NULL
  AND l.statut IN ('active', 'pending_signature', 'draft');

-- 4. Créer les enregistrements property_ownership
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

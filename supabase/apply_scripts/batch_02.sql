CREATE POLICY "Roommates can view their credits"
  ON payment_credits FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM roommates r
      WHERE r.id = payment_credits.roommate_id
        AND r.user_id = auth.uid()
    )
  );

-- Policies pour roommate_history
CREATE POLICY "Owners can view roommate history"
  ON roommate_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON l.property_id = p.id
      JOIN profiles pr ON p.owner_id = pr.id
      WHERE l.id = roommate_history.lease_id
        AND pr.user_id = auth.uid()
    )
  );

CREATE POLICY "Roommates can view history of their lease"
  ON roommate_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM roommates r
      WHERE r.lease_id = roommate_history.lease_id
        AND r.user_id = auth.uid()
    )
  );

-- ============================================
-- 11. TRIGGERS UPDATED_AT
-- ============================================

CREATE TRIGGER update_deposit_shares_updated_at 
  BEFORE UPDATE ON deposit_shares 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_credits_updated_at 
  BEFORE UPDATE ON payment_credits 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- FIN DE LA MIGRATION
-- ============================================

COMMENT ON SCHEMA public IS 'Migration colocation avancée appliquée - SOTA 2025';



-- ========== 20251207231451_add_visite_virtuelle_url.sql ==========
-- Migration : Ajout de la colonne visite_virtuelle_url pour les visites virtuelles (Matterport, Nodalview, etc.)
BEGIN;

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS visite_virtuelle_url TEXT;

COMMIT;



-- ========== 20251208000000_fix_all_roles_complete.sql ==========
-- ============================================
-- Migration : Correction complète de tous les rôles
-- Date: 2024-12-08
-- Corrige: guarantor, agency, syndic, copropriétaire
-- ============================================

BEGIN;

-- ============================================
-- 1. CORRIGER LA CONTRAINTE CHECK DES RÔLES
-- ============================================

-- Supprimer l'ancienne contrainte
ALTER TABLE profiles 
DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Ajouter la nouvelle contrainte avec TOUS les rôles
ALTER TABLE profiles 
ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('admin', 'owner', 'tenant', 'provider', 'agency', 'guarantor', 'syndic', 'coproprietaire'));

COMMENT ON CONSTRAINT profiles_role_check ON profiles IS 'Contrainte des rôles valides: admin, owner, tenant, provider, agency, guarantor, syndic, coproprietaire';

-- ============================================
-- 2. TABLE GUARANTOR_PROFILES
-- ============================================

CREATE TABLE IF NOT EXISTS guarantor_profiles (
  profile_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Informations personnelles
  situation_professionnelle TEXT CHECK (situation_professionnelle IN (
    'salarie_cdi', 'salarie_cdd', 'fonctionnaire', 'independant', 
    'retraite', 'sans_emploi', 'etudiant', 'autre'
  )),
  employeur TEXT,
  profession TEXT,
  revenus_mensuels_nets DECIMAL(10, 2),
  revenus_annuels DECIMAL(12, 2),
  
  -- Patrimoine
  proprietaire_residence BOOLEAN DEFAULT false,
  valeur_patrimoine_immobilier DECIMAL(12, 2),
  epargne_disponible DECIMAL(12, 2),
  
  -- Documents
  documents_verified BOOLEAN DEFAULT false,
  avis_imposition_url TEXT,
  justificatif_domicile_url TEXT,
  cni_url TEXT,
  
  -- Statut
  onboarding_completed BOOLEAN DEFAULT false,
  onboarding_step INTEGER DEFAULT 0,
  
  -- Métadonnées
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guarantor_profiles_verified ON guarantor_profiles(documents_verified);
CREATE INDEX IF NOT EXISTS idx_guarantor_profiles_onboarding ON guarantor_profiles(onboarding_completed);

COMMENT ON TABLE guarantor_profiles IS 'Profils des garants avec informations financières';

-- ============================================
-- 3. TABLE DES ENGAGEMENTS DE GARANTIE
-- ============================================

CREATE TABLE IF NOT EXISTS guarantor_engagements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guarantor_profile_id UUID NOT NULL REFERENCES guarantor_profiles(profile_id) ON DELETE CASCADE,
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  tenant_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Détails de l'engagement
  type_garantie TEXT NOT NULL DEFAULT 'caution_simple' 
    CHECK (type_garantie IN ('caution_simple', 'caution_solidaire')),
  montant_max_garanti DECIMAL(10, 2), -- Montant max couvert (null = illimité)
  duree_engagement TEXT CHECK (duree_engagement IN ('duree_bail', 'illimitee', 'limitee')),
  date_fin_engagement DATE, -- Si durée limitée
  
  -- Statut
  statut TEXT NOT NULL DEFAULT 'pending' 
    CHECK (statut IN ('pending', 'active', 'expired', 'invoked', 'terminated')),
  date_signature DATE,
  document_engagement_url TEXT,
  
  -- Historique d'invocation
  date_derniere_invocation DATE,
  montant_total_invoque DECIMAL(10, 2) DEFAULT 0,
  
  -- Métadonnées
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(guarantor_profile_id, lease_id, tenant_profile_id)
);

CREATE INDEX IF NOT EXISTS idx_guarantor_engagements_guarantor ON guarantor_engagements(guarantor_profile_id);
CREATE INDEX IF NOT EXISTS idx_guarantor_engagements_lease ON guarantor_engagements(lease_id);
CREATE INDEX IF NOT EXISTS idx_guarantor_engagements_tenant ON guarantor_engagements(tenant_profile_id);
CREATE INDEX IF NOT EXISTS idx_guarantor_engagements_statut ON guarantor_engagements(statut);

COMMENT ON TABLE guarantor_engagements IS 'Engagements de caution des garants pour les baux';

-- ============================================
-- 4. TABLES SYNDIC/COPRO (si non existantes)
-- ============================================

-- Table des sites de copropriété
CREATE TABLE IF NOT EXISTS sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT DEFAULT 'copropriete' CHECK (type IN ('copropriete', 'lotissement', 'residence_mixte', 'asl', 'aful')),
  
  -- Adresse
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  postal_code TEXT NOT NULL,
  city TEXT NOT NULL,
  country TEXT DEFAULT 'FR',
  
  -- Informations légales
  siret TEXT,
  numero_immatriculation TEXT,
  date_reglement DATE,
  
  -- Configuration
  fiscal_year_start_month INTEGER DEFAULT 1 CHECK (fiscal_year_start_month BETWEEN 1 AND 12),
  total_tantiemes_general INTEGER DEFAULT 10000,
  
  -- Syndic
  syndic_type TEXT DEFAULT 'professionnel' CHECK (syndic_type IN ('professionnel', 'benevole', 'cooperatif')),
  syndic_profile_id UUID REFERENCES profiles(id),
  syndic_company_name TEXT,
  syndic_siret TEXT,
  syndic_address TEXT,
  syndic_email TEXT,
  syndic_phone TEXT,
  
  -- Statut
  is_active BOOLEAN DEFAULT true,
  
  -- Métadonnées
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sites_syndic ON sites(syndic_profile_id);
CREATE INDEX IF NOT EXISTS idx_sites_active ON sites(is_active);

COMMENT ON TABLE sites IS 'Sites de copropriété gérés';

-- Table des bâtiments
CREATE TABLE IF NOT EXISTS buildings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT, -- Code interne (ex: A, B, Entrée 1)
  floors_count INTEGER,
  has_elevator BOOLEAN DEFAULT false,
  construction_year INTEGER,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_buildings_site ON buildings(site_id);

COMMENT ON TABLE buildings IS 'Bâtiments d''une copropriété';

-- Table des lots (unités de copropriété)
CREATE TABLE IF NOT EXISTS copro_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  building_id UUID REFERENCES buildings(id) ON DELETE SET NULL,
  
  -- Identification
  lot_number TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('appartement', 'parking', 'cave', 'box', 'local_commercial', 'bureau', 'autre')),
  description TEXT,
  floor INTEGER,
  surface DECIMAL(8, 2),
  
  -- Propriétaire
  owner_profile_id UUID REFERENCES profiles(id),
  
  -- Tantièmes
  tantieme_general INTEGER NOT NULL DEFAULT 0,
  tantiemes_speciaux JSONB DEFAULT '{}', -- {"ascenseur": 100, "chauffage": 150}
  
  -- Lien avec le module locatif
  property_id UUID REFERENCES properties(id), -- Si le lot est aussi un bien locatif
  
  -- Statut
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(site_id, lot_number)
);

CREATE INDEX IF NOT EXISTS idx_copro_units_site ON copro_units(site_id);
CREATE INDEX IF NOT EXISTS idx_copro_units_building ON copro_units(building_id);
CREATE INDEX IF NOT EXISTS idx_copro_units_owner ON copro_units(owner_profile_id);
CREATE INDEX IF NOT EXISTS idx_copro_units_property ON copro_units(property_id);

COMMENT ON TABLE copro_units IS 'Lots (unités) de copropriété';

-- Table des rôles utilisateurs sur les sites
CREATE TABLE IF NOT EXISTS user_site_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  role_code TEXT NOT NULL CHECK (role_code IN ('syndic', 'conseil_syndical', 'coproprietaire', 'coproprietaire_bailleur', 'locataire_copro')),
  
  -- Si copropriétaire, lier aux lots
  unit_ids UUID[] DEFAULT '{}',
  
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(user_id, site_id, role_code)
);

CREATE INDEX IF NOT EXISTS idx_user_site_roles_user ON user_site_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_site_roles_site ON user_site_roles(site_id);
CREATE INDEX IF NOT EXISTS idx_user_site_roles_role ON user_site_roles(role_code);

COMMENT ON TABLE user_site_roles IS 'Rôles des utilisateurs sur les sites de copropriété';

-- ============================================
-- 5. RLS POLICIES POUR GUARANTOR
-- ============================================

ALTER TABLE guarantor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE guarantor_engagements ENABLE ROW LEVEL SECURITY;

-- Guarantor profiles - voir son propre profil
CREATE POLICY "guarantor_profiles_select_own" ON guarantor_profiles
  FOR SELECT USING (
    profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Guarantor profiles - créer son propre profil
CREATE POLICY "guarantor_profiles_insert_own" ON guarantor_profiles
  FOR INSERT WITH CHECK (
    profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Guarantor profiles - modifier son propre profil
CREATE POLICY "guarantor_profiles_update_own" ON guarantor_profiles
  FOR UPDATE USING (
    profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Admin peut tout voir et modifier
CREATE POLICY "guarantor_profiles_admin_all" ON guarantor_profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Engagements - le garant voit ses engagements
CREATE POLICY "guarantor_engagements_select_guarantor" ON guarantor_engagements
  FOR SELECT USING (
    guarantor_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Engagements - le propriétaire voit les engagements de ses baux
CREATE POLICY "guarantor_engagements_select_owner" ON guarantor_engagements
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON l.property_id = p.id
      WHERE l.id = lease_id
      AND p.owner_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- Engagements - le locataire voit les engagements le concernant
CREATE POLICY "guarantor_engagements_select_tenant" ON guarantor_engagements
  FOR SELECT USING (
    tenant_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Engagements - admin peut tout voir
CREATE POLICY "guarantor_engagements_admin_all" ON guarantor_engagements
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- 6. RLS POLICIES POUR SYNDIC/COPRO
-- ============================================

ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE copro_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_site_roles ENABLE ROW LEVEL SECURITY;

-- Sites - le syndic peut tout faire sur ses sites
CREATE POLICY "sites_syndic_all" ON sites
  FOR ALL USING (
    syndic_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Sites - les copropriétaires peuvent voir leurs sites
CREATE POLICY "sites_coproprietaire_select" ON sites
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_site_roles usr
      WHERE usr.site_id = sites.id
      AND usr.user_id = auth.uid()
    )
  );

-- Sites - admin peut tout voir
CREATE POLICY "sites_admin_all" ON sites
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Buildings - accessible via le site
CREATE POLICY "buildings_via_site" ON buildings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sites s
      WHERE s.id = site_id
      AND (
        s.syndic_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM user_site_roles usr WHERE usr.site_id = s.id AND usr.user_id = auth.uid())
      )
    )
  );

-- Buildings - syndic peut modifier
CREATE POLICY "buildings_syndic_manage" ON buildings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM sites s
      WHERE s.id = site_id
      AND s.syndic_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- Copro_units - accessible via le site
CREATE POLICY "copro_units_via_site" ON copro_units
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sites s
      WHERE s.id = site_id
      AND (
        s.syndic_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM user_site_roles usr WHERE usr.site_id = s.id AND usr.user_id = auth.uid())
      )
    )
    OR owner_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Copro_units - syndic peut modifier
CREATE POLICY "copro_units_syndic_manage" ON copro_units
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM sites s
      WHERE s.id = site_id
      AND s.syndic_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- User_site_roles - visible par l'utilisateur concerné ou le syndic
CREATE POLICY "user_site_roles_select" ON user_site_roles
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM sites s
      WHERE s.id = site_id
      AND s.syndic_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- User_site_roles - syndic peut gérer
CREATE POLICY "user_site_roles_syndic_manage" ON user_site_roles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM sites s
      WHERE s.id = site_id
      AND s.syndic_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- ============================================
-- 7. FONCTION RPC GUARANTOR_DASHBOARD
-- ============================================

CREATE OR REPLACE FUNCTION guarantor_dashboard(p_guarantor_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile_id UUID;
  v_guarantor_profile RECORD;
  v_engagements JSONB;
  v_stats JSONB;
BEGIN
  -- Récupérer le profile_id
  SELECT id INTO v_profile_id
  FROM profiles
  WHERE user_id = p_guarantor_user_id;
  
  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Profile not found');
  END IF;
  
  -- Récupérer le profil garant
  SELECT * INTO v_guarantor_profile
  FROM guarantor_profiles
  WHERE profile_id = v_profile_id;
  
  IF v_guarantor_profile IS NULL THEN
    RETURN jsonb_build_object(
      'has_profile', false,
      'onboarding_required', true
    );
  END IF;
  
  -- Récupérer les engagements
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', ge.id,
      'lease_id', ge.lease_id,
      'tenant_name', COALESCE(tp.prenom || ' ' || tp.nom, 'Inconnu'),
      'property_address', COALESCE(pr.adresse_complete, 'Adresse inconnue'),
      'type_garantie', ge.type_garantie,
      'statut', ge.statut,
      'montant_max_garanti', ge.montant_max_garanti,
      'loyer', l.loyer,
      'date_signature', ge.date_signature
    )
  ), '[]'::jsonb)
  INTO v_engagements
  FROM guarantor_engagements ge
  JOIN leases l ON l.id = ge.lease_id
  JOIN profiles tp ON tp.id = ge.tenant_profile_id
  LEFT JOIN properties pr ON pr.id = l.property_id
  WHERE ge.guarantor_profile_id = v_profile_id;
  
  -- Calculer les stats
  SELECT jsonb_build_object(
    'total_engagements', COUNT(*),
    'engagements_actifs', COUNT(*) FILTER (WHERE statut = 'active'),
    'engagements_en_attente', COUNT(*) FILTER (WHERE statut = 'pending'),
    'montant_total_garanti', COALESCE(SUM(l.loyer) FILTER (WHERE ge.statut = 'active'), 0)
  )
  INTO v_stats
  FROM guarantor_engagements ge
  JOIN leases l ON l.id = ge.lease_id
  WHERE ge.guarantor_profile_id = v_profile_id;
  
  RETURN jsonb_build_object(
    'has_profile', true,
    'onboarding_completed', v_guarantor_profile.onboarding_completed,
    'documents_verified', v_guarantor_profile.documents_verified,
    'profile', jsonb_build_object(
      'situation_professionnelle', v_guarantor_profile.situation_professionnelle,
      'profession', v_guarantor_profile.profession,
      'revenus_mensuels_nets', v_guarantor_profile.revenus_mensuels_nets
    ),
    'engagements', v_engagements,
    'stats', v_stats
  );
END;
$$;

COMMENT ON FUNCTION guarantor_dashboard IS 'Retourne les données du dashboard garant';

-- ============================================
-- 8. FONCTION RPC SYNDIC_DASHBOARD
-- ============================================

CREATE OR REPLACE FUNCTION syndic_dashboard(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile_id UUID;
  v_sites JSONB;
  v_stats JSONB;
BEGIN
  -- Récupérer le profile_id
  SELECT id INTO v_profile_id
  FROM profiles
  WHERE user_id = p_user_id;
  
  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Profile not found');
  END IF;
  
  -- Récupérer les sites gérés
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'name', s.name,
      'type', s.type,
      'address', s.address_line1 || ', ' || s.postal_code || ' ' || s.city,
      'total_tantiemes', s.total_tantiemes_general,
      'buildings_count', (SELECT COUNT(*) FROM buildings b WHERE b.site_id = s.id),
      'units_count', (SELECT COUNT(*) FROM copro_units cu WHERE cu.site_id = s.id)
    )
  ), '[]'::jsonb)
  INTO v_sites
  FROM sites s
  WHERE s.syndic_profile_id = v_profile_id
  AND s.is_active = true;
  
  -- Calculer les stats globales
  SELECT jsonb_build_object(
    'total_sites', COUNT(*),
    'total_buildings', (SELECT COUNT(*) FROM buildings b JOIN sites s2 ON b.site_id = s2.id WHERE s2.syndic_profile_id = v_profile_id),
    'total_units', (SELECT COUNT(*) FROM copro_units cu JOIN sites s3 ON cu.site_id = s3.id WHERE s3.syndic_profile_id = v_profile_id),
    'total_coproprietaires', (
      SELECT COUNT(DISTINCT usr.user_id) 
      FROM user_site_roles usr 
      JOIN sites s4 ON usr.site_id = s4.id 
      WHERE s4.syndic_profile_id = v_profile_id
      AND usr.role_code IN ('coproprietaire', 'coproprietaire_bailleur')
    )
  )
  INTO v_stats
  FROM sites s
  WHERE s.syndic_profile_id = v_profile_id
  AND s.is_active = true;
  
  RETURN jsonb_build_object(
    'profile_id', v_profile_id,
    'sites', v_sites,
    'stats', v_stats
  );
END;
$$;

COMMENT ON FUNCTION syndic_dashboard IS 'Retourne les données du dashboard syndic';

-- ============================================
-- 9. TRIGGERS UPDATED_AT
-- ============================================

-- Trigger générique
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_guarantor_profiles_updated_at ON guarantor_profiles;
CREATE TRIGGER update_guarantor_profiles_updated_at
  BEFORE UPDATE ON guarantor_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_guarantor_engagements_updated_at ON guarantor_engagements;
CREATE TRIGGER update_guarantor_engagements_updated_at
  BEFORE UPDATE ON guarantor_engagements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sites_updated_at ON sites;
CREATE TRIGGER update_sites_updated_at
  BEFORE UPDATE ON sites
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_buildings_updated_at ON buildings;
CREATE TRIGGER update_buildings_updated_at
  BEFORE UPDATE ON buildings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_copro_units_updated_at ON copro_units;
CREATE TRIGGER update_copro_units_updated_at
  BEFORE UPDATE ON copro_units
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 10. GRANTS
-- ============================================

GRANT SELECT, INSERT, UPDATE ON guarantor_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON guarantor_engagements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON sites TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON buildings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON copro_units TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_site_roles TO authenticated;

COMMIT;

-- ============================================
-- FIN DE LA MIGRATION
-- ============================================



-- ========== 20251210100000_add_lease_payment_fields.sql ==========
-- Migration: Ajouter les champs de paiement et révision au bail
-- Date: 2025-12-10

-- Champs de modalités de paiement
ALTER TABLE leases
ADD COLUMN IF NOT EXISTS charges_type TEXT DEFAULT 'forfait' CHECK (charges_type IN ('forfait', 'provisions'));

ALTER TABLE leases
ADD COLUMN IF NOT EXISTS mode_paiement TEXT DEFAULT 'virement' CHECK (mode_paiement IN ('virement', 'prelevement', 'cheque', 'especes'));

ALTER TABLE leases
ADD COLUMN IF NOT EXISTS jour_paiement INTEGER DEFAULT 5 CHECK (jour_paiement >= 1 AND jour_paiement <= 28);

-- Champs de révision du loyer
ALTER TABLE leases
ADD COLUMN IF NOT EXISTS revision_autorisee BOOLEAN DEFAULT true;

-- Clauses particulières (texte libre)
ALTER TABLE leases
ADD COLUMN IF NOT EXISTS clauses_particulieres TEXT;

-- Commentaires
COMMENT ON COLUMN leases.charges_type IS 'Type de charges: forfait (montant fixe) ou provisions (régularisation annuelle)';
COMMENT ON COLUMN leases.mode_paiement IS 'Mode de paiement du loyer: virement, prélèvement, chèque, espèces';
COMMENT ON COLUMN leases.jour_paiement IS 'Jour du mois pour le paiement du loyer (1-28)';
COMMENT ON COLUMN leases.revision_autorisee IS 'Si la révision annuelle du loyer est autorisée';
COMMENT ON COLUMN leases.clauses_particulieres IS 'Clauses particulières ajoutées au bail';


-- ========== 20251221000000_document_caching.sql ==========
-- =====================================================
-- Migration: Optimisation du cache des documents générés
-- Date: 2024-12-21
-- Pattern: Création unique → Lectures multiples
-- =====================================================
-- 
-- Cette migration ajoute les structures nécessaires pour implémenter
-- le pattern "création unique → lectures multiples" pour tous les
-- documents générés (quittances, baux, EDL, factures, etc.)
--
-- Principe:
-- 1. Un document est généré UNE SEULE FOIS lors de la première demande
-- 2. Stocké dans Supabase Storage avec référence dans la table documents
-- 3. Les demandes suivantes retournent le document stocké via URL signée
-- 4. Un hash permet d'invalider le cache si les données source changent
-- =====================================================

BEGIN;

-- ============================================
-- ÉTENDRE LA TABLE DOCUMENTS
-- ============================================

-- Ajouter colonne content_hash pour déduplication rapide
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'documents' AND column_name = 'content_hash'
  ) THEN
    ALTER TABLE documents ADD COLUMN content_hash TEXT;
    COMMENT ON COLUMN documents.content_hash IS 'Hash SHA256 du contenu/données source pour cache invalidation';
  END IF;
END $$;

-- Ajouter colonne is_generated pour distinguer documents uploadés vs générés
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'documents' AND column_name = 'is_generated'
  ) THEN
    ALTER TABLE documents ADD COLUMN is_generated BOOLEAN DEFAULT FALSE;
    COMMENT ON COLUMN documents.is_generated IS 'TRUE si document généré automatiquement (PDF), FALSE si uploadé manuellement';
  END IF;
END $$;

-- Ajouter colonne generation_source pour traçabilité
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'documents' AND column_name = 'generation_source'
  ) THEN
    ALTER TABLE documents ADD COLUMN generation_source TEXT;
    COMMENT ON COLUMN documents.generation_source IS 'Source de génération: api_receipt, api_lease_pdf, edge_function, etc.';
  END IF;
END $$;

-- ============================================
-- INDEX POUR RECHERCHE RAPIDE
-- ============================================

-- Index sur le hash pour recherche par contenu (déduplication)
CREATE INDEX IF NOT EXISTS idx_documents_content_hash 
  ON documents(content_hash) 
  WHERE content_hash IS NOT NULL;

-- Index composite pour les quittances (recherche fréquente)
CREATE INDEX IF NOT EXISTS idx_documents_quittance_lookup 
  ON documents(type, tenant_id, lease_id) 
  WHERE type = 'quittance';

-- Index composite pour les baux
CREATE INDEX IF NOT EXISTS idx_documents_bail_lookup 
  ON documents(type, lease_id) 
  WHERE type = 'bail';

-- Index sur metadata->hash (utilisé par les API)
CREATE INDEX IF NOT EXISTS idx_documents_metadata_hash 
  ON documents((metadata->>'hash'))
  WHERE metadata->>'hash' IS NOT NULL;

-- Index sur metadata->payment_id (pour quittances)
CREATE INDEX IF NOT EXISTS idx_documents_metadata_payment 
  ON documents((metadata->>'payment_id'))
  WHERE metadata->>'payment_id' IS NOT NULL;

-- Index sur is_generated
CREATE INDEX IF NOT EXISTS idx_documents_is_generated
  ON documents(is_generated)
  WHERE is_generated = TRUE;

-- ============================================
-- TABLE DE CACHE DES APERÇUS HTML (optionnel)
-- ============================================

CREATE TABLE IF NOT EXISTS preview_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Clé de cache (composite unique)
  cache_key TEXT NOT NULL,
  
  -- Type d'aperçu
  preview_type TEXT NOT NULL CHECK (preview_type IN ('lease', 'receipt', 'edl', 'invoice', 'other')),
  
  -- Contenu HTML généré
  html_content TEXT NOT NULL,
  
  -- Métadonnées
  data_hash TEXT NOT NULL,
  
  -- TTL - expire après 1 heure par défaut
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 hour'),
  
  -- Tracking
  hit_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Contraintes
  CONSTRAINT preview_cache_key_unique UNIQUE (cache_key),
  CONSTRAINT preview_cache_valid_expiry CHECK (expires_at > created_at)
);

-- Index pour nettoyage automatique des aperçus expirés
CREATE INDEX IF NOT EXISTS idx_preview_cache_expires 
  ON preview_cache(expires_at);

-- Index pour recherche par type et hash
CREATE INDEX IF NOT EXISTS idx_preview_cache_lookup
  ON preview_cache(preview_type, data_hash);

-- ============================================
-- FONCTION DE NETTOYAGE DES APERÇUS EXPIRÉS
-- ============================================

CREATE OR REPLACE FUNCTION cleanup_expired_previews()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM preview_cache WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Log si beaucoup de suppressions
  IF deleted_count > 100 THEN
    RAISE NOTICE 'cleanup_expired_previews: % aperçus expirés supprimés', deleted_count;
  END IF;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FONCTION POUR OBTENIR OU MARQUER CRÉATION
-- ============================================

CREATE OR REPLACE FUNCTION get_or_mark_document_creation(
  p_type TEXT,
  p_hash TEXT,
  p_lease_id UUID DEFAULT NULL,
  p_property_id UUID DEFAULT NULL,
  p_owner_id UUID DEFAULT NULL,
  p_tenant_id UUID DEFAULT NULL,
  p_payment_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  document_id UUID,
  storage_path TEXT,
  is_new BOOLEAN,
  created_at TIMESTAMPTZ
) AS $$
DECLARE
  v_existing_doc RECORD;
BEGIN
  -- Chercher document existant par type et hash
  SELECT d.id, d.storage_path, d.created_at INTO v_existing_doc
  FROM documents d
  WHERE d.type = p_type
    AND (
      d.content_hash = p_hash 
      OR d.metadata->>'hash' = p_hash
      OR (p_payment_id IS NOT NULL AND d.metadata->>'payment_id' = p_payment_id)
    )
    AND (p_lease_id IS NULL OR d.lease_id = p_lease_id)
    AND (p_property_id IS NULL OR d.property_id = p_property_id)
    AND (p_owner_id IS NULL OR d.owner_id = p_owner_id)
    AND (p_tenant_id IS NULL OR d.tenant_id = p_tenant_id)
  ORDER BY d.created_at DESC
  LIMIT 1;

  IF v_existing_doc.id IS NOT NULL THEN
    -- Document existe → retourner pour LECTURE
    RETURN QUERY SELECT 
      v_existing_doc.id, 
      v_existing_doc.storage_path, 
      FALSE::BOOLEAN,
      v_existing_doc.created_at;
  ELSE
    -- Document n'existe pas → signaler pour CRÉATION
    RETURN QUERY SELECT 
      NULL::UUID, 
      NULL::TEXT, 
      TRUE::BOOLEAN,
      NULL::TIMESTAMPTZ;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_or_mark_document_creation IS 
  'Vérifie si un document existe déjà pour éviter régénération (pattern création unique → lectures multiples)';

-- ============================================
-- FONCTION POUR METTRE À JOUR LE COMPTEUR D'APERÇU
-- ============================================

CREATE OR REPLACE FUNCTION update_preview_cache_hit(p_cache_key TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE preview_cache
  SET 
    hit_count = hit_count + 1,
    last_accessed_at = NOW(),
    -- Prolonger le TTL si souvent accédé
    expires_at = CASE 
      WHEN hit_count > 10 THEN GREATEST(expires_at, NOW() + INTERVAL '2 hours')
      ELSE expires_at
    END
  WHERE cache_key = p_cache_key;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGER POUR NETTOYER LES VIEUX APERÇUS
-- ============================================

-- Supprimer automatiquement les aperçus après insertion si trop nombreux
CREATE OR REPLACE FUNCTION cleanup_old_previews_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Si plus de 10000 aperçus, supprimer les plus anciens
  IF (SELECT COUNT(*) FROM preview_cache) > 10000 THEN
    DELETE FROM preview_cache
    WHERE id IN (
      SELECT id FROM preview_cache
      ORDER BY last_accessed_at NULLS FIRST, created_at
      LIMIT 1000
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cleanup_old_previews ON preview_cache;
CREATE TRIGGER trg_cleanup_old_previews
  AFTER INSERT ON preview_cache
  FOR EACH STATEMENT
  EXECUTE FUNCTION cleanup_old_previews_on_insert();

-- ============================================
-- RLS POLICIES POUR PREVIEW_CACHE
-- ============================================

ALTER TABLE preview_cache ENABLE ROW LEVEL SECURITY;

-- Les utilisateurs authentifiés peuvent lire les aperçus
CREATE POLICY "Authenticated users can read previews" ON preview_cache
  FOR SELECT TO authenticated
  USING (true);

-- Seul le service peut insérer/modifier les aperçus
CREATE POLICY "Service role can manage previews" ON preview_cache
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- METTRE À JOUR LES DOCUMENTS EXISTANTS
-- ============================================

-- Marquer les documents générés existants
UPDATE documents
SET 
  is_generated = TRUE,
  generation_source = 'legacy_migration'
WHERE type IN ('quittance', 'bail', 'EDL_entree', 'EDL_sortie')
  AND is_generated IS NULL
  AND storage_path IS NOT NULL;

-- ============================================
-- STATISTIQUES POUR MONITORING
-- ============================================

CREATE OR REPLACE VIEW document_cache_stats AS
SELECT 
  type,
  is_generated,
  COUNT(*) as total_count,
  COUNT(CASE WHEN content_hash IS NOT NULL THEN 1 END) as with_hash,
  COUNT(CASE WHEN storage_path IS NOT NULL THEN 1 END) as with_storage,
  MIN(created_at) as oldest,
  MAX(created_at) as newest
FROM documents
GROUP BY type, is_generated
ORDER BY total_count DESC;

COMMENT ON VIEW document_cache_stats IS 
  'Vue de monitoring pour le cache des documents générés';

COMMIT;

-- ============================================
-- NOTES D'UTILISATION
-- ============================================
-- 
-- Pattern d'utilisation côté API:
-- 
-- 1. Appeler get_or_mark_document_creation() avec les paramètres
-- 2. Si is_new = FALSE: 
--    - Récupérer le document via storage_path
--    - Générer une URL signée
--    - Retourner au client
-- 3. Si is_new = TRUE:
--    - Générer le document (PDF)
--    - Uploader dans Supabase Storage
--    - Insérer dans la table documents
--    - Retourner l'URL signée
--
-- Exemple de requête pour vérifier un document:
-- 
-- SELECT * FROM get_or_mark_document_creation(
--   'quittance',           -- type
--   'abc123hash',          -- hash
--   'uuid-lease',          -- lease_id
--   NULL,                  -- property_id
--   NULL,                  -- owner_id
--   'uuid-tenant',         -- tenant_id
--   'uuid-payment'         -- payment_id
-- );
-- =====================================================



-- ========== 20251221000001_deposit_refunds.sql ==========
-- =====================================================
-- Migration: Table de restitution des dépôts de garantie
-- Date: 2024-12-21
-- =====================================================

BEGIN;

-- Table des restitutions de dépôt
CREATE TABLE IF NOT EXISTS deposit_refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
    
    -- Montants
    total_deposit DECIMAL(10,2) NOT NULL,
    total_deductions DECIMAL(10,2) NOT NULL DEFAULT 0,
    refund_amount DECIMAL(10,2) NOT NULL,
    
    -- Détail des retenues
    deductions JSONB DEFAULT '[]'::jsonb,
    -- Format: [{ "type": "loyers_impayes", "label": "Loyers impayés", "amount": 500 }]
    
    -- Mode de remboursement
    refund_method VARCHAR(50) DEFAULT 'virement', -- 'virement' | 'cheque' | 'especes'
    iban VARCHAR(50),
    
    -- Statut
    status VARCHAR(50) DEFAULT 'pending', -- 'pending' | 'completed' | 'cancelled'
    
    -- Dates
    refund_date DATE,
    completed_at TIMESTAMPTZ,
    
    -- Notes
    notes TEXT,
    
    -- Audit
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_deposit_refunds_lease_id ON deposit_refunds(lease_id);
CREATE INDEX IF NOT EXISTS idx_deposit_refunds_status ON deposit_refunds(status);

-- Trigger updated_at
DROP TRIGGER IF EXISTS set_updated_at_deposit_refunds ON deposit_refunds;
CREATE TRIGGER set_updated_at_deposit_refunds
    BEFORE UPDATE ON deposit_refunds
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE deposit_refunds ENABLE ROW LEVEL SECURITY;

-- Politique: Le propriétaire peut voir/créer ses remboursements
CREATE POLICY "Owner can manage deposit_refunds" ON deposit_refunds
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM leases l
            JOIN properties p ON l.property_id = p.id
            WHERE l.id = deposit_refunds.lease_id
            AND p.owner_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
        )
    );

-- Politique: Le locataire peut voir ses remboursements
CREATE POLICY "Tenant can view their deposit_refunds" ON deposit_refunds
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM lease_signers ls
            WHERE ls.lease_id = deposit_refunds.lease_id
            AND ls.role IN ('locataire_principal', 'colocataire')
            AND ls.profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
        )
    );

-- Politique: Admin peut tout voir
CREATE POLICY "Admin can manage all deposit_refunds" ON deposit_refunds
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- =====================================================
-- Table des indexations IRL (si elle n'existe pas)
-- =====================================================

CREATE TABLE IF NOT EXISTS lease_indexations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
    
    -- Valeurs de loyer
    old_rent DECIMAL(10,2) NOT NULL,
    new_rent DECIMAL(10,2) NOT NULL,
    increase_amount DECIMAL(10,2) NOT NULL,
    increase_percent DECIMAL(5,2) NOT NULL,
    
    -- Valeurs IRL
    old_irl_quarter VARCHAR(10) NOT NULL, -- Ex: "2023-Q4"
    old_irl_value DECIMAL(8,2) NOT NULL,
    new_irl_quarter VARCHAR(10) NOT NULL, -- Ex: "2024-Q4"
    new_irl_value DECIMAL(8,2) NOT NULL,
    
    -- Dates
    effective_date DATE NOT NULL,
    applied_at TIMESTAMPTZ,
    declined_at TIMESTAMPTZ,
    
    -- Statut
    status VARCHAR(50) DEFAULT 'pending', -- 'pending' | 'applied' | 'declined'
    decline_reason TEXT,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_lease_indexations_lease_id ON lease_indexations(lease_id);
CREATE INDEX IF NOT EXISTS idx_lease_indexations_status ON lease_indexations(status);
CREATE INDEX IF NOT EXISTS idx_lease_indexations_effective_date ON lease_indexations(effective_date);

-- RLS
ALTER TABLE lease_indexations ENABLE ROW LEVEL SECURITY;

-- Politique: Le propriétaire peut gérer les indexations
CREATE POLICY "Owner can manage lease_indexations" ON lease_indexations
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM leases l
            JOIN properties p ON l.property_id = p.id
            WHERE l.id = lease_indexations.lease_id
            AND p.owner_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
        )
    );

-- Politique: Le locataire peut voir les indexations
CREATE POLICY "Tenant can view their lease_indexations" ON lease_indexations
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM lease_signers ls
            WHERE ls.lease_id = lease_indexations.lease_id
            AND ls.role IN ('locataire_principal', 'colocataire')
            AND ls.profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
        )
    );

-- Politique: Admin peut tout voir
CREATE POLICY "Admin can manage all lease_indexations" ON lease_indexations
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

COMMIT;



-- ========== 20251221000002_lease_signers_invited_email.sql ==========
-- =====================================================
-- Migration: Ajouter invited_email aux lease_signers
-- Date: 2024-12-21
-- =====================================================
-- Cette colonne stocke l'email d'invitation pour les signataires
-- qui n'ont pas encore créé leur compte.
-- =====================================================

BEGIN;

-- Ajouter la colonne invited_email si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'lease_signers' 
        AND column_name = 'invited_email'
    ) THEN
        ALTER TABLE lease_signers 
        ADD COLUMN invited_email VARCHAR(255);
        
        COMMENT ON COLUMN lease_signers.invited_email IS 
            'Email utilisé pour l''invitation, avant que le signataire ne crée son compte';
    END IF;
END $$;

-- Index pour rechercher par email
CREATE INDEX IF NOT EXISTS idx_lease_signers_invited_email 
ON lease_signers(invited_email) 
WHERE invited_email IS NOT NULL;

COMMIT;



-- ========== 20251221000003_fix_lease_signers_nullable.sql ==========
-- =====================================================
-- Migration: Corriger lease_signers pour invitations
-- Date: 2024-12-21
-- =====================================================
-- Cette migration permet d'inviter des signataires qui
-- n'ont pas encore de compte sur la plateforme.
-- =====================================================

BEGIN;

-- 1. Rendre profile_id nullable pour permettre les invitations sans compte
ALTER TABLE lease_signers 
ALTER COLUMN profile_id DROP NOT NULL;

-- 2. Ajouter la colonne invited_email si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'lease_signers' 
        AND column_name = 'invited_email'
    ) THEN
        ALTER TABLE lease_signers 
        ADD COLUMN invited_email VARCHAR(255);
        
        COMMENT ON COLUMN lease_signers.invited_email IS 
            'Email utilisé pour l''invitation, avant que le signataire ne crée son compte';
    END IF;
END $$;

-- 3. Ajouter une colonne pour suivre quand l'invitation a été envoyée
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'lease_signers' 
        AND column_name = 'invited_at'
    ) THEN
        ALTER TABLE lease_signers 
        ADD COLUMN invited_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- 4. Ajouter une colonne pour le nom invité (avant création du profil)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'lease_signers' 
        AND column_name = 'invited_name'
    ) THEN
        ALTER TABLE lease_signers 
        ADD COLUMN invited_name VARCHAR(255);
    END IF;
END $$;

-- 5. Index pour rechercher par email d'invitation
CREATE INDEX IF NOT EXISTS idx_lease_signers_invited_email 
ON lease_signers(invited_email) 
WHERE invited_email IS NOT NULL;

-- 6. Contrainte: soit profile_id soit invited_email doit être défini
-- (Commenté car peut casser les données existantes - à activer après nettoyage)
-- ALTER TABLE lease_signers
-- ADD CONSTRAINT check_profile_or_email 
-- CHECK (profile_id IS NOT NULL OR invited_email IS NOT NULL);

COMMIT;



-- ========== 20251222000000_add_profile_columns.sql ==========
-- =====================================================
-- Migration: Ajouter colonnes manquantes dans profiles
-- Date: 2024-12-22
-- =====================================================
-- Colonnes nécessaires pour le flux de signature locataire
-- =====================================================

BEGIN;

-- 1. Ajouter lieu_naissance si manquant
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'lieu_naissance'
    ) THEN
        ALTER TABLE profiles 
        ADD COLUMN lieu_naissance VARCHAR(255);
        
        COMMENT ON COLUMN profiles.lieu_naissance IS 
            'Lieu de naissance pour les documents officiels';
    END IF;
END $$;

-- 2. Ajouter adresse si manquant
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'adresse'
    ) THEN
        ALTER TABLE profiles 
        ADD COLUMN adresse TEXT;
        
        COMMENT ON COLUMN profiles.adresse IS 
            'Adresse complète du profil';
    END IF;
END $$;

-- 3. Ajouter nationalite si manquant
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'nationalite'
    ) THEN
        ALTER TABLE profiles 
        ADD COLUMN nationalite VARCHAR(100) DEFAULT 'Française';
        
        COMMENT ON COLUMN profiles.nationalite IS 
            'Nationalité du profil';
    END IF;
END $$;

COMMIT;








-- ========== 20251222000001_signature_image.sql ==========
-- Migration: Ajouter la colonne signature_image à lease_signers
-- Date: 2025-12-22
-- Description: Permet de stocker l'image de signature (base64 ou URL) pour l'afficher sur le bail

-- Ajouter la colonne signature_image si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lease_signers' 
    AND column_name = 'signature_image'
  ) THEN
    ALTER TABLE lease_signers ADD COLUMN signature_image TEXT;
    COMMENT ON COLUMN lease_signers.signature_image IS 'Image de signature en base64 (data:image/png;base64,...) ou URL';
  END IF;
END $$;

-- Index pour optimiser les requêtes sur les signataires avec signature
CREATE INDEX IF NOT EXISTS idx_lease_signers_has_signature 
  ON lease_signers(lease_id) 
  WHERE signature_status = 'signed' AND signature_image IS NOT NULL;








-- ========== 20251228000000_documents_sota.sql ==========
-- Migration : Documents SOTA 2025
-- Date : 2025-12-28
-- 
-- Fonctionnalités :
-- 1. Unification des tables de documents
-- 2. Correction des owner_id/property_id manquants
-- 3. Index full-text pour la recherche
-- 4. Types de documents étendus

BEGIN;

-- ============================================
-- 1. EXTENSION DES TYPES DE DOCUMENTS
-- ============================================

-- Supprimer l'ancienne contrainte
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_type_check;

-- Ajouter les nouveaux types
ALTER TABLE documents ADD CONSTRAINT documents_type_check CHECK (
  type IN (
    -- Contrats
    'bail', 'avenant', 'engagement_garant', 'bail_signe_locataire', 'bail_signe_proprietaire',
    -- Identité
    'piece_identite', 'cni_recto', 'cni_verso', 'passeport', 'titre_sejour',
    -- Finance
    'quittance', 'facture', 'rib', 'avis_imposition', 'bulletin_paie', 'attestation_loyer',
    -- Assurance
    'attestation_assurance', 'assurance_pno',
    -- Diagnostics
    'diagnostic', 'dpe', 'diagnostic_gaz', 'diagnostic_electricite', 
    'diagnostic_plomb', 'diagnostic_amiante', 'diagnostic_termites', 'erp',
    -- États des lieux
    'EDL_entree', 'EDL_sortie', 'inventaire',
    -- Candidature (migrés depuis application_files)
    'candidature_identite', 'candidature_revenus', 'candidature_domicile', 'candidature_garantie',
    -- Garant (migrés depuis guarantor_documents)
    'garant_identite', 'garant_revenus', 'garant_domicile', 'garant_engagement',
    -- Prestataire
    'devis', 'ordre_mission', 'rapport_intervention',
    -- Copropriété
    'taxe_fonciere', 'taxe_sejour', 'copropriete', 'proces_verbal', 'appel_fonds',
    -- Divers
    'consentement', 'courrier', 'photo', 'justificatif_revenus', 'autre'
  )
);

-- ============================================
-- 2. AJOUT DE COLONNES MANQUANTES
-- ============================================

-- Catégorie pour le filtrage
ALTER TABLE documents ADD COLUMN IF NOT EXISTS category TEXT;

-- Application ID (pour les documents de candidature)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS application_id UUID REFERENCES tenant_applications(id) ON DELETE SET NULL;

-- Garant ID (pour les documents de garant)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS guarantor_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Nom original du fichier
ALTER TABLE documents ADD COLUMN IF NOT EXISTS original_filename TEXT;

-- Hash SHA256 pour déduplication
ALTER TABLE documents ADD COLUMN IF NOT EXISTS sha256 TEXT;

-- Taille du fichier
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_size BIGINT;

-- Type MIME
ALTER TABLE documents ADD COLUMN IF NOT EXISTS mime_type TEXT;

-- Index de recherche full-text
ALTER TABLE documents ADD COLUMN IF NOT EXISTS search_vector TSVECTOR;

-- ============================================
-- 3. CORRECTION DES DOCUMENTS EXISTANTS
-- ============================================

-- Mettre à jour les documents liés à un bail qui n'ont pas de owner_id/property_id
UPDATE documents d
SET 
  property_id = COALESCE(d.property_id, l.property_id),
  owner_id = COALESCE(d.owner_id, p.owner_id)
FROM leases l
JOIN properties p ON l.property_id = p.id
WHERE d.lease_id = l.id
  AND (d.property_id IS NULL OR d.owner_id IS NULL);

-- Mettre à jour la catégorie automatiquement
UPDATE documents SET category = CASE
  WHEN type IN ('bail', 'avenant', 'engagement_garant', 'bail_signe_locataire', 'bail_signe_proprietaire') THEN 'contrat'
  WHEN type IN ('piece_identite', 'cni_recto', 'cni_verso', 'passeport', 'titre_sejour') THEN 'identite'
  WHEN type IN ('quittance', 'facture', 'rib', 'avis_imposition', 'bulletin_paie', 'attestation_loyer') THEN 'finance'
  WHEN type IN ('attestation_assurance', 'assurance_pno') THEN 'assurance'
  WHEN type LIKE 'diagnostic%' OR type IN ('dpe', 'erp') THEN 'diagnostic'
  WHEN type IN ('EDL_entree', 'EDL_sortie', 'inventaire') THEN 'edl'
  WHEN type LIKE 'candidature%' THEN 'candidature'
  WHEN type LIKE 'garant%' THEN 'garant'
  WHEN type IN ('devis', 'ordre_mission', 'rapport_intervention') THEN 'prestataire'
  ELSE 'autre'
END
WHERE category IS NULL;

-- ============================================
-- 4. INDEX FULL-TEXT POUR RECHERCHE
-- ============================================

-- Créer la fonction de mise à jour du vecteur de recherche
CREATE OR REPLACE FUNCTION documents_search_vector_update()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('french', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('french', COALESCE(NEW.type, '')), 'B') ||
    setweight(to_tsvector('french', COALESCE(NEW.original_filename, '')), 'C') ||
    setweight(to_tsvector('french', COALESCE(NEW.metadata->>'nom', '')), 'B') ||
    setweight(to_tsvector('french', COALESCE(NEW.metadata->>'prenom', '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mise à jour automatique
DROP TRIGGER IF EXISTS trg_documents_search_vector ON documents;
CREATE TRIGGER trg_documents_search_vector
  BEFORE INSERT OR UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION documents_search_vector_update();

-- Mettre à jour les documents existants
UPDATE documents SET search_vector = 
  setweight(to_tsvector('french', COALESCE(title, '')), 'A') ||
  setweight(to_tsvector('french', COALESCE(type, '')), 'B') ||
  setweight(to_tsvector('french', COALESCE(original_filename, '')), 'C') ||
  setweight(to_tsvector('french', COALESCE(metadata->>'nom', '')), 'B') ||
  setweight(to_tsvector('french', COALESCE(metadata->>'prenom', '')), 'B');

-- Index GIN pour la recherche full-text
CREATE INDEX IF NOT EXISTS idx_documents_search_vector ON documents USING gin(search_vector);

-- Index sur la catégorie
CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);

-- Index composite pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_documents_owner_property ON documents(owner_id, property_id);

-- ============================================
-- 5. MIGRATION DES DONNÉES (application_files → documents)
-- ============================================

-- Ne migrer que si la table source existe et n'est pas vide
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'application_files') THEN
    -- Migrer les fichiers de candidature vers documents
    INSERT INTO documents (
      type,
      application_id,
      tenant_id,
      storage_path,
      original_filename,
      sha256,
      file_size,
      mime_type,
      metadata,
      created_at,
      category
    )
    SELECT 
      CASE af.kind
        WHEN 'identity' THEN 'candidature_identite'
        WHEN 'income' THEN 'candidature_revenus'
        WHEN 'address' THEN 'candidature_domicile'
        WHEN 'guarantee' THEN 'candidature_garantie'
        ELSE 'autre'
      END,
      af.application_id,
      ta.tenant_profile_id,
      af.storage_path,
      af.file_name,
      af.sha256,
      af.size_bytes,
      af.mime_type,
      jsonb_build_object(
        'ocr_provider', af.ocr_provider,
        'ocr_result', af.ocr_result,
        'confidence', af.confidence,
        'migrated_from', 'application_files',
        'original_id', af.id
      ),
      af.uploaded_at,
      'candidature'
    FROM application_files af
    JOIN tenant_applications ta ON ta.id = af.application_id
    WHERE NOT EXISTS (
      SELECT 1 FROM documents d 
      WHERE d.metadata->>'original_id' = af.id::text
        AND d.metadata->>'migrated_from' = 'application_files'
    );
    
    RAISE NOTICE 'Migration application_files terminée';
  END IF;
END $$;

-- ============================================
-- 6. MIGRATION DES DONNÉES (guarantor_documents → documents)
-- ============================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'guarantor_documents') THEN
    -- Migrer les documents garant vers documents
    INSERT INTO documents (
      type,
      guarantor_profile_id,
      storage_path,
      original_filename,
      file_size,
      mime_type,
      metadata,
      created_at,
      category
    )
    SELECT 
      CASE gd.document_type
        WHEN 'identity' THEN 'garant_identite'
        WHEN 'income' THEN 'garant_revenus'
        WHEN 'address' THEN 'garant_domicile'
        WHEN 'engagement' THEN 'garant_engagement'
        ELSE 'garant_' || COALESCE(gd.document_type, 'autre')
      END,
      gd.guarantor_profile_id,
      gd.storage_path,
      gd.original_filename,
      gd.file_size,
      gd.mime_type,
      jsonb_build_object(
        'verification_status', gd.verification_status,
        'verified_at', gd.verified_at,
        'verified_by', gd.verified_by,
        'migrated_from', 'guarantor_documents',
        'original_id', gd.id
      ),
      gd.created_at,
      'garant'
    FROM guarantor_documents gd
    WHERE NOT EXISTS (
      SELECT 1 FROM documents d 
      WHERE d.metadata->>'original_id' = gd.id::text
        AND d.metadata->>'migrated_from' = 'guarantor_documents'
    );
    
    RAISE NOTICE 'Migration guarantor_documents terminée';
  END IF;
END $$;

-- ============================================
-- 7. VUE ENRICHIE POUR LES REQUÊTES
-- ============================================

CREATE OR REPLACE VIEW documents_enriched AS
SELECT 
  d.*,
  -- Infos du locataire
  COALESCE(tp.prenom || ' ' || tp.nom, 'Non défini') AS tenant_name,
  tp.prenom AS tenant_prenom,
  tp.nom AS tenant_nom,
  -- Infos du propriétaire
  op.prenom || ' ' || op.nom AS owner_name,
  -- Infos du bien
  p.adresse_complete AS property_address,
  p.ville AS property_ville,
  -- Infos du bail
  l.type_bail,
  l.statut AS lease_status,
  l.date_debut AS lease_start,
  -- Catégorie calculée
  COALESCE(d.category, 
    CASE 
      WHEN d.type IN ('bail', 'avenant', 'engagement_garant') THEN 'contrat'
      WHEN d.type IN ('cni_recto', 'cni_verso', 'passeport', 'piece_identite') THEN 'identite'
      WHEN d.type IN ('quittance', 'facture') THEN 'finance'
      WHEN d.type LIKE 'diagnostic%' OR d.type IN ('dpe', 'erp') THEN 'diagnostic'
      WHEN d.type IN ('EDL_entree', 'EDL_sortie') THEN 'edl'
      ELSE 'autre'
    END
  ) AS computed_category
FROM documents d
LEFT JOIN profiles tp ON d.tenant_id = tp.id
LEFT JOIN profiles op ON d.owner_id = op.id
LEFT JOIN properties p ON d.property_id = p.id
LEFT JOIN leases l ON d.lease_id = l.id;

-- ============================================
-- 8. FONCTION DE RECHERCHE
-- ============================================

CREATE OR REPLACE FUNCTION search_documents(
  search_query TEXT,
  p_owner_id UUID DEFAULT NULL,
  p_tenant_id UUID DEFAULT NULL,
  p_property_id UUID DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  type TEXT,
  title TEXT,
  tenant_name TEXT,
  property_address TEXT,
  created_at TIMESTAMPTZ,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id,
    d.type,
    d.title,
    COALESCE(tp.prenom || ' ' || tp.nom, 'Non défini') AS tenant_name,
    p.adresse_complete AS property_address,
    d.created_at,
    ts_rank(d.search_vector, plainto_tsquery('french', search_query)) AS rank
  FROM documents d
  LEFT JOIN profiles tp ON d.tenant_id = tp.id
  LEFT JOIN properties p ON d.property_id = p.id
  WHERE 
    d.search_vector @@ plainto_tsquery('french', search_query)
    AND (p_owner_id IS NULL OR d.owner_id = p_owner_id)
    AND (p_tenant_id IS NULL OR d.tenant_id = p_tenant_id)
    AND (p_property_id IS NULL OR d.property_id = p_property_id)
    AND (p_category IS NULL OR d.category = p_category)
  ORDER BY rank DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 9. COMMENTAIRES
-- ============================================

COMMENT ON COLUMN documents.category IS 'Catégorie du document : contrat, identite, finance, assurance, diagnostic, edl, candidature, garant, prestataire, autre';
COMMENT ON COLUMN documents.search_vector IS 'Vecteur de recherche full-text pour recherche rapide';
COMMENT ON COLUMN documents.application_id IS 'ID de la candidature associée (migré depuis application_files)';
COMMENT ON COLUMN documents.guarantor_profile_id IS 'ID du profil garant (migré depuis guarantor_documents)';
COMMENT ON VIEW documents_enriched IS 'Vue enrichie des documents avec informations locataire/propriétaire/bien';
COMMENT ON FUNCTION search_documents IS 'Recherche full-text dans les documents avec filtres';

COMMIT;



-- ========== 20251228000001_edl_before_activation.sql ==========
-- ============================================
-- Migration : EDL obligatoire avant activation
-- Date : 2025-12-28
-- ============================================
-- FLUX LÉGAL FRANÇAIS :
-- 1. Bail signé par toutes les parties → statut "fully_signed"
-- 2. EDL d'entrée réalisé et signé
-- 3. Bail activé → statut "active"
-- ============================================

-- Supprimer l'ancienne contrainte si elle existe
ALTER TABLE leases 
DROP CONSTRAINT IF EXISTS leases_statut_check;

-- Ajouter la nouvelle contrainte avec tous les statuts du cycle de vie
ALTER TABLE leases
ADD CONSTRAINT leases_statut_check
CHECK (statut IN (
  'draft',              -- Brouillon
  'sent',               -- Envoyé pour signature
  'pending_signature',  -- En attente de signatures
  'partially_signed',   -- Partiellement signé (au moins une signature)
  'pending_owner_signature', -- Locataire(s) signé, attente propriétaire
  'fully_signed',       -- Entièrement signé (AVANT activation - attend EDL)
  'active',             -- Actif (APRÈS EDL d'entrée)
  'amended',            -- Avenant en cours
  'suspended',          -- Suspendu temporairement
  'terminated',         -- Terminé
  'archived'            -- Archivé
));

-- Ajouter une colonne pour suivre la date d'activation réelle
ALTER TABLE leases
ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ;

-- Ajouter une colonne pour stocker l'ID de l'EDL d'entrée qui a déclenché l'activation
ALTER TABLE leases
ADD COLUMN IF NOT EXISTS entry_edl_id UUID REFERENCES edl(id) ON DELETE SET NULL;

-- Index pour rechercher les baux en attente d'activation
CREATE INDEX IF NOT EXISTS idx_leases_fully_signed ON leases(statut) WHERE statut = 'fully_signed';

-- Commentaires pour documentation
COMMENT ON COLUMN leases.activated_at IS 'Date réelle d''activation du bail (après EDL d''entrée)';
COMMENT ON COLUMN leases.entry_edl_id IS 'Référence à l''EDL d''entrée qui a permis l''activation';

-- ============================================
-- Fonction : Vérifier si un bail peut être activé
-- ============================================
DROP FUNCTION IF EXISTS can_activate_lease(UUID);
CREATE OR REPLACE FUNCTION can_activate_lease(p_lease_id UUID)
RETURNS TABLE(
  can_activate BOOLEAN,
  reason TEXT,
  edl_status TEXT
) AS $$
DECLARE
  v_lease_status TEXT;
  v_edl_record RECORD;
BEGIN
  -- Récupérer le statut du bail
  SELECT statut INTO v_lease_status
  FROM leases
  WHERE id = p_lease_id;
  
  IF v_lease_status IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Bail non trouvé'::TEXT, NULL::TEXT;
    RETURN;
  END IF;
  
  IF v_lease_status != 'fully_signed' THEN
    RETURN QUERY SELECT FALSE, 
      ('Le bail doit être entièrement signé (statut actuel: ' || v_lease_status || ')')::TEXT, 
      NULL::TEXT;
    RETURN;
  END IF;
  
  -- Vérifier l'EDL d'entrée
  SELECT id, status INTO v_edl_record
  FROM edl
  WHERE lease_id = p_lease_id AND type = 'entree'
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_edl_record.id IS NULL THEN
    RETURN QUERY SELECT FALSE, 
      'Aucun état des lieux d''entrée n''existe pour ce bail'::TEXT, 
      NULL::TEXT;
    RETURN;
  END IF;
  
  IF v_edl_record.status != 'signed' THEN
    RETURN QUERY SELECT FALSE, 
      ('L''état des lieux d''entrée doit être signé (statut actuel: ' || v_edl_record.status || ')')::TEXT, 
      v_edl_record.status;
    RETURN;
  END IF;
  
  -- Tout est OK
  RETURN QUERY SELECT TRUE, 'Prêt pour activation'::TEXT, v_edl_record.status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Trigger : Auto-activation si EDL signé
-- (Optionnel - peut être commenté si activation manuelle préférée)
-- ============================================
DROP FUNCTION IF EXISTS trigger_activate_lease_on_edl_signed() CASCADE;
CREATE OR REPLACE FUNCTION trigger_activate_lease_on_edl_signed()
RETURNS TRIGGER AS $$
BEGIN
  -- Si l'EDL d'entrée passe à "signed"
  IF NEW.type = 'entree' AND NEW.status = 'signed' AND OLD.status != 'signed' THEN
    -- Vérifier que le bail est bien "fully_signed"
    IF EXISTS (
      SELECT 1 FROM leases 
      WHERE id = NEW.lease_id 
      AND statut = 'fully_signed'
    ) THEN
      -- Activer le bail
      UPDATE leases
      SET 
        statut = 'active',
        activated_at = NOW(),
        entry_edl_id = NEW.id,
        updated_at = NOW()
      WHERE id = NEW.lease_id;
      
      -- Log l'événement
      INSERT INTO audit_log (action, entity_type, entity_id, metadata)
      VALUES (
        'lease_auto_activated',
        'lease',
        NEW.lease_id,
        jsonb_build_object(
          'triggered_by', 'edl_signed',
          'edl_id', NEW.id
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Créer le trigger (désactivé par défaut - décommenter pour activation automatique)
-- DROP TRIGGER IF EXISTS auto_activate_lease_on_edl ON edl;
-- CREATE TRIGGER auto_activate_lease_on_edl
--   AFTER UPDATE ON edl
--   FOR EACH ROW
--   EXECUTE FUNCTION trigger_activate_lease_on_edl_signed();

-- ============================================
-- Vue : Baux en attente d'activation
-- ============================================
CREATE OR REPLACE VIEW v_leases_awaiting_activation AS
SELECT 
  l.id AS lease_id,
  l.date_debut,
  l.date_fin,
  l.type_bail,
  l.statut,
  l.created_at AS lease_created_at,
  p.id AS property_id,
  p.adresse_complete AS adresse,
  p.ville,
  p.code_postal,
  e.id AS edl_id,
  e.status AS edl_status,
  e.scheduled_date AS edl_scheduled,
  CASE 
    WHEN e.id IS NULL THEN 'Créer l''EDL d''entrée'
    WHEN e.status = 'draft' THEN 'Compléter l''EDL'
    WHEN e.status = 'in_progress' THEN 'Terminer l''EDL'
    WHEN e.status = 'completed' THEN 'Faire signer l''EDL'
    WHEN e.status = 'signed' THEN 'Prêt à activer'
    ELSE 'État inconnu'
  END AS next_action
FROM leases l
JOIN properties p ON l.property_id = p.id
LEFT JOIN edl e ON e.lease_id = l.id AND e.type = 'entree'
WHERE l.statut = 'fully_signed'
ORDER BY l.date_debut ASC;

COMMENT ON VIEW v_leases_awaiting_activation IS 'Liste des baux signés en attente d''activation (EDL requis)';







-- ========== 20251228100000_sealed_lease_pdf.sql ==========
-- ============================================
-- Migration : PDF final pour baux signés
-- Date : 2025-12-28
-- ============================================
-- Un bail signé par toutes les parties devient immutable.
-- Le PDF final est stocké et ne peut plus être modifié.
-- ============================================

-- 1. Ajouter la colonne pour stocker le chemin du PDF signé
ALTER TABLE leases 
ADD COLUMN IF NOT EXISTS signed_pdf_path TEXT;

-- 2. Ajouter une colonne pour la date de scellement
ALTER TABLE leases 
ADD COLUMN IF NOT EXISTS sealed_at TIMESTAMPTZ;

-- 3. Commentaires pour documentation
COMMENT ON COLUMN leases.signed_pdf_path IS 'Chemin du PDF final signé dans Storage (immutable après signature complète)';
COMMENT ON COLUMN leases.sealed_at IS 'Date à laquelle le bail a été scellé (toutes signatures collectées)';

-- 4. Index pour rechercher les baux scellés
CREATE INDEX IF NOT EXISTS idx_leases_sealed ON leases(sealed_at) WHERE sealed_at IS NOT NULL;

-- 5. Fonction pour vérifier si un bail est modifiable
CREATE OR REPLACE FUNCTION is_lease_editable(p_lease_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_statut TEXT;
  v_sealed_at TIMESTAMPTZ;
BEGIN
  SELECT statut, sealed_at INTO v_statut, v_sealed_at
  FROM leases
  WHERE id = p_lease_id;
  
  -- Un bail est modifiable si :
  -- 1. Il n'est pas encore scellé (sealed_at IS NULL)
  -- 2. Son statut permet les modifications
  RETURN v_sealed_at IS NULL AND v_statut IN ('draft', 'sent', 'pending_signature', 'partially_signed', 'pending_owner_signature');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Trigger pour empêcher les modifications sur un bail scellé
CREATE OR REPLACE FUNCTION prevent_sealed_lease_modification()
RETURNS TRIGGER AS $$
BEGIN
  -- Si le bail est scellé, bloquer certaines modifications
  IF OLD.sealed_at IS NOT NULL THEN
    -- Autoriser uniquement les changements de statut vers terminated/archived
    -- et les mises à jour de activated_at, entry_edl_id
    IF NEW.statut NOT IN ('active', 'terminated', 'archived', 'fully_signed') 
       OR NEW.loyer != OLD.loyer 
       OR NEW.charges_forfaitaires != OLD.charges_forfaitaires
       OR NEW.date_debut != OLD.date_debut
       OR NEW.date_fin != OLD.date_fin
       OR NEW.type_bail != OLD.type_bail THEN
      RAISE EXCEPTION 'Ce bail est scellé et ne peut plus être modifié. Seul le statut peut évoluer vers terminé ou archivé.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger
DROP TRIGGER IF EXISTS check_sealed_lease ON leases;
CREATE TRIGGER check_sealed_lease
  BEFORE UPDATE ON leases
  FOR EACH ROW
  EXECUTE FUNCTION prevent_sealed_lease_modification();

-- 7. Fonction pour sceller un bail (appelée après signature complète)
CREATE OR REPLACE FUNCTION seal_lease(p_lease_id UUID, p_pdf_path TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_all_signed BOOLEAN;
BEGIN
  -- Vérifier que toutes les signatures sont présentes
  SELECT COUNT(*) = SUM(CASE WHEN signature_status = 'signed' THEN 1 ELSE 0 END)
  INTO v_all_signed
  FROM lease_signers
  WHERE lease_id = p_lease_id;
  
  IF NOT v_all_signed THEN
    RAISE EXCEPTION 'Toutes les signatures ne sont pas présentes';
  END IF;
  
  -- Sceller le bail
  UPDATE leases
  SET 
    signed_pdf_path = p_pdf_path,
    sealed_at = NOW(),
    statut = 'fully_signed'
  WHERE id = p_lease_id
    AND sealed_at IS NULL;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION seal_lease IS 'Scelle un bail après signature complète. Stocke le PDF final et empêche les modifications futures.';




















-- ========== 20251228200000_fix_lease_status_trigger.sql ==========
-- Migration : Mise à jour automatique du statut du bail lors des signatures
-- Assure que le statut passe à 'partially_signed' ou 'fully_signed' dès qu'une signature est apposée

CREATE OR REPLACE FUNCTION update_lease_status_on_signature()
RETURNS TRIGGER AS $$
DECLARE
    total_signers INTEGER;
    signed_count INTEGER;
    new_status TEXT;
BEGIN
    -- Si le statut de signature passe à 'signed'
    IF (NEW.signature_status = 'signed' AND (OLD.signature_status IS NULL OR OLD.signature_status != 'signed')) THEN
        -- 1. Compter les signataires
        SELECT COUNT(*) INTO total_signers
        FROM lease_signers
        WHERE lease_id = NEW.lease_id;

        SELECT COUNT(*) INTO signed_count
        FROM lease_signers
        WHERE lease_id = NEW.lease_id
        AND signature_status = 'signed';

        -- 2. Déterminer le nouveau statut
        IF signed_count = total_signers AND total_signers > 0 THEN
            new_status := 'fully_signed';
        ELSIF signed_count > 0 THEN
            -- Vérifier si le propriétaire a signé
            IF EXISTS (
                SELECT 1 FROM lease_signers 
                WHERE lease_id = NEW.lease_id 
                AND role = 'proprietaire' 
                AND signature_status = 'signed'
            ) THEN
                new_status := 'partially_signed';
            ELSE
                -- Si seul le locataire a signé, on peut optionnellement passer à un état spécifique
                -- mais partially_signed convient
                new_status := 'partially_signed';
            END IF;
        ELSE
            new_status := 'pending_signature';
        END IF;

        -- 3. Mettre à jour le bail
        UPDATE leases 
        SET statut = new_status,
            updated_at = NOW()
        WHERE id = NEW.lease_id 
        AND statut IN ('draft', 'sent', 'pending_signature', 'partially_signed', 'pending_owner_signature')
        AND statut != new_status;
        
        -- 4. Si fully_signed, on peut aussi déclencher le scellement via un webhook ou une edge function
        -- (géré côté application pour l'instant)
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger sur lease_signers
DROP TRIGGER IF EXISTS on_lease_signer_updated_status ON lease_signers;
CREATE TRIGGER on_lease_signer_updated_status
    AFTER UPDATE ON lease_signers
    FOR EACH ROW
    EXECUTE FUNCTION update_lease_status_on_signature();

-- Commentaire pour documentation
COMMENT ON FUNCTION update_lease_status_on_signature() IS 'Met à jour automatiquement le statut du bail (leases.statut) en fonction des signatures récoltées.';



-- ========== 20251228210000_dpe_management_system.sql ==========
-- 1) Enums pour le cycle de vie de la demande DPE
do $$ begin
  create type public.dpe_request_status as enum (
    'REQUESTED',      -- demande envoyée (ou créée)
    'QUOTE_RECEIVED', -- devis reçu
    'SCHEDULED',      -- rdv planifié
    'DONE',           -- visite réalisée
    'DELIVERED',      -- rapport reçu (pdf + n°)
    'CANCELLED'
  );
exception when duplicate_object then null; end $$;

-- 2) Diagnostiqueurs "internes" (mini annuaire par propriétaire)
create table if not exists public.dpe_providers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  coverage text,          -- ex: "Martinique - Nord / CACEM"
  is_active boolean not null default true,
  notes text
);

create index if not exists dpe_providers_owner_id_idx on public.dpe_providers(owner_id);

-- 3) Demandes DPE
create table if not exists public.dpe_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  status public.dpe_request_status not null default 'REQUESTED',

  visit_contact_name text,
  visit_contact_role text default 'OWNER', -- 'OWNER'|'TENANT'|'OTHER'
  visit_contact_email text,
  visit_contact_phone text,

  access_notes text,
  preferred_slots jsonb,    -- [{start, end}, ...]
  attachments jsonb,        -- [{path, name}]
  notes text
);

create index if not exists dpe_requests_owner_id_idx on public.dpe_requests(owner_id);
create index if not exists dpe_requests_property_id_idx on public.dpe_requests(property_id);

-- 4) Devis liés aux demandes
create table if not exists public.dpe_quotes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null references public.dpe_requests(id) on delete cascade,
  provider_id uuid references public.dpe_providers(id) on delete set null,
  price_cents integer,
  currency text default 'EUR',
  proposed_date timestamptz,
  message text,
  is_accepted boolean not null default false
);

create index if not exists dpe_quotes_request_id_idx on public.dpe_quotes(request_id);

-- 5) Livrable DPE (document officiel stocké avec métadonnées)
create table if not exists public.dpe_deliverables (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  request_id uuid references public.dpe_requests(id) on delete set null,

  dpe_number text not null,        -- 13 chiffres ADEME
  issued_at date not null,
  energy_class text not null,      -- A-G
  ges_class text,                  -- A-G
  valid_until date not null,

  pdf_path text not null,          -- storage path
  source text default 'UPLOAD'     -- 'UPLOAD'|'API_PREFILL'
);

create index if not exists dpe_deliverables_property_id_idx on public.dpe_deliverables(property_id);

-- 6) Contraintes métier
alter table public.dpe_deliverables
  add constraint dpe_number_13_digits_chk
  check (dpe_number ~ '^[0-9]{13}$');

alter table public.dpe_deliverables
  add constraint energy_class_chk
  check (energy_class in ('A','B','C','D','E','F','G'));

alter table public.dpe_deliverables
  add constraint ges_class_chk
  check (ges_class is null or ges_class in ('A','B','C','D','E','F','G'));

-- 7) Fonction de calcul de validité (Source de vérité)
create or replace function public.compute_dpe_valid_until(p_issued_at date)
returns date
language plpgsql
as $$
begin
  -- Réforme DPE 2021 : période transitoire
  if p_issued_at >= date '2021-07-01' then
    return (p_issued_at + interval '10 years')::date;
  elsif p_issued_at between date '2018-01-01' and date '2021-06-30' then
    return date '2024-12-31';
  elsif p_issued_at between date '2013-01-01' and date '2017-12-31' then
    return date '2022-12-31';
  else
    return p_issued_at; -- considéré expiré car déjà passé
  end if;
end $$;

-- 8) Row Level Security (RLS)
alter table public.dpe_providers enable row level security;
alter table public.dpe_requests enable row level security;
alter table public.dpe_quotes enable row level security;
alter table public.dpe_deliverables enable row level security;

-- Politiques de sécurité (Accès par propriétaire)
create policy "Owners can manage their own DPE providers" on public.dpe_providers
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "Owners can manage their own DPE requests" on public.dpe_requests
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "Owners can manage their own DPE quotes" on public.dpe_quotes
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "Owners can manage their own DPE deliverables" on public.dpe_deliverables
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- 9) Trigger pour auto-calculer valid_until à l'insertion
create or replace function public.set_dpe_validity()
returns trigger as $$
begin
  new.valid_until := public.compute_dpe_valid_until(new.issued_at);
  return new;
end;
$$ language plpgsql;

create trigger trg_set_dpe_validity
  before insert or update of issued_at on public.dpe_deliverables
  for each row execute function public.set_dpe_validity();

-- 10) Commentaire pour documentation
comment on table public.dpe_deliverables is 'Stocke les rapports DPE validés avec calcul automatique de fin de validité selon la loi française.';



-- ========== 20251228220000_fix_meters_rls_and_nullability.sql ==========
-- Migration : Rendre lease_id nullable dans meters et ajouter RLS propriétaire
-- Date : 2025-12-28

BEGIN;

-- 1. Rendre lease_id nullable
ALTER TABLE public.meters 
  ALTER COLUMN lease_id DROP NOT NULL;

-- 2. Supprimer les anciennes politiques RLS restrictives (si elles existent)
DROP POLICY IF EXISTS "Meters lease members select" ON public.meters;
DROP POLICY IF EXISTS "Owners can manage meters of own properties" ON public.meters;

-- 3. Nouvelles politiques RLS pour les compteurs (Meters)

-- Les propriétaires peuvent TOUT faire sur les compteurs de leurs logements
CREATE POLICY "Owners can manage meters of own properties"
  ON public.meters FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = public.meters.property_id
      AND p.owner_id = public.user_profile_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = public.meters.property_id
      AND p.owner_id = public.user_profile_id()
    )
  );

-- Les locataires peuvent VOIR les compteurs liés à leur bail
CREATE POLICY "Tenants can view meters of own lease"
  ON public.meters FOR SELECT
  USING (
    lease_id IN (
      SELECT ls.lease_id 
      FROM public.lease_signers ls
      WHERE ls.profile_id = public.user_profile_id()
    )
  );

-- Les admins peuvent TOUT voir
CREATE POLICY "Admins can view all meters"
  ON public.meters FOR SELECT
  USING (public.user_role() = 'admin');

-- 4. Même logique pour les relevés (meter_readings)

ALTER TABLE public.meter_readings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Meter readings accessible" ON public.meter_readings;
DROP POLICY IF EXISTS "Meter readings tenant create" ON public.meter_readings;

-- Les propriétaires peuvent TOUT faire sur les relevés des compteurs de leurs logements
CREATE POLICY "Owners can manage readings of own property meters"
  ON public.meter_readings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.meters m
      JOIN public.properties p ON p.id = m.property_id
      WHERE m.id = public.meter_readings.meter_id
      AND p.owner_id = public.user_profile_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.meters m
      JOIN public.properties p ON p.id = m.property_id
      WHERE m.id = public.meter_readings.meter_id
      AND p.owner_id = public.user_profile_id()
    )
  );

-- Les locataires peuvent VOIR et CRÉER des relevés pour leurs compteurs
CREATE POLICY "Tenants can manage readings of own lease meters"
  ON public.meter_readings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.meters m
      WHERE m.id = public.meter_readings.meter_id
      AND m.lease_id IN (
        SELECT ls.lease_id 
        FROM public.lease_signers ls
        WHERE ls.profile_id = public.user_profile_id()
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.meters m
      WHERE m.id = public.meter_readings.meter_id
      AND m.lease_id IN (
        SELECT ls.lease_id 
        FROM public.lease_signers ls
        WHERE ls.profile_id = public.user_profile_id()
      )
    )
  );

COMMIT;



-- ========== 20251228230000_definitive_rls_fix.sql ==========
-- MASTER FIX: Éradication de la récursion infinie RLS
-- Ce script nettoie TOUTES les politiques sur les tables critiques et recrée des règles saines.
-- Tables cibles : lease_signers, leases, roommates, tenant_profiles, meters

BEGIN;

-- ============================================
-- 1. FONCTIONS HELPERS (SECURITY DEFINER)
-- Ces fonctions bypassent RLS et cassent les boucles.
-- ============================================

CREATE OR REPLACE FUNCTION public.user_profile_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Helper pour vérifier si un utilisateur est lié à un bail (locataire/colocataire)
CREATE OR REPLACE FUNCTION public.is_lease_member(p_lease_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM lease_signers 
    WHERE lease_id = p_lease_id 
    AND profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );
$$;

-- Helper pour vérifier si un utilisateur est propriétaire d'un bail via property
CREATE OR REPLACE FUNCTION public.is_lease_owner(p_lease_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM leases l
    JOIN properties p ON p.id = l.property_id
    WHERE l.id = p_lease_id 
    AND p.owner_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );
$$;

-- ============================================
-- 2. NETTOYAGE RADICAL
-- Supprime TOUTES les politiques sur les tables à risque pour repartir à zéro.
-- ============================================

DO $$ 
DECLARE 
  r RECORD;
BEGIN
  FOR r IN (
    SELECT policyname, tablename 
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename IN ('lease_signers', 'leases', 'roommates', 'tenant_profiles', 'meters', 'meter_readings', 'profiles')
  ) LOOP
    EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON ' || quote_ident(r.tablename);
  END LOOP;
END $$;

-- ============================================
-- 3. NOUVELLES POLITIQUES : PROFILES
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_self_all" ON profiles FOR ALL TO authenticated 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "profiles_admin_all" ON profiles FOR ALL TO authenticated 
USING (public.user_role() = 'admin');

CREATE POLICY "profiles_owner_view_tenants" ON profiles FOR SELECT TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM lease_signers ls
    JOIN leases l ON l.id = ls.lease_id
    JOIN properties p ON p.id = l.property_id
    WHERE ls.profile_id = profiles.id
    AND p.owner_id = public.user_profile_id()
  )
);

-- ============================================
-- 4. NOUVELLES POLITIQUES : LEASES
-- ============================================

ALTER TABLE leases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leases_admin_all" ON leases FOR ALL TO authenticated USING (public.user_role() = 'admin');

CREATE POLICY "leases_owner_all" ON leases FOR ALL TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM properties p 
    WHERE p.id = leases.property_id 
    AND p.owner_id = public.user_profile_id()
  )
);

CREATE POLICY "leases_tenant_select" ON leases FOR SELECT TO authenticated 
USING (public.is_lease_member(id));

-- ============================================
-- 4. NOUVELLES POLITIQUES : LEASE_SIGNERS
-- ============================================

ALTER TABLE lease_signers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ls_admin_all" ON lease_signers FOR ALL TO authenticated USING (public.user_role() = 'admin');

CREATE POLICY "ls_self_manage" ON lease_signers FOR ALL TO authenticated 
USING (profile_id = public.user_profile_id())
WITH CHECK (profile_id = public.user_profile_id());

CREATE POLICY "ls_owner_manage" ON lease_signers FOR ALL TO authenticated 
USING (public.is_lease_owner(lease_id));

CREATE POLICY "ls_tenant_view_others" ON lease_signers FOR SELECT TO authenticated 
USING (public.is_lease_member(lease_id));

-- ============================================
-- 5. NOUVELLES POLITIQUES : METERS & READINGS
-- ============================================

-- Corrections structurelles sur la table meters
ALTER TABLE meters ALTER COLUMN lease_id DROP NOT NULL;
ALTER TABLE meters DROP CONSTRAINT IF EXISTS meters_unit_check;

ALTER TABLE meters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meters_admin_all" ON meters FOR ALL TO authenticated USING (public.user_role() = 'admin');

CREATE POLICY "meters_owner_manage" ON meters FOR ALL TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM properties p 
    WHERE p.id = meters.property_id 
    AND p.owner_id = public.user_profile_id()
  )
);

CREATE POLICY "meters_tenant_select" ON meters FOR SELECT TO authenticated 
USING (public.is_lease_member(lease_id));

-- Meter Readings
ALTER TABLE meter_readings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "readings_admin_all" ON meter_readings FOR ALL TO authenticated USING (public.user_role() = 'admin');

CREATE POLICY "readings_owner_manage" ON meter_readings FOR ALL TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM meters m
    JOIN properties p ON p.id = m.property_id
    WHERE m.id = meter_readings.meter_id
    AND p.owner_id = public.user_profile_id()
  )
);

CREATE POLICY "readings_tenant_all" ON meter_readings FOR ALL TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM meters m
    WHERE m.id = meter_readings.meter_id
    AND public.is_lease_member(m.lease_id)
  )
);

-- ============================================
-- 6. NOUVELLES POLITIQUES : ROOMMATES
-- ============================================

ALTER TABLE roommates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "roommates_admin_all" ON roommates FOR ALL TO authenticated USING (public.user_role() = 'admin');

CREATE POLICY "roommates_owner_manage" ON roommates FOR ALL TO authenticated 
USING (public.is_lease_owner(lease_id));

CREATE POLICY "roommates_member_select" ON roommates FOR SELECT TO authenticated 
USING (public.is_lease_member(lease_id));

-- ============================================
-- 7. NOUVELLES POLITIQUES : TENANT_PROFILES
-- ============================================

ALTER TABLE tenant_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tp_admin_all" ON tenant_profiles FOR ALL TO authenticated USING (public.user_role() = 'admin');

CREATE POLICY "tp_self_manage" ON tenant_profiles FOR ALL TO authenticated 
USING (profile_id = public.user_profile_id());

CREATE POLICY "tp_owner_view" ON tenant_profiles FOR SELECT TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM lease_signers ls
    JOIN leases l ON l.id = ls.lease_id
    JOIN properties p ON p.id = l.property_id
    WHERE ls.profile_id = tenant_profiles.profile_id
    AND p.owner_id = public.user_profile_id()
  )
);

COMMIT;



-- ========== 20251229000001_fix_existing_lease_statuses.sql ==========
-- ============================================================================
-- Migration: Correction des statuts de baux existants
-- Date: 2025-12-29
-- Description: Met à jour les baux qui ont toutes les signatures mais un statut incorrect
-- ============================================================================

-- 1. Corriger les baux où TOUS les signataires ont signé mais le statut n'est pas "fully_signed"
UPDATE leases l
SET statut = 'fully_signed'
WHERE l.statut IN ('pending_signature', 'partially_signed', 'sent', 'draft')
  AND NOT EXISTS (
    -- S'assurer qu'il n'y a aucun signataire qui n'a pas signé
    SELECT 1 
    FROM lease_signers ls 
    WHERE ls.lease_id = l.id 
      AND ls.signature_status != 'signed'
  )
  AND EXISTS (
    -- S'assurer qu'il y a au moins un signataire
    SELECT 1 
    FROM lease_signers ls 
    WHERE ls.lease_id = l.id
  );

-- 2. Créer ou remplacer le trigger qui met à jour automatiquement le statut du bail
CREATE OR REPLACE FUNCTION update_lease_status_on_signature()
RETURNS TRIGGER AS $$
DECLARE
  v_all_signed BOOLEAN;
  v_signer_count INTEGER;
  v_signed_count INTEGER;
BEGIN
  -- Compter le nombre total de signataires et ceux qui ont signé
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE signature_status = 'signed')
  INTO v_signer_count, v_signed_count
  FROM lease_signers
  WHERE lease_id = NEW.lease_id;

  -- Déterminer si tous ont signé
  v_all_signed := (v_signer_count > 0 AND v_signer_count = v_signed_count);

  -- Mettre à jour le statut du bail
  IF v_all_signed THEN
    UPDATE leases 
    SET statut = 'fully_signed', updated_at = NOW()
    WHERE id = NEW.lease_id 
      AND statut NOT IN ('fully_signed', 'active', 'terminated', 'archived');
    
    RAISE NOTICE 'Bail % passé à fully_signed (% signataires)', NEW.lease_id, v_signer_count;
  ELSIF v_signed_count > 0 THEN
    UPDATE leases 
    SET statut = 'partially_signed', updated_at = NOW()
    WHERE id = NEW.lease_id 
      AND statut IN ('pending_signature', 'sent', 'draft');
    
    RAISE NOTICE 'Bail % passé à partially_signed (%/% signataires)', NEW.lease_id, v_signed_count, v_signer_count;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Supprimer l'ancien trigger s'il existe
DROP TRIGGER IF EXISTS trigger_update_lease_status_on_signature ON lease_signers;

-- Créer le nouveau trigger
CREATE TRIGGER trigger_update_lease_status_on_signature
  AFTER UPDATE OF signature_status ON lease_signers
  FOR EACH ROW
  WHEN (NEW.signature_status = 'signed' AND OLD.signature_status != 'signed')
  EXECUTE FUNCTION update_lease_status_on_signature();

-- 3. Afficher les baux corrigés (pour le log)
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM leases 
  WHERE statut = 'fully_signed';
  
  RAISE NOTICE 'Nombre total de baux avec statut fully_signed: %', v_count;
END $$;



-- ========== 20251231000000_advanced_signatures.sql ==========
-- ============================================
-- Migration : Signature Électronique Avancée (Audit Trail)
-- Date : 2025-12-31
-- Description : Ajout des colonnes pour le dossier de preuve (eIDAS)
-- ============================================

-- 1. Mise à jour de EDL_SIGNATURES
ALTER TABLE public.edl_signatures 
ADD COLUMN IF NOT EXISTS proof_id TEXT,
ADD COLUMN IF NOT EXISTS proof_metadata JSONB,
ADD COLUMN IF NOT EXISTS document_hash TEXT;

-- Index pour la recherche par preuve
CREATE INDEX IF NOT EXISTS idx_edl_signatures_proof_id ON public.edl_signatures(proof_id);

-- 2. Mise à jour de LEASE_SIGNERS
ALTER TABLE public.lease_signers
ADD COLUMN IF NOT EXISTS signature_image_path TEXT,
ADD COLUMN IF NOT EXISTS ip_inet INET,
ADD COLUMN IF NOT EXISTS user_agent TEXT,
ADD COLUMN IF NOT EXISTS proof_id TEXT,
ADD COLUMN IF NOT EXISTS proof_metadata JSONB,
ADD COLUMN IF NOT EXISTS document_hash TEXT;

-- Index pour la recherche par preuve
CREATE INDEX IF NOT EXISTS idx_lease_signers_proof_id ON public.lease_signers(proof_id);

-- 3. Commentaires pour la documentation
COMMENT ON COLUMN public.edl_signatures.proof_id IS 'Identifiant unique du dossier de preuve (Audit Trail)';
COMMENT ON COLUMN public.edl_signatures.proof_metadata IS 'Dossier de preuve complet (JSON) conforme eIDAS';
COMMENT ON COLUMN public.edl_signatures.document_hash IS 'Empreinte SHA-256 du document au moment de la signature';

COMMENT ON COLUMN public.lease_signers.proof_id IS 'Identifiant unique du dossier de preuve (Audit Trail)';
COMMENT ON COLUMN public.lease_signers.proof_metadata IS 'Dossier de preuve complet (JSON) conforme eIDAS';
COMMENT ON COLUMN public.lease_signers.document_hash IS 'Empreinte SHA-256 du document au moment de la signature';
COMMENT ON COLUMN public.lease_signers.signature_image_path IS 'Chemin de l''image de signature tactile dans le storage';



-- ========== 20251231000001_fix_owner_dashboard_rpc.sql ==========
-- Fix owner_dashboard RPC to use 'etat' instead of 'statut' for properties
-- and fix the values for status filtering

CREATE OR REPLACE FUNCTION owner_dashboard(p_owner_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Vérifier que l'utilisateur est bien le propriétaire
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = p_owner_id 
    AND role = 'owner'
    AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Accès non autorisé';
  END IF;

  SELECT jsonb_build_object(
    'properties', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'ref', p.unique_code,
          'adresse', p.adresse_complete,
          'statut', p.etat,
          'type', p.type,
          'surface', p.surface,
          'nb_pieces', p.nb_pieces,
          'created_at', p.created_at,
          'updated_at', p.updated_at
        )
      )
      FROM properties p
      WHERE p.owner_id = p_owner_id
    ),
    'properties_stats', (
      SELECT jsonb_build_object(
        'total', COUNT(*),
        'active', COUNT(*) FILTER (WHERE etat = 'published'),
        'draft', COUNT(*) FILTER (WHERE etat = 'draft')
      )
      FROM properties
      WHERE owner_id = p_owner_id
    ),
    'leases', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', l.id,
          'property_id', l.property_id,
          'type_bail', l.type_bail,
          'loyer', l.loyer,
          'date_debut', l.date_debut,
          'date_fin', l.date_fin,
          'statut', l.statut,
          'created_at', l.created_at
        )
      )
      FROM leases l
      INNER JOIN properties p ON p.id = l.property_id
      WHERE p.owner_id = p_owner_id
    ),
    'leases_stats', (
      SELECT jsonb_build_object(
        'total', COUNT(*),
        'active', COUNT(*) FILTER (WHERE l.statut = 'active'),
        'pending', COUNT(*) FILTER (WHERE l.statut = 'pending_signature')
      )
      FROM leases l
      INNER JOIN properties p ON p.id = l.property_id
      WHERE p.owner_id = p_owner_id
    ),
    'invoices', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', i.id,
          'lease_id', i.lease_id,
          'periode', i.periode,
          'montant_total', i.montant_total,
          'statut', i.statut,
          'created_at', i.created_at
        )
      )
      FROM invoices i
      WHERE i.owner_id = p_owner_id
      ORDER BY i.created_at DESC
      LIMIT 10
    ),
    'invoices_stats', (
      SELECT jsonb_build_object(
        'total', COUNT(*),
        'paid', COUNT(*) FILTER (WHERE statut = 'paid'),
        'pending', COUNT(*) FILTER (WHERE statut = 'sent'),
        'late', COUNT(*) FILTER (WHERE statut = 'late')
      )
      FROM invoices
      WHERE owner_id = p_owner_id
    ),
    'tickets', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', t.id,
          'property_id', t.property_id,
          'titre', t.titre,
          'priorite', t.priorite,
          'statut', t.statut,
          'created_at', t.created_at
        )
      )
      FROM tickets t
      INNER JOIN properties p ON p.id = t.property_id
      WHERE p.owner_id = p_owner_id
      ORDER BY t.created_at DESC
      LIMIT 10
    ),
    'tickets_stats', (
      SELECT jsonb_build_object(
        'total', COUNT(*),
        'open', COUNT(*) FILTER (WHERE t.statut = 'open'),
        'in_progress', COUNT(*) FILTER (WHERE t.statut = 'in_progress')
      )
      FROM tickets t
      INNER JOIN properties p ON p.id = t.property_id
      WHERE p.owner_id = p_owner_id
    )
  ) INTO v_result;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;



-- ========== 20251231000002_agency_dashboard_rpc.sql ==========
-- RPC pour le dashboard agence
-- Récupère toutes les données nécessaires (stats, mandats, paiements, tâches)

CREATE OR REPLACE FUNCTION agency_dashboard(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_agency_profile_id UUID;
  v_stats JSONB;
  v_recent_mandates JSONB;
  v_recent_payments JSONB;
  v_pending_tasks JSONB;
  v_result JSONB;
BEGIN
  -- 1. Récupérer l'ID du profil agence
  SELECT id INTO v_agency_profile_id
  FROM profiles
  WHERE user_id = p_user_id AND role = 'agency';

  IF v_agency_profile_id IS NULL THEN
    -- Vérifier si l'utilisateur est un gestionnaire d'agence
    SELECT agency_profile_id INTO v_agency_profile_id
    FROM agency_managers
    WHERE user_profile_id = (SELECT id FROM profiles WHERE user_id = p_user_id)
    AND is_active = true;
  END IF;

  IF v_agency_profile_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Profil agence non trouvé');
  END IF;

  -- 2. Statistiques via la vue existing agency_dashboard_stats
  SELECT jsonb_build_object(
    'mandatsActifs', mandats_actifs,
    'mandatsTotal', total_mandats,
    'proprietaires', total_proprietaires,
    'biensGeres', total_biens_geres,
    'commissionsEncaissees', commissions_encaissees,
    'commissionsEnAttente', commissions_en_attente,
    'loyersEncaissesMois', (
      SELECT COALESCE(SUM(montant_total), 0)
      FROM invoices i
      JOIN mandates m ON m.owner_profile_id = i.owner_id
      WHERE m.agency_profile_id = v_agency_profile_id
      AND i.statut = 'paid'
      AND i.periode = to_char(CURRENT_DATE, 'YYYY-MM')
    ),
    'tauxOccupation', (
      SELECT CASE WHEN total_biens_geres > 0 
        THEN ROUND((COUNT(*) FILTER (WHERE l.statut = 'active'))::NUMERIC / total_biens_geres * 100)
        ELSE 0 END
      FROM leases l
      INNER JOIN properties p ON p.id = l.property_id
      INNER JOIN mandates m ON m.owner_profile_id = p.owner_id
      WHERE m.agency_profile_id = v_agency_profile_id
    ),
    'ticketsOuverts', (
      SELECT COUNT(*)
      FROM tickets t
      INNER JOIN properties p ON p.id = t.property_id
      INNER JOIN mandates m ON m.owner_profile_id = p.owner_id
      WHERE m.agency_profile_id = v_agency_profile_id
      AND t.statut IN ('open', 'in_progress')
    )
  ) INTO v_stats
  FROM agency_dashboard_stats
  WHERE agency_id = v_agency_profile_id;

  -- 3. Mandats récents
  SELECT jsonb_agg(mandate_data) INTO v_recent_mandates
  FROM (
    SELECT jsonb_build_object(
      'id', m.id,
      'owner', (SELECT concat(pr.prenom, ' ', pr.nom) FROM profiles pr WHERE pr.id = m.owner_profile_id),
      'type', m.type_mandat,
      'biens', CASE WHEN m.inclut_tous_biens THEN (SELECT COUNT(*) FROM properties WHERE owner_id = m.owner_profile_id) ELSE array_length(m.properties_ids, 1) END,
      'status', m.statut,
      'commission', m.commission_pourcentage || '%'
    ) as mandate_data
    FROM mandates m
    WHERE m.agency_profile_id = v_agency_profile_id
    ORDER BY m.created_at DESC
    LIMIT 5
  ) sub;

  -- 4. Paiements récents
  SELECT jsonb_agg(payment_data) INTO v_recent_payments
  FROM (
    SELECT jsonb_build_object(
      'id', i.id,
      'property', (SELECT p.adresse_complete FROM properties p WHERE p.id = l.property_id),
      'tenant', (SELECT concat(pr.prenom, ' ', pr.nom) FROM profiles pr WHERE pr.id = i.tenant_id),
      'amount', i.montant_total,
      'status', i.statut,
      'date', to_char(i.updated_at, 'DD/MM/YYYY')
    ) as payment_data
    FROM invoices i
    JOIN leases l ON l.id = i.lease_id
    JOIN mandates m ON m.owner_profile_id = i.owner_id
    WHERE m.agency_profile_id = v_agency_profile_id
    AND i.statut IN ('paid', 'sent', 'late')
    ORDER BY i.updated_at DESC
    LIMIT 5
  ) sub;

  -- 5. Tâches en attente (EDL, Signatures, Révisions)
  SELECT jsonb_agg(task_data) INTO v_pending_tasks
  FROM (
    -- EDL en attente
    SELECT jsonb_build_object(
      'id', e.id,
      'title', 'EDL ' || e.type || ' - ' || (SELECT p.ville FROM properties p WHERE p.id = e.property_id),
      'type', 'edl',
      'dueDate', to_char(e.created_at + interval '2 days', 'DD/MM/YYYY')
    ) as task_data
    FROM edl e
    INNER JOIN properties p ON p.id = e.property_id
    INNER JOIN mandates m ON m.owner_profile_id = p.owner_id
    WHERE m.agency_profile_id = v_agency_profile_id
    AND e.is_signed = false
    UNION ALL
    -- Baux en attente de signature
    SELECT jsonb_build_object(
      'id', l.id,
      'title', 'Signature bail - ' || (SELECT p.adresse_complete FROM properties p WHERE p.id = l.property_id),
      'type', 'signature',
      'dueDate', to_char(l.created_at + interval '1 week', 'DD/MM/YYYY')
    ) as task_data
    FROM leases l
    INNER JOIN properties p ON p.id = l.property_id
    INNER JOIN mandates m ON m.owner_profile_id = p.owner_id
    WHERE m.agency_profile_id = v_agency_profile_id
    AND l.statut = 'pending_signature'
    LIMIT 5
  ) sub;

  -- 6. Résultat final
  v_result := jsonb_build_object(
    'stats', COALESCE(v_stats, '{}'::jsonb),
    'recentMandates', COALESCE(v_recent_mandates, '[]'::jsonb),
    'recentPayments', COALESCE(v_recent_payments, '[]'::jsonb),
    'pendingTasks', COALESCE(v_pending_tasks, '[]'::jsonb)
  );

  RETURN v_result;
END;
$$;



-- ========== 20251231000003_enhance_tenant_dashboard_rpc.sql ==========
-- Amélioration du RPC tenant_dashboard pour supporter multi-baux
-- et retourner plus d'informations connectées

CREATE OR REPLACE FUNCTION tenant_dashboard(p_tenant_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile_id UUID;
  v_leases JSONB;
  v_invoices JSONB;
  v_tickets JSONB;
  v_pending_edls JSONB;
  v_insurance_status JSONB;
  v_stats JSONB;
  v_result JSONB;
BEGIN
  -- 1. Récupérer l'ID du profil à partir du user_id
  SELECT id INTO v_profile_id
  FROM profiles
  WHERE user_id = p_tenant_user_id AND role = 'tenant';

  IF v_profile_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- 2. Récupérer TOUS les baux (actifs ou en attente)
  SELECT jsonb_agg(lease_data) INTO v_leases
  FROM (
    SELECT 
      l.*,
      jsonb_build_object(
        'id', p.id,
        'adresse_complete', p.adresse_complete,
        'ville', p.ville,
        'code_postal', p.code_postal,
        'type', p.type,
        'surface', p.surface,
        'nb_pieces', p.nb_pieces,
        'cover_url', (SELECT url FROM property_photos WHERE property_id = p.id AND is_main = true LIMIT 1)
      ) as property,
      jsonb_build_object(
        'id', owner_prof.id,
        'name', concat(owner_prof.prenom, ' ', owner_prof.nom),
        'email', owner_prof.email
      ) as owner
    FROM leases l
    JOIN lease_signers ls ON ls.lease_id = l.id
    JOIN properties p ON p.id = l.property_id
    JOIN profiles owner_prof ON owner_prof.id = p.owner_id
    WHERE ls.profile_id = v_profile_id
    AND l.statut IN ('active', 'pending_signature', 'terminated')
    ORDER BY l.statut = 'active' DESC, l.created_at DESC
  ) lease_data;

  -- 3. Récupérer les factures (10 dernières)
  SELECT jsonb_agg(invoice_data) INTO v_invoices
  FROM (
    SELECT 
      i.*,
      p.type as property_type,
      p.adresse_complete as property_address
    FROM invoices i
    JOIN leases l ON l.id = i.lease_id
    JOIN properties p ON p.id = l.property_id
    WHERE i.tenant_id = v_profile_id
    ORDER BY i.periode DESC, i.created_at DESC
    LIMIT 10
  ) invoice_data;

  -- 4. Récupérer les tickets récents (10 derniers)
  SELECT jsonb_agg(ticket_data) INTO v_tickets
  FROM (
    SELECT 
      t.*,
      p.adresse_complete as property_address,
      p.type as property_type
    FROM tickets t
    JOIN properties p ON p.id = t.property_id
    WHERE t.created_by_profile_id = v_profile_id
    ORDER BY t.created_at DESC
    LIMIT 10
  ) ticket_data;

  -- 5. Récupérer les EDLs en attente de signature
  SELECT jsonb_agg(edl_data) INTO v_pending_edls
  FROM (
    SELECT 
      e.id,
      e.type,
      e.scheduled_at,
      es.invitation_token,
      p.adresse_complete as property_address,
      p.type as property_type
    FROM edl e
    JOIN edl_signatures es ON es.edl_id = e.id
    JOIN properties p ON p.id = e.property_id
    WHERE es.signer_profile_id = v_profile_id
    AND es.signed_at IS NULL
    AND e.status IN ('draft', 'scheduled', 'in_progress')
    ORDER BY e.created_at DESC
  ) edl_data;

  -- 6. Vérifier l'assurance pour les baux actifs
  SELECT jsonb_build_object(
    'has_insurance', EXISTS (
      SELECT 1 FROM documents 
      WHERE tenant_id = v_profile_id 
      AND type = 'attestation_assurance'
      AND is_archived = false
      AND (expiry_date IS NULL OR expiry_date > NOW())
    ),
    'last_expiry_date', (
      SELECT expiry_date FROM documents 
      WHERE tenant_id = v_profile_id 
      AND type = 'attestation_assurance'
      AND is_archived = false
      ORDER BY expiry_date DESC LIMIT 1
    )
  ) INTO v_insurance_status;

  -- 7. Stats globales
  SELECT jsonb_build_object(
    'unpaid_amount', COALESCE(SUM(montant_total) FILTER (WHERE statut IN ('sent', 'late')), 0),
    'unpaid_count', COUNT(*) FILTER (WHERE statut IN ('sent', 'late')),
    'total_monthly_rent', COALESCE(SUM(loyer + charges_forfaitaires) FILTER (WHERE statut = 'active'), 0),
    'active_leases_count', COUNT(*) FILTER (WHERE statut = 'active')
  ) INTO v_stats
  FROM leases l
  JOIN lease_signers ls ON ls.lease_id = l.id
  WHERE ls.profile_id = v_profile_id;

  -- 8. Assembler le résultat
  v_result := jsonb_build_object(
    'profile_id', v_profile_id,
    'leases', COALESCE(v_leases, '[]'::jsonb),
    -- Rétro-compatibilité : premier bail
    'lease', CASE WHEN v_leases IS NOT NULL THEN v_leases->0 ELSE NULL END,
    'invoices', COALESCE(v_invoices, '[]'::jsonb),
    'tickets', COALESCE(v_tickets, '[]'::jsonb),
    'pending_edls', COALESCE(v_pending_edls, '[]'::jsonb),
    'insurance', v_insurance_status,
    'stats', COALESCE(v_stats, '{"unpaid_amount": 0, "unpaid_count": 0, "total_monthly_rent": 0, "active_leases_count": 0}'::jsonb)
  );

  RETURN v_result;
END;
$$;



-- ========== 20251231000004_fix_admin_stats_rpc.sql ==========
-- Mise à jour admin_stats pour inclure tous les rôles et corriger les agrégats

CREATE OR REPLACE FUNCTION admin_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_is_admin BOOLEAN;
  v_total_users INT;
  v_users_by_role JSONB;
  v_total_properties INT;
  v_properties_by_type JSONB;
  v_total_leases INT;
  v_active_leases INT;
  v_leases_by_status JSONB;
  v_total_invoices INT;
  v_unpaid_invoices INT;
  v_invoices_by_status JSONB;
  v_total_tickets INT;
  v_open_tickets INT;
  v_tickets_by_status JSONB;
  v_total_documents INT;
  v_result JSONB;
BEGIN
  -- 1. Vérifier que l'utilisateur est admin
  v_user_id := auth.uid();
  
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = v_user_id
    AND role = 'admin'
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Accès refusé : réservé aux administrateurs';
  END IF;

  -- 2. Stats Utilisateurs (Tous les rôles)
  SELECT COUNT(*) INTO v_total_users FROM profiles;
  
  SELECT jsonb_build_object(
    'admin', COUNT(*) FILTER (WHERE role = 'admin'),
    'owner', COUNT(*) FILTER (WHERE role = 'owner'),
    'tenant', COUNT(*) FILTER (WHERE role = 'tenant'),
    'provider', COUNT(*) FILTER (WHERE role = 'provider'),
    'agency', COUNT(*) FILTER (WHERE role = 'agency'),
    'guarantor', COUNT(*) FILTER (WHERE role = 'guarantor'),
    'syndic', COUNT(*) FILTER (WHERE role = 'syndic'),
    'coproprietaire', COUNT(*) FILTER (WHERE role = 'coproprietaire')
  ) INTO v_users_by_role
  FROM profiles;

  -- 3. Stats Propriétés
  SELECT COUNT(*) INTO v_total_properties FROM properties;
  
  SELECT jsonb_build_object(
    'appartement', COUNT(*) FILTER (WHERE type = 'appartement'),
    'maison', COUNT(*) FILTER (WHERE type = 'maison'),
    'colocation', COUNT(*) FILTER (WHERE type = 'colocation'),
    'saisonnier', COUNT(*) FILTER (WHERE type = 'saisonnier')
  ) INTO v_properties_by_type
  FROM properties;

  -- 4. Stats Baux
  SELECT COUNT(*) INTO v_total_leases FROM leases;
  SELECT COUNT(*) INTO v_active_leases FROM leases WHERE statut = 'active';
  
  SELECT jsonb_build_object(
    'draft', COUNT(*) FILTER (WHERE statut = 'draft'),
    'pending_signature', COUNT(*) FILTER (WHERE statut = 'pending_signature'),
    'active', COUNT(*) FILTER (WHERE statut = 'active'),
    'terminated', COUNT(*) FILTER (WHERE statut = 'terminated')
  ) INTO v_leases_by_status
  FROM leases;

  -- 5. Stats Factures
  SELECT COUNT(*) INTO v_total_invoices FROM invoices;
  SELECT COUNT(*) INTO v_unpaid_invoices FROM invoices WHERE statut IN ('sent', 'late');
  
  SELECT jsonb_build_object(
    'draft', COUNT(*) FILTER (WHERE statut = 'draft'),
    'sent', COUNT(*) FILTER (WHERE statut = 'sent'),
    'paid', COUNT(*) FILTER (WHERE statut = 'paid'),
    'late', COUNT(*) FILTER (WHERE statut = 'late')
  ) INTO v_invoices_by_status
  FROM invoices;

  -- 6. Stats Tickets
  SELECT COUNT(*) INTO v_total_tickets FROM tickets;
  SELECT COUNT(*) INTO v_open_tickets FROM tickets WHERE statut = 'open';
  
  SELECT jsonb_build_object(
    'open', COUNT(*) FILTER (WHERE statut = 'open'),
    'in_progress', COUNT(*) FILTER (WHERE statut = 'in_progress'),
    'resolved', COUNT(*) FILTER (WHERE statut = 'resolved'),
    'closed', COUNT(*) FILTER (WHERE statut = 'closed')
  ) INTO v_tickets_by_status
  FROM tickets;

  -- 7. Stats Documents
  SELECT COUNT(*) INTO v_total_documents FROM documents;

  -- Assembler le résultat
  v_result := jsonb_build_object(
    'totalUsers', v_total_users,
    'usersByRole', v_users_by_role,
    'totalProperties', v_total_properties,
    'propertiesByType', v_properties_by_type,
    'totalLeases', v_total_leases,
    'activeLeases', v_active_leases,
    'leasesByStatus', v_leases_by_status,
    'totalInvoices', v_total_invoices,
    'unpaidInvoices', v_unpaid_invoices,
    'invoicesByStatus', v_invoices_by_status,
    'totalTickets', v_total_tickets,
    'openTickets', v_open_tickets,
    'ticketsByStatus', v_tickets_by_status,
    'totalDocuments', v_total_documents,
    'totalBlogPosts', (SELECT COUNT(*) FROM blog_posts),
    'publishedBlogPosts', (SELECT COUNT(*) FROM blog_posts WHERE is_published = true),
    'recentActivity', (
      SELECT jsonb_agg(activity)
      FROM (
        SELECT 
          'profile' as type,
          concat(prenom, ' ', nom) as title,
          created_at::text as date
        FROM profiles
        ORDER BY created_at DESC
        LIMIT 10
      ) activity
    )
  );

  RETURN v_result;
END;
$$;



-- ========== 20251231000005_finalize_owner_dashboard_rpc.sql ==========
-- Final fix for owner_dashboard RPC: include recent activity

CREATE OR REPLACE FUNCTION owner_dashboard(p_owner_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Vérifier que l'utilisateur est bien le propriétaire
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = p_owner_id 
    AND role = 'owner'
    AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Accès non autorisé';
  END IF;

  SELECT jsonb_build_object(
    'properties', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'ref', p.unique_code,
          'adresse', p.adresse_complete,
          'statut', p.etat,
          'type', p.type,
          'surface', p.surface,
          'nb_pieces', p.nb_pieces,
          'created_at', p.created_at,
          'updated_at', p.updated_at
        )
      )
      FROM properties p
      WHERE p.owner_id = p_owner_id
    ),
    'properties_stats', (
      SELECT jsonb_build_object(
        'total', COUNT(*),
        'active', COUNT(*) FILTER (WHERE etat = 'published'),
        'draft', COUNT(*) FILTER (WHERE etat = 'draft')
      )
      FROM properties
      WHERE owner_id = p_owner_id
    ),
    'leases', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', l.id,
          'property_id', l.property_id,
          'type_bail', l.type_bail,
          'loyer', l.loyer,
          'date_debut', l.date_debut,
          'date_fin', l.date_fin,
          'statut', l.statut,
          'created_at', l.created_at
        )
      )
      FROM leases l
      INNER JOIN properties p ON p.id = l.property_id
      WHERE p.owner_id = p_owner_id
    ),
    'leases_stats', (
      SELECT jsonb_build_object(
        'total', COUNT(*),
        'active', COUNT(*) FILTER (WHERE l.statut = 'active'),
        'pending', COUNT(*) FILTER (WHERE l.statut = 'pending_signature')
      )
      FROM leases l
      INNER JOIN properties p ON p.id = l.property_id
      WHERE p.owner_id = p_owner_id
    ),
    'invoices', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', i.id,
          'lease_id', i.lease_id,
          'periode', i.periode,
          'montant_total', i.montant_total,
          'statut', i.statut,
          'created_at', i.created_at
        )
      )
      FROM invoices i
      WHERE i.owner_id = p_owner_id
      ORDER BY i.created_at DESC
      LIMIT 10
    ),
    'invoices_stats', (
      SELECT jsonb_build_object(
        'total', COUNT(*),
        'paid', COUNT(*) FILTER (WHERE statut = 'paid'),
        'pending', COUNT(*) FILTER (WHERE statut = 'sent'),
        'late', COUNT(*) FILTER (WHERE statut = 'late')
      )
      FROM invoices
      WHERE owner_id = p_owner_id
    ),
    'tickets', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', t.id,
          'property_id', t.property_id,
          'titre', t.titre,
          'priorite', t.priorite,
          'statut', t.statut,
          'created_at', t.created_at
        )
      )
      FROM tickets t
      INNER JOIN properties p ON p.id = t.property_id
      WHERE p.owner_id = p_owner_id
      ORDER BY t.created_at DESC
      LIMIT 10
    ),
    'tickets_stats', (
      SELECT jsonb_build_object(
        'total', COUNT(*),
        'open', COUNT(*) FILTER (WHERE t.statut = 'open'),
        'in_progress', COUNT(*) FILTER (WHERE t.statut = 'in_progress')
      )
      FROM tickets t
      INNER JOIN properties p ON p.id = t.property_id
      WHERE p.owner_id = p_owner_id
    ),
    'recentActivity', (
      SELECT jsonb_agg(act) FROM (
        -- Nouvelles factures
        SELECT 'invoice' as type, 'Facture générée - ' || i.periode as title, i.created_at::text as date
        FROM invoices i WHERE i.owner_id = p_owner_id
        UNION ALL
        -- Nouveaux tickets
        SELECT 'ticket' as type, 'Nouveau ticket: ' || t.titre as title, t.created_at::text as date
        FROM tickets t INNER JOIN properties p ON p.id = t.property_id WHERE p.owner_id = p_owner_id
        UNION ALL
        -- Nouvelles signatures
        SELECT 'signature' as type, 'Bail signé - ' || p.adresse_complete as title, l.updated_at::text as date
        FROM leases l INNER JOIN properties p ON p.id = l.property_id WHERE p.owner_id = p_owner_id AND l.statut = 'active'
        ORDER BY date DESC
        LIMIT 10
      ) act
    )
  ) INTO v_result;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;



-- ========== 20251231000006_automated_billing.sql ==========
-- ============================================
-- Migration : Automatisation de la Facturation Mensuelle
-- Date : 2025-12-31
-- Description : Fonction pour générer les factures de tous les baux actifs
-- ============================================

CREATE OR REPLACE FUNCTION generate_monthly_invoices(p_target_month TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT := 0;
  v_lease RECORD;
  v_result JSONB;
BEGIN
  -- Vérifier le format du mois (YYYY-MM)
  IF p_target_month !~ '^\d{4}-\d{2}$' THEN
    RAISE EXCEPTION 'Format de mois invalide. Attendu: YYYY-MM';
  END IF;

  -- Parcourir tous les baux actifs qui n'ont pas encore de facture pour ce mois
  FOR v_lease IN 
    SELECT 
      l.id as lease_id,
      l.property_id,
      p.owner_id,
      ls.profile_id as tenant_id,
      l.loyer,
      l.charges_forfaitaires
    FROM leases l
    JOIN properties p ON p.id = l.property_id
    JOIN lease_signers ls ON ls.lease_id = l.id AND ls.role IN ('locataire', 'locataire_principal')
    WHERE l.statut = 'active'
    AND l.date_debut <= (p_target_month || '-01')::DATE
    AND (l.date_fin IS NULL OR l.date_fin >= (p_target_month || '-01')::DATE)
    AND NOT EXISTS (
      SELECT 1 FROM invoices 
      WHERE lease_id = l.id 
      AND periode = p_target_month
    )
  LOOP
    INSERT INTO invoices (
      lease_id,
      owner_id,
      tenant_id,
      periode,
      montant_loyer,
      montant_charges,
      montant_total,
      statut,
      created_at
    ) VALUES (
      v_lease.lease_id,
      v_lease.owner_id,
      v_lease.tenant_id,
      p_target_month,
      v_lease.loyer,
      v_lease.charges_forfaitaires,
      v_lease.loyer + v_lease.charges_forfaitaires,
      'sent', -- Par défaut, on considère qu'elle est "envoyée" dès génération
      NOW()
    );

    v_count := v_count + 1;
  END LOOP;

  v_result := jsonb_build_object(
    'success', true,
    'month', p_target_month,
    'generated_count', v_count
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION generate_monthly_invoices IS 'Génère les factures de loyer pour tous les baux actifs pour un mois donné (YYYY-MM)';



-- ========== 20251231000007_invoices_stripe_fields.sql ==========
-- ============================================
-- Migration : Équipement Invoices pour Stripe et Relances
-- Date : 2025-12-31
-- Description : Ajout des colonnes nécessaires pour le suivi des paiements Stripe
-- ============================================

ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_session_id TEXT,
ADD COLUMN IF NOT EXISTS last_reminder_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reminder_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS date_paiement DATE;

-- Index pour la recherche rapide par Stripe ID
CREATE INDEX IF NOT EXISTS idx_invoices_stripe_pi ON public.invoices(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_invoices_stripe_session ON public.invoices(stripe_session_id);

COMMENT ON COLUMN public.invoices.stripe_payment_intent_id IS 'ID du Payment Intent Stripe lié';
COMMENT ON COLUMN public.invoices.stripe_session_id IS 'ID de la session Checkout Stripe liée';
COMMENT ON COLUMN public.invoices.last_reminder_sent_at IS 'Date du dernier email de relance envoyé';
COMMENT ON COLUMN public.invoices.reminder_count IS 'Nombre de relances déjà envoyées';
COMMENT ON COLUMN public.invoices.date_paiement IS 'Date effective à laquelle le paiement a été reçu';



-- ========== 20251231000008_fix_edl_signatures_schema.sql ==========
-- ============================================
-- Migration : Correction EDL_SIGNATURES schema
-- Date : 2025-12-31
-- Description : Rend signed_at nullable par défaut et ajoute signer_profile_id si manquant
-- ============================================

-- 1. Correction de signed_at (ne doit pas être NOW() par défaut)
ALTER TABLE public.edl_signatures 
ALTER COLUMN signed_at DROP DEFAULT,
ALTER COLUMN signed_at DROP NOT NULL;

-- 2. S'assurer que signer_profile_id existe (il semble déjà exister d'après le code mais par précaution)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='edl_signatures' AND column_name='signer_profile_id') THEN
        ALTER TABLE public.edl_signatures ADD COLUMN signer_profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 3. Ajouter une contrainte d'unicité pour éviter les doublons de signataires par EDL
ALTER TABLE public.edl_signatures
DROP CONSTRAINT IF EXISTS edl_signatures_edl_id_signer_profile_id_key;

ALTER TABLE public.edl_signatures
ADD CONSTRAINT edl_signatures_edl_id_signer_profile_id_key UNIQUE(edl_id, signer_profile_id);

-- 4. Nettoyage des données : mettre à NULL les signed_at qui n'ont pas d'image de signature (probablement des faux-positifs du NOW() par défaut)
UPDATE public.edl_signatures 
SET signed_at = NULL 
WHERE signature_image_path IS NULL;



-- ========== 20251231000009_tenant_housing_passport.sql ==========
-- Refonte de la RPC tenant_dashboard pour inclure le Passeport du Logement (Fiche Technique)
-- SOTA 2025: Données enrichies, techniques et multi-baux

-- 1. S'assurer que les colonnes techniques existent dans properties
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'properties' AND column_name = 'annee_construction') THEN
    ALTER TABLE properties ADD COLUMN annee_construction INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'properties' AND column_name = 'num_lot') THEN
    ALTER TABLE properties ADD COLUMN num_lot TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'properties' AND column_name = 'digicode') THEN
    ALTER TABLE properties ADD COLUMN digicode TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'properties' AND column_name = 'interphone') THEN
    ALTER TABLE properties ADD COLUMN interphone TEXT;
  END IF;
END $$;

-- 2. Recréer la RPC tenant_dashboard
CREATE OR REPLACE FUNCTION tenant_dashboard(p_tenant_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile_id UUID;
  v_leases JSONB;
  v_invoices JSONB;
  v_tickets JSONB;
  v_notifications JSONB;
  v_pending_edls JSONB;
  v_insurance_status JSONB;
  v_stats JSONB;
  v_result JSONB;
BEGIN
  -- 1. Récupérer l'ID du profil à partir du user_id
  SELECT id INTO v_profile_id
  FROM profiles
  WHERE user_id = p_tenant_user_id AND role = 'tenant';

  IF v_profile_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- 2. Récupérer TOUS les baux (actifs ou en attente) avec données techniques enrichies
  SELECT jsonb_agg(lease_data) INTO v_leases
  FROM (
    SELECT 
      l.*,
      jsonb_build_object(
        'id', p.id,
        'adresse_complete', p.adresse_complete,
        'ville', p.ville,
        'code_postal', p.code_postal,
        'type', p.type,
        'surface', p.surface,
        'nb_pieces', p.nb_pieces,
        'etage', p.etage,
        'ascenseur', p.ascenseur,
        'annee_construction', p.annee_construction,
        'parking_numero', p.parking_numero,
        'cave_numero', p.has_cave, -- Utilisation de has_cave comme indicateur si cave_numero absent
        'num_lot', p.num_lot,
        'digicode', p.digicode,
        'interphone', p.interphone,
        'dpe_classe_energie', p.energie, -- energie dans initial_schema
        'dpe_classe_climat', p.ges,     -- ges dans initial_schema
        'cover_url', (SELECT url FROM photos WHERE property_id = p.id AND is_main = true LIMIT 1),
        -- Inclure les compteurs (meters)
        'meters', (
          SELECT jsonb_agg(m_data)
          FROM (
            SELECT 
              m.id, 
              m.type, 
              m.serial_number, 
              m.unit,
              (SELECT reading_value FROM meter_readings WHERE meter_id = m.id ORDER BY reading_date DESC LIMIT 1) as last_reading_value,
              (SELECT reading_date FROM meter_readings WHERE meter_id = m.id ORDER BY reading_date DESC LIMIT 1) as last_reading_date
            FROM meters m
            WHERE m.property_id = p.id AND m.is_active = true
          ) m_data
        ),
        -- Inclure un résumé des clés depuis le dernier EDL signé
        'keys', (
          SELECT jsonb_agg(key_data)
          FROM (
            SELECT 
              item_name as label,
              description as count_info
            FROM edl_items ei
            JOIN edl e ON e.id = ei.edl_id
            WHERE e.property_id = p.id 
            AND e.status = 'signed' 
            AND ei.category = 'cles'
            ORDER BY e.completed_date DESC
          ) key_data
        )
      ) as property,
      jsonb_build_object(
        'id', owner_prof.id,
        'name', concat(owner_prof.prenom, ' ', owner_prof.nom),
        'email', owner_prof.email
      ) as owner
    FROM leases l
    JOIN lease_signers ls ON ls.lease_id = l.id
    JOIN properties p ON p.id = l.property_id
    JOIN profiles owner_prof ON owner_prof.id = p.owner_id
    WHERE ls.profile_id = v_profile_id
    AND l.statut IN ('active', 'pending_signature', 'terminated')
    ORDER BY l.statut = 'active' DESC, l.created_at DESC
  ) lease_data;

  -- 3. Récupérer les factures (10 dernières)
  SELECT jsonb_agg(invoice_data) INTO v_invoices
  FROM (
    SELECT 
      i.*,
      p.type as property_type,
      p.adresse_complete as property_address
    FROM invoices i
    JOIN leases l ON l.id = i.lease_id
    JOIN properties p ON p.id = l.property_id
    WHERE i.tenant_id = v_profile_id
    ORDER BY i.periode DESC, i.created_at DESC
    LIMIT 10
  ) invoice_data;

  -- 4. Récupérer les tickets récents (10 derniers)
  SELECT jsonb_agg(ticket_data) INTO v_tickets
  FROM (
    SELECT 
      t.*,
      p.adresse_complete as property_address,
      p.type as property_type
    FROM tickets t
    JOIN properties p ON p.id = t.property_id
    WHERE t.created_by_profile_id = v_profile_id
    ORDER BY t.created_at DESC
    LIMIT 10
  ) ticket_data;

  -- 5. Récupérer les notifications récentes
  SELECT jsonb_agg(notif_data) INTO v_notifications
  FROM (
    SELECT n.*
    FROM notifications n
    WHERE n.profile_id = v_profile_id
    ORDER BY n.is_read ASC, n.created_at DESC
    LIMIT 5
  ) notif_data;

  -- 6. Récupérer les EDLs en attente de signature
  SELECT jsonb_agg(edl_data) INTO v_pending_edls
  FROM (
    SELECT 
      e.id,
      e.type,
      e.scheduled_at,
      es.invitation_token,
      p.adresse_complete as property_address,
      p.type as property_type
    FROM edl e
    JOIN edl_signatures es ON es.edl_id = e.id
    JOIN properties p ON p.id = e.property_id
    WHERE es.signer_profile_id = v_profile_id
    AND es.signed_at IS NULL
    AND e.status IN ('draft', 'scheduled', 'in_progress')
    ORDER BY e.created_at DESC
  ) edl_data;

  -- 7. Vérifier l'assurance pour les baux actifs
  SELECT jsonb_build_object(
    'has_insurance', EXISTS (
      SELECT 1 FROM documents 
      WHERE tenant_id = v_profile_id 
      AND type = 'attestation_assurance'
      AND is_archived = false
      AND (expiry_date IS NULL OR expiry_date > NOW())
    ),
    'last_expiry_date', (
      SELECT expiry_date FROM documents 
      WHERE tenant_id = v_profile_id 
      AND type = 'attestation_assurance' 
      AND is_archived = false
      ORDER BY expiry_date DESC LIMIT 1
    )
  ) INTO v_insurance_status;

  -- 8. Stats globales
  SELECT jsonb_build_object(
    'unpaid_amount', COALESCE(SUM(montant_total) FILTER (WHERE statut IN ('sent', 'late')), 0),
    'unpaid_count', COUNT(*) FILTER (WHERE statut IN ('sent', 'late')),
    'total_monthly_rent', COALESCE(SUM(loyer + charges_forfaitaires) FILTER (WHERE statut = 'active'), 0),
    'active_leases_count', COUNT(*) FILTER (WHERE statut = 'active')
  ) INTO v_stats
  FROM leases l
  JOIN lease_signers ls ON ls.lease_id = l.id
  LEFT JOIN invoices i ON i.lease_id = l.id AND i.tenant_id = v_profile_id
  WHERE ls.profile_id = v_profile_id;

  -- 9. Assembler le résultat
  v_result := jsonb_build_object(
    'profile_id', v_profile_id,
    'leases', COALESCE(v_leases, '[]'::jsonb),
    -- Rétro-compatibilité : premier bail
    'lease', CASE WHEN v_leases IS NOT NULL THEN v_leases->0 ELSE NULL END,
    -- Propriété principale pour rétro-compatibilité
    'property', CASE WHEN v_leases IS NOT NULL THEN (v_leases->0)->'property' ELSE NULL END,
    'invoices', COALESCE(v_invoices, '[]'::jsonb),
    'tickets', COALESCE(v_tickets, '[]'::jsonb),
    'notifications', COALESCE(v_notifications, '[]'::jsonb),
    'pending_edls', COALESCE(v_pending_edls, '[]'::jsonb),
    'insurance', v_insurance_status,
    'stats', COALESCE(v_stats, '{"unpaid_amount": 0, "unpaid_count": 0, "total_monthly_rent": 0, "active_leases_count": 0}'::jsonb)
  );

  RETURN v_result;
END;
$$;


-- ========== 20251231000010_export_system.sql ==========
-- Migration: 20251231000010_export_system.sql

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'export_status') THEN
        CREATE TYPE export_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'expired');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS export_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'accounting', 'invoices', 'portability'
    format VARCHAR(10) NOT NULL, -- 'csv', 'json', 'xlsx'
    filters JSONB DEFAULT '{}',
    status export_status DEFAULT 'pending',
    storage_path TEXT,
    file_hash TEXT,
    record_count INTEGER DEFAULT 0,
    error_message TEXT,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index pour le cleanup
CREATE INDEX IF NOT EXISTS idx_export_jobs_expires_at ON export_jobs(expires_at) WHERE status != 'expired';

-- RLS
ALTER TABLE export_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own export jobs" ON export_jobs;
CREATE POLICY "Users can view their own export jobs"
    ON export_jobs FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own export jobs" ON export_jobs;
CREATE POLICY "Users can create their own export jobs"
    ON export_jobs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Audit log table if not exists (checked from grep results)
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view all audit logs" ON audit_log FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
);



-- ========== 20251231000011_export_cleanup.sql ==========
-- Migration: 20251231000011_export_cleanup.sql

-- 1. Fonction de nettoyage des jobs expirés
CREATE OR REPLACE FUNCTION cleanup_expired_exports()
RETURNS void AS $$
BEGIN
    -- Marquer comme expirés dans la DB
    UPDATE export_jobs
    SET status = 'expired'
    WHERE expires_at < now()
    AND status != 'expired';

    -- Note: La suppression physique des fichiers dans Storage 
    -- doit être gérée par une Edge Function ou via une policy de cycle de vie du bucket.
END;
$$ LANGUAGE plpgsql;

-- 2. Activation de pg_cron si disponible (nécessite permissions superuser)
-- SELECT cron.schedule('cleanup-exports', '0 0 * * *', 'SELECT cleanup_expired_exports()');



-- ========== 20260101000002_fix_tenant_dashboard_signers.sql ==========
-- Migration: Mise à jour de la RPC tenant_dashboard pour inclure les signataires des baux
-- Date: 2026-01-01

CREATE OR REPLACE FUNCTION tenant_dashboard(p_tenant_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile_id UUID;
  v_leases JSONB;
  v_invoices JSONB;
  v_tickets JSONB;
  v_notifications JSONB;
  v_pending_edls JSONB;
  v_insurance_status JSONB;
  v_stats JSONB;
  v_result JSONB;
BEGIN
  -- 1. Récupérer l'ID du profil à partir du user_id
  SELECT id INTO v_profile_id
  FROM profiles
  WHERE user_id = p_tenant_user_id AND role = 'tenant';

  IF v_profile_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- 2. Récupérer TOUS les baux avec signataires et données techniques
  SELECT jsonb_agg(lease_data) INTO v_leases
  FROM (
    SELECT 
      l.*,
      -- Inclure les signataires du bail
      (
        SELECT jsonb_agg(ls_data)
        FROM (
          SELECT 
            ls.id,
            ls.profile_id,
            ls.role,
            ls.signature_status,
            ls.signed_at,
            p_sig.prenom,
            p_sig.nom,
            p_sig.avatar_url
          FROM lease_signers ls
          JOIN profiles p_sig ON p_sig.id = ls.profile_id
          WHERE ls.lease_id = l.id
        ) ls_data
      ) as lease_signers,
      jsonb_build_object(
        'id', p.id,
        'adresse_complete', p.adresse_complete,
        'ville', p.ville,
        'code_postal', p.code_postal,
        'type', p.type,
        'surface', p.surface,
        'nb_pieces', p.nb_pieces,
        'etage', p.etage,
        'ascenseur', p.ascenseur,
        'annee_construction', p.annee_construction,
        'parking_numero', p.parking_numero,
        'cave_numero', p.has_cave,
        'num_lot', p.num_lot,
        'digicode', p.digicode,
        'interphone', p.interphone,
        'dpe_classe_energie', p.energie,
        'dpe_classe_climat', p.ges,
        'cover_url', (SELECT url FROM photos WHERE property_id = p.id AND is_main = true LIMIT 1),
        'meters', (
          SELECT jsonb_agg(m_data)
          FROM (
            SELECT 
              m.id, 
              m.type, 
              m.serial_number, 
              m.unit,
              (SELECT reading_value FROM meter_readings WHERE meter_id = m.id ORDER BY reading_date DESC LIMIT 1) as last_reading_value,
              (SELECT reading_date FROM meter_readings WHERE meter_id = m.id ORDER BY reading_date DESC LIMIT 1) as last_reading_date
            FROM meters m
            WHERE m.property_id = p.id AND m.is_active = true
          ) m_data
        ),
        'keys', (
          SELECT jsonb_agg(key_data)
          FROM (
            SELECT 
              item_name as label,
              description as count_info
            FROM edl_items ei
            JOIN edl e ON e.id = ei.edl_id
            WHERE e.property_id = p.id 
            AND e.status = 'signed' 
            AND ei.category = 'cles'
            ORDER BY e.completed_date DESC
          ) key_data
        )
      ) as property,
      jsonb_build_object(
        'id', owner_prof.id,
        'name', concat(owner_prof.prenom, ' ', owner_prof.nom),
        'email', owner_prof.email
      ) as owner
    FROM leases l
    JOIN lease_signers ls ON ls.lease_id = l.id
    JOIN properties p ON p.id = l.property_id
    JOIN profiles owner_prof ON owner_prof.id = p.owner_id
    WHERE ls.profile_id = v_profile_id
    AND l.statut IN ('active', 'pending_signature', 'terminated')
    ORDER BY l.statut = 'active' DESC, l.created_at DESC
  ) lease_data;

  -- 3. Récupérer les factures (10 dernières)
  SELECT jsonb_agg(invoice_data) INTO v_invoices
  FROM (
    SELECT 
      i.*,
      p.type as property_type,
      p.adresse_complete as property_address
    FROM invoices i
    JOIN leases l ON l.id = i.lease_id
    JOIN properties p ON p.id = l.property_id
    WHERE i.tenant_id = v_profile_id
    ORDER BY i.periode DESC, i.created_at DESC
    LIMIT 10
  ) invoice_data;

  -- 4. Récupérer les tickets récents (10 derniers)
  SELECT jsonb_agg(ticket_data) INTO v_tickets
  FROM (
    SELECT 
      t.*,
      p.adresse_complete as property_address,
      p.type as property_type
    FROM tickets t
    JOIN properties p ON p.id = t.property_id
    WHERE t.created_by_profile_id = v_profile_id
    ORDER BY t.created_at DESC
    LIMIT 10
  ) ticket_data;

  -- 5. Récupérer les notifications récentes
  SELECT jsonb_agg(notif_data) INTO v_notifications
  FROM (
    SELECT n.*
    FROM notifications n
    WHERE n.profile_id = v_profile_id
    ORDER BY n.is_read ASC, n.created_at DESC
    LIMIT 5
  ) notif_data;

  -- 6. Récupérer les EDLs en attente de signature
  SELECT jsonb_agg(edl_data) INTO v_pending_edls
  FROM (
    SELECT 
      e.id,
      e.type,
      e.scheduled_at,
      es.invitation_token,
      p.adresse_complete as property_address,
      p.type as property_type
    FROM edl e
    JOIN edl_signatures es ON es.edl_id = e.id
    JOIN properties p ON p.id = e.property_id
    WHERE es.signer_profile_id = v_profile_id
    AND es.signed_at IS NULL
    AND e.status IN ('draft', 'scheduled', 'in_progress')
    ORDER BY e.created_at DESC
  ) edl_data;

  -- 7. Vérifier l'assurance
  SELECT jsonb_build_object(
    'has_insurance', EXISTS (
      SELECT 1 FROM documents 
      WHERE tenant_id = v_profile_id 
      AND type = 'attestation_assurance'
      AND is_archived = false
      AND (expiry_date IS NULL OR expiry_date > NOW())
    ),
    'last_expiry_date', (
      SELECT expiry_date FROM documents 
      WHERE tenant_id = v_profile_id 
      AND type = 'attestation_assurance' 
      AND is_archived = false
      ORDER BY expiry_date DESC LIMIT 1
    )
  ) INTO v_insurance_status;

  -- 8. Stats globales
  SELECT jsonb_build_object(
    'unpaid_amount', COALESCE(SUM(montant_total) FILTER (WHERE statut IN ('sent', 'late')), 0),
    'unpaid_count', COUNT(*) FILTER (WHERE statut IN ('sent', 'late')),
    'total_monthly_rent', COALESCE(SUM(loyer + charges_forfaitaires) FILTER (WHERE statut = 'active'), 0),
    'active_leases_count', COUNT(*) FILTER (WHERE statut = 'active')
  ) INTO v_stats
  FROM leases l
  JOIN lease_signers ls ON ls.lease_id = l.id
  LEFT JOIN invoices i ON i.lease_id = l.id AND i.tenant_id = v_profile_id
  WHERE ls.profile_id = v_profile_id;

  -- 9. Assembler le résultat
  v_result := jsonb_build_object(
    'profile_id', v_profile_id,
    'leases', COALESCE(v_leases, '[]'::jsonb),
    'lease', CASE WHEN v_leases IS NOT NULL THEN v_leases->0 ELSE NULL END,
    'property', CASE WHEN v_leases IS NOT NULL THEN (v_leases->0)->'property' ELSE NULL END,
    'invoices', COALESCE(v_invoices, '[]'::jsonb),
    'tickets', COALESCE(v_tickets, '[]'::jsonb),
    'notifications', COALESCE(v_notifications, '[]'::jsonb),
    'pending_edls', COALESCE(v_pending_edls, '[]'::jsonb),
    'insurance', v_insurance_status,
    'stats', COALESCE(v_stats, '{"unpaid_amount": 0, "unpaid_count": 0, "total_monthly_rent": 0, "active_leases_count": 0}'::jsonb)
  );

  RETURN v_result;
END;
$$;



-- ========== 20260101000002a_add_invited_email_to_signers.sql ==========
-- Migration : Ajouter les colonnes invited_email et invited_name à lease_signers
-- Ces colonnes sont nécessaires pour le flux d'invitation des locataires

-- 1. Rendre profile_id nullable (pour permettre les invitations avant création de compte)
ALTER TABLE lease_signers 
  ALTER COLUMN profile_id DROP NOT NULL;

-- 2. Ajouter les colonnes d'invitation
ALTER TABLE lease_signers 
  ADD COLUMN IF NOT EXISTS invited_email TEXT,
  ADD COLUMN IF NOT EXISTS invited_name TEXT;

-- 3. Créer un index sur invited_email pour les recherches rapides
CREATE INDEX IF NOT EXISTS idx_lease_signers_invited_email 
  ON lease_signers(invited_email) 
  WHERE invited_email IS NOT NULL;

-- 4. Modifier la contrainte unique pour permettre soit profile_id soit invited_email
-- D'abord supprimer l'ancienne contrainte
ALTER TABLE lease_signers 
  DROP CONSTRAINT IF EXISTS lease_signers_lease_id_profile_id_key;

-- 5. Ajouter une nouvelle contrainte qui vérifie la cohérence
-- Un signataire doit avoir soit un profile_id, soit un invited_email
ALTER TABLE lease_signers 
  ADD CONSTRAINT lease_signers_has_identity 
  CHECK (profile_id IS NOT NULL OR invited_email IS NOT NULL);

-- 6. Créer un index unique partiel pour éviter les doublons
CREATE UNIQUE INDEX IF NOT EXISTS idx_lease_signers_unique_profile 
  ON lease_signers(lease_id, profile_id) 
  WHERE profile_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_lease_signers_unique_email 
  ON lease_signers(lease_id, invited_email) 
  WHERE invited_email IS NOT NULL AND profile_id IS NULL;

-- 7. Mettre à jour les RLS pour permettre aux propriétaires de voir les signataires invités
DROP POLICY IF EXISTS "lease_signers_owner_view_invited" ON lease_signers;
CREATE POLICY "lease_signers_owner_view_invited" ON lease_signers
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties prop ON prop.id = l.property_id
      JOIN profiles owner_p ON owner_p.id = prop.owner_id
      WHERE l.id = lease_signers.lease_id 
        AND owner_p.user_id = auth.uid()
    )
  );

-- 8. Créer un trigger pour lier automatiquement profile_id quand le locataire crée son compte
CREATE OR REPLACE FUNCTION public.auto_link_signer_profile()
RETURNS TRIGGER AS $$
BEGIN
  -- Quand un profil est créé, chercher les invitations par email
  UPDATE lease_signers ls
  SET profile_id = NEW.id,
      updated_at = NOW()
  FROM auth.users u
  WHERE u.id = NEW.user_id
    AND ls.invited_email = u.email
    AND ls.profile_id IS NULL;
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_created_auto_link ON profiles;
CREATE TRIGGER on_profile_created_auto_link
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_link_signer_profile();

COMMENT ON COLUMN lease_signers.invited_email IS 'Email du locataire invité avant création de son compte';
COMMENT ON COLUMN lease_signers.invited_name IS 'Nom du locataire invité (optionnel)';



-- ========== 20260101000003_make_lease_signers_profile_nullable.sql ==========
-- =====================================================
-- Migration: Ajouter contrainte CHECK et index pour signataires invités
-- Date: 2026-01-02
-- =====================================================
-- Complète la migration 20251221000003 qui rend profile_id nullable
-- Ajoute une contrainte CHECK et un index pour optimiser les requêtes
-- =====================================================

BEGIN;

-- 1. Vérifier si profile_id est déjà nullable (idempotent)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lease_signers' 
    AND column_name = 'profile_id'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE lease_signers 
      ALTER COLUMN profile_id DROP NOT NULL;
  END IF;
END $$;

-- 2. Ajouter la contrainte CHECK pour s'assurer qu'on a soit profile_id, soit invited_email
-- (idempotent - vérifie si la contrainte existe déjà)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'lease_signers_profile_or_email_check'
  ) THEN
    ALTER TABLE lease_signers
      ADD CONSTRAINT lease_signers_profile_or_email_check 
      CHECK (
        (profile_id IS NOT NULL) OR 
        (invited_email IS NOT NULL)
      );
  END IF;
END $$;

-- 3. Ajouter un index partiel pour les signataires invités (sans profile_id)
CREATE INDEX IF NOT EXISTS idx_lease_signers_invited 
ON lease_signers(lease_id, invited_email) 
WHERE profile_id IS NULL AND invited_email IS NOT NULL;

-- 4. Commentaires pour documentation
COMMENT ON COLUMN lease_signers.profile_id IS 
  'ID du profil (NULL si le signataire n''a pas encore créé son compte)';
COMMENT ON COLUMN lease_signers.invited_email IS 
  'Email d''invitation (requis si profile_id est NULL)';

COMMIT;



-- ========== 20260101000004_add_edl_signatures_email.sql ==========
-- =====================================================
-- Migration: Ajouter signer_email à edl_signatures
-- Date: 2026-01-02
-- =====================================================
-- Permet de créer des signatures EDL avec invited_email
-- avant que le signataire n'ait créé son compte
-- =====================================================

BEGIN;

-- Ajouter la colonne signer_email si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'edl_signatures' 
        AND column_name = 'signer_email'
    ) THEN
        ALTER TABLE public.edl_signatures 
        ADD COLUMN signer_email VARCHAR(255);
        
        COMMENT ON COLUMN public.edl_signatures.signer_email IS 
            'Email du signataire (utilisé si signer_profile_id est NULL pour les invitations)';
    END IF;
END $$;

-- Rendre signer_profile_id nullable si ce n'est pas déjà fait
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'edl_signatures' 
        AND column_name = 'signer_profile_id'
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE public.edl_signatures 
        ALTER COLUMN signer_profile_id DROP NOT NULL;
    END IF;
END $$;

-- Rendre signer_user nullable si ce n'est pas déjà fait (pour les invitations)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'edl_signatures' 
        AND column_name = 'signer_user'
        AND is_nullable = 'NO'
    ) THEN
        -- Supprimer la contrainte FK d'abord si elle existe
        ALTER TABLE public.edl_signatures 
        DROP CONSTRAINT IF EXISTS edl_signatures_signer_user_fkey;
        
        ALTER TABLE public.edl_signatures 
        ALTER COLUMN signer_user DROP NOT NULL;
        
        -- Recréer la FK mais sans NOT NULL
        ALTER TABLE public.edl_signatures
        ADD CONSTRAINT edl_signatures_signer_user_fkey 
        FOREIGN KEY (signer_user) 
        REFERENCES auth.users(id) 
        ON DELETE CASCADE;
    END IF;
END $$;

-- Ajouter une contrainte CHECK pour s'assurer qu'on a soit signer_profile_id, soit signer_email
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'edl_signatures_profile_or_email_check'
    ) THEN
        ALTER TABLE public.edl_signatures
        ADD CONSTRAINT edl_signatures_profile_or_email_check 
        CHECK (
            (signer_profile_id IS NOT NULL) OR 
            (signer_email IS NOT NULL)
        );
    END IF;
END $$;

-- Index pour rechercher par email
CREATE INDEX IF NOT EXISTS idx_edl_signatures_signer_email 
ON public.edl_signatures(signer_email) 
WHERE signer_email IS NOT NULL;

-- Modifier la contrainte UNIQUE existante pour permettre plusieurs NULL
-- Supprimer l'ancienne contrainte si elle existe
ALTER TABLE public.edl_signatures
DROP CONSTRAINT IF EXISTS edl_signatures_edl_id_signer_profile_id_key;

-- Créer une contrainte UNIQUE partielle qui ne s'applique que si signer_profile_id n'est pas NULL
-- Cela permet plusieurs lignes avec signer_profile_id = NULL pour le même edl_id
CREATE UNIQUE INDEX IF NOT EXISTS edl_signatures_edl_id_signer_profile_id_unique
ON public.edl_signatures(edl_id, signer_profile_id)
WHERE signer_profile_id IS NOT NULL;

-- Créer une contrainte UNIQUE pour signer_email (un seul signataire invité par email par EDL)
CREATE UNIQUE INDEX IF NOT EXISTS edl_signatures_edl_id_signer_email_unique
ON public.edl_signatures(edl_id, signer_email)
WHERE signer_email IS NOT NULL;

COMMIT;



-- ========== 20260101000005_edl_signatures_invited_columns.sql ==========
-- =====================================================
-- Migration: Colonnes d'invitation pour edl_signatures
-- Date: 2026-01-01
-- =====================================================
-- Permet de stocker les informations des signataires invités sans compte

BEGIN;

-- 1. Rendre signer_profile_id et signer_user nullable
ALTER TABLE public.edl_signatures 
  ALTER COLUMN signer_profile_id DROP NOT NULL;

-- signer_user peut aussi être NULL pour les invités
DO $$
BEGIN
    ALTER TABLE public.edl_signatures 
      ALTER COLUMN signer_user DROP NOT NULL;
EXCEPTION
    WHEN others THEN NULL;
END $$;

-- 2. Ajouter la colonne signer_email si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'edl_signatures' 
        AND column_name = 'signer_email'
    ) THEN
        ALTER TABLE public.edl_signatures 
        ADD COLUMN signer_email VARCHAR(255);
        
        COMMENT ON COLUMN public.edl_signatures.signer_email IS 
            'Email du signataire (utilisé si signer_profile_id est NULL pour les invitations)';
    END IF;
END $$;

-- 3. Ajouter la colonne signer_name si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'edl_signatures' 
        AND column_name = 'signer_name'
    ) THEN
        ALTER TABLE public.edl_signatures 
        ADD COLUMN signer_name VARCHAR(255);
        
        COMMENT ON COLUMN public.edl_signatures.signer_name IS 
            'Nom du signataire (stocké directement ou extrait du profil)';
    END IF;
END $$;

-- 4. Index pour rechercher par email
CREATE INDEX IF NOT EXISTS idx_edl_signatures_signer_email 
ON public.edl_signatures(signer_email) 
WHERE signer_email IS NOT NULL;

-- 5. Modifier la contrainte UNIQUE existante pour permettre plusieurs NULL
-- Supprimer l'ancienne contrainte si elle existe
ALTER TABLE public.edl_signatures 
DROP CONSTRAINT IF EXISTS edl_signatures_edl_id_signer_profile_id_key;

-- Créer une contrainte UNIQUE partielle (uniquement pour signer_profile_id non-NULL)
CREATE UNIQUE INDEX IF NOT EXISTS edl_signatures_edl_id_signer_profile_id_unique
ON public.edl_signatures(edl_id, signer_profile_id)
WHERE signer_profile_id IS NOT NULL;

-- Créer une contrainte UNIQUE pour signer_email (un seul signataire invité par email par EDL)
CREATE UNIQUE INDEX IF NOT EXISTS edl_signatures_edl_id_signer_email_unique
ON public.edl_signatures(edl_id, signer_email)
WHERE signer_email IS NOT NULL;

COMMIT;



-- ========== 20260102000006_fix_edl_signatures_schema.sql ==========
-- Migration : Correction du schéma edl_signatures pour supporter les invitations et le profil
-- Date: 2026-01-02

BEGIN;

-- 1. Ajouter les colonnes manquantes à edl_signatures
ALTER TABLE edl_signatures 
  ADD COLUMN IF NOT EXISTS signer_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invitation_token UUID DEFAULT uuid_generate_v4(),
  ADD COLUMN IF NOT EXISTS invitation_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Rendre signer_user nullable (car on peut inviter avant que le compte existe)
ALTER TABLE edl_signatures ALTER COLUMN signer_user DROP NOT NULL;

-- 3. Rendre signed_at nullable (car une invitation n'est pas encore une signature)
ALTER TABLE edl_signatures ALTER COLUMN signed_at DROP NOT NULL;
ALTER TABLE edl_signatures ALTER COLUMN signed_at DROP DEFAULT;

-- 4. Ajouter des index pour les performances
CREATE INDEX IF NOT EXISTS idx_edl_signatures_signer_profile_id ON edl_signatures(signer_profile_id);
CREATE INDEX IF NOT EXISTS idx_edl_signatures_invitation_token ON edl_signatures(invitation_token);

-- 5. Mettre à jour les RLS pour permettre l'accès via invitation_token
DROP POLICY IF EXISTS "EDL signatures via token" ON edl_signatures;
CREATE POLICY "EDL signatures via token" ON edl_signatures
  FOR SELECT USING (true); -- On restreindra davantage si besoin, mais permet la lecture pour signature

COMMIT;



-- ========== 20260102000007_auto_activate_leases.sql ==========
-- Migration : Activation automatique des baux et synchronisation finale
-- Date: 2026-01-02

BEGIN;

-- 1. Fonction pour activer le bail si tous les signataires ont signé
CREATE OR REPLACE FUNCTION public.check_and_activate_lease()
RETURNS TRIGGER AS $$
DECLARE
    v_total_signers INTEGER;
    v_signed_count INTEGER;
BEGIN
    -- Compter le nombre de signataires requis
    SELECT COUNT(*) INTO v_total_signers
    FROM lease_signers
    WHERE lease_id = NEW.lease_id;

    -- Compter le nombre de signatures effectuées
    SELECT COUNT(*) INTO v_signed_count
    FROM lease_signers
    WHERE lease_id = NEW.lease_id
    AND signature_status = 'signed';

    -- Si tout le monde a signé (et qu'il y a au moins 2 personnes: proprio + locataire)
    IF v_total_signers >= 2 AND v_signed_count = v_total_signers THEN
        UPDATE leases
        SET statut = 'active',
            updated_at = NOW()
        WHERE id = NEW.lease_id
        AND statut = 'pending_signature';
        
        RAISE NOTICE 'Bail % activé automatiquement', NEW.lease_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Trigger sur lease_signers
DROP TRIGGER IF EXISTS tr_check_activate_lease ON lease_signers;
CREATE TRIGGER tr_check_activate_lease
AFTER UPDATE OF signature_status ON lease_signers
FOR EACH ROW
WHEN (NEW.signature_status = 'signed')
EXECUTE FUNCTION public.check_and_activate_lease();

-- 3. Réparer les baux existants qui devraient être actifs
UPDATE leases l
SET statut = 'active',
    updated_at = NOW()
WHERE statut = 'pending_signature'
AND (
    SELECT COUNT(*) 
    FROM lease_signers ls 
    WHERE ls.lease_id = l.id
) >= 2
AND NOT EXISTS (
    SELECT 1 
    FROM lease_signers ls 
    WHERE ls.lease_id = l.id 
    AND ls.signature_status != 'signed'
);

COMMIT;



-- ========== 20260102000020_fix_pending_edls_query.sql ==========
-- Migration: Corriger la requête pending_edls dans tenant_dashboard
-- Date: 2026-01-02
-- 
-- PROBLÈME: La RPC utilise es.signer_email qui n'existe pas dans edl_signatures
-- SOLUTION: Chercher par signer_profile_id uniquement, ou joindre via profiles

CREATE OR REPLACE FUNCTION tenant_dashboard(p_tenant_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile_id UUID;
  v_user_email TEXT;
  v_tenant_data JSONB;
  v_leases JSONB;
  v_invoices JSONB;
  v_tickets JSONB;
  v_notifications JSONB;
  v_pending_edls JSONB;
  v_insurance_status JSONB;
  v_stats JSONB;
  v_result JSONB;
BEGIN
  -- 1. Récupérer l'ID du profil ET l'email de l'utilisateur
  SELECT p.id, u.email, 
         jsonb_build_object(
           'id', p.id,
           'prenom', p.prenom,
           'nom', p.nom,
           'email', u.email,
           'telephone', p.telephone,
           'avatar_url', p.avatar_url
         )
  INTO v_profile_id, v_user_email, v_tenant_data
  FROM profiles p
  JOIN auth.users u ON u.id = p.user_id
  WHERE p.user_id = p_tenant_user_id AND p.role = 'tenant';

  IF v_profile_id IS NULL THEN
    RAISE NOTICE '[tenant_dashboard] Aucun profil trouvé pour user_id: %', p_tenant_user_id;
    RETURN NULL;
  END IF;

  RAISE NOTICE '[tenant_dashboard] Profil trouvé: %, email: %', v_profile_id, v_user_email;

  -- 2. Récupérer TOUS les baux
  SELECT jsonb_agg(lease_data ORDER BY lease_data->>'statut' = 'active' DESC, lease_data->>'created_at' DESC) 
  INTO v_leases
  FROM (
    SELECT 
      jsonb_build_object(
        'id', l.id,
        'type_bail', l.type_bail,
        'statut', l.statut,
        'loyer', l.loyer,
        'charges_forfaitaires', l.charges_forfaitaires,
        'depot_de_garantie', l.depot_de_garantie,
        'date_debut', l.date_debut,
        'date_fin', l.date_fin,
        'created_at', l.created_at,
        'signers', (
          SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
              'id', ls2.id,
              'profile_id', ls2.profile_id,
              'role', ls2.role,
              'signature_status', ls2.signature_status,
              'signed_at', ls2.signed_at,
              'invited_name', ls2.invited_name,
              'invited_email', ls2.invited_email,
              'prenom', COALESCE(p_sig.prenom, SPLIT_PART(ls2.invited_name, ' ', 1)),
              'nom', COALESCE(p_sig.nom, SPLIT_PART(ls2.invited_name, ' ', 2)),
              'avatar_url', p_sig.avatar_url
            )
          ), '[]'::jsonb)
          FROM lease_signers ls2
          LEFT JOIN profiles p_sig ON p_sig.id = ls2.profile_id
          WHERE ls2.lease_id = l.id
        ),
        'property', jsonb_build_object(
          'id', p.id,
          'adresse_complete', COALESCE(p.adresse_complete, 'Adresse à compléter'),
          'ville', COALESCE(p.ville, ''),
          'code_postal', COALESCE(p.code_postal, ''),
          'type', COALESCE(p.type, 'appartement'),
          'surface', p.surface,
          'nb_pieces', p.nb_pieces,
          'etage', p.etage,
          'ascenseur', p.ascenseur,
          'annee_construction', p.annee_construction,
          'parking_numero', p.parking_numero,
          'has_cave', p.has_cave,
          'num_lot', p.num_lot,
          'digicode', p.digicode,
          'interphone', p.interphone,
          'dpe_classe_energie', COALESCE(p.energie, p.dpe_classe_energie),
          'dpe_classe_climat', COALESCE(p.ges, p.dpe_classe_climat),
          'chauffage_type', p.chauffage_type,
          'eau_chaude_type', p.eau_chaude_type,
          'cover_url', (
            SELECT url FROM property_photos 
            WHERE property_id = p.id AND is_main = true 
            LIMIT 1
          ),
          'meters', (
            SELECT COALESCE(jsonb_agg(
              jsonb_build_object(
                'id', m.id, 
                'type', m.type, 
                'serial_number', m.serial_number, 
                'unit', m.unit,
                'last_reading_value', (
                  SELECT reading_value FROM meter_readings 
                  WHERE meter_id = m.id ORDER BY reading_date DESC LIMIT 1
                ),
                'last_reading_date', (
                  SELECT reading_date FROM meter_readings 
                  WHERE meter_id = m.id ORDER BY reading_date DESC LIMIT 1
                )
              )
            ), '[]'::jsonb)
            FROM meters m
            WHERE m.property_id = p.id AND m.is_active = true
          )
        ),
        'owner', jsonb_build_object(
          'id', owner_prof.id,
          'name', COALESCE(
            (SELECT raison_sociale FROM owner_profiles WHERE profile_id = owner_prof.id),
            CONCAT(owner_prof.prenom, ' ', owner_prof.nom)
          ),
          'email', owner_prof.email,
          'telephone', owner_prof.telephone
        )
      ) as lease_data
    FROM leases l
    JOIN lease_signers ls ON ls.lease_id = l.id
    JOIN properties p ON p.id = l.property_id
    JOIN profiles owner_prof ON owner_prof.id = p.owner_id
    WHERE 
      (ls.profile_id = v_profile_id OR LOWER(ls.invited_email) = LOWER(v_user_email))
      AND l.statut IN ('active', 'pending_signature', 'fully_signed', 'terminated')
  ) sub;

  RAISE NOTICE '[tenant_dashboard] Baux trouvés: %', COALESCE(jsonb_array_length(v_leases), 0);

  -- 3. Récupérer les factures (10 dernières)
  SELECT COALESCE(jsonb_agg(invoice_data), '[]'::jsonb) INTO v_invoices
  FROM (
    SELECT 
      i.id,
      i.periode,
      i.montant_total,
      i.statut,
      i.created_at,
      i.due_date,
      p.type as property_type,
      p.adresse_complete as property_address
    FROM invoices i
    JOIN leases l ON l.id = i.lease_id
    JOIN lease_signers ls ON ls.lease_id = l.id
    JOIN properties p ON p.id = l.property_id
    WHERE (ls.profile_id = v_profile_id OR LOWER(ls.invited_email) = LOWER(v_user_email))
    ORDER BY i.periode DESC, i.created_at DESC
    LIMIT 10
  ) invoice_data;

  -- 4. Récupérer les tickets récents (10 derniers)
  SELECT COALESCE(jsonb_agg(ticket_data), '[]'::jsonb) INTO v_tickets
  FROM (
    SELECT 
      t.id,
      t.titre,
      t.description,
      t.priorite,
      t.statut,
      t.created_at,
      p.adresse_complete as property_address,
      p.type as property_type
    FROM tickets t
    JOIN properties p ON p.id = t.property_id
    WHERE t.created_by_profile_id = v_profile_id
    ORDER BY t.created_at DESC
    LIMIT 10
  ) ticket_data;

  -- 5. Récupérer les notifications récentes
  SELECT COALESCE(jsonb_agg(notif_data), '[]'::jsonb) INTO v_notifications
  FROM (
    SELECT n.id, n.title, n.message, n.type, n.is_read, n.created_at, n.action_url
    FROM notifications n
    WHERE n.profile_id = v_profile_id
    ORDER BY n.is_read ASC, n.created_at DESC
    LIMIT 5
  ) notif_data;

  -- 6. ✅ FIX: Récupérer les EDLs en attente de signature (sans signer_email)
  SELECT COALESCE(jsonb_agg(edl_data), '[]'::jsonb) INTO v_pending_edls
  FROM (
    SELECT 
      e.id,
      e.type,
      e.status,
      e.scheduled_at,
      es.invitation_token,
      COALESCE(p.adresse_complete, 'Adresse non renseignée') as property_address,
      COALESCE(p.type, 'appartement') as property_type
    FROM edl e
    JOIN edl_signatures es ON es.edl_id = e.id
    LEFT JOIN properties p ON p.id = e.property_id
    WHERE es.signer_profile_id = v_profile_id
      AND es.signed_at IS NULL
      AND e.status IN ('draft', 'scheduled', 'in_progress', 'completed')
    ORDER BY e.created_at DESC
  ) edl_data;

  RAISE NOTICE '[tenant_dashboard] EDLs en attente: %', COALESCE(jsonb_array_length(v_pending_edls), 0);

  -- 7. Vérifier l'assurance
  SELECT jsonb_build_object(
    'has_insurance', EXISTS (
      SELECT 1 FROM documents 
      WHERE tenant_id = v_profile_id 
      AND type = 'attestation_assurance'
      AND is_archived = false
      AND (expiry_date IS NULL OR expiry_date > NOW())
    ),
    'last_expiry_date', (
      SELECT expiry_date FROM documents 
      WHERE tenant_id = v_profile_id 
      AND type = 'attestation_assurance' 
      AND is_archived = false
      ORDER BY expiry_date DESC LIMIT 1
    )
  ) INTO v_insurance_status;

  -- 8. Stats globales
  SELECT jsonb_build_object(
    'unpaid_amount', COALESCE(SUM(i.montant_total) FILTER (WHERE i.statut IN ('sent', 'late')), 0),
    'unpaid_count', COUNT(*) FILTER (WHERE i.statut IN ('sent', 'late')),
    'total_monthly_rent', COALESCE(
      (SELECT SUM(l2.loyer + l2.charges_forfaitaires) 
       FROM leases l2 
       JOIN lease_signers ls2 ON ls2.lease_id = l2.id 
       WHERE (ls2.profile_id = v_profile_id OR LOWER(ls2.invited_email) = LOWER(v_user_email))
       AND l2.statut = 'active'), 
      0
    ),
    'active_leases_count', (
      SELECT COUNT(DISTINCT l2.id) 
      FROM leases l2 
      JOIN lease_signers ls2 ON ls2.lease_id = l2.id 
      WHERE (ls2.profile_id = v_profile_id OR LOWER(ls2.invited_email) = LOWER(v_user_email))
      AND l2.statut = 'active'
    )
  ) INTO v_stats
  FROM leases l
  JOIN lease_signers ls ON ls.lease_id = l.id
  LEFT JOIN invoices i ON i.lease_id = l.id
  WHERE (ls.profile_id = v_profile_id OR LOWER(ls.invited_email) = LOWER(v_user_email));

  -- 9. Assembler le résultat final
  v_result := jsonb_build_object(
    'profile_id', v_profile_id,
    'tenant', v_tenant_data,
    'kyc_status', COALESCE((SELECT kyc_status FROM tenant_profiles WHERE profile_id = v_profile_id), 'pending'),
    'leases', COALESCE(v_leases, '[]'::jsonb),
    'lease', CASE WHEN v_leases IS NOT NULL AND jsonb_array_length(v_leases) > 0 THEN v_leases->0 ELSE NULL END,
    'property', CASE WHEN v_leases IS NOT NULL AND jsonb_array_length(v_leases) > 0 THEN (v_leases->0)->'property' ELSE NULL END,
    'invoices', v_invoices,
    'tickets', v_tickets,
    'notifications', v_notifications,
    'pending_edls', v_pending_edls,
    'insurance', v_insurance_status,
    'stats', COALESCE(v_stats, '{"unpaid_amount": 0, "unpaid_count": 0, "total_monthly_rent": 0, "active_leases_count": 0}'::jsonb)
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION tenant_dashboard(UUID) IS 
'RPC pour le tableau de bord locataire. Version corrigée sans signer_email.';



-- ========== 20260103000005_enhance_owner_dashboard_edl.sql ==========
-- Enhance owner_dashboard RPC to include EDL stats and pending signatures for the owner

CREATE OR REPLACE FUNCTION owner_dashboard(p_owner_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Vérifier que l'utilisateur est bien le propriétaire
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = p_owner_id 
    AND role = 'owner'
    AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Accès non autorisé';
  END IF;

  SELECT jsonb_build_object(
    'properties', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'ref', p.unique_code,
          'adresse', p.adresse_complete,
          'statut', p.etat,
          'type', p.type,
          'surface', p.surface,
          'nb_pieces', p.nb_pieces,
          'created_at', p.created_at,
          'updated_at', p.updated_at
        )
      )
      FROM properties p
      WHERE p.owner_id = p_owner_id
    ),
    'properties_stats', (
      SELECT jsonb_build_object(
        'total', COUNT(*),
        'active', COUNT(*) FILTER (WHERE etat = 'published'),
        'draft', COUNT(*) FILTER (WHERE etat = 'draft')
      )
      FROM properties
      WHERE owner_id = p_owner_id
    ),
    'leases', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', l.id,
          'property_id', l.property_id,
          'type_bail', l.type_bail,
          'loyer', l.loyer,
          'date_debut', l.date_debut,
          'date_fin', l.date_fin,
          'statut', l.statut,
          'created_at', l.created_at
        )
      )
      FROM leases l
      INNER JOIN properties p ON p.id = l.property_id
      WHERE p.owner_id = p_owner_id
    ),
    'leases_stats', (
      SELECT jsonb_build_object(
        'total', COUNT(*),
        'active', COUNT(*) FILTER (WHERE l.statut = 'active'),
        'pending', COUNT(*) FILTER (WHERE l.statut = 'pending_signature')
      )
      FROM leases l
      INNER JOIN properties p ON p.id = l.property_id
      WHERE p.owner_id = p_owner_id
    ),
    'edl_stats', (
      SELECT jsonb_build_object(
        'total', COUNT(*),
        'pending_owner_signature', COUNT(*) FILTER (
          WHERE e.status = 'completed' AND NOT EXISTS (
            SELECT 1 FROM edl_signatures es 
            WHERE es.edl_id = e.id 
            AND es.signer_role = 'owner' 
            AND es.signed_at IS NOT NULL
          )
        )
      )
      FROM edl e
      INNER JOIN leases l ON l.id = e.lease_id
      INNER JOIN properties p ON p.id = l.property_id
      WHERE p.owner_id = p_owner_id
    ),
    'invoices', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', i.id,
          'lease_id', i.lease_id,
          'periode', i.periode,
          'montant_total', i.montant_total,
          'statut', i.statut,
          'created_at', i.created_at
        )
      )
      FROM invoices i
      WHERE i.owner_id = p_owner_id
      ORDER BY i.created_at DESC
      LIMIT 10
    ),
    'invoices_stats', (
      SELECT jsonb_build_object(
        'total', COUNT(*),
        'paid', COUNT(*) FILTER (WHERE statut = 'paid'),
        'pending', COUNT(*) FILTER (WHERE statut = 'sent'),
        'late', COUNT(*) FILTER (WHERE statut = 'late')
      )
      FROM invoices
      WHERE owner_id = p_owner_id
    ),
    'tickets', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', t.id,
          'property_id', t.property_id,
          'titre', t.titre,
          'priorite', t.priorite,
          'statut', t.statut,
          'created_at', t.created_at
        )
      )
      FROM tickets t
      INNER JOIN properties p ON p.id = t.property_id
      WHERE p.owner_id = p_owner_id
      ORDER BY t.created_at DESC
      LIMIT 10
    ),
    'tickets_stats', (
      SELECT jsonb_build_object(
        'total', COUNT(*),
        'open', COUNT(*) FILTER (WHERE t.statut = 'open'),
        'in_progress', COUNT(*) FILTER (WHERE t.statut = 'in_progress')
      )
      FROM tickets t
      INNER JOIN properties p ON p.id = t.property_id
      WHERE p.owner_id = p_owner_id
    ),
    'recentActivity', (
      SELECT jsonb_agg(act) FROM (
        -- Nouvelles factures
        SELECT 'invoice' as type, 'Facture générée - ' || i.periode as title, i.created_at::text as date
        FROM invoices i WHERE i.owner_id = p_owner_id
        UNION ALL
        -- Nouveaux tickets
        SELECT 'ticket' as type, 'Nouveau ticket: ' || t.titre as title, t.created_at::text as date
        FROM tickets t INNER JOIN properties p ON p.id = t.property_id WHERE p.owner_id = p_owner_id
        UNION ALL
        -- Nouvelles signatures
        SELECT 'signature' as type, 'Bail signé - ' || p.adresse_complete as title, l.updated_at::text as date
        FROM leases l INNER JOIN properties p ON p.id = l.property_id WHERE p.owner_id = p_owner_id AND l.statut = 'active'
        ORDER BY date DESC
        LIMIT 10
      ) act
    )
  ) INTO v_result;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;



-- ========== 20260103000010_fix_tenant_dashboard_email_search.sql ==========
-- Migration: Corriger la RPC tenant_dashboard pour chercher par email si profile_id non lié
-- Date: 2026-01-03
-- 
-- PROBLÈME: Si un locataire est invité mais son profile_id n'est pas encore lié 
-- dans lease_signers, le dashboard affiche "Adresse non renseignée"
--
-- SOLUTION: Chercher par profile_id OU par invited_email (email de l'utilisateur)

CREATE OR REPLACE FUNCTION tenant_dashboard(p_tenant_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile_id UUID;
  v_user_email TEXT;
  v_tenant_data JSONB;
  v_leases JSONB;
  v_invoices JSONB;
  v_tickets JSONB;
  v_notifications JSONB;
  v_pending_edls JSONB;
  v_insurance_status JSONB;
  v_stats JSONB;
  v_result JSONB;
BEGIN
  -- 1. Récupérer l'ID du profil ET l'email de l'utilisateur
  SELECT p.id, u.email, 
         jsonb_build_object(
           'id', p.id,
           'prenom', p.prenom,
           'nom', p.nom,
           'email', u.email,
           'telephone', p.telephone,
           'avatar_url', p.avatar_url
         )
  INTO v_profile_id, v_user_email, v_tenant_data
  FROM profiles p
  JOIN auth.users u ON u.id = p.user_id
  WHERE p.user_id = p_tenant_user_id AND p.role = 'tenant';

  IF v_profile_id IS NULL THEN
    RAISE NOTICE '[tenant_dashboard] Aucun profil trouvé pour user_id: %', p_tenant_user_id;
    RETURN NULL;
  END IF;

  RAISE NOTICE '[tenant_dashboard] Profil trouvé: %, email: %', v_profile_id, v_user_email;

  -- 2. Récupérer TOUS les baux - ✅ FIX: Chercher par profile_id OU invited_email
  SELECT jsonb_agg(lease_data ORDER BY lease_data->>'statut' = 'active' DESC, lease_data->>'created_at' DESC) 
  INTO v_leases
  FROM (
    SELECT 
      jsonb_build_object(
        'id', l.id,
        'type_bail', l.type_bail,
        'statut', l.statut,
        'loyer', l.loyer,
        'charges_forfaitaires', l.charges_forfaitaires,
        'depot_de_garantie', l.depot_de_garantie,
        'date_debut', l.date_debut,
        'date_fin', l.date_fin,
        'created_at', l.created_at,
        -- Inclure les signataires du bail
        'signers', (
          SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
              'id', ls2.id,
              'profile_id', ls2.profile_id,
              'role', ls2.role,
              'signature_status', ls2.signature_status,
              'signed_at', ls2.signed_at,
              'invited_name', ls2.invited_name,
              'invited_email', ls2.invited_email,
              'prenom', COALESCE(p_sig.prenom, SPLIT_PART(ls2.invited_name, ' ', 1)),
              'nom', COALESCE(p_sig.nom, SPLIT_PART(ls2.invited_name, ' ', 2)),
              'avatar_url', p_sig.avatar_url
            )
          ), '[]'::jsonb)
          FROM lease_signers ls2
          LEFT JOIN profiles p_sig ON p_sig.id = ls2.profile_id
          WHERE ls2.lease_id = l.id
        ),
        'property', jsonb_build_object(
          'id', p.id,
          'adresse_complete', COALESCE(p.adresse_complete, 'Adresse à compléter'),
          'ville', COALESCE(p.ville, ''),
          'code_postal', COALESCE(p.code_postal, ''),
          'type', COALESCE(p.type, 'appartement'),
          'surface', p.surface,
          'nb_pieces', p.nb_pieces,
          'etage', p.etage,
          'ascenseur', p.ascenseur,
          'annee_construction', p.annee_construction,
          'parking_numero', p.parking_numero,
          'has_cave', p.has_cave,
          'num_lot', p.num_lot,
          'digicode', p.digicode,
          'interphone', p.interphone,
          'dpe_classe_energie', COALESCE(p.energie, p.dpe_classe_energie),
          'dpe_classe_climat', COALESCE(p.ges, p.dpe_classe_climat),
          'chauffage_type', p.chauffage_type,
          'eau_chaude_type', p.eau_chaude_type,
          'cover_url', (
            SELECT url FROM property_photos 
            WHERE property_id = p.id AND is_main = true 
            LIMIT 1
          ),
          'meters', (
            SELECT COALESCE(jsonb_agg(
              jsonb_build_object(
                'id', m.id, 
                'type', m.type, 
                'serial_number', m.serial_number, 
                'unit', m.unit,
                'last_reading_value', (
                  SELECT reading_value FROM meter_readings 
                  WHERE meter_id = m.id ORDER BY reading_date DESC LIMIT 1
                ),
                'last_reading_date', (
                  SELECT reading_date FROM meter_readings 
                  WHERE meter_id = m.id ORDER BY reading_date DESC LIMIT 1
                )
              )
            ), '[]'::jsonb)
            FROM meters m
            WHERE m.property_id = p.id AND m.is_active = true
          )
        ),
        'owner', jsonb_build_object(
          'id', owner_prof.id,
          'name', COALESCE(
            (SELECT raison_sociale FROM owner_profiles WHERE profile_id = owner_prof.id),
            CONCAT(owner_prof.prenom, ' ', owner_prof.nom)
          ),
          'email', owner_prof.email,
          'telephone', owner_prof.telephone
        )
      ) as lease_data
    FROM leases l
    JOIN lease_signers ls ON ls.lease_id = l.id
    JOIN properties p ON p.id = l.property_id
    JOIN profiles owner_prof ON owner_prof.id = p.owner_id
    WHERE 
      -- ✅ FIX: Chercher par profile_id OU par email d'invitation
      (ls.profile_id = v_profile_id OR LOWER(ls.invited_email) = LOWER(v_user_email))
      AND l.statut IN ('active', 'pending_signature', 'fully_signed', 'terminated')
  ) sub;

  RAISE NOTICE '[tenant_dashboard] Baux trouvés: %', COALESCE(jsonb_array_length(v_leases), 0);

  -- 3. Récupérer les factures (10 dernières)
  SELECT COALESCE(jsonb_agg(invoice_data), '[]'::jsonb) INTO v_invoices
  FROM (
    SELECT 
      i.id,
      i.periode,
      i.montant_total,
      i.statut,
      i.created_at,
      i.due_date,
      p.type as property_type,
      p.adresse_complete as property_address
    FROM invoices i
    JOIN leases l ON l.id = i.lease_id
    JOIN lease_signers ls ON ls.lease_id = l.id
    JOIN properties p ON p.id = l.property_id
    WHERE (ls.profile_id = v_profile_id OR LOWER(ls.invited_email) = LOWER(v_user_email))
    ORDER BY i.periode DESC, i.created_at DESC
    LIMIT 10
  ) invoice_data;

  -- 4. Récupérer les tickets récents (10 derniers)
  SELECT COALESCE(jsonb_agg(ticket_data), '[]'::jsonb) INTO v_tickets
  FROM (
    SELECT 
      t.id,
      t.titre,
      t.description,
      t.priorite,
      t.statut,
      t.created_at,
      p.adresse_complete as property_address,
      p.type as property_type
    FROM tickets t
    JOIN properties p ON p.id = t.property_id
    WHERE t.created_by_profile_id = v_profile_id
    ORDER BY t.created_at DESC
    LIMIT 10
  ) ticket_data;

  -- 5. Récupérer les notifications récentes
  SELECT COALESCE(jsonb_agg(notif_data), '[]'::jsonb) INTO v_notifications
  FROM (
    SELECT n.id, n.title, n.message, n.type, n.is_read, n.created_at, n.action_url
    FROM notifications n
    WHERE n.profile_id = v_profile_id
    ORDER BY n.is_read ASC, n.created_at DESC
    LIMIT 5
  ) notif_data;

  -- 6. Récupérer les EDLs en attente de signature
  SELECT COALESCE(jsonb_agg(edl_data), '[]'::jsonb) INTO v_pending_edls
  FROM (
    SELECT 
      e.id,
      e.type,
      e.status,
      e.scheduled_at,
      es.invitation_token,
      p.adresse_complete as property_address,
      p.type as property_type
    FROM edl e
    JOIN edl_signatures es ON es.edl_id = e.id
    JOIN properties p ON p.id = e.property_id
    WHERE (es.signer_profile_id = v_profile_id OR LOWER(es.signer_email) = LOWER(v_user_email))
    AND es.signed_at IS NULL
    AND e.status IN ('draft', 'scheduled', 'in_progress', 'completed')
    ORDER BY e.created_at DESC
  ) edl_data;

  -- 7. Vérifier l'assurance
  SELECT jsonb_build_object(
    'has_insurance', EXISTS (
      SELECT 1 FROM documents 
      WHERE tenant_id = v_profile_id 
      AND type = 'attestation_assurance'
      AND is_archived = false
      AND (expiry_date IS NULL OR expiry_date > NOW())
    ),
    'last_expiry_date', (
      SELECT expiry_date FROM documents 
      WHERE tenant_id = v_profile_id 
      AND type = 'attestation_assurance' 
      AND is_archived = false
      ORDER BY expiry_date DESC LIMIT 1
    )
  ) INTO v_insurance_status;

  -- 8. Stats globales - ✅ FIX: Chercher par email aussi
  SELECT jsonb_build_object(
    'unpaid_amount', COALESCE(SUM(i.montant_total) FILTER (WHERE i.statut IN ('sent', 'late')), 0),
    'unpaid_count', COUNT(*) FILTER (WHERE i.statut IN ('sent', 'late')),
    'total_monthly_rent', COALESCE(
      (SELECT SUM(l2.loyer + l2.charges_forfaitaires) 
       FROM leases l2 
       JOIN lease_signers ls2 ON ls2.lease_id = l2.id 
       WHERE (ls2.profile_id = v_profile_id OR LOWER(ls2.invited_email) = LOWER(v_user_email))
       AND l2.statut = 'active'), 
      0
    ),
    'active_leases_count', (
      SELECT COUNT(DISTINCT l2.id) 
      FROM leases l2 
      JOIN lease_signers ls2 ON ls2.lease_id = l2.id 
      WHERE (ls2.profile_id = v_profile_id OR LOWER(ls2.invited_email) = LOWER(v_user_email))
      AND l2.statut = 'active'
    )
  ) INTO v_stats
  FROM leases l
  JOIN lease_signers ls ON ls.lease_id = l.id
  LEFT JOIN invoices i ON i.lease_id = l.id
  WHERE (ls.profile_id = v_profile_id OR LOWER(ls.invited_email) = LOWER(v_user_email));

  -- 9. Vérifier le statut KYC
  DECLARE
    v_kyc_status TEXT := 'pending';
  BEGIN
    SELECT COALESCE(tp.kyc_status, 'pending') INTO v_kyc_status
    FROM tenant_profiles tp
    WHERE tp.profile_id = v_profile_id;
  EXCEPTION WHEN OTHERS THEN
    v_kyc_status := 'pending';
  END;

  -- 10. Assembler le résultat final
  v_result := jsonb_build_object(
    'profile_id', v_profile_id,
    'tenant', v_tenant_data,
    'kyc_status', COALESCE((SELECT kyc_status FROM tenant_profiles WHERE profile_id = v_profile_id), 'pending'),
    'leases', COALESCE(v_leases, '[]'::jsonb),
    'lease', CASE WHEN v_leases IS NOT NULL AND jsonb_array_length(v_leases) > 0 THEN v_leases->0 ELSE NULL END,
    'property', CASE WHEN v_leases IS NOT NULL AND jsonb_array_length(v_leases) > 0 THEN (v_leases->0)->'property' ELSE NULL END,
    'invoices', v_invoices,
    'tickets', v_tickets,
    'notifications', v_notifications,
    'pending_edls', v_pending_edls,
    'insurance', v_insurance_status,
    'stats', COALESCE(v_stats, '{"unpaid_amount": 0, "unpaid_count": 0, "total_monthly_rent": 0, "active_leases_count": 0}'::jsonb)
  );

  RETURN v_result;
END;
$$;

-- Ajouter un commentaire explicatif
COMMENT ON FUNCTION tenant_dashboard(UUID) IS 
'RPC pour le tableau de bord locataire. Cherche les baux par profile_id OU invited_email pour gérer le cas où le profile_id n''est pas encore lié dans lease_signers.';



-- ========== 20260104000000_add_kyc_status_and_fix_signature_logic.sql ==========
-- ============================================================================
-- MIGRATION: Ajouter kyc_status à tenant_profiles et corriger la logique
-- Date: 2026-01-04
-- Description: 
--   1. Ajoute la colonne kyc_status à tenant_profiles
--   2. Met à jour les locataires existants avec comptes créés comme "verified"
--   3. Corrige la logique pour que les locataires invités soient auto-vérifiés
-- ============================================================================

-- 1. Ajouter la colonne kyc_status si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tenant_profiles' AND column_name = 'kyc_status'
  ) THEN
    ALTER TABLE tenant_profiles 
    ADD COLUMN kyc_status TEXT DEFAULT 'pending' 
    CHECK (kyc_status IN ('pending', 'processing', 'verified', 'rejected'));
    
    RAISE NOTICE 'Colonne kyc_status ajoutée à tenant_profiles';
  END IF;
END $$;

-- 2. Marquer comme "verified" tous les locataires qui ont :
--    - Un compte créé (profile_id existe)
--    - Signé un bail (lease_signers.signed_at IS NOT NULL)
UPDATE tenant_profiles tp
SET kyc_status = 'verified'
WHERE EXISTS (
  SELECT 1 FROM lease_signers ls
  WHERE ls.profile_id = tp.profile_id
  AND ls.signed_at IS NOT NULL
)
AND (tp.kyc_status IS NULL OR tp.kyc_status = 'pending');

-- 3. Marquer comme "verified" tous les locataires qui ont un compte actif
--    (ils se sont connectés, donc leur email est vérifié)
UPDATE tenant_profiles tp
SET kyc_status = 'verified'
WHERE tp.profile_id IN (
  SELECT p.id FROM profiles p
  JOIN auth.users u ON u.id = p.user_id
  WHERE u.email_confirmed_at IS NOT NULL
)
AND (tp.kyc_status IS NULL OR tp.kyc_status = 'pending');

-- 4. Créer un trigger pour auto-vérifier les nouveaux locataires qui acceptent une invitation
CREATE OR REPLACE FUNCTION auto_verify_tenant_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  -- Si un locataire crée un compte via invitation, on le marque comme vérifié
  IF NEW.kyc_status IS NULL OR NEW.kyc_status = 'pending' THEN
    -- Vérifier si ce locataire a une invitation acceptée
    IF EXISTS (
      SELECT 1 FROM invitations i
      WHERE LOWER(i.email) = LOWER((SELECT email FROM auth.users WHERE id = (SELECT user_id FROM profiles WHERE id = NEW.profile_id)))
      AND i.status = 'accepted'
    ) THEN
      NEW.kyc_status := 'verified';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Supprimer le trigger s'il existe
DROP TRIGGER IF EXISTS tr_auto_verify_tenant ON tenant_profiles;

-- Créer le trigger
CREATE TRIGGER tr_auto_verify_tenant
BEFORE INSERT OR UPDATE ON tenant_profiles
FOR EACH ROW
EXECUTE FUNCTION auto_verify_tenant_on_signup();

-- 5. Mettre à jour la fonction tenant_dashboard pour récupérer correctement le kyc_status
-- Cette partie est informative - la RPC actuelle fait déjà un COALESCE sur kyc_status

COMMENT ON COLUMN tenant_profiles.kyc_status IS 
'Statut de vérification d''identité: pending (en attente), processing (en cours), verified (vérifié), rejected (rejeté). 
Un locataire est auto-vérifié s''il a créé un compte via invitation ou s''il a signé un bail.';



-- ========== 20260104000001_lease_auto_activation_trigger.sql ==========
-- Migration : Activer l'auto-activation du bail après signature de l'EDL
-- Date: 2026-01-04

-- 1. Fonction pour activer le bail
CREATE OR REPLACE FUNCTION public.trigger_activate_lease_on_edl_signed()
RETURNS TRIGGER AS $$
BEGIN
  -- Si l'EDL d'entrée passe à "signed"
  IF NEW.type = 'entree' AND NEW.status = 'signed' AND (OLD.status IS NULL OR OLD.status != 'signed') THEN
    -- Mettre à jour le bail associé
    UPDATE leases
    SET 
      statut = 'active',
      activated_at = NOW(),
      entry_edl_id = NEW.id,
      updated_at = NOW()
    WHERE id = NEW.lease_id 
    AND statut IN ('fully_signed', 'pending_signature', 'partially_signed');
    
    RAISE NOTICE 'Bail % activé suite à la signature de l''EDL %', NEW.lease_id, NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Création effective du trigger
DROP TRIGGER IF EXISTS auto_activate_lease_on_edl ON edl;
CREATE TRIGGER auto_activate_lease_on_edl
  AFTER UPDATE OF status ON edl
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_activate_lease_on_edl_signed();

-- 3. Correction immédiate pour les baux déjà signés avec EDL signé
UPDATE leases l
SET statut = 'active', 
    activated_at = NOW(),
    updated_at = NOW()
WHERE l.statut IN ('fully_signed', 'pending_signature', 'partially_signed')
AND EXISTS (
    SELECT 1 FROM edl e 
    WHERE e.lease_id = l.id 
    AND e.status = 'signed' 
    AND e.type = 'entree'
);




-- ========== 20260104000002_edl_finalization_and_lease_activation.sql ==========
-- Migration pour automatiser la finalisation de l'EDL et l'activation du bail
-- Correction des rôles pour la détection des signatures

CREATE OR REPLACE FUNCTION public.check_edl_finalization()
RETURNS TRIGGER AS $$
DECLARE
    v_has_owner BOOLEAN;
    v_has_tenant BOOLEAN;
    v_edl_type TEXT;
    v_lease_id UUID;
    v_edl_id UUID;
BEGIN
    v_edl_id := NEW.edl_id;

    -- 1. Vérifier les signatures pour cet EDL
    -- On est plus souple sur les noms de rôles
    SELECT 
        EXISTS (SELECT 1 FROM edl_signatures WHERE edl_id = v_edl_id AND (signer_role IN ('owner', 'proprietaire', 'bailleur')) AND signature_image_path IS NOT NULL),
        EXISTS (SELECT 1 FROM edl_signatures WHERE edl_id = v_edl_id AND (signer_role IN ('tenant', 'locataire', 'locataire_principal')) AND signature_image_path IS NOT NULL)
    INTO v_has_owner, v_has_tenant;

    -- 2. Si les deux ont signé
    IF v_has_owner AND v_has_tenant THEN
        -- Récupérer les infos de l'EDL
        SELECT type, lease_id INTO v_edl_type, v_lease_id FROM edl WHERE id = v_edl_id;

        -- Mettre l'EDL en statut 'signed'
        UPDATE edl SET 
            status = 'signed',
            completed_date = NOW(),
            updated_at = NOW()
        WHERE id = v_edl_id 
        AND status != 'signed';

        -- 3. Si c'est un EDL d'entrée, on active le bail
        IF v_edl_type = 'entree' THEN
            -- Vérifier si le bail est déjà au moins fully_signed
            UPDATE leases SET 
                statut = 'active',
                activated_at = NOW(),
                updated_at = NOW()
            WHERE id = v_lease_id 
            AND statut IN ('fully_signed', 'pending_signature', 'partially_signed', 'sent');

            -- Déclencher un événement outbox pour la facture initiale (sera traité par un worker)
            INSERT INTO outbox (event_type, payload)
            VALUES ('Lease.Activated', jsonb_build_object(
                'lease_id', v_lease_id,
                'edl_id', v_edl_id,
                'action', 'generate_initial_invoice'
            ));
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger sur edl_signatures
DROP TRIGGER IF EXISTS tr_check_edl_finalization ON edl_signatures;
CREATE TRIGGER tr_check_edl_finalization
AFTER INSERT OR UPDATE OF signature_image_path ON edl_signatures
FOR EACH ROW
EXECUTE FUNCTION public.check_edl_finalization();

-- Correction immédiate des EDL déjà signés mais bloqués en brouillon
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT id FROM edl WHERE status != 'signed'
    LOOP
        -- Simuler un update pour déclencher la logique (ou appeler la fonction manuellement)
        -- Ici on appelle la logique pour chaque signature existante
        PERFORM check_edl_finalization();
    END LOOP;
END $$;



-- ========== 20260104000003_enrich_edl_schema.sql ==========
-- ============================================================================
-- MIGRATION: Enrichir le schéma EDL pour les compteurs et les clés
-- Date: 2026-01-04
-- ============================================================================

-- 1. Ajouter la colonne 'general_notes' et 'keys' à la table edl si elles n'existent pas
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl' AND column_name = 'general_notes') THEN
        ALTER TABLE edl ADD COLUMN general_notes TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl' AND column_name = 'keys') THEN
        ALTER TABLE edl ADD COLUMN keys JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- 2. Ajouter la colonne 'category' et 'description' à la table edl_items
-- Utile pour classer les items (ex: 'cles', 'compteurs') si on ne veut pas de tables séparées
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_items' AND column_name = 'category') THEN
        ALTER TABLE edl_items ADD COLUMN category TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_items' AND column_name = 'description') THEN
        ALTER TABLE edl_items ADD COLUMN description TEXT;
    END IF;
END $$;

-- 3. Ajouter des indexes pour les performances
CREATE INDEX IF NOT EXISTS idx_edl_items_category ON edl_items(category);

-- 4. Commentaires
COMMENT ON COLUMN edl.keys IS 'Liste des clés remises (JSONB array: [{type, quantite, notes}])';
COMMENT ON COLUMN edl_items.category IS 'Catégorie de l''item (ex: cles, electricite, etc.)';
COMMENT ON COLUMN edl_items.description IS 'Description détaillée ou informations complémentaires sur l''item';



-- ========== 20260104000004_ensure_meter_columns.sql ==========
-- Migration: S'assurer que les colonnes meter_number, serial_number et location existent sur la table meters
-- Date: 2026-01-04

DO $$
BEGIN
    -- 1. Vérifier meter_number (devrait exister)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meters' AND column_name = 'meter_number') THEN
        ALTER TABLE public.meters ADD COLUMN meter_number TEXT;
    END IF;

    -- 2. Vérifier serial_number (alias courant)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meters' AND column_name = 'serial_number') THEN
        ALTER TABLE public.meters ADD COLUMN serial_number TEXT;
    END IF;

    -- 3. Vérifier location (essentiel pour l'EDL)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meters' AND column_name = 'location') THEN
        ALTER TABLE public.meters ADD COLUMN location TEXT;
    END IF;

    -- 4. Synchroniser les données existantes entre meter_number et serial_number
    UPDATE public.meters SET serial_number = meter_number WHERE serial_number IS NULL AND meter_number IS NOT NULL;
    UPDATE public.meters SET meter_number = serial_number WHERE meter_number IS NULL AND serial_number IS NOT NULL;

END $$;



-- ========== 20260105000001_add_neuf_condition.sql ==========
-- Migration: Ajouter l'état "neuf" aux conditions d'éléments EDL
-- Date: 2026-01-05
-- Description: Ajoute "neuf" comme option de condition pour les éléments d'état des lieux

-- ============================================================================
-- 1. Mettre à jour la contrainte CHECK sur la colonne condition de edl_items
-- ============================================================================

-- Supprimer l'ancienne contrainte si elle existe
ALTER TABLE edl_items DROP CONSTRAINT IF EXISTS edl_items_condition_check;

-- Ajouter la nouvelle contrainte avec "neuf"
ALTER TABLE edl_items ADD CONSTRAINT edl_items_condition_check 
  CHECK (condition IN ('neuf', 'bon', 'moyen', 'mauvais', 'tres_mauvais'));

-- ============================================================================
-- 2. Ajouter un commentaire sur la colonne pour documentation
-- ============================================================================

COMMENT ON COLUMN edl_items.condition IS 'État de l''élément: neuf, bon, moyen, mauvais, tres_mauvais';

-- ============================================================================
-- 3. Confirmation
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Migration réussie: état "neuf" ajouté aux conditions EDL';
END $$;



-- ========== 20260105000001_fix_handle_new_user_with_metadata.sql ==========
-- ============================================
-- Migration: Améliorer handle_new_user pour lire le rôle depuis les metadata
-- Date: 2026-01-05
-- Description: Le trigger lit maintenant le rôle, prénom, nom et téléphone 
--              depuis les raw_user_meta_data de l'utilisateur
-- ============================================

-- Recréer la fonction handle_new_user pour lire les metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_prenom TEXT;
  v_nom TEXT;
  v_telephone TEXT;
BEGIN
  -- Lire le rôle depuis les metadata, avec fallback sur 'tenant'
  v_role := COALESCE(
    NEW.raw_user_meta_data->>'role',
    'tenant'
  );
  
  -- Valider le rôle
  IF v_role NOT IN ('admin', 'owner', 'tenant', 'provider') THEN
    v_role := 'tenant';
  END IF;
  
  -- Lire les autres données depuis les metadata
  v_prenom := NEW.raw_user_meta_data->>'prenom';
  v_nom := NEW.raw_user_meta_data->>'nom';
  v_telephone := NEW.raw_user_meta_data->>'telephone';
  
  -- Insérer le profil avec toutes les données
  INSERT INTO public.profiles (user_id, role, prenom, nom, telephone)
  VALUES (NEW.id, v_role, v_prenom, v_nom, v_telephone)
  ON CONFLICT (user_id) DO UPDATE SET
    role = EXCLUDED.role,
    prenom = COALESCE(EXCLUDED.prenom, profiles.prenom),
    nom = COALESCE(EXCLUDED.nom, profiles.nom),
    telephone = COALESCE(EXCLUDED.telephone, profiles.telephone),
    updated_at = NOW();
  
  RETURN NEW;
END;
$$;

-- Commenter la fonction
COMMENT ON FUNCTION public.handle_new_user() IS 
'Crée automatiquement un profil lors de la création d''un utilisateur.
Lit le rôle et les informations personnelles depuis les raw_user_meta_data.
Utilise ON CONFLICT pour gérer les cas où le profil existe déjà.';



-- ========== 20260105000002_edl_lease_sync_triggers.sql ==========
-- Migration: Triggers de synchronisation EDL/Bail
-- Date: 2026-01-05
-- Description: Assure la synchronisation automatique des statuts entre EDL et baux

-- ============================================================================
-- 1. Fonction de vérification et finalisation de l'EDL
-- ============================================================================
CREATE OR REPLACE FUNCTION public.check_edl_finalization()
RETURNS TRIGGER AS $$
DECLARE
    v_has_owner BOOLEAN;
    v_has_tenant BOOLEAN;
    v_edl_type TEXT;
    v_lease_id UUID;
    v_edl_id UUID;
BEGIN
    v_edl_id := NEW.edl_id;

    -- Vérifier les signatures (support des rôles FR et EN)
    SELECT 
        EXISTS (
            SELECT 1 FROM edl_signatures 
            WHERE edl_id = v_edl_id 
            AND signer_role IN ('owner', 'proprietaire', 'bailleur') 
            AND signature_image_path IS NOT NULL
            AND signed_at IS NOT NULL
        ),
        EXISTS (
            SELECT 1 FROM edl_signatures 
            WHERE edl_id = v_edl_id 
            AND signer_role IN ('tenant', 'locataire', 'locataire_principal') 
            AND signature_image_path IS NOT NULL
            AND signed_at IS NOT NULL
        )
    INTO v_has_owner, v_has_tenant;

    -- Si les deux parties ont signé
    IF v_has_owner AND v_has_tenant THEN
        -- Récupérer les infos de l'EDL
        SELECT type, lease_id INTO v_edl_type, v_lease_id 
        FROM edl WHERE id = v_edl_id;

        -- Mettre l'EDL en statut 'signed'
        UPDATE edl SET 
            status = 'signed',
            completed_date = CURRENT_DATE,
            updated_at = NOW()
        WHERE id = v_edl_id 
        AND status != 'signed';

        -- Si c'est un EDL d'entrée, activer le bail
        IF v_edl_type = 'entree' AND v_lease_id IS NOT NULL THEN
            UPDATE leases SET 
                statut = 'active',
                activated_at = NOW(),
                updated_at = NOW()
            WHERE id = v_lease_id 
            AND statut IN ('fully_signed', 'pending_signature', 'partially_signed', 'sent');

            -- Émettre un événement pour la facturation
            INSERT INTO outbox (event_type, payload)
            VALUES ('Lease.Activated', jsonb_build_object(
                'lease_id', v_lease_id,
                'edl_id', v_edl_id,
                'action', 'generate_initial_invoice',
                'triggered_by', 'edl_signature_trigger'
            ));
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 2. Trigger sur edl_signatures (INSERT et UPDATE)
-- ============================================================================
DROP TRIGGER IF EXISTS tr_check_edl_finalization ON edl_signatures;
CREATE TRIGGER tr_check_edl_finalization
AFTER INSERT OR UPDATE OF signature_image_path, signed_at ON edl_signatures
FOR EACH ROW
EXECUTE FUNCTION public.check_edl_finalization();

-- ============================================================================
-- 3. Trigger sur edl pour activer le bail si statut passe à 'signed'
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trigger_activate_lease_on_edl_signed()
RETURNS TRIGGER AS $$
BEGIN
    -- Si l'EDL d'entrée passe à "signed"
    IF NEW.type = 'entree' 
       AND NEW.status = 'signed' 
       AND (OLD.status IS NULL OR OLD.status != 'signed') 
    THEN
        UPDATE leases
        SET 
            statut = 'active',
            activated_at = NOW(),
            entry_edl_id = NEW.id,
            updated_at = NOW()
        WHERE id = NEW.lease_id 
        AND statut IN ('fully_signed', 'pending_signature', 'partially_signed', 'sent');
        
        RAISE NOTICE 'Bail % activé suite à la signature de l''EDL %', NEW.lease_id, NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS auto_activate_lease_on_edl ON edl;
CREATE TRIGGER auto_activate_lease_on_edl
AFTER UPDATE OF status ON edl
FOR EACH ROW
EXECUTE FUNCTION public.trigger_activate_lease_on_edl_signed();

-- ============================================================================
-- 4. Correction immédiate des données existantes
-- ============================================================================

-- 4a. Corriger les EDL avec signatures complètes mais pas en 'signed'
UPDATE edl e
SET 
    status = 'signed', 
    completed_date = CURRENT_DATE,
    updated_at = NOW()
WHERE status != 'signed'
AND EXISTS (
    SELECT 1 FROM edl_signatures s 
    WHERE s.edl_id = e.id 
    AND s.signer_role IN ('owner', 'proprietaire', 'bailleur')
    AND s.signature_image_path IS NOT NULL
    AND s.signed_at IS NOT NULL
)
AND EXISTS (
    SELECT 1 FROM edl_signatures s 
    WHERE s.edl_id = e.id 
    AND s.signer_role IN ('tenant', 'locataire', 'locataire_principal')
    AND s.signature_image_path IS NOT NULL
    AND s.signed_at IS NOT NULL
);

-- 4b. Activer les baux dont l'EDL d'entrée est signé
UPDATE leases l
SET 
    statut = 'active', 
    activated_at = NOW(),
    updated_at = NOW()
WHERE statut IN ('fully_signed', 'pending_signature', 'partially_signed', 'sent')
AND EXISTS (
    SELECT 1 FROM edl e 
    WHERE e.lease_id = l.id 
    AND e.status = 'signed' 
    AND e.type = 'entree'
);

-- ============================================================================
-- 5. Vérification
-- ============================================================================
DO $$
DECLARE
    v_edl_count INTEGER;
    v_lease_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_edl_count FROM edl WHERE status = 'signed';
    SELECT COUNT(*) INTO v_lease_count FROM leases WHERE statut = 'active';
    
    RAISE NOTICE 'Migration terminée: % EDL signés, % baux actifs', v_edl_count, v_lease_count;
END $$;

SELECT 'Migration EDL/Lease sync triggers appliquée avec succès' AS status;



-- ========== 20260105000002_update_rooms_type_piece_constraint.sql ==========
-- ============================================
-- Migration: Mise à jour contrainte type_piece pour rooms
-- Date: 2026-01-05
-- Description: Ajoute les nouveaux types de pièces V3 et pro/parking
-- ============================================

-- Supprimer l'ancienne contrainte
ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_type_piece_check;

-- Ajouter la nouvelle contrainte avec tous les types
ALTER TABLE rooms ADD CONSTRAINT rooms_type_piece_check 
  CHECK (type_piece IN (
    -- Types principaux habitation
    'sejour',
    'chambre',
    'cuisine',
    'salle_de_bain',
    'wc',
    'entree',
    'couloir',
    'balcon',
    'terrasse',
    'cave',
    'autre',
    -- Types additionnels V3
    'salon_cuisine',
    'bureau',
    'dressing',
    'suite_parentale',
    'mezzanine',
    'buanderie',
    'cellier',
    'jardin',
    -- Types pro/parking
    'stockage',
    'emplacement',
    'box'
  ));

COMMENT ON CONSTRAINT rooms_type_piece_check ON rooms IS 
'Types de pièces valides incluant habitation, V3 additionnels et pro/parking';



-- ========== 20260105000003_add_leases_missing_columns.sql ==========
-- ============================================
-- Migration: Ajouter les colonnes manquantes à leases
-- Date: 2026-01-05
-- Description: Ajoute charges_type, coloc_config et autres colonnes manquantes
-- ============================================

-- Ajouter charges_type si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leases' AND column_name = 'charges_type') THEN
    ALTER TABLE leases ADD COLUMN charges_type TEXT DEFAULT 'forfait' 
      CHECK (charges_type IN ('forfait', 'provisions'));
  END IF;
END $$;

-- Ajouter coloc_config (pour la configuration colocation) si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leases' AND column_name = 'coloc_config') THEN
    ALTER TABLE leases ADD COLUMN coloc_config JSONB;
  END IF;
END $$;

-- Mettre à jour la contrainte type_bail pour inclure les nouveaux types
ALTER TABLE leases DROP CONSTRAINT IF EXISTS leases_type_bail_check;
ALTER TABLE leases ADD CONSTRAINT leases_type_bail_check 
  CHECK (type_bail IN ('nu', 'meuble', 'colocation', 'saisonnier', 'etudiant', 'mobilite'));

-- Ajouter un index sur charges_type pour les requêtes filtrées
CREATE INDEX IF NOT EXISTS idx_leases_charges_type ON leases(charges_type);

COMMENT ON COLUMN leases.charges_type IS 'Type de charges: forfait (fixe) ou provisions (régularisation annuelle)';
COMMENT ON COLUMN leases.coloc_config IS 'Configuration colocation: nb_places, bail_type, solidarite, split_mode, etc.';



-- ========== 20260105000003_lease_notices.sql ==========
-- Migration: Table des congés locataires
-- Date: 2026-01-05
-- Description: Permet aux locataires de donner congé avec gestion du préavis

-- ============================================================================
-- 1. Table lease_notices - Enregistrement des congés
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.lease_notices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
    tenant_profile_id UUID NOT NULL REFERENCES profiles(id),
    
    -- Dates
    notice_date DATE NOT NULL,               -- Date d'envoi du congé
    effective_end_date DATE NOT NULL,        -- Date de fin effective du bail
    notice_period_days INTEGER NOT NULL,     -- Durée du préavis en jours
    
    -- Préavis réduit
    is_reduced_notice BOOLEAN DEFAULT FALSE,
    reduced_notice_reason TEXT,              -- Motif légal pour préavis réduit
    
    -- Informations complémentaires
    forwarding_address TEXT,                 -- Nouvelle adresse du locataire
    notes TEXT,                              -- Commentaires additionnels
    
    -- Statut du congé
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'acknowledged', 'completed', 'cancelled')),
    acknowledged_at TIMESTAMPTZ,             -- Date d'accusé réception par le propriétaire
    acknowledged_by UUID REFERENCES auth.users(id),
    
    -- Documents générés
    notice_letter_path TEXT,                 -- Chemin vers la lettre de congé PDF
    
    -- Métadonnées
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_lease_notices_lease_id ON lease_notices(lease_id);
CREATE INDEX IF NOT EXISTS idx_lease_notices_tenant ON lease_notices(tenant_profile_id);
CREATE INDEX IF NOT EXISTS idx_lease_notices_status ON lease_notices(status);
CREATE INDEX IF NOT EXISTS idx_lease_notices_end_date ON lease_notices(effective_end_date);

-- ============================================================================
-- 2. Mise à jour du statut possible des baux
-- ============================================================================
-- Ajouter le statut "notice_given" si pas déjà présent dans la contrainte
DO $$
BEGIN
    -- Vérifier si la contrainte existe et la mettre à jour
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'leases_statut_check' 
        AND conrelid = 'leases'::regclass
    ) THEN
        ALTER TABLE leases DROP CONSTRAINT IF EXISTS leases_statut_check;
    END IF;
    
    -- Ajouter la nouvelle contrainte avec tous les statuts
    ALTER TABLE leases ADD CONSTRAINT leases_statut_check 
        CHECK (statut IN (
            'draft', 
            'sent', 
            'pending_signature', 
            'partially_signed',
            'pending_owner_signature',
            'fully_signed', 
            'active', 
            'notice_given',     -- NOUVEAU: Congé donné
            'amended', 
            'terminated', 
            'archived'
        ));
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Contrainte statut déjà à jour ou autre erreur: %', SQLERRM;
END $$;

-- ============================================================================
-- 3. RLS Policies
-- ============================================================================
ALTER TABLE lease_notices ENABLE ROW LEVEL SECURITY;

-- Locataire peut voir ses propres congés
CREATE POLICY "Tenant can view own notices" ON lease_notices
    FOR SELECT
    USING (
        tenant_profile_id IN (
            SELECT id FROM profiles WHERE user_id = auth.uid()
        )
    );

-- Locataire peut créer un congé pour son bail
CREATE POLICY "Tenant can create notice" ON lease_notices
    FOR INSERT
    WITH CHECK (
        tenant_profile_id IN (
            SELECT id FROM profiles WHERE user_id = auth.uid()
        )
        AND EXISTS (
            SELECT 1 FROM lease_signers ls
            WHERE ls.lease_id = lease_notices.lease_id
            AND ls.profile_id = lease_notices.tenant_profile_id
            AND ls.role IN ('locataire_principal', 'colocataire')
        )
    );

-- Propriétaire peut voir les congés de ses baux
CREATE POLICY "Owner can view notices" ON lease_notices
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM leases l
            JOIN properties p ON l.property_id = p.id
            JOIN profiles pr ON p.owner_id = pr.id
            WHERE l.id = lease_notices.lease_id
            AND pr.user_id = auth.uid()
        )
    );

-- Propriétaire peut mettre à jour le statut (acknowledged)
CREATE POLICY "Owner can update notice status" ON lease_notices
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM leases l
            JOIN properties p ON l.property_id = p.id
            JOIN profiles pr ON p.owner_id = pr.id
            WHERE l.id = lease_notices.lease_id
            AND pr.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM leases l
            JOIN properties p ON l.property_id = p.id
            JOIN profiles pr ON p.owner_id = pr.id
            WHERE l.id = lease_notices.lease_id
            AND pr.user_id = auth.uid()
        )
    );

-- Admin a accès complet
CREATE POLICY "Admin full access notices" ON lease_notices
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- ============================================================================
-- 4. Trigger pour updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION update_lease_notices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_lease_notices_updated_at ON lease_notices;
CREATE TRIGGER tr_lease_notices_updated_at
    BEFORE UPDATE ON lease_notices
    FOR EACH ROW
    EXECUTE FUNCTION update_lease_notices_updated_at();

-- ============================================================================
-- 5. Vue pour les congés à venir (utile pour le propriétaire)
-- ============================================================================
CREATE OR REPLACE VIEW v_upcoming_lease_notices AS
SELECT 
    ln.id as notice_id,
    ln.lease_id,
    ln.notice_date,
    ln.effective_end_date,
    ln.notice_period_days,
    ln.is_reduced_notice,
    ln.reduced_notice_reason,
    ln.status,
    ln.forwarding_address,
    l.type_bail,
    l.loyer,
    p.adresse_complete,
    p.ville,
    p.owner_id,
    tp.prenom as tenant_prenom,
    tp.nom as tenant_nom,
    tp.email as tenant_email,
    (ln.effective_end_date - CURRENT_DATE) as days_until_end
FROM lease_notices ln
JOIN leases l ON ln.lease_id = l.id
JOIN properties p ON l.property_id = p.id
JOIN profiles tp ON ln.tenant_profile_id = tp.id
WHERE ln.status != 'cancelled'
AND ln.effective_end_date >= CURRENT_DATE
ORDER BY ln.effective_end_date ASC;

-- Confirmation
SELECT 'Migration lease_notices appliquée avec succès' AS status;



-- ========== 20260107000000_building_support.sql ==========
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

CREATE TABLE IF NOT EXISTS buildings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  
  -- Identification
  name TEXT NOT NULL,
  
  -- Adresse
  adresse_complete TEXT NOT NULL,
  code_postal TEXT NOT NULL,
  ville TEXT NOT NULL,
  departement TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  
  -- Structure physique
  floors INTEGER NOT NULL DEFAULT 1 CHECK (floors >= 1 AND floors <= 50),
  construction_year INTEGER CHECK (construction_year >= 1800 AND construction_year <= 2100),
  surface_totale DECIMAL(10, 2),
  
  -- Parties communes
  has_ascenseur BOOLEAN DEFAULT false,
  has_gardien BOOLEAN DEFAULT false,
  has_interphone BOOLEAN DEFAULT false,
  has_digicode BOOLEAN DEFAULT false,
  has_local_velo BOOLEAN DEFAULT false,
  has_local_poubelles BOOLEAN DEFAULT false,
  has_parking_commun BOOLEAN DEFAULT false,
  has_jardin_commun BOOLEAN DEFAULT false,
  
  -- Métadonnées
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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



-- ========== 20260107000000_rebranding_to_talok.sql ==========
-- Migration : Rebranding global vers Talok
-- Date : 2026-01-07
-- Description : Met à jour les données de base (plans, providers, etc.) pour refléter le nouveau nom

BEGIN;

-- 1. Mise à jour des descriptions des plans d'abonnement
UPDATE subscription_plans 
SET description = REPLACE(description, 'la gestion locative', 'Talok')
WHERE description LIKE '%la gestion locative%';

UPDATE subscription_plans 
SET description = REPLACE(description, 'Gestion Locative', 'Talok')
WHERE description LIKE '%Gestion Locative%';

-- Mise à jour spécifique pour le plan gratuit si nécessaire
UPDATE subscription_plans 
SET description = 'Découvrez Talok et simplifiez la gestion de votre premier bien'
WHERE slug = 'gratuit';

-- 2. Mise à jour des métadonnées des providers API si nécessaire
-- (Par exemple, si des noms d'affichage par défaut étaient stockés en JSON)
UPDATE api_credentials
SET config = config || jsonb_build_object('email_from', REPLACE(config->>'email_from', 'Gestion Locative', 'Talok'))
WHERE config ? 'email_from' AND config->>'email_from' LIKE '%Gestion Locative%';

-- 3. Mise à jour des commentaires de table pour la cohérence
COMMENT ON TABLE subscription_plans IS 'Plans d''abonnement Talok';
COMMENT ON TABLE profiles IS 'Profils utilisateurs Talok';

-- 4. Nettoyage des anciennes références dans les fonctions si elles utilisaient le nom en dur
-- (Après vérification, la plupart utilisent des paramètres, mais on assure le coup pour les messages de log)

CREATE OR REPLACE FUNCTION create_owner_subscription()
RETURNS TRIGGER AS $$
DECLARE
  v_plan_id UUID;
BEGIN
  -- Seulement pour les propriétaires
  IF NEW.role = 'owner' THEN
    -- Récupérer l'ID du plan gratuit (nouveau défaut)
    SELECT id INTO v_plan_id 
    FROM subscription_plans 
    WHERE slug = 'gratuit' 
    LIMIT 1;
    
    -- Fallback sur starter si gratuit n'existe pas
    IF v_plan_id IS NULL THEN
      SELECT id INTO v_plan_id 
      FROM subscription_plans 
      WHERE slug = 'starter' 
      LIMIT 1;
    END IF;
    
    -- Créer l'abonnement si le plan existe
    IF v_plan_id IS NOT NULL THEN
      INSERT INTO subscriptions (
        owner_id, 
        plan_id, 
        status, 
        billing_cycle, 
        current_period_start,
        current_period_end,
        properties_count,
        leases_count
      )
      VALUES (
        NEW.id,
        v_plan_id,
        'active',
        'monthly',
        NOW(),
        NOW() + INTERVAL '1 month',
        0,
        0
      )
      ON CONFLICT (owner_id) DO NOTHING;
      
      RAISE NOTICE 'Abonnement Talok Gratuit créé pour le propriétaire %', NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;



-- ========== 20260107000001_sota_lease_status_constraint.sql ==========
-- =====================================================
-- MIGRATION: SOTA 2026 - Contrainte de statuts de bail
-- Date: 2026-01-07
-- Description: Garantit que tous les statuts légaux de bail sont autorisés
-- =====================================================

-- 1. Supprimer l'ancienne contrainte si elle existe
ALTER TABLE leases DROP CONSTRAINT IF EXISTS leases_statut_check;

-- 2. Ajouter la nouvelle contrainte avec TOUS les statuts SOTA 2026
ALTER TABLE leases ADD CONSTRAINT leases_statut_check 
  CHECK (statut IN (
    'draft',                   -- Brouillon initial
    'sent',                    -- Envoyé pour signature
    'pending_signature',       -- En attente de signatures
    'partially_signed',        -- Partiellement signé
    'pending_owner_signature', -- Locataire signé, attente propriétaire
    'fully_signed',            -- Entièrement signé (avant activation)
    'active',                  -- Bail en cours
    'notice_given',            -- Congé donné (préavis)
    'amended',                 -- Avenant en cours
    'terminated',              -- Terminé
    'archived'                 -- Archivé
  ));

-- 3. Créer un index pour optimiser les requêtes par statut
CREATE INDEX IF NOT EXISTS idx_leases_statut ON leases(statut);

-- 4. Index partiel pour les baux en attente d'action (les plus fréquemment consultés)
CREATE INDEX IF NOT EXISTS idx_leases_pending_action ON leases(statut) 
  WHERE statut IN ('pending_signature', 'partially_signed', 'pending_owner_signature', 'fully_signed');

-- 5. Commenter pour la documentation
COMMENT ON COLUMN leases.statut IS 'Statut du bail: draft, sent, pending_signature, partially_signed, pending_owner_signature, fully_signed, active, notice_given, amended, terminated, archived';

-- 6. Log de migration
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM leases;
  RAISE NOTICE '[MIGRATION] Contrainte statuts SOTA 2026 appliquée. % baux existants.', v_count;
END $$;



-- ========== 20260107000002_fix_existing_lease_statuses_sota.sql ==========
-- =====================================================
-- MIGRATION: SOTA 2026 - Correction des statuts de baux existants
-- Date: 2026-01-07
-- Description: Corrige les baux mal catégorisés après le fix de determineLeaseStatus
-- =====================================================

-- 1. CORRECTION : Baux marqués "active" mais sans EDL d'entrée signé
-- Ces baux auraient dû être "fully_signed" et attendre l'EDL
UPDATE leases SET 
  statut = 'fully_signed',
  updated_at = NOW()
WHERE statut = 'active'
  AND id NOT IN (
    -- Exclure les baux qui ont un EDL d'entrée signé
    SELECT DISTINCT lease_id FROM edl 
    WHERE type = 'entree' AND status = 'signed'
  )
  AND id IN (
    -- Seulement les baux où tous les signataires ont signé
    SELECT ls.lease_id
    FROM lease_signers ls
    GROUP BY ls.lease_id
    HAVING COUNT(*) > 1 
       AND COUNT(*) = COUNT(CASE WHEN ls.signature_status = 'signed' THEN 1 END)
  );

-- Log du nombre de corrections
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN
    RAISE NOTICE '[SOTA 2026] % bail(s) corrigé(s) de "active" vers "fully_signed"', v_count;
  ELSE
    RAISE NOTICE '[SOTA 2026] Aucun bail à corriger';
  END IF;
END $$;

-- 2. CORRECTION : Baux en "pending_signature" alors que tous ont signé
UPDATE leases SET 
  statut = 'fully_signed',
  updated_at = NOW()
WHERE statut IN ('pending_signature', 'partially_signed')
  AND id IN (
    -- Baux où tous les signataires ont signé
    SELECT ls.lease_id
    FROM lease_signers ls
    GROUP BY ls.lease_id
    HAVING COUNT(*) >= 2 -- Au moins propriétaire + locataire
       AND COUNT(*) = COUNT(CASE WHEN ls.signature_status = 'signed' THEN 1 END)
  );

-- 3. CORRECTION : Baux en "pending_signature" où locataire signé mais pas proprio
UPDATE leases SET 
  statut = 'pending_owner_signature',
  updated_at = NOW()
WHERE statut = 'pending_signature'
  AND id IN (
    SELECT ls.lease_id
    FROM lease_signers ls
    WHERE ls.role IN ('locataire_principal', 'locataire', 'tenant', 'colocataire')
      AND ls.signature_status = 'signed'
    GROUP BY ls.lease_id
  )
  AND id NOT IN (
    SELECT ls.lease_id
    FROM lease_signers ls
    WHERE ls.role IN ('proprietaire', 'owner')
      AND ls.signature_status = 'signed'
    GROUP BY ls.lease_id
  );

-- 4. Rapport final
DO $$
DECLARE
  v_draft INTEGER;
  v_pending INTEGER;
  v_fully_signed INTEGER;
  v_active INTEGER;
  v_terminated INTEGER;
BEGIN
  SELECT 
    COUNT(*) FILTER (WHERE statut = 'draft'),
    COUNT(*) FILTER (WHERE statut IN ('pending_signature', 'partially_signed', 'pending_owner_signature', 'sent')),
    COUNT(*) FILTER (WHERE statut = 'fully_signed'),
    COUNT(*) FILTER (WHERE statut = 'active'),
    COUNT(*) FILTER (WHERE statut IN ('terminated', 'archived'))
  INTO v_draft, v_pending, v_fully_signed, v_active, v_terminated
  FROM leases;
  
  RAISE NOTICE '=== RAPPORT STATUTS BAUX SOTA 2026 ===';
  RAISE NOTICE 'Brouillons: %', v_draft;
  RAISE NOTICE 'En attente de signature: %', v_pending;
  RAISE NOTICE 'Entièrement signés (attente EDL): %', v_fully_signed;
  RAISE NOTICE 'Actifs: %', v_active;
  RAISE NOTICE 'Terminés/Archivés: %', v_terminated;
  RAISE NOTICE '======================================';
END $$;



-- ========== 20260107100000_fix_auth_500_database_error.sql ==========
-- =====================================================
-- MIGRATION: Fix erreur "Database error querying schema" (500)
-- Date: 2026-01-07
-- Problème: L'authentification échoue avec une erreur 500
-- Cause: Fonctions RLS manquantes ou politiques mal configurées
-- =====================================================

-- 1. RECRÉER LES FONCTIONS HELPER AVEC SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.user_profile_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.user_profile_id(p_user_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id FROM profiles WHERE user_id = p_user_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.user_role(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE user_id = p_user_id LIMIT 1;
$$;

-- 2. S'ASSURER QUE RLS EST ACTIVÉ
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 3. NETTOYER LES ANCIENNES POLITIQUES
DROP POLICY IF EXISTS "profiles_self_all" ON profiles;
DROP POLICY IF EXISTS "profiles_admin_all" ON profiles;
DROP POLICY IF EXISTS "profiles_owner_view_tenants" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "users_view_own_profile" ON profiles;
DROP POLICY IF EXISTS "users_update_own_profile" ON profiles;
DROP POLICY IF EXISTS "admins_view_all_profiles" ON profiles;

-- 4. CRÉER LES NOUVELLES POLITIQUES
CREATE POLICY "profiles_self_all" ON profiles 
FOR ALL TO authenticated 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "profiles_admin_all" ON profiles 
FOR SELECT TO authenticated 
USING (public.user_role() = 'admin');

CREATE POLICY "profiles_owner_view_tenants" ON profiles 
FOR SELECT TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM lease_signers ls
    JOIN leases l ON l.id = ls.lease_id
    JOIN properties p ON p.id = l.property_id
    WHERE ls.profile_id = profiles.id
    AND p.owner_id = public.user_profile_id()
  )
);



-- ========== 20260107150000_fix_profiles_rls_recursion.sql ==========
-- =====================================================
-- MIGRATION: Correction DÉFINITIVE de la récursion RLS sur profiles
-- Date: 2026-01-07
-- Problème: "RLS recursion detected" - erreur 500 sur profiles
-- 
-- CAUSE: Les politiques RLS sur `profiles` appellent user_role() 
--        qui requête `profiles`, créant une boucle infinie.
--
-- SOLUTION: Utiliser auth.uid() directement dans les politiques
--           et des sous-requêtes avec SECURITY DEFINER
-- =====================================================

-- 1. DÉSACTIVER TEMPORAIREMENT RLS POUR LE NETTOYAGE
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- 2. SUPPRIMER TOUTES LES ANCIENNES POLITIQUES SUR profiles
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE tablename = 'profiles' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON profiles', pol.policyname);
  END LOOP;
END $$;

-- 3. CRÉER UNE FONCTION POUR VÉRIFIER SI L'UTILISATEUR EST ADMIN
-- Cette fonction utilise une vue matérialisée ou un cache pour éviter la récursion
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
    LIMIT 1
  );
$$;

-- 4. CRÉER UNE FONCTION POUR OBTENIR LE ROLE SANS RLS
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role FROM profiles WHERE user_id = auth.uid() LIMIT 1),
    'anonymous'
  );
$$;

-- 5. CRÉER UNE FONCTION POUR OBTENIR MON PROFILE_ID SANS RLS  
CREATE OR REPLACE FUNCTION public.get_my_profile_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- 6. RÉACTIVER RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 7. CRÉER LES NOUVELLES POLITIQUES (SANS RÉCURSION)
-- Politique principale : chaque utilisateur peut voir/modifier son propre profil
CREATE POLICY "profiles_own_access" ON profiles 
FOR ALL TO authenticated 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());


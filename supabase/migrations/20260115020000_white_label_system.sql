-- ============================================
-- Migration: Système White-Label complet
-- Date: 2026-01-15
-- Description: Tables pour organisations, branding et domaines personnalisés
-- ============================================

-- ============================================
-- TYPE ENUM pour les niveaux white-label
-- ============================================

CREATE TYPE white_label_level AS ENUM ('none', 'basic', 'full', 'premium');
CREATE TYPE domain_verification_method AS ENUM ('dns_txt', 'dns_cname', 'file');
CREATE TYPE ssl_status AS ENUM ('pending', 'active', 'failed', 'expired');
CREATE TYPE sso_provider AS ENUM ('saml', 'oidc');

-- ============================================
-- TABLE: organizations
-- Organisation/entreprise utilisant le white-label
-- ============================================

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Informations de base
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,

  -- Propriétaire (user_id du propriétaire principal)
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Lien avec l'abonnement
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,

  -- Niveau white-label (déterminé par le plan)
  white_label_level white_label_level NOT NULL DEFAULT 'none',

  -- État
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Métadonnées
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX idx_organizations_owner ON organizations(owner_id);
CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_subscription ON organizations(subscription_id);

-- ============================================
-- TABLE: organization_members
-- Membres d'une organisation
-- ============================================

CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Rôle dans l'organisation
  role VARCHAR(50) NOT NULL DEFAULT 'member', -- owner, admin, member

  -- État
  is_active BOOLEAN NOT NULL DEFAULT true,
  invited_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ DEFAULT NOW(),

  -- Métadonnées
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Contrainte unique
  UNIQUE(organization_id, user_id)
);

-- Index
CREATE INDEX idx_org_members_org ON organization_members(organization_id);
CREATE INDEX idx_org_members_user ON organization_members(user_id);

-- ============================================
-- TABLE: organization_branding
-- Configuration du branding pour une organisation
-- ============================================

CREATE TABLE IF NOT EXISTS organization_branding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID UNIQUE NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- ============================================
  -- NIVEAU BASIC (Enterprise M - 349€)
  -- ============================================

  -- Nom et identité
  company_name VARCHAR(255),
  tagline VARCHAR(500),

  -- Logo principal
  logo_url TEXT,
  logo_dark_url TEXT, -- Version pour dark mode

  -- Couleur principale
  primary_color VARCHAR(7), -- Format #RRGGBB

  -- Email basique
  email_from_name VARCHAR(255),
  email_from_address VARCHAR(255),
  email_logo_url TEXT,

  -- ============================================
  -- NIVEAU FULL (Enterprise L - 499€)
  -- ============================================

  -- Favicon
  favicon_url TEXT,

  -- Couleurs complètes
  secondary_color VARCHAR(7),
  accent_color VARCHAR(7),

  -- Background page connexion
  login_background_url TEXT,
  login_background_color VARCHAR(7),

  -- Email avancé
  email_reply_to VARCHAR(255),
  email_footer_html TEXT,
  email_primary_color VARCHAR(7),
  email_secondary_color VARCHAR(7),

  -- Options
  remove_powered_by BOOLEAN NOT NULL DEFAULT false,

  -- ============================================
  -- NIVEAU PREMIUM (Enterprise XL - 799€)
  -- ============================================

  -- CSS personnalisé
  custom_css TEXT,

  -- SSO
  sso_enabled BOOLEAN NOT NULL DEFAULT false,
  sso_provider sso_provider,
  sso_entity_id VARCHAR(255),
  sso_metadata_url TEXT,
  sso_certificate TEXT,
  sso_config JSONB DEFAULT '{}',

  -- API Branding
  api_branding_enabled BOOLEAN NOT NULL DEFAULT false,

  -- ============================================
  -- Métadonnées
  -- ============================================

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX idx_org_branding_org ON organization_branding(organization_id);

-- ============================================
-- TABLE: custom_domains
-- Domaines personnalisés pour une organisation
-- ============================================

CREATE TABLE IF NOT EXISTS custom_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Domaine
  domain VARCHAR(255) NOT NULL,
  subdomain VARCHAR(100), -- Si sous-domaine de talok.app

  -- Vérification
  verified BOOLEAN NOT NULL DEFAULT false,
  verification_token VARCHAR(64) NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  verification_method domain_verification_method NOT NULL DEFAULT 'dns_txt',
  verification_attempts INTEGER NOT NULL DEFAULT 0,
  last_verification_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,

  -- SSL/TLS
  ssl_status ssl_status NOT NULL DEFAULT 'pending',
  ssl_certificate_id VARCHAR(255), -- ID chez le provider (Let's Encrypt, etc.)
  ssl_issued_at TIMESTAMPTZ,
  ssl_expires_at TIMESTAMPTZ,

  -- État
  is_primary BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Métadonnées
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Contraintes
  UNIQUE(domain)
);

-- Index
CREATE INDEX idx_custom_domains_org ON custom_domains(organization_id);
CREATE INDEX idx_custom_domains_domain ON custom_domains(domain);
CREATE INDEX idx_custom_domains_verified ON custom_domains(verified) WHERE verified = true;

-- ============================================
-- TABLE: branding_assets
-- Assets uploadés (logos, images, etc.)
-- ============================================

CREATE TABLE IF NOT EXISTS branding_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Type d'asset
  asset_type VARCHAR(50) NOT NULL, -- logo, favicon, login_bg, email_logo

  -- Fichier
  file_name VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type VARCHAR(100) NOT NULL,

  -- Dimensions (pour images)
  width INTEGER,
  height INTEGER,

  -- État
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Métadonnées
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX idx_branding_assets_org ON branding_assets(organization_id);
CREATE INDEX idx_branding_assets_type ON branding_assets(asset_type);

-- ============================================
-- FONCTIONS
-- ============================================

-- Fonction pour obtenir le branding d'une organisation
CREATE OR REPLACE FUNCTION get_organization_branding(p_organization_id UUID)
RETURNS TABLE (
  organization_id UUID,
  organization_name VARCHAR,
  white_label_level white_label_level,
  branding JSONB,
  primary_domain VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.id AS organization_id,
    o.name AS organization_name,
    o.white_label_level,
    CASE
      WHEN ob.id IS NOT NULL THEN
        jsonb_build_object(
          'company_name', COALESCE(ob.company_name, o.name),
          'tagline', ob.tagline,
          'logo_url', ob.logo_url,
          'logo_dark_url', ob.logo_dark_url,
          'favicon_url', ob.favicon_url,
          'primary_color', COALESCE(ob.primary_color, '#2563eb'),
          'secondary_color', ob.secondary_color,
          'accent_color', ob.accent_color,
          'email_from_name', ob.email_from_name,
          'email_from_address', ob.email_from_address,
          'email_logo_url', ob.email_logo_url,
          'email_footer_html', ob.email_footer_html,
          'email_primary_color', ob.email_primary_color,
          'remove_powered_by', ob.remove_powered_by,
          'custom_css', ob.custom_css,
          'sso_enabled', ob.sso_enabled,
          'sso_provider', ob.sso_provider
        )
      ELSE
        jsonb_build_object(
          'company_name', o.name,
          'primary_color', '#2563eb'
        )
    END AS branding,
    cd.domain AS primary_domain
  FROM organizations o
  LEFT JOIN organization_branding ob ON ob.organization_id = o.id
  LEFT JOIN custom_domains cd ON cd.organization_id = o.id AND cd.is_primary = true AND cd.verified = true
  WHERE o.id = p_organization_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour obtenir l'organisation par domaine
CREATE OR REPLACE FUNCTION get_organization_by_domain(p_domain VARCHAR)
RETURNS TABLE (
  organization_id UUID,
  organization_slug VARCHAR,
  white_label_level white_label_level
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.id AS organization_id,
    o.slug AS organization_slug,
    o.white_label_level
  FROM organizations o
  INNER JOIN custom_domains cd ON cd.organization_id = o.id
  WHERE cd.domain = p_domain
    AND cd.verified = true
    AND cd.is_active = true
    AND o.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour vérifier si une feature white-label est disponible
CREATE OR REPLACE FUNCTION check_white_label_feature(
  p_organization_id UUID,
  p_feature VARCHAR
) RETURNS BOOLEAN AS $$
DECLARE
  v_level white_label_level;
  v_basic_features VARCHAR[] := ARRAY['custom_logo', 'primary_color', 'company_name', 'custom_email_from', 'custom_email_logo'];
  v_full_features VARCHAR[] := ARRAY['custom_favicon', 'secondary_color', 'accent_color', 'custom_email_footer', 'custom_email_colors', 'branded_login_page', 'remove_powered_by', 'custom_domain'];
  v_premium_features VARCHAR[] := ARRAY['custom_css', 'sso_saml', 'sso_oidc', 'multi_organizations', 'branding_api'];
BEGIN
  -- Récupérer le niveau
  SELECT white_label_level INTO v_level
  FROM organizations
  WHERE id = p_organization_id;

  IF v_level IS NULL THEN
    RETURN false;
  END IF;

  -- Vérifier selon le niveau
  CASE v_level
    WHEN 'none' THEN
      RETURN false;
    WHEN 'basic' THEN
      RETURN p_feature = ANY(v_basic_features);
    WHEN 'full' THEN
      RETURN p_feature = ANY(v_basic_features) OR p_feature = ANY(v_full_features);
    WHEN 'premium' THEN
      RETURN true; -- Toutes les features
    ELSE
      RETURN false;
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- TRIGGERS
-- ============================================

-- Trigger pour updated_at sur organizations
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger pour updated_at sur organization_members
CREATE TRIGGER update_org_members_updated_at
  BEFORE UPDATE ON organization_members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger pour updated_at sur organization_branding
CREATE TRIGGER update_org_branding_updated_at
  BEFORE UPDATE ON organization_branding
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger pour updated_at sur custom_domains
CREATE TRIGGER update_custom_domains_updated_at
  BEFORE UPDATE ON custom_domains
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger pour créer automatiquement le branding quand une organisation est créée
CREATE OR REPLACE FUNCTION create_default_branding()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO organization_branding (organization_id, company_name)
  VALUES (NEW.id, NEW.name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER create_org_branding_on_create
  AFTER INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION create_default_branding();

-- Trigger pour s'assurer qu'il n'y a qu'un seul domaine primaire par organisation
CREATE OR REPLACE FUNCTION ensure_single_primary_domain()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_primary = true THEN
    UPDATE custom_domains
    SET is_primary = false
    WHERE organization_id = NEW.organization_id
      AND id != NEW.id
      AND is_primary = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_single_primary_domain_trigger
  BEFORE INSERT OR UPDATE ON custom_domains
  FOR EACH ROW
  WHEN (NEW.is_primary = true)
  EXECUTE FUNCTION ensure_single_primary_domain();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_branding ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE branding_assets ENABLE ROW LEVEL SECURITY;

-- Policies pour organizations
CREATE POLICY "Users can view their organizations"
  ON organizations FOR SELECT
  USING (
    owner_id = auth.uid()
    OR id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Owners can update their organizations"
  ON organizations FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "Owners can delete their organizations"
  ON organizations FOR DELETE
  USING (owner_id = auth.uid());

CREATE POLICY "Users can create organizations"
  ON organizations FOR INSERT
  WITH CHECK (owner_id = auth.uid());

-- Policies pour organization_members
CREATE POLICY "Members can view their organization members"
  ON organization_members FOR SELECT
  USING (
    organization_id IN (
      SELECT id FROM organizations WHERE owner_id = auth.uid()
    )
    OR organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Org owners can manage members"
  ON organization_members FOR ALL
  USING (
    organization_id IN (
      SELECT id FROM organizations WHERE owner_id = auth.uid()
    )
  );

-- Policies pour organization_branding
CREATE POLICY "Members can view branding"
  ON organization_branding FOR SELECT
  USING (
    organization_id IN (
      SELECT id FROM organizations WHERE owner_id = auth.uid()
    )
    OR organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Org owners/admins can update branding"
  ON organization_branding FOR UPDATE
  USING (
    organization_id IN (
      SELECT id FROM organizations WHERE owner_id = auth.uid()
    )
    OR organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true
    )
  );

-- Policies pour custom_domains
CREATE POLICY "Members can view domains"
  ON custom_domains FOR SELECT
  USING (
    organization_id IN (
      SELECT id FROM organizations WHERE owner_id = auth.uid()
    )
    OR organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Org owners/admins can manage domains"
  ON custom_domains FOR ALL
  USING (
    organization_id IN (
      SELECT id FROM organizations WHERE owner_id = auth.uid()
    )
    OR organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true
    )
  );

-- Policies pour branding_assets
CREATE POLICY "Members can view assets"
  ON branding_assets FOR SELECT
  USING (
    organization_id IN (
      SELECT id FROM organizations WHERE owner_id = auth.uid()
    )
    OR organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Org owners/admins can manage assets"
  ON branding_assets FOR ALL
  USING (
    organization_id IN (
      SELECT id FROM organizations WHERE owner_id = auth.uid()
    )
    OR organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true
    )
  );

-- ============================================
-- AJOUT COLONNE organization_id à profiles
-- ============================================

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_organization ON profiles(organization_id);

-- ============================================
-- STORAGE BUCKET pour les assets
-- ============================================

-- Créer le bucket pour les assets de branding (à exécuter manuellement ou via API)
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('branding-assets', 'branding-assets', true)
-- ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE organizations IS 'Organisations utilisant le white-label';
COMMENT ON TABLE organization_branding IS 'Configuration du branding par organisation';
COMMENT ON TABLE custom_domains IS 'Domaines personnalisés pour le white-label';
COMMENT ON TABLE branding_assets IS 'Assets uploadés (logos, images)';

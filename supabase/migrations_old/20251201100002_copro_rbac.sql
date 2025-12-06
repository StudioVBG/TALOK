-- =====================================================
-- MIGRATION: Système RBAC pour COPRO
-- Description: Rôles, permissions, affectations utilisateurs
-- =====================================================

-- =====================================================
-- TABLE: app_roles (définition des rôles)
-- =====================================================
CREATE TABLE IF NOT EXISTS app_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Identification
  code TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  
  -- Catégorie
  category TEXT DEFAULT 'copro' 
    CHECK (category IN ('platform', 'copro', 'locatif', 'prestataire')),
  
  -- Hiérarchie
  parent_role_code TEXT REFERENCES app_roles(code),
  hierarchy_level INTEGER DEFAULT 0,
  
  -- Système
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_assignable BOOLEAN NOT NULL DEFAULT true,
  
  -- Métadonnées
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_app_roles_code ON app_roles(code);
CREATE INDEX IF NOT EXISTS idx_app_roles_category ON app_roles(category);

-- =====================================================
-- TABLE: app_permissions (définition des permissions)
-- =====================================================
CREATE TABLE IF NOT EXISTS app_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Identification
  code TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  
  -- Catégorie/module
  module TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create', 'read', 'update', 'delete', 'manage', 'admin')),
  
  -- Métadonnées
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_app_permissions_code ON app_permissions(code);
CREATE INDEX IF NOT EXISTS idx_app_permissions_module ON app_permissions(module);

-- =====================================================
-- TABLE: role_permissions (liaison rôle-permission)
-- =====================================================
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role_code TEXT NOT NULL REFERENCES app_roles(code) ON DELETE CASCADE,
  permission_code TEXT NOT NULL REFERENCES app_permissions(code) ON DELETE CASCADE,
  
  -- Conditions
  conditions JSONB DEFAULT '{}', -- Conditions supplémentaires
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(role_code, permission_code)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_code);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON role_permissions(permission_code);

-- =====================================================
-- TABLE: user_roles (affectation utilisateur-rôle)
-- =====================================================
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_code TEXT NOT NULL REFERENCES app_roles(code) ON DELETE CASCADE,
  
  -- Scope (contexte du rôle)
  tenant_id UUID, -- Pour multi-tenant
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE, -- Rôle sur un site spécifique
  unit_id UUID REFERENCES copro_units(id) ON DELETE CASCADE, -- Rôle sur un lot spécifique
  
  -- Validité
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  granted_by UUID REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES auth.users(id),
  
  -- État
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Métadonnées
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Contrainte unique (un rôle par user/scope)
  UNIQUE(user_id, role_code, site_id, unit_id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_code ON user_roles(role_code);
CREATE INDEX IF NOT EXISTS idx_user_roles_site_id ON user_roles(site_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_is_active ON user_roles(is_active);

-- =====================================================
-- SEED: Rôles système
-- =====================================================
INSERT INTO app_roles (code, label, description, category, hierarchy_level, is_system) VALUES
  -- Platform
  ('platform_admin', 'Administrateur plateforme', 'Accès total à la plateforme SaaS', 'platform', 100, true),
  
  -- Copropriété
  ('syndic', 'Syndic', 'Gestionnaire de copropriété (professionnel ou bénévole)', 'copro', 80, true),
  ('conseil_syndical', 'Membre du Conseil Syndical', 'Membre élu du conseil syndical', 'copro', 60, true),
  ('president_cs', 'Président du Conseil Syndical', 'Président du conseil syndical', 'copro', 70, true),
  ('coproprietaire_occupant', 'Copropriétaire Occupant', 'Propriétaire occupant son lot', 'copro', 40, true),
  ('coproprietaire_bailleur', 'Copropriétaire Bailleur', 'Propriétaire louant son lot', 'copro', 40, true),
  ('coproprietaire_nu', 'Nu-propriétaire', 'Nu-propriétaire d''un lot', 'copro', 30, true),
  ('usufruitier', 'Usufruitier', 'Usufruitier d''un lot', 'copro', 30, true),
  
  -- Locatif
  ('locataire', 'Locataire', 'Locataire d''un lot en copropriété', 'locatif', 20, true),
  ('occupant', 'Occupant', 'Occupant d''un lot (colocataire, etc.)', 'locatif', 10, true),
  
  -- Prestataire
  ('prestataire', 'Prestataire', 'Prestataire de services', 'prestataire', 30, true),
  ('gardien', 'Gardien/Concierge', 'Gardien ou concierge de l''immeuble', 'prestataire', 35, true)
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- SEED: Permissions
-- =====================================================
INSERT INTO app_permissions (code, label, module, action, description) VALUES
  -- Platform
  ('platform.admin', 'Administration plateforme', 'platform', 'admin', 'Accès administrateur plateforme'),
  ('platform.users.manage', 'Gestion utilisateurs', 'platform', 'manage', 'Gérer tous les utilisateurs'),
  ('platform.billing.manage', 'Gestion facturation', 'platform', 'manage', 'Gérer la facturation SaaS'),
  
  -- Sites
  ('sites.create', 'Créer un site', 'sites', 'create', 'Créer une nouvelle copropriété'),
  ('sites.read', 'Voir les sites', 'sites', 'read', 'Voir les copropriétés'),
  ('sites.read_own', 'Voir ses sites', 'sites', 'read', 'Voir ses propres copropriétés'),
  ('sites.update', 'Modifier un site', 'sites', 'update', 'Modifier une copropriété'),
  ('sites.delete', 'Supprimer un site', 'sites', 'delete', 'Supprimer une copropriété'),
  ('sites.manage', 'Gérer les sites', 'sites', 'manage', 'Gestion complète des sites'),
  
  -- Buildings/Units
  ('buildings.manage', 'Gérer les bâtiments', 'buildings', 'manage', 'Gestion des bâtiments'),
  ('units.read', 'Voir les lots', 'units', 'read', 'Voir tous les lots'),
  ('units.read_own', 'Voir ses lots', 'units', 'read', 'Voir ses propres lots'),
  ('units.manage', 'Gérer les lots', 'units', 'manage', 'Gestion des lots'),
  ('tantiemes.manage', 'Gérer les tantièmes', 'tantiemes', 'manage', 'Modifier les tantièmes'),
  
  -- Owners
  ('owners.read', 'Voir les propriétaires', 'owners', 'read', 'Voir la liste des copropriétaires'),
  ('owners.manage', 'Gérer les propriétaires', 'owners', 'manage', 'Gestion des copropriétaires'),
  ('owners.invite', 'Inviter des propriétaires', 'owners', 'create', 'Envoyer des invitations'),
  
  -- Charges
  ('charges.read', 'Voir les charges', 'charges', 'read', 'Voir toutes les charges'),
  ('charges.read_own', 'Voir ses charges', 'charges', 'read', 'Voir ses propres charges'),
  ('charges.manage', 'Gérer les charges', 'charges', 'manage', 'Gestion des charges'),
  ('charges.allocate', 'Répartir les charges', 'charges', 'update', 'Répartir les charges entre lots'),
  ('charges.validate', 'Valider les charges', 'charges', 'update', 'Valider la répartition'),
  
  -- Services & Contracts
  ('services.read', 'Voir les services', 'services', 'read', 'Voir les services'),
  ('services.manage', 'Gérer les services', 'services', 'manage', 'Gestion des services'),
  ('contracts.read', 'Voir les contrats', 'contracts', 'read', 'Voir les contrats'),
  ('contracts.manage', 'Gérer les contrats', 'contracts', 'manage', 'Gestion des contrats'),
  ('expenses.create', 'Créer une facture', 'expenses', 'create', 'Saisir une facture'),
  ('expenses.manage', 'Gérer les factures', 'expenses', 'manage', 'Gestion des factures'),
  
  -- Calls for Funds
  ('calls.read', 'Voir les appels', 'calls', 'read', 'Voir les appels de fonds'),
  ('calls.read_own', 'Voir ses appels', 'calls', 'read', 'Voir ses propres appels'),
  ('calls.manage', 'Gérer les appels', 'calls', 'manage', 'Gestion des appels de fonds'),
  ('calls.send', 'Envoyer les appels', 'calls', 'update', 'Envoyer les appels par email'),
  
  -- Payments
  ('payments.read', 'Voir les paiements', 'payments', 'read', 'Voir tous les paiements'),
  ('payments.read_own', 'Voir ses paiements', 'payments', 'read', 'Voir ses propres paiements'),
  ('payments.create', 'Enregistrer un paiement', 'payments', 'create', 'Enregistrer un paiement'),
  ('payments.manage', 'Gérer les paiements', 'payments', 'manage', 'Gestion des paiements'),
  
  -- Assemblies (AG)
  ('assemblies.read', 'Voir les AG', 'assemblies', 'read', 'Voir les assemblées générales'),
  ('assemblies.manage', 'Gérer les AG', 'assemblies', 'manage', 'Gestion des AG'),
  ('assemblies.convoke', 'Convoquer une AG', 'assemblies', 'create', 'Créer et convoquer une AG'),
  ('assemblies.vote', 'Voter en AG', 'assemblies', 'update', 'Participer aux votes'),
  ('assemblies.proxy', 'Donner pouvoir', 'assemblies', 'update', 'Donner ou recevoir un pouvoir'),
  
  -- Documents
  ('documents.read', 'Voir les documents', 'documents', 'read', 'Voir les documents'),
  ('documents.read_own', 'Voir ses documents', 'documents', 'read', 'Voir ses propres documents'),
  ('documents.manage', 'Gérer les documents', 'documents', 'manage', 'Gestion des documents'),
  ('documents.upload', 'Déposer un document', 'documents', 'create', 'Déposer un document'),
  
  -- Tickets
  ('tickets.read', 'Voir les tickets', 'tickets', 'read', 'Voir tous les tickets'),
  ('tickets.read_own', 'Voir ses tickets', 'tickets', 'read', 'Voir ses propres tickets'),
  ('tickets.create', 'Créer un ticket', 'tickets', 'create', 'Créer un signalement'),
  ('tickets.manage', 'Gérer les tickets', 'tickets', 'manage', 'Gestion des tickets'),
  
  -- Locatif (Bridge)
  ('locatif.charges.read', 'Voir charges locatives', 'locatif', 'read', 'Voir les charges récupérables'),
  ('locatif.charges.manage', 'Gérer charges locatives', 'locatif', 'manage', 'Gestion des charges locatives'),
  ('locatif.regularisation', 'Régularisation', 'locatif', 'manage', 'Effectuer les régularisations'),
  
  -- Accounting
  ('accounting.read', 'Voir comptabilité', 'accounting', 'read', 'Voir la comptabilité'),
  ('accounting.manage', 'Gérer comptabilité', 'accounting', 'manage', 'Gestion comptable complète'),
  
  -- Reports
  ('reports.read', 'Voir les rapports', 'reports', 'read', 'Accéder aux rapports'),
  ('reports.export', 'Exporter', 'reports', 'read', 'Exporter les données')
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- SEED: Attribution permissions aux rôles
-- =====================================================

-- Platform Admin: Toutes les permissions
INSERT INTO role_permissions (role_code, permission_code)
SELECT 'platform_admin', code FROM app_permissions
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- Syndic: Gestion complète du site
INSERT INTO role_permissions (role_code, permission_code) VALUES
  ('syndic', 'sites.read'),
  ('syndic', 'sites.update'),
  ('syndic', 'sites.manage'),
  ('syndic', 'buildings.manage'),
  ('syndic', 'units.read'),
  ('syndic', 'units.manage'),
  ('syndic', 'tantiemes.manage'),
  ('syndic', 'owners.read'),
  ('syndic', 'owners.manage'),
  ('syndic', 'owners.invite'),
  ('syndic', 'charges.read'),
  ('syndic', 'charges.manage'),
  ('syndic', 'charges.allocate'),
  ('syndic', 'charges.validate'),
  ('syndic', 'services.read'),
  ('syndic', 'services.manage'),
  ('syndic', 'contracts.read'),
  ('syndic', 'contracts.manage'),
  ('syndic', 'expenses.create'),
  ('syndic', 'expenses.manage'),
  ('syndic', 'calls.read'),
  ('syndic', 'calls.manage'),
  ('syndic', 'calls.send'),
  ('syndic', 'payments.read'),
  ('syndic', 'payments.create'),
  ('syndic', 'payments.manage'),
  ('syndic', 'assemblies.read'),
  ('syndic', 'assemblies.manage'),
  ('syndic', 'assemblies.convoke'),
  ('syndic', 'documents.read'),
  ('syndic', 'documents.manage'),
  ('syndic', 'documents.upload'),
  ('syndic', 'tickets.read'),
  ('syndic', 'tickets.manage'),
  ('syndic', 'accounting.read'),
  ('syndic', 'accounting.manage'),
  ('syndic', 'reports.read'),
  ('syndic', 'reports.export')
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- Conseil Syndical: Lecture avancée + vote
INSERT INTO role_permissions (role_code, permission_code) VALUES
  ('conseil_syndical', 'sites.read'),
  ('conseil_syndical', 'units.read'),
  ('conseil_syndical', 'owners.read'),
  ('conseil_syndical', 'charges.read'),
  ('conseil_syndical', 'services.read'),
  ('conseil_syndical', 'contracts.read'),
  ('conseil_syndical', 'calls.read'),
  ('conseil_syndical', 'payments.read'),
  ('conseil_syndical', 'assemblies.read'),
  ('conseil_syndical', 'assemblies.vote'),
  ('conseil_syndical', 'assemblies.proxy'),
  ('conseil_syndical', 'documents.read'),
  ('conseil_syndical', 'tickets.read'),
  ('conseil_syndical', 'tickets.create'),
  ('conseil_syndical', 'accounting.read'),
  ('conseil_syndical', 'reports.read')
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- Président CS: Conseil Syndical + pouvoirs supplémentaires
INSERT INTO role_permissions (role_code, permission_code) VALUES
  ('president_cs', 'sites.read'),
  ('president_cs', 'units.read'),
  ('president_cs', 'owners.read'),
  ('president_cs', 'charges.read'),
  ('president_cs', 'charges.validate'),
  ('president_cs', 'services.read'),
  ('president_cs', 'contracts.read'),
  ('president_cs', 'calls.read'),
  ('president_cs', 'payments.read'),
  ('president_cs', 'assemblies.read'),
  ('president_cs', 'assemblies.vote'),
  ('president_cs', 'assemblies.proxy'),
  ('president_cs', 'documents.read'),
  ('president_cs', 'documents.upload'),
  ('president_cs', 'tickets.read'),
  ('president_cs', 'tickets.create'),
  ('president_cs', 'accounting.read'),
  ('president_cs', 'reports.read'),
  ('president_cs', 'reports.export')
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- Copropriétaire Occupant
INSERT INTO role_permissions (role_code, permission_code) VALUES
  ('coproprietaire_occupant', 'sites.read_own'),
  ('coproprietaire_occupant', 'units.read_own'),
  ('coproprietaire_occupant', 'charges.read_own'),
  ('coproprietaire_occupant', 'calls.read_own'),
  ('coproprietaire_occupant', 'payments.read_own'),
  ('coproprietaire_occupant', 'payments.create'),
  ('coproprietaire_occupant', 'assemblies.read'),
  ('coproprietaire_occupant', 'assemblies.vote'),
  ('coproprietaire_occupant', 'assemblies.proxy'),
  ('coproprietaire_occupant', 'documents.read_own'),
  ('coproprietaire_occupant', 'tickets.read_own'),
  ('coproprietaire_occupant', 'tickets.create')
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- Copropriétaire Bailleur: Occupant + gestion locative
INSERT INTO role_permissions (role_code, permission_code) VALUES
  ('coproprietaire_bailleur', 'sites.read_own'),
  ('coproprietaire_bailleur', 'units.read_own'),
  ('coproprietaire_bailleur', 'charges.read_own'),
  ('coproprietaire_bailleur', 'calls.read_own'),
  ('coproprietaire_bailleur', 'payments.read_own'),
  ('coproprietaire_bailleur', 'payments.create'),
  ('coproprietaire_bailleur', 'assemblies.read'),
  ('coproprietaire_bailleur', 'assemblies.vote'),
  ('coproprietaire_bailleur', 'assemblies.proxy'),
  ('coproprietaire_bailleur', 'documents.read_own'),
  ('coproprietaire_bailleur', 'tickets.read_own'),
  ('coproprietaire_bailleur', 'tickets.create'),
  ('coproprietaire_bailleur', 'locatif.charges.read'),
  ('coproprietaire_bailleur', 'locatif.charges.manage'),
  ('coproprietaire_bailleur', 'locatif.regularisation')
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- Locataire
INSERT INTO role_permissions (role_code, permission_code) VALUES
  ('locataire', 'sites.read_own'),
  ('locataire', 'charges.read_own'),
  ('locataire', 'documents.read_own'),
  ('locataire', 'tickets.read_own'),
  ('locataire', 'tickets.create'),
  ('locataire', 'locatif.charges.read')
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- Prestataire
INSERT INTO role_permissions (role_code, permission_code) VALUES
  ('prestataire', 'tickets.read'),
  ('prestataire', 'documents.upload')
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- Gardien
INSERT INTO role_permissions (role_code, permission_code) VALUES
  ('gardien', 'sites.read_own'),
  ('gardien', 'units.read'),
  ('gardien', 'owners.read'),
  ('gardien', 'tickets.read'),
  ('gardien', 'tickets.create'),
  ('gardien', 'tickets.manage'),
  ('gardien', 'documents.read'),
  ('gardien', 'documents.upload')
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- =====================================================
-- VIEWS: Vues pour faciliter les requêtes RBAC
-- =====================================================

-- Vue: Rôles utilisateur avec détails
CREATE OR REPLACE VIEW v_user_roles_detailed AS
SELECT 
  ur.id,
  ur.user_id,
  ur.role_code,
  ar.label as role_label,
  ar.category as role_category,
  ar.hierarchy_level,
  ur.site_id,
  s.name as site_name,
  ur.unit_id,
  cu.lot_number,
  ur.is_active,
  ur.granted_at,
  ur.expires_at
FROM user_roles ur
JOIN app_roles ar ON ar.code = ur.role_code
LEFT JOIN sites s ON s.id = ur.site_id
LEFT JOIN copro_units cu ON cu.id = ur.unit_id
WHERE ur.is_active = true
  AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
  AND ur.revoked_at IS NULL;

-- Vue: Permissions utilisateur effectives
CREATE OR REPLACE VIEW v_user_permissions AS
SELECT DISTINCT
  ur.user_id,
  ur.site_id,
  ur.unit_id,
  ap.code as permission_code,
  ap.module,
  ap.action,
  ap.label as permission_label
FROM user_roles ur
JOIN role_permissions rp ON rp.role_code = ur.role_code
JOIN app_permissions ap ON ap.code = rp.permission_code
WHERE ur.is_active = true
  AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
  AND ur.revoked_at IS NULL;

-- =====================================================
-- FUNCTIONS: Helpers RBAC pour RLS
-- =====================================================

-- Fonction: Vérifier si l'utilisateur a un rôle
CREATE OR REPLACE FUNCTION has_role(p_role_code TEXT, p_site_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role_code = p_role_code
      AND ur.is_active = true
      AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
      AND ur.revoked_at IS NULL
      AND (p_site_id IS NULL OR ur.site_id IS NULL OR ur.site_id = p_site_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Fonction: Vérifier si l'utilisateur a une permission
CREATE OR REPLACE FUNCTION has_permission(p_permission_code TEXT, p_site_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM v_user_permissions vup
    WHERE vup.user_id = auth.uid()
      AND vup.permission_code = p_permission_code
      AND (p_site_id IS NULL OR vup.site_id IS NULL OR vup.site_id = p_site_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Fonction: Obtenir les IDs de sites accessibles
CREATE OR REPLACE FUNCTION accessible_site_ids()
RETURNS SETOF UUID AS $$
BEGIN
  -- Platform admin: tous les sites
  IF has_role('platform_admin') THEN
    RETURN QUERY SELECT id FROM sites WHERE is_active = true;
    RETURN;
  END IF;
  
  -- Autres: sites où l'utilisateur a un rôle
  RETURN QUERY
  SELECT DISTINCT ur.site_id 
  FROM user_roles ur
  WHERE ur.user_id = auth.uid()
    AND ur.site_id IS NOT NULL
    AND ur.is_active = true
    AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
    AND ur.revoked_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Fonction: Obtenir les IDs de lots possédés
CREATE OR REPLACE FUNCTION owned_unit_ids()
RETURNS SETOF UUID AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT o.unit_id 
  FROM ownerships o
  JOIN profiles p ON p.id = o.profile_id
  WHERE p.user_id = auth.uid()
    AND o.is_current = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Fonction: Vérifier si l'utilisateur est propriétaire d'un lot
CREATE OR REPLACE FUNCTION is_owner_of_unit(p_unit_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM ownerships o
    JOIN profiles p ON p.id = o.profile_id
    WHERE o.unit_id = p_unit_id
      AND p.user_id = auth.uid()
      AND o.is_current = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Fonction: Vérifier si l'utilisateur est syndic d'un site
CREATE OR REPLACE FUNCTION is_syndic_of(p_site_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN has_role('syndic', p_site_id) OR has_role('platform_admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Fonction: Obtenir le rôle le plus élevé de l'utilisateur
CREATE OR REPLACE FUNCTION get_highest_role()
RETURNS TEXT AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT ur.role_code INTO v_role
  FROM user_roles ur
  JOIN app_roles ar ON ar.code = ur.role_code
  WHERE ur.user_id = auth.uid()
    AND ur.is_active = true
    AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
    AND ur.revoked_at IS NULL
  ORDER BY ar.hierarchy_level DESC
  LIMIT 1;
  
  RETURN v_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Fonction: Attribuer un rôle à un utilisateur
CREATE OR REPLACE FUNCTION assign_role(
  p_user_id UUID,
  p_role_code TEXT,
  p_site_id UUID DEFAULT NULL,
  p_unit_id UUID DEFAULT NULL,
  p_granted_by UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_new_id UUID;
BEGIN
  INSERT INTO user_roles (user_id, role_code, site_id, unit_id, granted_by)
  VALUES (p_user_id, p_role_code, p_site_id, p_unit_id, COALESCE(p_granted_by, auth.uid()))
  ON CONFLICT (user_id, role_code, site_id, unit_id) 
  DO UPDATE SET 
    is_active = true,
    revoked_at = NULL,
    revoked_by = NULL,
    updated_at = NOW()
  RETURNING id INTO v_new_id;
  
  RETURN v_new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction: Révoquer un rôle
CREATE OR REPLACE FUNCTION revoke_role(
  p_user_id UUID,
  p_role_code TEXT,
  p_site_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE user_roles
  SET 
    is_active = false,
    revoked_at = NOW(),
    revoked_by = auth.uid(),
    updated_at = NOW()
  WHERE user_id = p_user_id
    AND role_code = p_role_code
    AND (p_site_id IS NULL OR site_id = p_site_id)
    AND is_active = true;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE app_roles IS 'Définition des rôles applicatifs';
COMMENT ON TABLE app_permissions IS 'Définition des permissions granulaires';
COMMENT ON TABLE role_permissions IS 'Association rôle-permission';
COMMENT ON TABLE user_roles IS 'Attribution des rôles aux utilisateurs avec scope';

COMMENT ON FUNCTION has_role IS 'Vérifie si l''utilisateur courant a un rôle donné';
COMMENT ON FUNCTION has_permission IS 'Vérifie si l''utilisateur courant a une permission donnée';
COMMENT ON FUNCTION accessible_site_ids IS 'Retourne les IDs de sites accessibles par l''utilisateur';
COMMENT ON FUNCTION owned_unit_ids IS 'Retourne les IDs de lots possédés par l''utilisateur';


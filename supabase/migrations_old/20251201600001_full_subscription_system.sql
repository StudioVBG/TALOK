-- Migration consolidée : Système complet de forfaits et tarification
-- Date: 2025-12-01
-- Description: Crée toutes les tables nécessaires pour la gestion des plans admin

BEGIN;

-- ============================================
-- VÉRIFIER SI subscription_plans EXISTE, SINON CRÉER
-- ============================================
CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  
  -- Tarification (en centimes)
  price_monthly INTEGER NOT NULL DEFAULT 0,
  price_yearly INTEGER NOT NULL DEFAULT 0,
  
  -- Limites
  max_properties INTEGER NOT NULL DEFAULT 1,
  max_leases INTEGER NOT NULL DEFAULT 3,
  max_tenants INTEGER NOT NULL DEFAULT 5,
  max_documents_gb NUMERIC(10,2) NOT NULL DEFAULT 1,
  
  -- Features JSON
  features JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Stripe IDs
  stripe_product_id TEXT,
  stripe_price_monthly_id TEXT,
  stripe_price_yearly_id TEXT,
  
  -- Statut
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_popular BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  
  -- Colonnes étendues
  extra_property_price INTEGER DEFAULT 0,
  included_properties INTEGER DEFAULT 0,
  billing_type TEXT DEFAULT 'fixed' CHECK (billing_type IN ('fixed', 'per_unit', 'tiered')),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_plans_slug ON subscription_plans(slug);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_active ON subscription_plans(is_active);

-- ============================================
-- TABLE DES ABONNEMENTS (SI N'EXISTE PAS)
-- ============================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),
  
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  
  status TEXT NOT NULL DEFAULT 'trialing' 
    CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused', 'incomplete')),
  
  billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly')),
  
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  trial_start TIMESTAMPTZ DEFAULT NOW(),
  trial_end TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),
  canceled_at TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  
  properties_count INTEGER NOT NULL DEFAULT 0,
  leases_count INTEGER NOT NULL DEFAULT 0,
  tenants_count INTEGER NOT NULL DEFAULT 0,
  documents_size_mb NUMERIC(10,2) NOT NULL DEFAULT 0,
  
  -- Grandfathering
  grandfathered_until TIMESTAMPTZ,
  locked_price_monthly INTEGER,
  locked_price_yearly INTEGER,
  price_change_notified_at TIMESTAMPTZ,
  price_change_accepted BOOLEAN DEFAULT NULL,
  
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(owner_id)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_owner ON subscriptions(owner_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- ============================================
-- TABLE DES ADD-ONS
-- ============================================
CREATE TABLE IF NOT EXISTS subscription_addons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  
  price_monthly INTEGER NOT NULL DEFAULT 0,
  price_yearly INTEGER NOT NULL DEFAULT 0,
  
  features JSONB NOT NULL DEFAULT '{}'::jsonb,
  compatible_plans TEXT[] NOT NULL DEFAULT '{}',
  
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  
  stripe_product_id TEXT,
  stripe_price_monthly_id TEXT,
  stripe_price_yearly_id TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_addons_slug ON subscription_addons(slug);
CREATE INDEX IF NOT EXISTS idx_subscription_addons_active ON subscription_addons(is_active);

-- ============================================
-- TABLE DES ADD-ONS SOUSCRITS
-- ============================================
CREATE TABLE IF NOT EXISTS subscription_addon_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  addon_id UUID NOT NULL REFERENCES subscription_addons(id) ON DELETE CASCADE,
  
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due')),
  
  stripe_subscription_item_id TEXT,
  
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  canceled_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(subscription_id, addon_id)
);

CREATE INDEX IF NOT EXISTS idx_addon_subs_subscription ON subscription_addon_subscriptions(subscription_id);
CREATE INDEX IF NOT EXISTS idx_addon_subs_addon ON subscription_addon_subscriptions(addon_id);

-- ============================================
-- HISTORIQUE DES MODIFICATIONS DE PLANS
-- ============================================
CREATE TABLE IF NOT EXISTS plan_pricing_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,
  
  old_price_monthly INTEGER NOT NULL,
  old_price_yearly INTEGER NOT NULL,
  old_features JSONB,
  old_limits JSONB,
  
  new_price_monthly INTEGER NOT NULL,
  new_price_yearly INTEGER NOT NULL,
  new_features JSONB,
  new_limits JSONB,
  
  change_reason TEXT NOT NULL,
  effective_date TIMESTAMPTZ NOT NULL,
  notification_sent_at TIMESTAMPTZ,
  affected_subscribers_count INTEGER DEFAULT 0,
  
  changed_by UUID REFERENCES profiles(id),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plan_history_plan ON plan_pricing_history(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_history_effective ON plan_pricing_history(effective_date);

-- ============================================
-- RLS POLICIES
-- ============================================
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_addon_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_pricing_history ENABLE ROW LEVEL SECURITY;

-- Plans visibles par tous les authentifiés
DROP POLICY IF EXISTS "Plans visible by all authenticated" ON subscription_plans;
CREATE POLICY "Plans visible by all authenticated" ON subscription_plans 
  FOR SELECT TO authenticated USING (is_active = true);

-- Admins peuvent tout gérer sur les plans
DROP POLICY IF EXISTS "Admins can manage plans" ON subscription_plans;
CREATE POLICY "Admins can manage plans" ON subscription_plans
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'));

-- Abonnements visibles uniquement par le propriétaire
DROP POLICY IF EXISTS "Owners can view their subscription" ON subscriptions;
CREATE POLICY "Owners can view their subscription" ON subscriptions 
  FOR SELECT TO authenticated
  USING (owner_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Admins peuvent tout voir sur les abonnements
DROP POLICY IF EXISTS "Admins can view all subscriptions" ON subscriptions;
CREATE POLICY "Admins can view all subscriptions" ON subscriptions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'));

-- Add-ons visibles par tous les authentifiés
DROP POLICY IF EXISTS "Addons visible by all authenticated" ON subscription_addons;
CREATE POLICY "Addons visible by all authenticated" ON subscription_addons 
  FOR SELECT TO authenticated USING (is_active = true);

-- Admins peuvent tout gérer sur les add-ons
DROP POLICY IF EXISTS "Admins can manage addons" ON subscription_addons;
CREATE POLICY "Admins can manage addons" ON subscription_addons
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'));

-- Utilisateurs voient leurs add-ons souscrits
DROP POLICY IF EXISTS "Users can view their addon subscriptions" ON subscription_addon_subscriptions;
CREATE POLICY "Users can view their addon subscriptions" ON subscription_addon_subscriptions
  FOR SELECT TO authenticated
  USING (
    subscription_id IN (
      SELECT id FROM subscriptions 
      WHERE owner_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- Admins peuvent tout voir sur les add-on subscriptions
DROP POLICY IF EXISTS "Admins can manage addon subscriptions" ON subscription_addon_subscriptions;
CREATE POLICY "Admins can manage addon subscriptions" ON subscription_addon_subscriptions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'));

-- Admins peuvent gérer l'historique des prix
DROP POLICY IF EXISTS "Admins can manage pricing history" ON plan_pricing_history;
CREATE POLICY "Admins can manage pricing history" ON plan_pricing_history
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'));

-- ============================================
-- INSÉRER LES PLANS PAR DÉFAUT
-- ============================================
INSERT INTO subscription_plans (
  name, slug, description, 
  price_monthly, price_yearly, 
  max_properties, max_leases, max_tenants, max_documents_gb,
  included_properties, extra_property_price, billing_type,
  features, is_active, is_popular, display_order
) VALUES
-- PLAN SOLO - 19€/mois
(
  'Solo',
  'solo',
  'Idéal pour gérer jusqu''à 3 biens en toute simplicité',
  1900, 19000,
  3, 10, 15, 2,
  3, 0, 'fixed',
  '{"signatures": false, "signatures_monthly_quota": 0, "open_banking": false, "auto_reminders": false, "tenant_portal": "basic", "colocation": false, "work_orders": false, "export_csv": true, "storage_gb": 2}'::jsonb,
  true, false, 1
),
-- PLAN CONFORT - 39€/mois ⭐ POPULAIRE
(
  'Confort',
  'confort',
  'Pour les propriétaires actifs avec Open Banking et automatisations',
  3900, 39000,
  15, 50, 75, 10,
  15, 0, 'fixed',
  '{"signatures": true, "signatures_monthly_quota": 10, "open_banking": true, "bank_reconciliation": true, "auto_reminders": true, "tenant_portal": "advanced", "lease_generation": true, "colocation": true, "work_orders": true, "priority_support": true, "export_csv": true, "export_excel": true, "storage_gb": 10}'::jsonb,
  true, true, 2
),
-- PLAN PRO / AGENCE - 89€/mois + 1€/lot
(
  'Pro / Agence',
  'pro',
  '50 biens inclus, équipe multi-utilisateurs, rapports avancés',
  8900, 89000,
  -1, 500, 1000, 50,
  50, 100, 'per_unit',
  '{"signatures": true, "signatures_monthly_quota": -1, "open_banking": true, "bank_reconciliation": true, "auto_reminders": true, "auto_reminders_sms": true, "tenant_portal": "advanced", "tenant_payment_online": true, "lease_generation": true, "colocation": true, "multi_units": true, "multi_users": true, "max_users": 10, "roles_permissions": true, "work_orders": true, "work_orders_planning": true, "providers_management": true, "owner_reports": true, "channel_manager": "basic", "api_access": true, "onboarding": true, "data_import": true, "export_csv": true, "export_excel": true, "export_accounting": true, "storage_gb": 50, "scoring_ia": true}'::jsonb,
  true, false, 3
),
-- PLAN ENTERPRISE - Sur devis (à partir de 299€)
(
  'Enterprise',
  'enterprise',
  'Solution sur mesure : white label, API complète, SLA dédié',
  29900, 299000,
  -1, -1, -1, -1,
  500, 0, 'fixed',
  '{"signatures": true, "signatures_monthly_quota": -1, "open_banking": true, "bank_reconciliation": true, "auto_reminders": true, "auto_reminders_sms": true, "tenant_portal": "whitelabel", "tenant_payment_online": true, "lease_generation": true, "colocation": true, "multi_units": true, "multi_users": true, "max_users": -1, "roles_permissions": true, "work_orders": true, "work_orders_planning": true, "providers_management": true, "owner_reports": true, "channel_manager": "full", "api_access": true, "webhooks": true, "white_label": true, "sso": true, "custom_sla": true, "priority_support": true, "support_phone": true, "onboarding": true, "data_import": true, "account_manager": true, "export_csv": true, "export_excel": true, "export_accounting": true, "storage_gb": -1, "scoring_ia": true}'::jsonb,
  true, false, 4
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  max_properties = EXCLUDED.max_properties,
  max_leases = EXCLUDED.max_leases,
  max_tenants = EXCLUDED.max_tenants,
  max_documents_gb = EXCLUDED.max_documents_gb,
  included_properties = EXCLUDED.included_properties,
  extra_property_price = EXCLUDED.extra_property_price,
  billing_type = EXCLUDED.billing_type,
  features = EXCLUDED.features,
  is_popular = EXCLUDED.is_popular,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- ============================================
-- INSÉRER LES ADD-ONS PAR DÉFAUT
-- ============================================
INSERT INTO subscription_addons (
  name, slug, description,
  price_monthly, price_yearly,
  features, compatible_plans,
  is_active, display_order
) VALUES
-- Channel Manager Avancé
(
  '🏨 Channel Manager Avancé',
  'channel-manager',
  'Sync Airbnb, Booking, Abritel • Création annonces • Prix dynamiques • Messages centralisés',
  2900, 29000,
  '{"channel_manager": "full", "airbnb_sync": true, "booking_sync": true, "abritel_sync": true}'::jsonb,
  ARRAY['confort', 'pro'],
  true, 1
),
-- Copropriété Light
(
  '🏢 Copropriété Light',
  'copro',
  'Charges communes • Appels de fonds • Tantièmes • Documents AG • Jusqu''à 20 lots',
  1900, 19000,
  '{"copro_charges": true, "copro_calls": true, "copro_tantiemes": true, "copro_documents": true, "copro_max_lots": 20}'::jsonb,
  ARRAY['confort', 'pro', 'enterprise'],
  true, 2
),
-- Open Banking Premium
(
  '🏦 Open Banking Premium',
  'open-banking-premium',
  'Multi-comptes bancaires • Règles auto avancées • Rapports consolidés',
  900, 9000,
  '{"open_banking_level": "premium", "multi_bank_accounts": true, "unlimited_accounts": true}'::jsonb,
  ARRAY['confort'],
  true, 3
),
-- Scoring IA Locataire
(
  '📊 Scoring IA Locataire',
  'scoring-ia',
  'Score de solvabilité • Analyse pièces • Détection anomalies • 50 analyses/mois',
  1500, 15000,
  '{"scoring_ia": true, "solvency_score": true, "document_analysis": true, "monthly_analyses": 50}'::jsonb,
  ARRAY['confort', 'pro'],
  true, 4
),
-- Signatures Illimitées
(
  '✍️ Signatures Illimitées',
  'unlimited-signatures',
  'E-signatures illimitées via Yousign (au lieu de 10/mois) • Modèles avancés',
  1200, 12000,
  '{"signatures_monthly_quota": -1, "signatures_unlimited": true, "bulk_signing": true}'::jsonb,
  ARRAY['confort'],
  true, 5
),
-- Support Premium
(
  '🎧 Support Premium',
  'support-premium',
  'Support téléphonique • Réponse 4h • Onboarding • Aide import données',
  1900, 19000,
  '{"support_phone": true, "response_4h": true, "onboarding": true, "data_import": true}'::jsonb,
  ARRAY['solo', 'confort'],
  true, 6
),
-- Pack États des Lieux
(
  '📋 Pack États des Lieux',
  'edl-pack',
  'EDL numériques interactifs • Photos annotées • Comparatif entrée/sortie',
  900, 9000,
  '{"edl_digital": true, "edl_photos": true, "edl_annotations": true, "edl_comparison": true}'::jsonb,
  ARRAY['solo', 'confort'],
  true, 7
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  features = EXCLUDED.features,
  compatible_plans = EXCLUDED.compatible_plans,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

COMMIT;


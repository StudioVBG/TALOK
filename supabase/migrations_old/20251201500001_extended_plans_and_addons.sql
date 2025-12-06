-- Migration: Système étendu de forfaits et add-ons
-- Date: 2024-12-01
-- Description: Nouveaux plans (Solo, Confort, Pro, Enterprise), add-ons et features étendues

BEGIN;

-- ============================================
-- TABLE DES ADD-ONS
-- ============================================
CREATE TABLE IF NOT EXISTS subscription_addons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  
  -- Tarification (en centimes)
  price_monthly INTEGER NOT NULL DEFAULT 0,
  price_yearly INTEGER NOT NULL DEFAULT 0,
  
  -- Features débloquées par cet add-on (JSONB)
  features JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Plans compatibles
  compatible_plans TEXT[] NOT NULL DEFAULT '{}',
  
  -- Statut
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  
  -- Stripe
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
  
  -- Statut
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due')),
  
  -- Stripe
  stripe_subscription_item_id TEXT,
  
  -- Dates
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  canceled_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  
  -- Métadonnées
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(subscription_id, addon_id)
);

CREATE INDEX IF NOT EXISTS idx_addon_subs_subscription ON subscription_addon_subscriptions(subscription_id);
CREATE INDEX IF NOT EXISTS idx_addon_subs_addon ON subscription_addon_subscriptions(addon_id);
CREATE INDEX IF NOT EXISTS idx_addon_subs_status ON subscription_addon_subscriptions(status);

-- ============================================
-- AJOUT COLONNES SUR SUBSCRIPTION_PLANS
-- ============================================
DO $$
BEGIN
  -- Coût par lot supplémentaire (pour le plan Pro)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'subscription_plans' AND column_name = 'extra_property_price') THEN
    ALTER TABLE subscription_plans ADD COLUMN extra_property_price INTEGER DEFAULT 0;
  END IF;
  
  -- Nombre de lots inclus de base
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'subscription_plans' AND column_name = 'included_properties') THEN
    ALTER TABLE subscription_plans ADD COLUMN included_properties INTEGER DEFAULT 0;
  END IF;
  
  -- Type de facturation pour lots supplémentaires
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'subscription_plans' AND column_name = 'billing_type') THEN
    ALTER TABLE subscription_plans ADD COLUMN billing_type TEXT DEFAULT 'fixed' CHECK (billing_type IN ('fixed', 'per_unit', 'tiered'));
  END IF;
END $$;

-- ============================================
-- MISE À JOUR DES PLANS EXISTANTS
-- ============================================

-- Supprimer les anciens plans pour les remplacer
DELETE FROM subscription_plans WHERE slug IN ('free', 'starter', 'pro', 'business', 'enterprise', 'solo', 'confort');

-- ============================================
-- PLAN SOLO - 19€/mois
-- Cible: Particulier avec 1-3 biens
-- ============================================
INSERT INTO subscription_plans (
  name, slug, description, 
  price_monthly, price_yearly, 
  max_properties, max_leases, max_tenants, max_documents_gb,
  included_properties, extra_property_price, billing_type,
  features, is_active, is_popular, display_order
) VALUES (
  'Solo',
  'solo',
  'Idéal pour gérer jusqu''à 3 biens en toute simplicité',
  1900, 19000,  -- 19€/mois, 190€/an (≈16€/mois)
  3, 10, 15, 2,
  3, 0, 'fixed',
  '{
    "signatures": false,
    "signatures_monthly_quota": 0,
    "open_banking": false,
    "open_banking_level": "none",
    "bank_reconciliation": false,
    "auto_reminders": false,
    "auto_reminders_sms": false,
    "irl_revision": false,
    "alerts_deadlines": false,
    "tenant_portal": "basic",
    "tenant_payment_online": false,
    "lease_generation": false,
    "lease_templates": "basic",
    "colocation": false,
    "multi_units": false,
    "multi_users": false,
    "max_users": 1,
    "roles_permissions": false,
    "activity_log": false,
    "work_orders": false,
    "work_orders_planning": false,
    "providers_management": false,
    "owner_reports": false,
    "multi_mandants": false,
    "channel_manager": "none",
    "api_access": false,
    "api_access_level": "none",
    "webhooks": false,
    "white_label": false,
    "sso": false,
    "custom_sla": false,
    "priority_support": false,
    "support_phone": false,
    "onboarding": false,
    "data_import": false,
    "account_manager": false,
    "export_csv": true,
    "export_excel": false,
    "export_accounting": false,
    "storage_gb": 2,
    "email_templates": false,
    "deposit_tracking": false,
    "edl_digital": false,
    "attestations": false,
    "ocr_documents": false,
    "scoring_ia": false
  }'::jsonb,
  true, false, 1
);

-- ============================================
-- PLAN CONFORT - 39€/mois ⭐ POPULAIRE
-- Cible: Multi-propriétaire, petite SCI
-- ============================================
INSERT INTO subscription_plans (
  name, slug, description, 
  price_monthly, price_yearly, 
  max_properties, max_leases, max_tenants, max_documents_gb,
  included_properties, extra_property_price, billing_type,
  features, is_active, is_popular, display_order
) VALUES (
  'Confort',
  'confort',
  'Pour les propriétaires actifs avec Open Banking et automatisations',
  3900, 39000,  -- 39€/mois, 390€/an (≈32€/mois)
  15, 50, 75, 10,
  15, 0, 'fixed',
  '{
    "signatures": true,
    "signatures_monthly_quota": 10,
    "open_banking": true,
    "open_banking_level": "basic",
    "bank_reconciliation": true,
    "auto_reminders": true,
    "auto_reminders_sms": false,
    "irl_revision": true,
    "alerts_deadlines": true,
    "tenant_portal": "advanced",
    "tenant_payment_online": false,
    "lease_generation": true,
    "lease_templates": "full",
    "colocation": true,
    "multi_units": false,
    "multi_users": false,
    "max_users": 1,
    "roles_permissions": false,
    "activity_log": false,
    "work_orders": true,
    "work_orders_planning": false,
    "providers_management": false,
    "owner_reports": false,
    "multi_mandants": false,
    "channel_manager": "none",
    "api_access": false,
    "api_access_level": "none",
    "webhooks": false,
    "white_label": false,
    "sso": false,
    "custom_sla": false,
    "priority_support": true,
    "support_phone": false,
    "onboarding": false,
    "data_import": false,
    "account_manager": false,
    "export_csv": true,
    "export_excel": true,
    "export_accounting": false,
    "storage_gb": 10,
    "email_templates": true,
    "deposit_tracking": true,
    "edl_digital": false,
    "attestations": true,
    "ocr_documents": false,
    "scoring_ia": false
  }'::jsonb,
  true, true, 2
);

-- ============================================
-- PLAN PRO / AGENCE - 89€/mois + 1€/lot
-- Cible: Agences, SCI importantes, conciergeries
-- ============================================
INSERT INTO subscription_plans (
  name, slug, description, 
  price_monthly, price_yearly, 
  max_properties, max_leases, max_tenants, max_documents_gb,
  included_properties, extra_property_price, billing_type,
  features, is_active, is_popular, display_order
) VALUES (
  'Pro / Agence',
  'pro',
  '50 biens inclus, équipe multi-utilisateurs, rapports avancés',
  8900, 89000,  -- 89€/mois, 890€/an (≈74€/mois)
  -1, 500, 1000, 50,  -- max_properties -1 = géré par billing_type
  50, 100, 'per_unit',  -- 50 inclus, puis 1€/lot (100 centimes)
  '{
    "signatures": true,
    "signatures_monthly_quota": -1,
    "open_banking": true,
    "open_banking_level": "advanced",
    "bank_reconciliation": true,
    "auto_reminders": true,
    "auto_reminders_sms": true,
    "irl_revision": true,
    "alerts_deadlines": true,
    "tenant_portal": "advanced",
    "tenant_payment_online": true,
    "lease_generation": true,
    "lease_templates": "full",
    "colocation": true,
    "multi_units": true,
    "multi_users": true,
    "max_users": 10,
    "roles_permissions": true,
    "activity_log": true,
    "work_orders": true,
    "work_orders_planning": true,
    "providers_management": true,
    "owner_reports": true,
    "multi_mandants": true,
    "channel_manager": "basic",
    "api_access": true,
    "api_access_level": "basic",
    "webhooks": false,
    "white_label": false,
    "sso": false,
    "custom_sla": false,
    "priority_support": true,
    "support_phone": false,
    "onboarding": true,
    "data_import": true,
    "account_manager": false,
    "export_csv": true,
    "export_excel": true,
    "export_accounting": true,
    "storage_gb": 50,
    "email_templates": true,
    "deposit_tracking": true,
    "edl_digital": true,
    "attestations": true,
    "ocr_documents": true,
    "scoring_ia": true
  }'::jsonb,
  true, false, 3
);

-- ============================================
-- PLAN ENTERPRISE - Sur devis (à partir de 299€)
-- Cible: Grands comptes, réseaux d'agences, > 500 lots
-- ============================================
INSERT INTO subscription_plans (
  name, slug, description, 
  price_monthly, price_yearly, 
  max_properties, max_leases, max_tenants, max_documents_gb,
  included_properties, extra_property_price, billing_type,
  features, is_active, is_popular, display_order
) VALUES (
  'Enterprise',
  'enterprise',
  'Solution sur mesure : white label, API complète, SLA dédié',
  29900, 299000,  -- 299€/mois minimum, sur devis
  -1, -1, -1, -1,  -- Tout illimité
  500, 0, 'fixed',
  '{
    "signatures": true,
    "signatures_monthly_quota": -1,
    "open_banking": true,
    "open_banking_level": "advanced",
    "bank_reconciliation": true,
    "auto_reminders": true,
    "auto_reminders_sms": true,
    "irl_revision": true,
    "alerts_deadlines": true,
    "tenant_portal": "whitelabel",
    "tenant_payment_online": true,
    "lease_generation": true,
    "lease_templates": "custom",
    "colocation": true,
    "multi_units": true,
    "multi_users": true,
    "max_users": -1,
    "roles_permissions": true,
    "activity_log": true,
    "work_orders": true,
    "work_orders_planning": true,
    "providers_management": true,
    "owner_reports": true,
    "multi_mandants": true,
    "channel_manager": "full",
    "api_access": true,
    "api_access_level": "full",
    "webhooks": true,
    "white_label": true,
    "sso": true,
    "custom_sla": true,
    "priority_support": true,
    "support_phone": true,
    "onboarding": true,
    "data_import": true,
    "account_manager": true,
    "export_csv": true,
    "export_excel": true,
    "export_accounting": true,
    "storage_gb": -1,
    "email_templates": true,
    "deposit_tracking": true,
    "edl_digital": true,
    "attestations": true,
    "ocr_documents": true,
    "scoring_ia": true
  }'::jsonb,
  true, false, 4
);

-- ============================================
-- CRÉATION DES ADD-ONS
-- Modules complémentaires pour Confort et Pro
-- ============================================

-- ============================================
-- ADD-ON 1: Channel Manager Avancé - 29€/mois
-- Pour la location saisonnière multi-plateformes
-- ============================================
INSERT INTO subscription_addons (
  name, slug, description,
  price_monthly, price_yearly,
  features, compatible_plans,
  is_active, display_order
) VALUES (
  '🏨 Channel Manager Avancé',
  'channel-manager',
  'Sync Airbnb, Booking, Abritel • Création annonces • Prix dynamiques • Messages centralisés',
  2900, 29000,  -- 29€/mois, 290€/an
  '{
    "channel_manager": "full",
    "airbnb_sync": true,
    "booking_sync": true,
    "abritel_sync": true,
    "vrbo_sync": true,
    "unified_messaging": true,
    "dynamic_pricing": true,
    "listing_creation": true,
    "availability_sync": true,
    "review_management": true,
    "calendar_multi_platform": true
  }'::jsonb,
  ARRAY['confort', 'pro'],
  true, 1
);

-- ============================================
-- ADD-ON 2: Copropriété Light - 19€/mois
-- Gestion simplifiée pour petits immeubles
-- ============================================
INSERT INTO subscription_addons (
  name, slug, description,
  price_monthly, price_yearly,
  features, compatible_plans,
  is_active, display_order
) VALUES (
  '🏢 Copropriété Light',
  'copro',
  'Charges communes • Appels de fonds • Tantièmes • Documents AG • Jusqu''à 20 lots',
  1900, 19000,  -- 19€/mois, 190€/an
  '{
    "copro_charges": true,
    "copro_calls": true,
    "copro_tantiemes": true,
    "copro_documents": true,
    "copro_providers": true,
    "copro_ag": true,
    "copro_budget_previsionnel": true,
    "copro_carnet_entretien": true,
    "copro_max_lots": 20
  }'::jsonb,
  ARRAY['confort', 'pro', 'enterprise'],
  true, 2
);

-- ============================================
-- ADD-ON 3: Open Banking Premium - 9€/mois
-- Finances avancées multi-comptes
-- ============================================
INSERT INTO subscription_addons (
  name, slug, description,
  price_monthly, price_yearly,
  features, compatible_plans,
  is_active, display_order
) VALUES (
  '🏦 Open Banking Premium',
  'open-banking-premium',
  'Multi-comptes bancaires • Règles auto avancées • Rapports consolidés',
  900, 9000,  -- 9€/mois, 90€/an
  '{
    "open_banking_level": "premium",
    "multi_bank_accounts": true,
    "unlimited_accounts": true,
    "advanced_categorization_rules": true,
    "custom_categories": true,
    "consolidated_reports": true,
    "auto_categorization": true,
    "split_transactions": true,
    "recurring_detection": true,
    "bank_accounts_limit": -1
  }'::jsonb,
  ARRAY['confort'],  -- Déjà niveau avancé dans Pro
  true, 3
);

-- ============================================
-- ADD-ON 4: Scoring IA Locataire - 15€/mois
-- Analyse intelligente des dossiers
-- ============================================
INSERT INTO subscription_addons (
  name, slug, description,
  price_monthly, price_yearly,
  features, compatible_plans,
  is_active, display_order
) VALUES (
  '📊 Scoring IA Locataire',
  'scoring-ia',
  'Score de solvabilité • Analyse pièces • Détection anomalies • 50 analyses/mois',
  1500, 15000,  -- 15€/mois, 150€/an
  '{
    "scoring_ia": true,
    "solvency_score": true,
    "document_analysis": true,
    "fraud_detection": true,
    "income_verification": true,
    "recommendations": true,
    "risk_assessment": true,
    "comparative_analysis": true,
    "monthly_analyses": 50
  }'::jsonb,
  ARRAY['confort', 'pro'],  -- Inclus dans Enterprise
  true, 4
);

-- ============================================
-- ADD-ON 5: Signatures Illimitées - 12€/mois
-- Pour Confort qui veut plus que 10/mois
-- ============================================
INSERT INTO subscription_addons (
  name, slug, description,
  price_monthly, price_yearly,
  features, compatible_plans,
  is_active, display_order
) VALUES (
  '✍️ Signatures Illimitées',
  'unlimited-signatures',
  'E-signatures illimitées via Yousign (au lieu de 10/mois) • Modèles avancés',
  1200, 12000,  -- 12€/mois, 120€/an
  '{
    "signatures_monthly_quota": -1,
    "signatures_unlimited": true,
    "bulk_signing": true,
    "signature_templates": true,
    "advanced_workflows": true
  }'::jsonb,
  ARRAY['confort'],  -- Déjà illimité dans Pro et Enterprise
  true, 5
);

-- ============================================
-- ADD-ON 6: Support Premium - 19€/mois
-- Support téléphonique prioritaire
-- ============================================
INSERT INTO subscription_addons (
  name, slug, description,
  price_monthly, price_yearly,
  features, compatible_plans,
  is_active, display_order
) VALUES (
  '🎧 Support Premium',
  'support-premium',
  'Support téléphonique • Réponse 4h • Onboarding • Aide import données',
  1900, 19000,  -- 19€/mois, 190€/an
  '{
    "support_phone": true,
    "response_4h": true,
    "onboarding": true,
    "data_import": true,
    "priority_queue": true,
    "screen_sharing": true
  }'::jsonb,
  ARRAY['solo', 'confort'],  -- Inclus dans Pro et Enterprise
  true, 6
);

-- ============================================
-- ADD-ON 7: Pack États des Lieux - 9€/mois
-- EDL numériques complets
-- ============================================
INSERT INTO subscription_addons (
  name, slug, description,
  price_monthly, price_yearly,
  features, compatible_plans,
  is_active, display_order
) VALUES (
  '📋 Pack États des Lieux',
  'edl-pack',
  'EDL numériques interactifs • Photos annotées • Comparatif entrée/sortie',
  900, 9000,  -- 9€/mois, 90€/an
  '{
    "edl_digital": true,
    "edl_photos": true,
    "edl_annotations": true,
    "edl_comparison": true,
    "edl_templates": true,
    "edl_pdf_export": true
  }'::jsonb,
  ARRAY['solo', 'confort'],  -- Inclus dans Pro et Enterprise
  true, 7
);

-- ============================================
-- RLS POLICIES
-- ============================================
ALTER TABLE subscription_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_addon_subscriptions ENABLE ROW LEVEL SECURITY;

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

-- ============================================
-- FONCTIONS UTILITAIRES
-- ============================================

-- Fonction pour obtenir toutes les features d'un abonnement (plan + add-ons)
CREATE OR REPLACE FUNCTION get_subscription_all_features(p_subscription_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_base_features JSONB;
  v_addon_features JSONB;
  v_merged_features JSONB;
BEGIN
  -- Récupérer les features du plan de base
  SELECT sp.features INTO v_base_features
  FROM subscriptions s
  JOIN subscription_plans sp ON s.plan_id = sp.id
  WHERE s.id = p_subscription_id;
  
  IF v_base_features IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;
  
  -- Récupérer et fusionner les features des add-ons actifs
  SELECT COALESCE(jsonb_object_agg(key, value), '{}'::jsonb) INTO v_addon_features
  FROM (
    SELECT key, value
    FROM subscription_addon_subscriptions sas
    JOIN subscription_addons sa ON sas.addon_id = sa.id
    CROSS JOIN LATERAL jsonb_each(sa.features)
    WHERE sas.subscription_id = p_subscription_id
    AND sas.status = 'active'
  ) addon_features;
  
  -- Fusionner: les features des add-ons écrasent celles du plan de base
  v_merged_features := v_base_features || v_addon_features;
  
  RETURN v_merged_features;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Fonction pour vérifier si un utilisateur a accès à une feature (plan + add-ons)
CREATE OR REPLACE FUNCTION has_feature(p_owner_id UUID, p_feature TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_subscription_id UUID;
  v_all_features JSONB;
  v_feature_value JSONB;
BEGIN
  -- Trouver l'abonnement actif
  SELECT id INTO v_subscription_id
  FROM subscriptions
  WHERE owner_id = p_owner_id
  AND status IN ('active', 'trialing')
  LIMIT 1;
  
  IF v_subscription_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Récupérer toutes les features
  v_all_features := get_subscription_all_features(v_subscription_id);
  
  -- Vérifier la feature
  v_feature_value := v_all_features->p_feature;
  
  IF v_feature_value IS NULL THEN
    RETURN false;
  END IF;
  
  -- Si c'est un booléen
  IF jsonb_typeof(v_feature_value) = 'boolean' THEN
    RETURN v_feature_value::boolean;
  END IF;
  
  -- Si c'est une string (ex: "none", "basic", "advanced")
  IF jsonb_typeof(v_feature_value) = 'string' THEN
    RETURN v_feature_value::text != 'none';
  END IF;
  
  -- Si c'est un nombre (quota), vérifier si > 0 ou = -1 (illimité)
  IF jsonb_typeof(v_feature_value) = 'number' THEN
    RETURN (v_feature_value::int > 0 OR v_feature_value::int = -1);
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Fonction pour calculer le prix total d'un abonnement (plan + add-ons + lots supplémentaires)
CREATE OR REPLACE FUNCTION calculate_subscription_price(
  p_subscription_id UUID,
  p_billing_cycle TEXT DEFAULT 'monthly'
) RETURNS TABLE (
  base_price INTEGER,
  addons_price INTEGER,
  extra_units_price INTEGER,
  total_price INTEGER,
  currency TEXT
) AS $$
DECLARE
  v_plan RECORD;
  v_subscription RECORD;
  v_base_price INTEGER;
  v_addons_total INTEGER := 0;
  v_extra_units INTEGER := 0;
  v_extra_price INTEGER := 0;
BEGIN
  -- Récupérer l'abonnement et le plan
  SELECT s.*, sp.price_monthly, sp.price_yearly, sp.included_properties, 
         sp.extra_property_price, sp.billing_type
  INTO v_subscription
  FROM subscriptions s
  JOIN subscription_plans sp ON s.plan_id = sp.id
  WHERE s.id = p_subscription_id;
  
  IF v_subscription IS NULL THEN
    RETURN QUERY SELECT 0, 0, 0, 0, 'EUR'::TEXT;
    RETURN;
  END IF;
  
  -- Prix de base selon le cycle
  IF p_billing_cycle = 'yearly' THEN
    v_base_price := v_subscription.price_yearly;
  ELSE
    v_base_price := v_subscription.price_monthly;
  END IF;
  
  -- Calculer le prix des add-ons
  SELECT COALESCE(SUM(
    CASE WHEN p_billing_cycle = 'yearly' THEN sa.price_yearly ELSE sa.price_monthly END
  ), 0) INTO v_addons_total
  FROM subscription_addon_subscriptions sas
  JOIN subscription_addons sa ON sas.addon_id = sa.id
  WHERE sas.subscription_id = p_subscription_id
  AND sas.status = 'active';
  
  -- Calculer le prix des lots supplémentaires (si billing_type = 'per_unit')
  IF v_subscription.billing_type = 'per_unit' AND v_subscription.included_properties > 0 THEN
    v_extra_units := GREATEST(0, v_subscription.properties_count - v_subscription.included_properties);
    v_extra_price := v_extra_units * v_subscription.extra_property_price;
  END IF;
  
  RETURN QUERY SELECT 
    v_base_price,
    v_addons_total,
    v_extra_price,
    v_base_price + v_addons_total + v_extra_price,
    'EUR'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMIT;


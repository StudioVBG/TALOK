-- Migration: Système d'abonnement et monétisation
-- Date: 2024-11-29
-- Description: Tables pour gérer les plans, abonnements et limites

BEGIN;

-- ============================================
-- PLANS D'ABONNEMENT
-- ============================================

CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  
  -- Tarification (en centimes)
  price_monthly INTEGER NOT NULL DEFAULT 0,      -- 1990 = 19.90€
  price_yearly INTEGER NOT NULL DEFAULT 0,       -- 19900 = 199€
  
  -- Limites
  max_properties INTEGER NOT NULL DEFAULT 1,
  max_leases INTEGER NOT NULL DEFAULT 3,
  max_tenants INTEGER NOT NULL DEFAULT 5,
  max_documents_gb NUMERIC(10,2) NOT NULL DEFAULT 1,
  
  -- Features JSON
  features JSONB NOT NULL DEFAULT '{
    "signatures": false,
    "ocr": false,
    "scoring": false,
    "automations": false,
    "api_access": false,
    "priority_support": false,
    "white_label": false,
    "cash_payments": true,
    "export_csv": true,
    "multi_users": false
  }'::jsonb,
  
  -- Stripe IDs
  stripe_product_id TEXT,
  stripe_price_monthly_id TEXT,
  stripe_price_yearly_id TEXT,
  
  -- Statut
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_popular BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_plans_slug ON subscription_plans(slug);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_active ON subscription_plans(is_active);

-- ============================================
-- ABONNEMENTS UTILISATEURS
-- ============================================

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),
  
  -- Stripe
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  
  -- Statut
  status TEXT NOT NULL DEFAULT 'trialing' 
    CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused', 'incomplete')),
  
  -- Cycle de facturation
  billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly')),
  
  -- Périodes
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  trial_start TIMESTAMPTZ DEFAULT NOW(),
  trial_end TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),
  canceled_at TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  
  -- Usage actuel (mis à jour par triggers)
  properties_count INTEGER NOT NULL DEFAULT 0,
  leases_count INTEGER NOT NULL DEFAULT 0,
  tenants_count INTEGER NOT NULL DEFAULT 0,
  documents_size_mb NUMERIC(10,2) NOT NULL DEFAULT 0,
  
  -- Métadonnées
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(owner_id)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_owner ON subscriptions(owner_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe ON subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_period_end ON subscriptions(current_period_end);

-- ============================================
-- HISTORIQUE DES FACTURES STRIPE
-- ============================================

CREATE TABLE IF NOT EXISTS subscription_invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  
  -- Stripe
  stripe_invoice_id TEXT UNIQUE,
  stripe_charge_id TEXT,
  
  -- Montants (en centimes)
  amount_due INTEGER NOT NULL,
  amount_paid INTEGER NOT NULL DEFAULT 0,
  amount_remaining INTEGER NOT NULL DEFAULT 0,
  
  -- Statut
  status TEXT NOT NULL CHECK (status IN ('draft', 'open', 'paid', 'void', 'uncollectible')),
  
  -- URLs
  hosted_invoice_url TEXT,
  invoice_pdf TEXT,
  
  -- Périodes
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  due_date TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_invoices_sub ON subscription_invoices(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_invoices_status ON subscription_invoices(status);

-- ============================================
-- USAGE ET QUOTAS
-- ============================================

CREATE TABLE IF NOT EXISTS subscription_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  
  -- Type d'usage
  usage_type TEXT NOT NULL CHECK (usage_type IN (
    'signature', 'ocr_page', 'scoring', 'api_call', 'storage_mb', 'email_sent', 'sms_sent'
  )),
  
  -- Quantité
  quantity INTEGER NOT NULL DEFAULT 1,
  
  -- Période (pour les quotas mensuels)
  period_month TEXT NOT NULL, -- Format: "2024-11"
  
  -- Métadonnées
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_usage_sub ON subscription_usage(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_usage_period ON subscription_usage(period_month);
CREATE INDEX IF NOT EXISTS idx_subscription_usage_type ON subscription_usage(usage_type);

-- ============================================
-- INSÉRER LES PLANS PAR DÉFAUT
-- ============================================

INSERT INTO subscription_plans (name, slug, description, price_monthly, price_yearly, max_properties, max_leases, max_tenants, max_documents_gb, features, is_popular, display_order) VALUES
(
  'Gratuit',
  'free',
  'Pour découvrir la plateforme',
  0, 0,
  1, 1, 2, 0.5,
  '{"signatures": false, "ocr": false, "scoring": false, "automations": false, "api_access": false, "priority_support": false, "cash_payments": true, "export_csv": true}'::jsonb,
  false, 0
),
(
  'Starter',
  'starter',
  'Pour les petits propriétaires',
  1990, 19900,
  3, 5, 10, 2,
  '{"signatures": true, "ocr": false, "scoring": false, "automations": true, "api_access": false, "priority_support": false, "cash_payments": true, "export_csv": true}'::jsonb,
  false, 1
),
(
  'Pro',
  'pro',
  'Pour les propriétaires actifs',
  4990, 49900,
  10, 20, 50, 10,
  '{"signatures": true, "ocr": true, "scoring": true, "automations": true, "api_access": false, "priority_support": false, "cash_payments": true, "export_csv": true, "multi_users": false}'::jsonb,
  true, 2
),
(
  'Business',
  'business',
  'Pour les gestionnaires de patrimoine',
  9990, 99900,
  30, 100, 200, 50,
  '{"signatures": true, "ocr": true, "scoring": true, "automations": true, "api_access": true, "priority_support": true, "cash_payments": true, "export_csv": true, "multi_users": true}'::jsonb,
  false, 3
),
(
  'Enterprise',
  'enterprise',
  'Solution sur mesure',
  0, 0,
  -1, -1, -1, -1,
  '{"signatures": true, "ocr": true, "scoring": true, "automations": true, "api_access": true, "priority_support": true, "cash_payments": true, "export_csv": true, "multi_users": true, "white_label": true, "dedicated_support": true}'::jsonb,
  false, 4
)
ON CONFLICT (slug) DO UPDATE SET
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  max_properties = EXCLUDED.max_properties,
  max_leases = EXCLUDED.max_leases,
  max_tenants = EXCLUDED.max_tenants,
  features = EXCLUDED.features,
  updated_at = NOW();

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_usage ENABLE ROW LEVEL SECURITY;

-- Plans visibles par tous
CREATE POLICY "Plans visible by all authenticated" ON subscription_plans 
  FOR SELECT TO authenticated USING (is_active = true);

-- Abonnements visibles uniquement par le propriétaire
CREATE POLICY "Owners can view their subscription" ON subscriptions 
  FOR SELECT TO authenticated
  USING (owner_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Admins peuvent tout voir
CREATE POLICY "Admins can view all subscriptions" ON subscriptions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Factures visibles par le propriétaire
CREATE POLICY "Owners can view their invoices" ON subscription_invoices
  FOR SELECT TO authenticated
  USING (
    subscription_id IN (
      SELECT id FROM subscriptions 
      WHERE owner_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- Usage visible par le propriétaire
CREATE POLICY "Owners can view their usage" ON subscription_usage
  FOR SELECT TO authenticated
  USING (
    subscription_id IN (
      SELECT id FROM subscriptions 
      WHERE owner_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- ============================================
-- FONCTIONS UTILITAIRES
-- ============================================

-- Fonction pour vérifier si un propriétaire a une feature
CREATE OR REPLACE FUNCTION has_subscription_feature(
  p_owner_id UUID,
  p_feature TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_features JSONB;
BEGIN
  SELECT p.features INTO v_features
  FROM subscriptions s
  JOIN subscription_plans p ON s.plan_id = p.id
  WHERE s.owner_id = p_owner_id
  AND s.status IN ('active', 'trialing');
  
  IF v_features IS NULL THEN
    -- Pas d'abonnement = plan gratuit
    SELECT features INTO v_features FROM subscription_plans WHERE slug = 'free';
  END IF;
  
  RETURN COALESCE((v_features->>p_feature)::boolean, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Fonction pour vérifier les limites
CREATE OR REPLACE FUNCTION check_subscription_limit(
  p_owner_id UUID,
  p_resource TEXT,
  p_increment INTEGER DEFAULT 1
) RETURNS BOOLEAN AS $$
DECLARE
  v_plan subscription_plans;
  v_sub subscriptions;
  v_current INTEGER;
  v_max INTEGER;
BEGIN
  -- Récupérer l'abonnement actif
  SELECT s.*, p.max_properties, p.max_leases, p.max_tenants
  INTO v_sub
  FROM subscriptions s
  JOIN subscription_plans p ON s.plan_id = p.id
  WHERE s.owner_id = p_owner_id
  AND s.status IN ('active', 'trialing');
  
  IF v_sub IS NULL THEN
    -- Plan gratuit par défaut
    SELECT * INTO v_plan FROM subscription_plans WHERE slug = 'free';
    v_sub.properties_count := 0;
    v_sub.leases_count := 0;
    v_sub.tenants_count := 0;
  ELSE
    SELECT * INTO v_plan FROM subscription_plans WHERE id = v_sub.plan_id;
  END IF;
  
  -- Vérifier selon la ressource
  CASE p_resource
    WHEN 'properties' THEN
      v_max := v_plan.max_properties;
      v_current := COALESCE(v_sub.properties_count, 0);
    WHEN 'leases' THEN
      v_max := v_plan.max_leases;
      v_current := COALESCE(v_sub.leases_count, 0);
    WHEN 'tenants' THEN
      v_max := v_plan.max_tenants;
      v_current := COALESCE(v_sub.tenants_count, 0);
    ELSE
      RETURN true;
  END CASE;
  
  -- -1 = illimité
  IF v_max = -1 THEN
    RETURN true;
  END IF;
  
  RETURN (v_current + p_increment) <= v_max;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour obtenir les limites actuelles
CREATE OR REPLACE FUNCTION get_subscription_limits(p_owner_id UUID)
RETURNS TABLE (
  plan_name TEXT,
  plan_slug TEXT,
  status TEXT,
  trial_end TIMESTAMPTZ,
  properties_current INTEGER,
  properties_max INTEGER,
  leases_current INTEGER,
  leases_max INTEGER,
  tenants_current INTEGER,
  tenants_max INTEGER,
  features JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.name,
    p.slug,
    COALESCE(s.status, 'free'),
    s.trial_end,
    COALESCE(s.properties_count, 0)::INTEGER,
    p.max_properties,
    COALESCE(s.leases_count, 0)::INTEGER,
    p.max_leases,
    COALESCE(s.tenants_count, 0)::INTEGER,
    p.max_tenants,
    p.features
  FROM subscription_plans p
  LEFT JOIN subscriptions s ON s.plan_id = p.id AND s.owner_id = p_owner_id
  WHERE p.slug = COALESCE(
    (SELECT sp.slug FROM subscription_plans sp 
     JOIN subscriptions sub ON sub.plan_id = sp.id 
     WHERE sub.owner_id = p_owner_id AND sub.status IN ('active', 'trialing')),
    'free'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================
-- TRIGGERS POUR METTRE À JOUR LES COMPTEURS
-- ============================================

-- Trigger pour compter les propriétés
CREATE OR REPLACE FUNCTION update_subscription_properties_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE subscriptions 
    SET properties_count = properties_count + 1,
        updated_at = NOW()
    WHERE owner_id = NEW.owner_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE subscriptions 
    SET properties_count = GREATEST(0, properties_count - 1),
        updated_at = NOW()
    WHERE owner_id = OLD.owner_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_subscription_properties ON properties;
CREATE TRIGGER trg_update_subscription_properties
  AFTER INSERT OR DELETE ON properties
  FOR EACH ROW EXECUTE FUNCTION update_subscription_properties_count();

-- Trigger pour compter les baux actifs
CREATE OR REPLACE FUNCTION update_subscription_leases_count()
RETURNS TRIGGER AS $$
DECLARE
  v_owner_id UUID;
BEGIN
  -- Récupérer le owner_id via la propriété
  IF TG_OP = 'DELETE' THEN
    SELECT owner_id INTO v_owner_id FROM properties WHERE id = OLD.property_id;
  ELSE
    SELECT owner_id INTO v_owner_id FROM properties WHERE id = NEW.property_id;
  END IF;
  
  IF v_owner_id IS NOT NULL THEN
    UPDATE subscriptions 
    SET leases_count = (
      SELECT COUNT(*) FROM leases l
      JOIN properties p ON l.property_id = p.id
      WHERE p.owner_id = v_owner_id
      AND l.statut IN ('active', 'pending_signature')
    ),
    updated_at = NOW()
    WHERE owner_id = v_owner_id;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_subscription_leases ON leases;
CREATE TRIGGER trg_update_subscription_leases
  AFTER INSERT OR UPDATE OR DELETE ON leases
  FOR EACH ROW EXECUTE FUNCTION update_subscription_leases_count();

COMMIT;


-- ============================================
-- MIGRATION: Add-ons pour les abonnements
-- Date: 2024-12-03
-- Description: Système d'add-ons optionnels
-- ============================================

-- Add-ons disponibles
CREATE TABLE IF NOT EXISTS subscription_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  
  -- Pricing (centimes)
  price_monthly INTEGER NOT NULL DEFAULT 0,
  price_yearly INTEGER NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'eur',
  
  -- Stripe IDs
  stripe_product_id TEXT,
  stripe_price_id_monthly TEXT,
  stripe_price_id_yearly TEXT,
  
  -- Limites et features ajoutées
  limits_boost JSONB DEFAULT '{}',
  features_added JSONB DEFAULT '{}',
  
  -- Restrictions
  compatible_plans TEXT[] DEFAULT '{}', -- vide = tous les plans
  requires_plan TEXT[], -- plans minimum requis
  
  -- Métadonnées
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  icon TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add-ons souscrits par les utilisateurs
CREATE TABLE IF NOT EXISTS subscription_addon_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
  addon_id UUID REFERENCES subscription_addons(id) ON DELETE CASCADE,
  
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'paused')),
  
  -- Stripe
  stripe_subscription_item_id TEXT,
  
  -- Périodes
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(subscription_id, addon_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_addons_active ON subscription_addons(is_active, display_order);
CREATE INDEX IF NOT EXISTS idx_addon_subs_subscription ON subscription_addon_subscriptions(subscription_id);
CREATE INDEX IF NOT EXISTS idx_addon_subs_status ON subscription_addon_subscriptions(status);

-- RLS
ALTER TABLE subscription_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_addon_subscriptions ENABLE ROW LEVEL SECURITY;

-- Add-ons: lecture publique (actifs uniquement)
DROP POLICY IF EXISTS "Addons actifs visibles par tous" ON subscription_addons;
CREATE POLICY "Addons actifs visibles par tous"
  ON subscription_addons FOR SELECT
  USING (is_active = true);

-- Add-ons: admin peut tout faire
DROP POLICY IF EXISTS "Admin peut gérer les addons" ON subscription_addons;
CREATE POLICY "Admin peut gérer les addons"
  ON subscription_addons FOR ALL
  USING (public.user_role() = 'admin');

-- Add-on subscriptions: user voit les siennes
DROP POLICY IF EXISTS "User voit ses addon subscriptions" ON subscription_addon_subscriptions;
CREATE POLICY "User voit ses addon subscriptions"
  ON subscription_addon_subscriptions FOR SELECT
  USING (
    subscription_id IN (
      SELECT id FROM subscriptions WHERE user_id = auth.uid()
    )
  );

-- Add-on subscriptions: admin voit tout
DROP POLICY IF EXISTS "Admin gère tous les addon subs" ON subscription_addon_subscriptions;
CREATE POLICY "Admin gère tous les addon subs"
  ON subscription_addon_subscriptions FOR ALL
  USING (public.user_role() = 'admin');

-- Seed data pour les add-ons
INSERT INTO subscription_addons (slug, name, description, price_monthly, price_yearly, limits_boost, features_added, compatible_plans, display_order, icon)
VALUES
(
  'extra_signatures',
  'Signatures supplémentaires',
  '10 signatures électroniques supplémentaires par mois',
  500,
  5000,
  '{"signatures_monthly": 10}',
  '{}',
  '{"confort", "pro"}',
  1,
  'pen-tool'
),
(
  'extra_storage',
  'Stockage supplémentaire',
  '10 Go de stockage supplémentaire',
  300,
  3000,
  '{"storage_gb": 10}',
  '{}',
  '{}',
  2,
  'hard-drive'
),
(
  'sms_pack',
  'Pack SMS',
  '100 SMS de relance par mois',
  900,
  9000,
  '{"sms_monthly": 100}',
  '{"auto_reminders_sms": true}',
  '{"confort", "pro"}',
  3,
  'message-square'
),
(
  'api_access',
  'Accès API',
  'Accès à l''API REST et webhooks',
  1500,
  15000,
  '{}',
  '{"api_access": true, "webhooks": true}',
  '{"confort"}',
  4,
  'code'
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  limits_boost = EXCLUDED.limits_boost,
  features_added = EXCLUDED.features_added,
  compatible_plans = EXCLUDED.compatible_plans,
  display_order = EXCLUDED.display_order,
  icon = EXCLUDED.icon,
  updated_at = NOW();

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_subscription_addons_updated ON subscription_addons;
CREATE TRIGGER trg_subscription_addons_updated
  BEFORE UPDATE ON subscription_addons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_addon_subscriptions_updated ON subscription_addon_subscriptions;
CREATE TRIGGER trg_addon_subscriptions_updated
  BEFORE UPDATE ON subscription_addon_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE subscription_addons IS 'Add-ons disponibles pour les abonnements';
COMMENT ON TABLE subscription_addon_subscriptions IS 'Add-ons souscrits par les utilisateurs';


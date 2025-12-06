-- ============================================
-- MIGRATION: Système d'abonnements complet
-- Date: 2024-12-03
-- Description: Tables, fonctions, RLS pour le système de pricing
-- ============================================

-- ============================================
-- 1. TABLES PRINCIPALES
-- ============================================

-- Plans disponibles (configurables par admin)
CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL, -- 'gratuit', 'confort', 'pro', 'enterprise'
  name TEXT NOT NULL,
  description TEXT,
  tagline TEXT,
  
  -- Pricing (en centimes)
  price_monthly INTEGER DEFAULT 0,
  price_yearly INTEGER DEFAULT 0,
  currency TEXT DEFAULT 'eur',
  
  -- Stripe IDs
  stripe_product_id TEXT,
  stripe_price_id_monthly TEXT,
  stripe_price_id_yearly TEXT,
  
  -- Limites (JSONB pour flexibilité)
  limits JSONB NOT NULL DEFAULT '{
    "max_properties": 1,
    "max_leases": 1,
    "max_users": 1,
    "max_signatures_monthly": 0,
    "storage_gb": 0.1,
    "extra_property_price": 0
  }',
  
  -- Features activées (JSONB)
  features JSONB NOT NULL DEFAULT '{}',
  
  -- Highlights pour l'UI
  highlights JSONB DEFAULT '[]',
  
  -- Métadonnées
  is_active BOOLEAN DEFAULT true,
  is_popular BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  trial_days INTEGER DEFAULT 14,
  cta_text TEXT DEFAULT 'Commencer',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Abonnements utilisateurs
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES subscription_plans(id),
  plan_slug TEXT NOT NULL DEFAULT 'gratuit',
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'active', 'trialing', 'past_due', 'canceled', 'paused', 'incomplete', 'suspended'
  )),
  
  -- Stripe
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  
  -- Périodes
  billing_cycle TEXT DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  cancel_reason TEXT,
  
  -- Extra billing (biens supplémentaires pour Pro)
  extra_properties INTEGER DEFAULT 0,
  extra_properties_amount INTEGER DEFAULT 0,
  
  -- Codes promo
  promo_code_id UUID,
  discount_applied INTEGER DEFAULT 0,
  
  -- Métadonnées
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- Usage tracking mensuel
CREATE TABLE IF NOT EXISTS subscription_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Compteurs
  properties_count INTEGER DEFAULT 0,
  leases_count INTEGER DEFAULT 0,
  users_count INTEGER DEFAULT 1,
  signatures_used_this_month INTEGER DEFAULT 0,
  storage_used_bytes BIGINT DEFAULT 0,
  api_calls_this_month INTEGER DEFAULT 0,
  
  -- Période
  period_start TIMESTAMPTZ DEFAULT DATE_TRUNC('month', NOW()),
  period_end TIMESTAMPTZ DEFAULT DATE_TRUNC('month', NOW()) + INTERVAL '1 month',
  
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, period_start)
);

-- Historique des événements
CREATE TABLE IF NOT EXISTS subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  
  event_type TEXT NOT NULL CHECK (event_type IN (
    'created', 'upgraded', 'downgraded', 'canceled', 'reactivated',
    'trial_started', 'trial_ended', 'trial_converted',
    'payment_succeeded', 'payment_failed', 'payment_refunded',
    'invoice_created', 'invoice_paid', 'invoice_failed',
    'plan_changed', 'promo_applied', 'gift_received',
    'suspended', 'unsuspended'
  )),
  
  from_plan TEXT,
  to_plan TEXT,
  
  -- Stripe event
  stripe_event_id TEXT,
  
  -- Détails
  amount INTEGER,
  currency TEXT,
  
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Codes promo
CREATE TABLE IF NOT EXISTS promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT,
  description TEXT,
  
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value INTEGER NOT NULL, -- % ou centimes
  
  -- Restrictions
  applicable_plans TEXT[] DEFAULT '{}', -- vide = tous
  min_billing_cycle TEXT CHECK (min_billing_cycle IN ('monthly', 'yearly', NULL)),
  first_subscription_only BOOLEAN DEFAULT false,
  
  -- Limites
  max_uses INTEGER,
  uses_count INTEGER DEFAULT 0,
  max_uses_per_user INTEGER DEFAULT 1,
  
  -- Validité
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  
  -- Stripe
  stripe_coupon_id TEXT,
  
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Utilisation des codes promo
CREATE TABLE IF NOT EXISTS promo_code_uses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id UUID NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id),
  
  discount_applied INTEGER NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(promo_code_id, user_id)
);

-- Factures
CREATE TABLE IF NOT EXISTS subscription_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES subscriptions(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  
  stripe_invoice_id TEXT UNIQUE,
  invoice_number TEXT,
  
  -- Montants (centimes)
  subtotal INTEGER NOT NULL,
  discount INTEGER DEFAULT 0,
  tax INTEGER DEFAULT 0,
  total INTEGER NOT NULL,
  amount_paid INTEGER DEFAULT 0,
  amount_due INTEGER NOT NULL,
  currency TEXT DEFAULT 'eur',
  
  status TEXT DEFAULT 'draft' CHECK (status IN (
    'draft', 'open', 'paid', 'void', 'uncollectible'
  )),
  
  -- URLs
  invoice_pdf_url TEXT,
  hosted_invoice_url TEXT,
  
  -- Périodes
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  due_date TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  
  -- Détails
  lines JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Actions admin
CREATE TABLE IF NOT EXISTS admin_subscription_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES auth.users(id),
  target_user_id UUID NOT NULL REFERENCES auth.users(id),
  
  action_type TEXT NOT NULL CHECK (action_type IN (
    'plan_override', 'gift_days', 'suspend', 'unsuspend', 'reactivate',
    'cancel', 'apply_promo', 'remove_promo', 'note_added', 'email_sent',
    'refund', 'credit_added'
  )),
  
  -- Détails
  from_plan TEXT,
  to_plan TEXT,
  gift_days INTEGER,
  promo_code TEXT,
  amount INTEGER,
  
  reason TEXT NOT NULL,
  internal_note TEXT,
  notify_user BOOLEAN DEFAULT false,
  
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notes internes admin
CREATE TABLE IF NOT EXISTS admin_user_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES auth.users(id),
  
  note TEXT NOT NULL,
  is_important BOOLEAN DEFAULT false,
  is_pinned BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_subscription_plans_active ON subscription_plans(is_active, display_order);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_slug ON subscription_plans(slug);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe ON subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan ON subscriptions(plan_slug);
CREATE INDEX IF NOT EXISTS idx_subscriptions_period_end ON subscriptions(current_period_end);

CREATE INDEX IF NOT EXISTS idx_subscription_usage_user ON subscription_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_usage_period ON subscription_usage(period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_subscription_events_sub ON subscription_events(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_events_user ON subscription_events(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_events_type ON subscription_events(event_type);
CREATE INDEX IF NOT EXISTS idx_subscription_events_date ON subscription_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code);
CREATE INDEX IF NOT EXISTS idx_promo_codes_active ON promo_codes(is_active, valid_until);

CREATE INDEX IF NOT EXISTS idx_subscription_invoices_user ON subscription_invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_invoices_status ON subscription_invoices(status);
CREATE INDEX IF NOT EXISTS idx_subscription_invoices_stripe ON subscription_invoices(stripe_invoice_id);

CREATE INDEX IF NOT EXISTS idx_admin_actions_target ON admin_subscription_actions(target_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_admin ON admin_subscription_actions(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_date ON admin_subscription_actions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_notes_user ON admin_user_notes(user_id);

-- ============================================
-- 3. FONCTIONS UTILITAIRES
-- ============================================

-- Obtenir le plan d'un utilisateur
CREATE OR REPLACE FUNCTION get_user_subscription(p_user_id UUID)
RETURNS TABLE (
  subscription_id UUID,
  plan_slug TEXT,
  plan_name TEXT,
  status TEXT,
  billing_cycle TEXT,
  limits JSONB,
  features JSONB,
  current_period_end TIMESTAMPTZ,
  is_trial BOOLEAN,
  trial_end TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.plan_slug,
    sp.name,
    s.status,
    s.billing_cycle,
    sp.limits,
    sp.features,
    s.current_period_end,
    s.status = 'trialing' as is_trial,
    s.trial_end
  FROM subscriptions s
  LEFT JOIN subscription_plans sp ON s.plan_slug = sp.slug
  WHERE s.user_id = p_user_id
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Vérifier si un utilisateur a une feature
CREATE OR REPLACE FUNCTION user_has_feature(p_user_id UUID, p_feature TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_features JSONB;
  v_status TEXT;
BEGIN
  SELECT sp.features, s.status INTO v_features, v_status
  FROM subscriptions s
  JOIN subscription_plans sp ON s.plan_slug = sp.slug
  WHERE s.user_id = p_user_id;
  
  -- Vérifier que l'abonnement est actif
  IF v_status NOT IN ('active', 'trialing') THEN
    RETURN false;
  END IF;
  
  RETURN COALESCE((v_features ->> p_feature)::boolean, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Vérifier si un utilisateur est dans sa limite
CREATE OR REPLACE FUNCTION user_within_limit(p_user_id UUID, p_resource TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_limit INTEGER;
  v_current INTEGER;
BEGIN
  -- Obtenir la limite
  SELECT (sp.limits ->> ('max_' || p_resource))::integer INTO v_limit
  FROM subscriptions s
  JOIN subscription_plans sp ON s.plan_slug = sp.slug
  WHERE s.user_id = p_user_id;
  
  -- -1 = illimité
  IF v_limit = -1 THEN RETURN true; END IF;
  
  -- Obtenir l'usage actuel
  SELECT 
    CASE p_resource
      WHEN 'properties' THEN properties_count
      WHEN 'leases' THEN leases_count
      WHEN 'users' THEN users_count
      WHEN 'signatures_monthly' THEN signatures_used_this_month
      ELSE 0
    END INTO v_current
  FROM subscription_usage
  WHERE user_id = p_user_id
  ORDER BY period_start DESC
  LIMIT 1;
  
  RETURN COALESCE(v_current, 0) < v_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Obtenir l'usage restant
CREATE OR REPLACE FUNCTION get_remaining_usage(p_user_id UUID, p_resource TEXT)
RETURNS INTEGER AS $$
DECLARE
  v_limit INTEGER;
  v_current INTEGER;
BEGIN
  SELECT (sp.limits ->> ('max_' || p_resource))::integer INTO v_limit
  FROM subscriptions s
  JOIN subscription_plans sp ON s.plan_slug = sp.slug
  WHERE s.user_id = p_user_id;
  
  IF v_limit = -1 THEN RETURN 999999; END IF;
  
  SELECT 
    CASE p_resource
      WHEN 'properties' THEN properties_count
      WHEN 'leases' THEN leases_count
      WHEN 'users' THEN users_count
      WHEN 'signatures_monthly' THEN signatures_used_this_month
      ELSE 0
    END INTO v_current
  FROM subscription_usage
  WHERE user_id = p_user_id
  ORDER BY period_start DESC
  LIMIT 1;
  
  RETURN GREATEST(0, v_limit - COALESCE(v_current, 0));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Créer/mettre à jour l'usage
CREATE OR REPLACE FUNCTION update_user_usage(p_user_id UUID)
RETURNS void AS $$
DECLARE
  v_props_count INTEGER;
  v_leases_count INTEGER;
  v_period_start TIMESTAMPTZ := DATE_TRUNC('month', NOW());
BEGIN
  -- Compter les propriétés
  SELECT COUNT(*) INTO v_props_count
  FROM properties
  WHERE owner_id = (SELECT id FROM profiles WHERE user_id = p_user_id);
  
  -- Compter les baux actifs
  SELECT COUNT(*) INTO v_leases_count
  FROM leases l
  JOIN properties p ON l.property_id = p.id
  WHERE p.owner_id = (SELECT id FROM profiles WHERE user_id = p_user_id)
  AND l.statut IN ('active', 'pending_signature');
  
  -- Upsert usage
  INSERT INTO subscription_usage (user_id, subscription_id, period_start, properties_count, leases_count, last_calculated_at)
  SELECT 
    p_user_id,
    s.id,
    v_period_start,
    v_props_count,
    v_leases_count,
    NOW()
  FROM subscriptions s
  WHERE s.user_id = p_user_id
  ON CONFLICT (user_id, period_start) DO UPDATE SET
    properties_count = EXCLUDED.properties_count,
    leases_count = EXCLUDED.leases_count,
    last_calculated_at = NOW(),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Incrémenter compteur signatures
CREATE OR REPLACE FUNCTION increment_signature_usage(p_user_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE subscription_usage
  SET 
    signatures_used_this_month = signatures_used_this_month + 1,
    updated_at = NOW()
  WHERE user_id = p_user_id
  AND period_start = DATE_TRUNC('month', NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 4. TRIGGERS
-- ============================================

-- Mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_subscription_plans_updated
  BEFORE UPDATE ON subscription_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_subscriptions_updated
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_promo_codes_updated
  BEFORE UPDATE ON promo_codes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Créer un abonnement gratuit pour les nouveaux users
CREATE OR REPLACE FUNCTION create_default_subscription()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO subscriptions (user_id, plan_slug, status, current_period_start)
  VALUES (NEW.id, 'gratuit', 'active', NOW())
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Créer l'usage initial
  INSERT INTO subscription_usage (user_id, subscription_id, period_start)
  SELECT NEW.id, s.id, DATE_TRUNC('month', NOW())
  FROM subscriptions s WHERE s.user_id = NEW.id
  ON CONFLICT (user_id, period_start) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: Ce trigger doit être ajouté sur auth.users si possible, 
-- sinon on le gère côté application

-- Log des événements de changement de plan
CREATE OR REPLACE FUNCTION log_subscription_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.plan_slug IS DISTINCT FROM NEW.plan_slug THEN
    INSERT INTO subscription_events (
      subscription_id, user_id, event_type, from_plan, to_plan
    ) VALUES (
      NEW.id, 
      NEW.user_id, 
      CASE 
        WHEN get_plan_level(NEW.plan_slug) > get_plan_level(OLD.plan_slug) THEN 'upgraded'
        ELSE 'downgraded'
      END,
      OLD.plan_slug,
      NEW.plan_slug
    );
  END IF;
  
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO subscription_events (
      subscription_id, user_id, event_type, metadata
    ) VALUES (
      NEW.id,
      NEW.user_id,
      CASE NEW.status
        WHEN 'canceled' THEN 'canceled'
        WHEN 'active' THEN CASE WHEN OLD.status = 'canceled' THEN 'reactivated' ELSE 'created' END
        WHEN 'trialing' THEN 'trial_started'
        WHEN 'suspended' THEN 'suspended'
        ELSE 'plan_changed'
      END,
      jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Helper pour le niveau de plan
CREATE OR REPLACE FUNCTION get_plan_level(p_slug TEXT)
RETURNS INTEGER AS $$
BEGIN
  RETURN CASE p_slug
    WHEN 'gratuit' THEN 0
    WHEN 'confort' THEN 1
    WHEN 'pro' THEN 2
    WHEN 'enterprise' THEN 3
    ELSE 0
  END;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_log_subscription_change
  AFTER UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION log_subscription_change();

-- Mettre à jour le compteur de codes promo
CREATE OR REPLACE FUNCTION update_promo_uses_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE promo_codes
  SET uses_count = uses_count + 1
  WHERE id = NEW.promo_code_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_promo_code_used
  AFTER INSERT ON promo_code_uses
  FOR EACH ROW EXECUTE FUNCTION update_promo_uses_count();

-- ============================================
-- 5. ROW LEVEL SECURITY
-- ============================================

ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_code_uses ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_subscription_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_user_notes ENABLE ROW LEVEL SECURITY;

-- Plans: lecture publique (actifs uniquement)
CREATE POLICY "Plans actifs visibles par tous"
  ON subscription_plans FOR SELECT
  USING (is_active = true);

-- Plans: admin peut tout faire
CREATE POLICY "Admin peut gérer les plans"
  ON subscription_plans FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Subscriptions: user voit la sienne
CREATE POLICY "User voit son abonnement"
  ON subscriptions FOR SELECT
  USING (user_id = auth.uid());

-- Subscriptions: admin voit tout
CREATE POLICY "Admin voit tous les abonnements"
  ON subscriptions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Subscriptions: admin peut modifier
CREATE POLICY "Admin peut modifier les abonnements"
  ON subscriptions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Usage: user voit le sien
CREATE POLICY "User voit son usage"
  ON subscription_usage FOR SELECT
  USING (user_id = auth.uid());

-- Usage: admin voit tout
CREATE POLICY "Admin voit tout l'usage"
  ON subscription_usage FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Events: user voit les siens
CREATE POLICY "User voit ses événements"
  ON subscription_events FOR SELECT
  USING (user_id = auth.uid());

-- Events: admin voit tout
CREATE POLICY "Admin voit tous les événements"
  ON subscription_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Promo codes: lecture pour validation
CREATE POLICY "Codes promo actifs lisibles"
  ON promo_codes FOR SELECT
  USING (is_active = true AND (valid_until IS NULL OR valid_until > NOW()));

-- Promo codes: admin gère tout
CREATE POLICY "Admin gère les codes promo"
  ON promo_codes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Invoices: user voit les siennes
CREATE POLICY "User voit ses factures"
  ON subscription_invoices FOR SELECT
  USING (user_id = auth.uid());

-- Invoices: admin voit tout
CREATE POLICY "Admin voit toutes les factures"
  ON subscription_invoices FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Admin actions: admin uniquement
CREATE POLICY "Admin actions visibles par admin"
  ON admin_subscription_actions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Admin notes: admin uniquement
CREATE POLICY "Admin notes visibles par admin"
  ON admin_user_notes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- 6. SEED DATA - PLANS
-- ============================================

INSERT INTO subscription_plans (slug, name, description, tagline, price_monthly, price_yearly, limits, features, highlights, is_active, is_popular, display_order, trial_days, cta_text)
VALUES
(
  'gratuit',
  'Gratuit',
  'Idéal pour découvrir la plateforme',
  'Démarrez gratuitement',
  0,
  0,
  '{
    "max_properties": 1,
    "max_leases": 1,
    "max_users": 1,
    "max_signatures_monthly": 0,
    "storage_gb": 0.1
  }',
  '{
    "property_management": true,
    "lease_management": true,
    "rent_tracking": true,
    "receipt_generation": true,
    "tenant_portal_basic": true,
    "electronic_signature": false,
    "open_banking": false,
    "ai_scoring": false,
    "ai_scoring_advanced": false,
    "auto_reminders_email": false,
    "auto_reminders_sms": false,
    "edl_digital": false,
    "irl_indexation": false,
    "multi_users": false,
    "api_access": false,
    "api_access_full": false,
    "provider_management": false,
    "reports_advanced": false,
    "white_label": false,
    "copro_module": false,
    "sso": false
  }',
  '["Gestion de 1 bien", "Création de bail", "Quittances PDF", "Suivi des loyers"]',
  true,
  false,
  0,
  0,
  'Commencer gratuitement'
),
(
  'confort',
  'Confort',
  'Pour les bailleurs exigeants',
  'Le plus populaire',
  1900,
  19000,
  '{
    "max_properties": 15,
    "max_leases": -1,
    "max_users": 1,
    "max_signatures_monthly": 5,
    "storage_gb": 10
  }',
  '{
    "property_management": true,
    "lease_management": true,
    "rent_tracking": true,
    "receipt_generation": true,
    "tenant_portal_basic": true,
    "electronic_signature": true,
    "open_banking": true,
    "ai_scoring": true,
    "ai_scoring_advanced": false,
    "auto_reminders_email": true,
    "auto_reminders_sms": false,
    "edl_digital": true,
    "irl_indexation": true,
    "multi_users": false,
    "api_access": false,
    "api_access_full": false,
    "provider_management": false,
    "reports_advanced": false,
    "white_label": false,
    "copro_module": false,
    "sso": false
  }',
  '["Jusqu''à 15 biens", "Signature électronique (5/mois)", "Open Banking", "Scoring IA locataire", "Relances automatiques", "EDL numérique"]',
  true,
  true,
  1,
  14,
  'Essai gratuit 14 jours'
),
(
  'pro',
  'Pro',
  'Pour les gestionnaires professionnels',
  'Performance maximale',
  4900,
  49000,
  '{
    "max_properties": 100,
    "extra_property_price": 100,
    "max_leases": -1,
    "max_users": 10,
    "max_signatures_monthly": -1,
    "storage_gb": 50
  }',
  '{
    "property_management": true,
    "lease_management": true,
    "rent_tracking": true,
    "receipt_generation": true,
    "tenant_portal_basic": true,
    "electronic_signature": true,
    "open_banking": true,
    "ai_scoring": true,
    "ai_scoring_advanced": true,
    "auto_reminders_email": true,
    "auto_reminders_sms": true,
    "edl_digital": true,
    "irl_indexation": true,
    "multi_users": true,
    "api_access": true,
    "api_access_full": false,
    "provider_management": true,
    "reports_advanced": true,
    "white_label": false,
    "copro_module": false,
    "sso": false
  }',
  '["100 biens inclus (+1€/bien)", "Signatures illimitées", "Scoring IA avancé (GPT-4)", "10 utilisateurs", "Relances SMS", "Gestion prestataires", "API accès"]',
  true,
  false,
  2,
  14,
  'Essai gratuit 14 jours'
),
(
  'enterprise',
  'Enterprise',
  'Solution sur-mesure pour les grandes structures',
  'Puissance illimitée',
  NULL,
  NULL,
  '{
    "max_properties": -1,
    "max_leases": -1,
    "max_users": -1,
    "max_signatures_monthly": -1,
    "storage_gb": -1
  }',
  '{
    "property_management": true,
    "lease_management": true,
    "rent_tracking": true,
    "receipt_generation": true,
    "tenant_portal_basic": true,
    "electronic_signature": true,
    "open_banking": true,
    "ai_scoring": true,
    "ai_scoring_advanced": true,
    "auto_reminders_email": true,
    "auto_reminders_sms": true,
    "edl_digital": true,
    "irl_indexation": true,
    "multi_users": true,
    "api_access": true,
    "api_access_full": true,
    "provider_management": true,
    "reports_advanced": true,
    "white_label": true,
    "copro_module": true,
    "sso": true
  }',
  '["Biens illimités", "Utilisateurs illimités", "White label", "API complète + Webhooks", "SSO (SAML/OAuth)", "Module copropriété", "Account manager dédié", "SLA 99,5%"]',
  true,
  false,
  3,
  30,
  'Nous contacter'
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tagline = EXCLUDED.tagline,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  limits = EXCLUDED.limits,
  features = EXCLUDED.features,
  highlights = EXCLUDED.highlights,
  is_popular = EXCLUDED.is_popular,
  display_order = EXCLUDED.display_order,
  trial_days = EXCLUDED.trial_days,
  cta_text = EXCLUDED.cta_text,
  updated_at = NOW();

-- ============================================
-- 7. VUE ADMIN
-- ============================================

CREATE OR REPLACE VIEW admin_subscriptions_overview AS
SELECT 
  u.id as user_id,
  u.email,
  u.created_at as user_created_at,
  p.prenom,
  p.nom,
  p.role as user_role,
  s.id as subscription_id,
  s.plan_slug,
  sp.name as plan_name,
  sp.price_monthly,
  s.status,
  s.billing_cycle,
  s.current_period_start,
  s.current_period_end,
  s.trial_end,
  s.canceled_at,
  s.cancel_at_period_end,
  s.stripe_customer_id,
  s.stripe_subscription_id,
  su.properties_count,
  su.leases_count,
  su.signatures_used_this_month,
  (sp.limits->>'max_properties')::int as max_properties,
  (sp.limits->>'max_signatures_monthly')::int as max_signatures,
  CASE 
    WHEN s.status = 'active' AND sp.price_monthly > 0 THEN sp.price_monthly
    ELSE 0
  END as mrr_contribution
FROM auth.users u
LEFT JOIN profiles p ON p.user_id = u.id
LEFT JOIN subscriptions s ON s.user_id = u.id
LEFT JOIN subscription_plans sp ON sp.slug = s.plan_slug
LEFT JOIN subscription_usage su ON su.user_id = u.id 
  AND su.period_start = DATE_TRUNC('month', NOW());

-- Stats globales
CREATE OR REPLACE FUNCTION get_subscription_stats()
RETURNS TABLE (
  total_users BIGINT,
  paying_users BIGINT,
  free_users BIGINT,
  trialing_users BIGINT,
  canceled_users BIGINT,
  mrr BIGINT,
  arr BIGINT,
  arpu NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(DISTINCT s.user_id)::BIGINT as total_users,
    COUNT(DISTINCT s.user_id) FILTER (WHERE s.plan_slug != 'gratuit' AND s.status = 'active')::BIGINT as paying_users,
    COUNT(DISTINCT s.user_id) FILTER (WHERE s.plan_slug = 'gratuit')::BIGINT as free_users,
    COUNT(DISTINCT s.user_id) FILTER (WHERE s.status = 'trialing')::BIGINT as trialing_users,
    COUNT(DISTINCT s.user_id) FILTER (WHERE s.status = 'canceled')::BIGINT as canceled_users,
    COALESCE(SUM(sp.price_monthly) FILTER (WHERE s.status = 'active'), 0)::BIGINT as mrr,
    COALESCE(SUM(sp.price_monthly) FILTER (WHERE s.status = 'active'), 0)::BIGINT * 12 as arr,
    CASE 
      WHEN COUNT(*) FILTER (WHERE s.plan_slug != 'gratuit' AND s.status = 'active') > 0 
      THEN ROUND(SUM(sp.price_monthly) FILTER (WHERE s.status = 'active')::NUMERIC / 
           COUNT(*) FILTER (WHERE s.plan_slug != 'gratuit' AND s.status = 'active'), 2)
      ELSE 0
    END as arpu
  FROM subscriptions s
  LEFT JOIN subscription_plans sp ON sp.slug = s.plan_slug;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Distribution par plan
CREATE OR REPLACE FUNCTION get_plans_distribution()
RETURNS TABLE (
  plan_slug TEXT,
  plan_name TEXT,
  count BIGINT,
  percentage NUMERIC
) AS $$
DECLARE
  total BIGINT;
BEGIN
  SELECT COUNT(*) INTO total FROM subscriptions;
  
  RETURN QUERY
  SELECT 
    s.plan_slug,
    sp.name,
    COUNT(*)::BIGINT,
    ROUND(COUNT(*)::NUMERIC / NULLIF(total, 0) * 100, 1)
  FROM subscriptions s
  LEFT JOIN subscription_plans sp ON sp.slug = s.plan_slug
  GROUP BY s.plan_slug, sp.name, sp.display_order
  ORDER BY sp.display_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE subscription_plans IS 'Plans d''abonnement disponibles';
COMMENT ON TABLE subscriptions IS 'Abonnements des utilisateurs';
COMMENT ON TABLE subscription_usage IS 'Usage mensuel par utilisateur';
COMMENT ON TABLE subscription_events IS 'Historique des événements d''abonnement';
COMMENT ON TABLE promo_codes IS 'Codes promotionnels';
COMMENT ON TABLE subscription_invoices IS 'Factures d''abonnement';
COMMENT ON TABLE admin_subscription_actions IS 'Actions admin sur les abonnements';


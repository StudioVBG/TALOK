-- ============================================
-- SOTA 2026 Payment System Migration
-- State-of-the-art payment infrastructure
-- ============================================

-- ============================================
-- 1. REVENUE INTELLIGENCE
-- ============================================

-- Revenue metrics history for tracking and forecasting
CREATE TABLE IF NOT EXISTS revenue_metrics_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Core metrics
  mrr NUMERIC(12, 2) NOT NULL DEFAULT 0,
  arr NUMERIC(12, 2) NOT NULL DEFAULT 0,
  nrr NUMERIC(5, 2) NOT NULL DEFAULT 100, -- Net Revenue Retention %
  grr NUMERIC(5, 2) NOT NULL DEFAULT 100, -- Gross Revenue Retention %

  -- Per user metrics
  arpu NUMERIC(10, 2) NOT NULL DEFAULT 0,
  arppu NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ltv NUMERIC(12, 2) NOT NULL DEFAULT 0,

  -- Churn
  churn_rate NUMERIC(5, 2) NOT NULL DEFAULT 0,
  revenue_churn_rate NUMERIC(5, 2) NOT NULL DEFAULT 0,

  -- MRR breakdown
  mrr_new NUMERIC(10, 2) NOT NULL DEFAULT 0,
  mrr_expansion NUMERIC(10, 2) NOT NULL DEFAULT 0,
  mrr_contraction NUMERIC(10, 2) NOT NULL DEFAULT 0,
  mrr_churn NUMERIC(10, 2) NOT NULL DEFAULT 0,
  mrr_reactivation NUMERIC(10, 2) NOT NULL DEFAULT 0,

  -- Growth
  quick_ratio NUMERIC(5, 2) NOT NULL DEFAULT 0,

  -- Period
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_revenue_metrics_period ON revenue_metrics_history(period_start DESC);

-- ============================================
-- 2. SMART DUNNING
-- ============================================

-- Dunning sequences configuration
CREATE TABLE IF NOT EXISTS dunning_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  steps JSONB NOT NULL DEFAULT '[]',
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default sequences
INSERT INTO dunning_sequences (slug, name, description, steps, is_default) VALUES
('default', 'Standard Dunning', 'Séquence de récupération standard', '[
  {"day": 0, "action": "soft_reminder_email", "template_id": "payment_failed_day0", "channel": "email"},
  {"day": 3, "action": "sms_reminder", "template_id": "payment_reminder_sms", "channel": "sms", "fallback_channel": "email"},
  {"day": 7, "action": "payment_method_update_request", "template_id": "update_payment_method", "channel": "email"},
  {"day": 14, "action": "offer_payment_plan", "template_id": "payment_plan_offer", "channel": "email"},
  {"day": 21, "action": "final_warning", "template_id": "final_warning", "channel": "email"},
  {"day": 30, "action": "graceful_downgrade", "template_id": "graceful_downgrade", "channel": "email"}
]', TRUE),
('vip', 'VIP Dunning', 'Séquence douce pour clients premium', '[
  {"day": 0, "action": "soft_reminder_email", "template_id": "vip_payment_failed", "channel": "email"},
  {"day": 2, "action": "soft_reminder_email", "template_id": "vip_friendly_reminder", "channel": "email"},
  {"day": 5, "action": "payment_method_update_request", "template_id": "vip_update_payment", "channel": "email"},
  {"day": 10, "action": "offer_payment_plan", "template_id": "vip_payment_plan", "channel": "email"},
  {"day": 20, "action": "final_warning", "template_id": "vip_final_warning", "channel": "email"},
  {"day": 45, "action": "graceful_downgrade", "template_id": "vip_downgrade", "channel": "email"}
]', FALSE)
ON CONFLICT (slug) DO NOTHING;

-- Dunning attempts tracking
CREATE TABLE IF NOT EXISTS dunning_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  sequence_id TEXT NOT NULL,
  current_step INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'recovered', 'failed', 'cancelled')),
  payment_intent_id TEXT,
  amount_due NUMERIC(10, 2) NOT NULL,
  currency TEXT DEFAULT 'eur',
  attempts JSONB DEFAULT '[]',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  recovered_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dunning_attempts_status ON dunning_attempts(status);
CREATE INDEX idx_dunning_attempts_subscription ON dunning_attempts(subscription_id);

-- Payment plan offers for dunning
CREATE TABLE IF NOT EXISTS payment_plan_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  total_amount NUMERIC(10, 2) NOT NULL,
  installments INTEGER NOT NULL DEFAULT 3,
  installment_amount NUMERIC(10, 2) NOT NULL,
  status TEXT DEFAULT 'offered' CHECK (status IN ('offered', 'accepted', 'declined', 'completed', 'expired')),
  expires_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Churn predictions
CREATE TABLE IF NOT EXISTS churn_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
  risk_score INTEGER NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  factors JSONB DEFAULT '[]',
  recommended_actions JSONB DEFAULT '[]',
  confidence NUMERIC(3, 2) DEFAULT 0.5,
  calculated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id)
);

CREATE INDEX idx_churn_predictions_risk ON churn_predictions(risk_level, risk_score DESC);

-- ============================================
-- 3. USAGE-BASED BILLING
-- ============================================

-- Usage meters
CREATE TABLE IF NOT EXISTS usage_meters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  event_name TEXT NOT NULL,
  aggregation TEXT DEFAULT 'sum' CHECK (aggregation IN ('sum', 'count', 'max', 'last')),
  default_unit TEXT DEFAULT 'units',
  stripe_meter_id TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default meters
INSERT INTO usage_meters (name, event_name, aggregation, default_unit) VALUES
('signatures', 'signature_created', 'sum', 'signatures'),
('api_calls', 'api_call', 'sum', 'calls'),
('storage', 'storage_change', 'sum', 'bytes'),
('documents', 'document_created', 'count', 'documents')
ON CONFLICT (name) DO NOTHING;

-- Usage records
CREATE TABLE IF NOT EXISTS usage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
  meter_id UUID REFERENCES usage_meters(id) ON DELETE CASCADE,
  quantity NUMERIC(15, 4) NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  idempotency_key TEXT UNIQUE NOT NULL,
  stripe_event_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_usage_records_subscription_meter ON usage_records(subscription_id, meter_id);
CREATE INDEX idx_usage_records_timestamp ON usage_records(timestamp DESC);

-- ============================================
-- 4. CREDIT SYSTEM
-- ============================================

-- Credit balances
CREATE TABLE IF NOT EXISTS credit_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  balance INTEGER NOT NULL DEFAULT 0,
  lifetime_earned INTEGER NOT NULL DEFAULT 0,
  lifetime_spent INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Credit transactions
CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('earned', 'spent', 'expired', 'purchased', 'gifted', 'refunded')),
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  description TEXT NOT NULL,
  reference_type TEXT CHECK (reference_type IN ('subscription', 'signature', 'purchase', 'promo', 'admin')),
  reference_id TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_credit_transactions_user ON credit_transactions(user_id, created_at DESC);

-- Credit packages for purchase
CREATE TABLE IF NOT EXISTS credit_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  credits INTEGER NOT NULL,
  price INTEGER NOT NULL, -- In cents
  bonus_credits INTEGER DEFAULT 0,
  stripe_price_id TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  popular BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default credit packages
INSERT INTO credit_packages (name, credits, price, bonus_credits, popular) VALUES
('Starter', 100, 990, 0, FALSE),
('Pro', 500, 3990, 50, TRUE),
('Business', 1000, 6990, 150, FALSE),
('Enterprise', 5000, 29900, 1000, FALSE)
ON CONFLICT DO NOTHING;

-- ============================================
-- 5. TENANT REWARDS PROGRAM
-- ============================================

-- Tenant rewards accounts
CREATE TABLE IF NOT EXISTS tenant_rewards_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE,
  points_balance INTEGER NOT NULL DEFAULT 0,
  lifetime_points INTEGER NOT NULL DEFAULT 0,
  tier TEXT DEFAULT 'bronze' CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum')),
  tier_progress INTEGER DEFAULT 0 CHECK (tier_progress >= 0 AND tier_progress <= 100),
  payment_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  rewards_earned NUMERIC(10, 2) DEFAULT 0,
  credit_reporting_enabled BOOLEAN DEFAULT FALSE,
  credit_reporting_enrolled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tenant_rewards_tier ON tenant_rewards_accounts(tier);
CREATE INDEX idx_tenant_rewards_points ON tenant_rewards_accounts(lifetime_points DESC);

-- Reward partners
CREATE TABLE IF NOT EXISTS reward_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  logo_url TEXT,
  category TEXT CHECK (category IN ('dining', 'shopping', 'entertainment', 'travel', 'services', 'utilities')),
  points_per_euro NUMERIC(5, 2) DEFAULT 100, -- 100 points = €1
  description TEXT,
  terms TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  is_featured BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sample partners
INSERT INTO reward_partners (name, category, description, is_featured) VALUES
('Amazon', 'shopping', 'Cartes cadeaux Amazon', TRUE),
('Carrefour', 'shopping', 'Courses et cartes cadeaux', TRUE),
('Netflix', 'entertainment', 'Abonnement et crédit', FALSE),
('Uber Eats', 'dining', 'Crédit livraison repas', FALSE),
('Fnac', 'shopping', 'Cartes cadeaux culture', FALSE),
('Decathlon', 'shopping', 'Équipement sportif', FALSE)
ON CONFLICT DO NOTHING;

-- Reward transactions
CREATE TABLE IF NOT EXISTS reward_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES tenant_rewards_accounts(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('earned', 'redeemed', 'expired', 'bonus')),
  points INTEGER NOT NULL,
  description TEXT NOT NULL,
  reference_type TEXT CHECK (reference_type IN ('rent_payment', 'referral', 'streak_bonus', 'redemption', 'promo')),
  reference_id TEXT,
  partner_id UUID REFERENCES reward_partners(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reward_transactions_account ON reward_transactions(account_id, created_at DESC);

-- Reward redemptions
CREATE TABLE IF NOT EXISTS reward_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES tenant_rewards_accounts(id) ON DELETE CASCADE,
  partner_id UUID REFERENCES reward_partners(id) ON DELETE SET NULL,
  points_spent INTEGER NOT NULL,
  value NUMERIC(10, 2) NOT NULL,
  code TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'used', 'expired', 'cancelled')),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reward_redemptions_account ON reward_redemptions(account_id);

-- Tenant badges
CREATE TABLE IF NOT EXISTS tenant_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  badge_id TEXT NOT NULL,
  earned_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(tenant_id, badge_id)
);

CREATE INDEX idx_tenant_badges_tenant ON tenant_badges(tenant_id);

-- ============================================
-- 6. EMBEDDED FINANCE
-- ============================================

-- Financing offers
CREATE TABLE IF NOT EXISTS financing_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  user_type TEXT NOT NULL CHECK (user_type IN ('owner', 'tenant')),
  offer_type TEXT NOT NULL CHECK (offer_type IN ('rent_advance', 'deposit_split', 'work_loan', 'bnpl')),
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'applied', 'approved', 'active', 'completed', 'declined')),
  amount_min NUMERIC(10, 2) NOT NULL,
  amount_max NUMERIC(10, 2) NOT NULL,
  apr NUMERIC(5, 2) NOT NULL, -- Annual percentage rate
  term_months INTEGER NOT NULL,
  monthly_payment NUMERIC(10, 2),
  stripe_capital_offer_id TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_financing_offers_user ON financing_offers(user_id, status);

-- Financing applications
CREATE TABLE IF NOT EXISTS financing_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID REFERENCES financing_offers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  requested_amount NUMERIC(10, 2) NOT NULL,
  approved_amount NUMERIC(10, 2),
  term_months INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'approved', 'declined', 'cancelled')),
  decision_at TIMESTAMPTZ,
  decline_reason TEXT,
  stripe_application_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Instant payouts
CREATE TABLE IF NOT EXISTS instant_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  fee NUMERIC(10, 2) NOT NULL,
  net_amount NUMERIC(10, 2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  destination TEXT CHECK (destination IN ('bank_account', 'debit_card')),
  stripe_payout_id TEXT,
  arrival_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_instant_payouts_user ON instant_payouts(user_id, created_at DESC);

-- ============================================
-- 7. BANK RECONCILIATION
-- ============================================

-- Bank connections
CREATE TABLE IF NOT EXISTS bank_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('plaid', 'bridge', 'tink', 'nordigen')),
  institution_name TEXT NOT NULL,
  institution_logo TEXT,
  account_id TEXT NOT NULL,
  account_name TEXT,
  account_type TEXT CHECK (account_type IN ('checking', 'savings')),
  last_synced_at TIMESTAMPTZ,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'error', 'disconnected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, provider, account_id)
);

-- Bank transactions
CREATE TABLE IF NOT EXISTS bank_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES bank_connections(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  transaction_id TEXT NOT NULL,
  date DATE NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  currency TEXT DEFAULT 'EUR',
  description TEXT,
  category TEXT,
  counterparty TEXT,
  is_matched BOOLEAN DEFAULT FALSE,
  matched_payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  match_confidence NUMERIC(3, 2),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(connection_id, transaction_id)
);

CREATE INDEX idx_bank_transactions_user ON bank_transactions(user_id, date DESC);
CREATE INDEX idx_bank_transactions_unmatched ON bank_transactions(user_id, is_matched) WHERE is_matched = FALSE;

-- Reconciliation rules
CREATE TABLE IF NOT EXISTS reconciliation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  conditions JSONB NOT NULL DEFAULT '[]',
  action TEXT CHECK (action IN ('auto_match', 'suggest', 'ignore')),
  property_id UUID,
  tenant_id UUID,
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reconciliation suggestions
CREATE TABLE IF NOT EXISTS reconciliation_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_transaction_id UUID REFERENCES bank_transactions(id) ON DELETE CASCADE,
  suggested_payment_id UUID REFERENCES payments(id) ON DELETE CASCADE,
  confidence NUMERIC(5, 2) NOT NULL,
  match_reasons JSONB DEFAULT '[]',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 8. PAYMENT ANALYTICS
-- ============================================

-- Payment method analytics (aggregated daily)
CREATE TABLE IF NOT EXISTS payment_analytics_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  payment_method TEXT NOT NULL,
  total_transactions INTEGER DEFAULT 0,
  successful_transactions INTEGER DEFAULT 0,
  failed_transactions INTEGER DEFAULT 0,
  total_volume NUMERIC(14, 2) DEFAULT 0,
  average_amount NUMERIC(10, 2) DEFAULT 0,
  success_rate NUMERIC(5, 2) DEFAULT 0,
  avg_processing_time_ms INTEGER DEFAULT 0,

  UNIQUE(date, payment_method)
);

CREATE INDEX idx_payment_analytics_date ON payment_analytics_daily(date DESC);

-- ============================================
-- 9. ENHANCED SUBSCRIPTION EVENTS
-- ============================================

-- Add new event types to subscription_events if column exists
DO $$
BEGIN
  -- Add amount column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_events' AND column_name = 'amount'
  ) THEN
    ALTER TABLE subscription_events ADD COLUMN amount NUMERIC(10, 2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_events' AND column_name = 'currency'
  ) THEN
    ALTER TABLE subscription_events ADD COLUMN currency TEXT DEFAULT 'eur';
  END IF;
END $$;

-- ============================================
-- 10. FUNCTIONS FOR ANALYTICS
-- ============================================

-- Function to calculate MRR for a given date
CREATE OR REPLACE FUNCTION calculate_mrr_at_date(target_date DATE)
RETURNS NUMERIC(12, 2) AS $$
DECLARE
  total_mrr NUMERIC(12, 2);
BEGIN
  SELECT COALESCE(SUM(
    CASE
      WHEN s.billing_cycle = 'yearly' THEN sp.price_yearly / 12.0
      ELSE sp.price_monthly
    END
  ), 0)
  INTO total_mrr
  FROM subscriptions s
  JOIN subscription_plans sp ON s.plan_id = sp.id
  WHERE s.status = 'active'
    AND s.created_at::DATE <= target_date
    AND (s.canceled_at IS NULL OR s.canceled_at::DATE > target_date);

  RETURN total_mrr / 100.0; -- Convert from cents
END;
$$ LANGUAGE plpgsql;

-- Function to get subscription counts by status
CREATE OR REPLACE FUNCTION get_subscription_stats()
RETURNS TABLE(
  status TEXT,
  count BIGINT,
  mrr NUMERIC(12, 2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.status,
    COUNT(*)::BIGINT as count,
    COALESCE(SUM(
      CASE
        WHEN s.billing_cycle = 'yearly' THEN sp.price_yearly / 12.0
        ELSE sp.price_monthly
      END
    ), 0) / 100.0 as mrr
  FROM subscriptions s
  LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
  GROUP BY s.status;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 11. RLS POLICIES
-- ============================================

-- Enable RLS on new tables
ALTER TABLE revenue_metrics_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE dunning_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE churn_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_rewards_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE financing_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;

-- Admin-only policies for analytics
CREATE POLICY "Admin read revenue metrics" ON revenue_metrics_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- User-specific policies
CREATE POLICY "Users read own dunning attempts" ON dunning_attempts
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users read own churn predictions" ON churn_predictions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users read own credits" ON credit_balances
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users read own credit transactions" ON credit_transactions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Tenant rewards policies
CREATE POLICY "Tenants read own rewards" ON tenant_rewards_accounts
  FOR SELECT TO authenticated
  USING (tenant_id = auth.uid());

CREATE POLICY "Tenants read own reward transactions" ON reward_transactions
  FOR SELECT TO authenticated
  USING (
    account_id IN (
      SELECT id FROM tenant_rewards_accounts WHERE tenant_id = auth.uid()
    )
  );

-- Bank connections policies
CREATE POLICY "Users manage own bank connections" ON bank_connections
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users read own bank transactions" ON bank_transactions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ============================================
-- 12. TRIGGERS FOR UPDATED_AT
-- ============================================

-- Generic updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DO $$
DECLARE
  tables TEXT[] := ARRAY[
    'dunning_sequences',
    'dunning_attempts',
    'credit_balances',
    'tenant_rewards_accounts'
  ];
  t TEXT;
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS update_%s_updated_at ON %s;
      CREATE TRIGGER update_%s_updated_at
        BEFORE UPDATE ON %s
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    ', t, t, t, t);
  END LOOP;
END $$;

-- ============================================
-- DONE
-- ============================================

COMMENT ON TABLE revenue_metrics_history IS 'SOTA 2026: Historical revenue metrics for analytics and forecasting';
COMMENT ON TABLE dunning_attempts IS 'SOTA 2026: Smart dunning payment recovery tracking';
COMMENT ON TABLE churn_predictions IS 'SOTA 2026: AI-powered churn risk predictions';
COMMENT ON TABLE usage_meters IS 'SOTA 2026: Usage-based billing meters';
COMMENT ON TABLE credit_balances IS 'SOTA 2026: Credit system for hybrid pricing';
COMMENT ON TABLE tenant_rewards_accounts IS 'SOTA 2026: Tenant loyalty rewards program';
COMMENT ON TABLE financing_offers IS 'SOTA 2026: Embedded finance offers';
COMMENT ON TABLE bank_connections IS 'SOTA 2026: Open banking connections for reconciliation';

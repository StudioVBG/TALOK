-- Migration: SOTA 2026 Security & Reconciliation
-- Date: 2026-01-10
-- Description: Tables pour webhooks, réconciliation, et sécurité améliorée

-- =====================================================
-- TABLE WEBHOOK_EVENTS (Idempotence)
-- =====================================================

CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL, -- 'stripe', 'gocardless', 'twilio'
  provider_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'processing', 'processed', 'failed')
  ),
  error_message TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Contrainte d'unicité pour idempotence
  CONSTRAINT webhook_events_unique UNIQUE (provider, provider_event_id)
);

-- Index pour requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_webhook_events_provider ON webhook_events(provider);
CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON webhook_events(status);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON webhook_events(created_at DESC);

-- =====================================================
-- TABLE SEPA_MANDATES (Mandats de prélèvement)
-- =====================================================

CREATE TABLE IF NOT EXISTS sepa_mandates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id),

  -- Données du mandat
  provider TEXT NOT NULL DEFAULT 'gocardless', -- 'gocardless', 'stripe'
  provider_mandate_id TEXT,
  provider_customer_id TEXT,

  -- IBAN (chiffré)
  iban_encrypted TEXT,
  iban_last4 TEXT,
  bic TEXT,

  -- Statut
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'submitted', 'active', 'cancelled', 'expired', 'failed')
  ),
  failure_reason TEXT,

  -- Dates
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,

  CONSTRAINT sepa_mandates_provider_unique UNIQUE (provider, provider_mandate_id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_sepa_mandates_lease_id ON sepa_mandates(lease_id);
CREATE INDEX IF NOT EXISTS idx_sepa_mandates_status ON sepa_mandates(status);
CREATE INDEX IF NOT EXISTS idx_sepa_mandates_provider_id ON sepa_mandates(provider_mandate_id);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_sepa_mandates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sepa_mandates_updated_at ON sepa_mandates;
CREATE TRIGGER trigger_sepa_mandates_updated_at
  BEFORE UPDATE ON sepa_mandates
  FOR EACH ROW
  EXECUTE FUNCTION update_sepa_mandates_updated_at();

-- =====================================================
-- TABLE AUTOPAY_SUBSCRIPTIONS (Abonnements auto)
-- =====================================================

CREATE TABLE IF NOT EXISTS autopay_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  mandate_id UUID REFERENCES sepa_mandates(id),

  -- Provider
  provider TEXT NOT NULL DEFAULT 'gocardless',
  provider_subscription_id TEXT,

  -- Configuration
  amount INTEGER NOT NULL, -- En centimes
  currency TEXT NOT NULL DEFAULT 'EUR',
  day_of_month INTEGER NOT NULL DEFAULT 5 CHECK (day_of_month BETWEEN 1 AND 28),

  -- Statut
  status TEXT NOT NULL DEFAULT 'active' CHECK (
    status IN ('active', 'paused', 'cancelled', 'finished')
  ),
  cancellation_reason TEXT,

  -- Dates
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  next_payment_date DATE,
  cancelled_at TIMESTAMPTZ,

  CONSTRAINT autopay_subscriptions_provider_unique UNIQUE (provider, provider_subscription_id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_autopay_subs_lease_id ON autopay_subscriptions(lease_id);
CREATE INDEX IF NOT EXISTS idx_autopay_subs_status ON autopay_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_autopay_subs_next_payment ON autopay_subscriptions(next_payment_date);

-- =====================================================
-- COLONNES ADDITIONNELLES SUR PAYMENTS
-- =====================================================

-- Ajouter colonnes si elles n'existent pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'confirmed_at'
  ) THEN
    ALTER TABLE payments ADD COLUMN confirmed_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'failure_reason'
  ) THEN
    ALTER TABLE payments ADD COLUMN failure_reason TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'failure_code'
  ) THEN
    ALTER TABLE payments ADD COLUMN failure_code TEXT;
  END IF;
END $$;

-- =====================================================
-- FONCTION FIND_DUPLICATE_PAYMENTS (pour réconciliation)
-- =====================================================

CREATE OR REPLACE FUNCTION find_duplicate_payments()
RETURNS TABLE (
  invoice_id UUID,
  provider_ref TEXT,
  duplicate_count BIGINT,
  total_amount NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.invoice_id,
    p.provider_ref,
    COUNT(*) as duplicate_count,
    SUM(p.montant) as total_amount
  FROM payments p
  WHERE p.provider_ref IS NOT NULL
  GROUP BY p.invoice_id, p.provider_ref
  HAVING COUNT(*) > 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- webhook_events: admin seulement
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_select_webhook_events" ON webhook_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = public.user_profile_id() AND role = 'admin'
    )
  );

-- sepa_mandates: owner du bail ou admin
ALTER TABLE sepa_mandates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_select_sepa_mandates" ON sepa_mandates
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON l.property_id = p.id
      WHERE l.id = sepa_mandates.lease_id
        AND p.owner_id = public.user_profile_id()
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = public.user_profile_id() AND role = 'admin'
    )
  );

CREATE POLICY "owner_insert_sepa_mandates" ON sepa_mandates
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON l.property_id = p.id
      WHERE l.id = sepa_mandates.lease_id
        AND p.owner_id = public.user_profile_id()
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = public.user_profile_id() AND role = 'admin'
    )
  );

-- autopay_subscriptions: mêmes règles que sepa_mandates
ALTER TABLE autopay_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_select_autopay" ON autopay_subscriptions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON l.property_id = p.id
      WHERE l.id = autopay_subscriptions.lease_id
        AND p.owner_id = public.user_profile_id()
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = public.user_profile_id() AND role = 'admin'
    )
  );

-- =====================================================
-- COMMENTAIRES
-- =====================================================

COMMENT ON TABLE webhook_events IS 'Événements webhook reçus pour idempotence';
COMMENT ON TABLE sepa_mandates IS 'Mandats de prélèvement SEPA';
COMMENT ON TABLE autopay_subscriptions IS 'Abonnements de paiement automatique';
COMMENT ON FUNCTION find_duplicate_payments IS 'Trouve les paiements en double pour réconciliation';

-- Migration: Stripe Connect pour les reversements aux propriétaires
-- Date: 2026-01-27
-- Description: Ajoute le support de Stripe Connect Express pour les paiements directs aux propriétaires

-- Table des comptes Stripe Connect
CREATE TABLE IF NOT EXISTS stripe_connect_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  stripe_account_id TEXT NOT NULL UNIQUE,
  account_type TEXT NOT NULL DEFAULT 'express' CHECK (account_type IN ('express', 'standard', 'custom')),

  -- Statut du compte
  charges_enabled BOOLEAN DEFAULT FALSE,
  payouts_enabled BOOLEAN DEFAULT FALSE,
  details_submitted BOOLEAN DEFAULT FALSE,

  -- Informations KYC
  requirements_currently_due JSONB DEFAULT '[]',
  requirements_eventually_due JSONB DEFAULT '[]',
  requirements_past_due JSONB DEFAULT '[]',
  requirements_disabled_reason TEXT,

  -- Informations bancaires (masquées)
  bank_account_last4 TEXT,
  bank_account_bank_name TEXT,
  default_currency TEXT DEFAULT 'eur',

  -- Métadonnées
  business_type TEXT CHECK (business_type IN ('individual', 'company')),
  country TEXT DEFAULT 'FR',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  onboarding_completed_at TIMESTAMPTZ,

  CONSTRAINT unique_profile_connect UNIQUE (profile_id)
);

-- Index pour les recherches
CREATE INDEX IF NOT EXISTS idx_stripe_connect_profile ON stripe_connect_accounts(profile_id);
CREATE INDEX IF NOT EXISTS idx_stripe_connect_stripe_id ON stripe_connect_accounts(stripe_account_id);
CREATE INDEX IF NOT EXISTS idx_stripe_connect_charges_enabled ON stripe_connect_accounts(charges_enabled) WHERE charges_enabled = TRUE;

-- Table des transferts vers les propriétaires
CREATE TABLE IF NOT EXISTS stripe_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connect_account_id UUID NOT NULL REFERENCES stripe_connect_accounts(id),
  payment_id UUID REFERENCES payments(id),
  invoice_id UUID REFERENCES invoices(id),

  -- Identifiants Stripe
  stripe_transfer_id TEXT NOT NULL UNIQUE,
  stripe_payment_intent_id TEXT,

  -- Montants
  amount INTEGER NOT NULL, -- en centimes
  currency TEXT DEFAULT 'eur',
  platform_fee INTEGER DEFAULT 0, -- commission Talok en centimes
  stripe_fee INTEGER DEFAULT 0, -- frais Stripe en centimes
  net_amount INTEGER NOT NULL, -- montant net pour le propriétaire

  -- Statut
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'canceled', 'reversed')),
  failure_reason TEXT,

  -- Métadonnées
  description TEXT,
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  CONSTRAINT positive_amounts CHECK (amount > 0 AND net_amount > 0)
);

-- Index pour les transferts
CREATE INDEX IF NOT EXISTS idx_transfers_connect ON stripe_transfers(connect_account_id);
CREATE INDEX IF NOT EXISTS idx_transfers_payment ON stripe_transfers(payment_id);
CREATE INDEX IF NOT EXISTS idx_transfers_status ON stripe_transfers(status);
CREATE INDEX IF NOT EXISTS idx_transfers_created ON stripe_transfers(created_at DESC);

-- RLS Policies
ALTER TABLE stripe_connect_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_transfers ENABLE ROW LEVEL SECURITY;

-- Propriétaires peuvent voir leur propre compte Connect
CREATE POLICY "Owners can view own connect account" ON stripe_connect_accounts
  FOR SELECT USING (profile_id = auth.uid() OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- Propriétaires peuvent créer leur compte Connect
CREATE POLICY "Owners can create own connect account" ON stripe_connect_accounts
  FOR INSERT WITH CHECK (profile_id = auth.uid());

-- Service role peut tout faire
CREATE POLICY "Service role full access connect" ON stripe_connect_accounts
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Propriétaires peuvent voir leurs transferts
CREATE POLICY "Owners can view own transfers" ON stripe_transfers
  FOR SELECT USING (
    connect_account_id IN (
      SELECT id FROM stripe_connect_accounts WHERE profile_id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Service role peut tout faire sur les transferts
CREATE POLICY "Service role full access transfers" ON stripe_transfers
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Trigger pour updated_at
CREATE TRIGGER update_stripe_connect_timestamp
  BEFORE UPDATE ON stripe_connect_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Fonction pour obtenir le compte Connect d'un propriétaire par property_id
CREATE OR REPLACE FUNCTION get_property_owner_connect_account(property_id UUID)
RETURNS TABLE (
  connect_account_id UUID,
  stripe_account_id TEXT,
  charges_enabled BOOLEAN,
  payouts_enabled BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sca.id,
    sca.stripe_account_id,
    sca.charges_enabled,
    sca.payouts_enabled
  FROM stripe_connect_accounts sca
  JOIN properties p ON p.owner_id = sca.profile_id
  WHERE p.id = property_id
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Commentaires
COMMENT ON TABLE stripe_connect_accounts IS 'Comptes Stripe Connect des propriétaires pour les reversements directs';
COMMENT ON TABLE stripe_transfers IS 'Historique des transferts vers les propriétaires via Stripe Connect';
COMMENT ON FUNCTION get_property_owner_connect_account IS 'Récupère le compte Connect du propriétaire d''une propriété';

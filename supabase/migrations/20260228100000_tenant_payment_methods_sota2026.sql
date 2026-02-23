-- ============================================================
-- SOTA 2026 : Système de paiement locataire complet
-- - tenant_payment_methods  (multi-cartes, SEPA, wallets)
-- - sepa_mandates           (mandats SEPA avec conformité)
-- - payment_schedules       (prélèvements automatiques)
-- - payment_method_audit_log (traçabilité PSD3)
-- - Ajout statut 'partial' sur invoices
-- ============================================================

-- 1. TABLE PRINCIPALE : tenant_payment_methods
CREATE TABLE IF NOT EXISTS tenant_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  stripe_customer_id TEXT NOT NULL,
  stripe_payment_method_id TEXT NOT NULL UNIQUE,

  type TEXT NOT NULL CHECK (type IN ('card', 'sepa_debit', 'apple_pay', 'google_pay', 'link')),
  is_default BOOLEAN NOT NULL DEFAULT false,
  label TEXT,

  -- Card-specific
  card_brand TEXT,
  card_last4 TEXT,
  card_exp_month INTEGER,
  card_exp_year INTEGER,
  card_fingerprint TEXT,

  -- SEPA-specific
  sepa_last4 TEXT,
  sepa_bank_code TEXT,
  sepa_country TEXT,
  sepa_fingerprint TEXT,
  sepa_mandate_id UUID,

  -- Metadata
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked', 'failed')),
  last_used_at TIMESTAMPTZ,
  failure_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tpm_tenant ON tenant_payment_methods(tenant_profile_id);
CREATE INDEX idx_tpm_stripe_pm ON tenant_payment_methods(stripe_payment_method_id);
CREATE INDEX idx_tpm_default ON tenant_payment_methods(tenant_profile_id, is_default) WHERE is_default = true;
CREATE INDEX idx_tpm_active ON tenant_payment_methods(tenant_profile_id, status) WHERE status = 'active';

ALTER TABLE tenant_payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tpm_select_own" ON tenant_payment_methods
  FOR SELECT USING (tenant_profile_id = public.user_profile_id());

CREATE POLICY "tpm_insert_own" ON tenant_payment_methods
  FOR INSERT WITH CHECK (tenant_profile_id = public.user_profile_id());

CREATE POLICY "tpm_update_own" ON tenant_payment_methods
  FOR UPDATE USING (tenant_profile_id = public.user_profile_id());

CREATE POLICY "tpm_delete_own" ON tenant_payment_methods
  FOR DELETE USING (tenant_profile_id = public.user_profile_id());

CREATE POLICY "tpm_admin_all" ON tenant_payment_methods
  FOR ALL USING (public.user_role() = 'admin');

-- Trigger updated_at
CREATE TRIGGER update_tpm_updated_at
  BEFORE UPDATE ON tenant_payment_methods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Ensure only ONE default per tenant
CREATE OR REPLACE FUNCTION enforce_single_default_payment_method()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE tenant_payment_methods
    SET is_default = false, updated_at = NOW()
    WHERE tenant_profile_id = NEW.tenant_profile_id
      AND id != NEW.id
      AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_enforce_single_default_pm
  AFTER INSERT OR UPDATE OF is_default ON tenant_payment_methods
  FOR EACH ROW
  WHEN (NEW.is_default = true)
  EXECUTE FUNCTION enforce_single_default_payment_method();


-- 2. TABLE : sepa_mandates
CREATE TABLE IF NOT EXISTS sepa_mandates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mandate_reference TEXT NOT NULL UNIQUE DEFAULT ('MNDT-' || substr(gen_random_uuid()::text, 1, 12)),
  tenant_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  owner_profile_id UUID NOT NULL REFERENCES profiles(id),
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,

  -- Debtor (locataire)
  debtor_name TEXT NOT NULL,
  debtor_iban TEXT NOT NULL,

  -- Creditor (propriétaire)
  creditor_name TEXT NOT NULL,
  creditor_iban TEXT NOT NULL,
  creditor_bic TEXT,

  -- Stripe references
  stripe_customer_id TEXT,
  stripe_payment_method_id TEXT,
  stripe_mandate_id TEXT,

  -- Mandate details
  amount DECIMAL(10,2) NOT NULL,
  signature_date DATE NOT NULL DEFAULT CURRENT_DATE,
  signed_at TIMESTAMPTZ,
  signature_method TEXT DEFAULT 'electronic' CHECK (signature_method IN ('electronic', 'paper', 'api')),
  first_collection_date DATE,

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'suspended', 'cancelled', 'expired', 'failed')),

  -- Pre-notification tracking (conformité SEPA D-14)
  last_prenotification_sent_at TIMESTAMPTZ,
  next_collection_date DATE,

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sepa_mandates_tenant ON sepa_mandates(tenant_profile_id);
CREATE INDEX idx_sepa_mandates_lease ON sepa_mandates(lease_id);
CREATE INDEX idx_sepa_mandates_status ON sepa_mandates(status) WHERE status = 'active';
CREATE INDEX idx_sepa_mandates_next_collection ON sepa_mandates(next_collection_date) WHERE status = 'active';

ALTER TABLE sepa_mandates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sepa_select_tenant" ON sepa_mandates
  FOR SELECT USING (tenant_profile_id = public.user_profile_id());

CREATE POLICY "sepa_select_owner" ON sepa_mandates
  FOR SELECT USING (owner_profile_id = public.user_profile_id());

CREATE POLICY "sepa_insert_tenant" ON sepa_mandates
  FOR INSERT WITH CHECK (tenant_profile_id = public.user_profile_id());

CREATE POLICY "sepa_update_tenant" ON sepa_mandates
  FOR UPDATE USING (tenant_profile_id = public.user_profile_id());

CREATE POLICY "sepa_admin_all" ON sepa_mandates
  FOR ALL USING (public.user_role() = 'admin');

CREATE TRIGGER update_sepa_mandates_updated_at
  BEFORE UPDATE ON sepa_mandates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Link tenant_payment_methods to sepa_mandates
ALTER TABLE tenant_payment_methods
  ADD CONSTRAINT fk_tpm_sepa_mandate
  FOREIGN KEY (sepa_mandate_id) REFERENCES sepa_mandates(id) ON DELETE SET NULL;


-- 3. TABLE : payment_schedules (échéanciers de prélèvement)
CREATE TABLE IF NOT EXISTS payment_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  mandate_id UUID REFERENCES sepa_mandates(id) ON DELETE SET NULL,
  payment_method_id UUID REFERENCES tenant_payment_methods(id) ON DELETE SET NULL,

  payment_method_type TEXT NOT NULL DEFAULT 'sepa'
    CHECK (payment_method_type IN ('sepa', 'card', 'pay_by_bank')),
  collection_day INTEGER NOT NULL DEFAULT 5 CHECK (collection_day BETWEEN 1 AND 28),
  rent_amount DECIMAL(10,2) NOT NULL,
  charges_amount DECIMAL(10,2) NOT NULL DEFAULT 0,

  is_active BOOLEAN NOT NULL DEFAULT true,
  start_date DATE NOT NULL,
  end_date DATE,

  -- Smart retry
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  last_attempt_at TIMESTAMPTZ,
  last_failure_reason TEXT,
  next_retry_at TIMESTAMPTZ,

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(lease_id)
);

CREATE INDEX idx_ps_active ON payment_schedules(is_active, collection_day) WHERE is_active = true;
CREATE INDEX idx_ps_next_retry ON payment_schedules(next_retry_at) WHERE next_retry_at IS NOT NULL;
CREATE INDEX idx_ps_lease ON payment_schedules(lease_id);

ALTER TABLE payment_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ps_select_tenant" ON payment_schedules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE l.id = payment_schedules.lease_id
        AND ls.profile_id = public.user_profile_id()
    )
  );

CREATE POLICY "ps_select_owner" ON payment_schedules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON p.id = l.property_id
      WHERE l.id = payment_schedules.lease_id
        AND p.owner_id = public.user_profile_id()
    )
  );

CREATE POLICY "ps_admin_all" ON payment_schedules
  FOR ALL USING (public.user_role() = 'admin');

CREATE TRIGGER update_ps_updated_at
  BEFORE UPDATE ON payment_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- 4. TABLE : payment_method_audit_log (PSD3 Permission Dashboard)
CREATE TABLE IF NOT EXISTS payment_method_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  payment_method_id UUID REFERENCES tenant_payment_methods(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN (
    'created', 'set_default', 'revoked', 'expired',
    'payment_success', 'payment_failed', 'prenotification_sent',
    'mandate_created', 'mandate_cancelled', 'data_accessed'
  )),
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pmal_tenant ON payment_method_audit_log(tenant_profile_id, created_at DESC);
CREATE INDEX idx_pmal_pm ON payment_method_audit_log(payment_method_id, created_at DESC);

ALTER TABLE payment_method_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pmal_select_own" ON payment_method_audit_log
  FOR SELECT USING (tenant_profile_id = public.user_profile_id());

CREATE POLICY "pmal_admin_all" ON payment_method_audit_log
  FOR ALL USING (public.user_role() = 'admin');


-- 5. Ajouter 'partial' au statut des invoices
DO $$
BEGIN
  -- Drop old constraint and recreate with 'partial'
  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name LIKE '%invoices_statut_check%'
  ) THEN
    ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_statut_check;
  END IF;

  ALTER TABLE invoices ADD CONSTRAINT invoices_statut_check
    CHECK (statut IN ('draft', 'sent', 'paid', 'late', 'partial'));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not update invoices statut constraint: %', SQLERRM;
END $$;

-- Add partial tracking columns to invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(10,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS amount_remaining DECIMAL(10,2);

-- Auto-calculate remaining on update
CREATE OR REPLACE FUNCTION update_invoice_amount_remaining()
RETURNS TRIGGER AS $$
BEGIN
  NEW.amount_remaining := NEW.montant_total - COALESCE(NEW.amount_paid, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_invoice_amount_remaining ON invoices;
CREATE TRIGGER trg_invoice_amount_remaining
  BEFORE INSERT OR UPDATE OF montant_total, amount_paid ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_invoice_amount_remaining();

-- Backfill existing invoices
UPDATE invoices
SET amount_paid = CASE WHEN statut = 'paid' THEN montant_total ELSE 0 END
WHERE amount_paid IS NULL OR amount_paid = 0;


-- 6. Add stripe_customer_id to profiles if missing
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer ON profiles(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

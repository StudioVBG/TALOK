-- Migration: hardening production paiements
-- Objectifs:
-- 1. Neutraliser les derniers chemins legacy qui activent un bail implicitement
-- 2. Renforcer l'idempotence des reversements Stripe Connect
-- 3. Distinguer transfert Connect et payout bancaire reel
-- 4. Backfiller les marqueurs de facture initiale et les liens SEPA sur les donnees existantes

-- -----------------------------------------------------------------------------
-- Flux bail / signatures / EDL
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sync_signature_session_to_entity()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'done' AND OLD.status != 'done' THEN
    IF NEW.entity_type = 'lease' THEN
      UPDATE leases
      SET
        statut = CASE
          WHEN NEW.document_type = 'bail' THEN 'fully_signed'
          ELSE statut
        END,
        signature_completed_at = NOW(),
        updated_at = NOW()
      WHERE id = NEW.entity_id;

    ELSIF NEW.entity_type = 'edl' THEN
      UPDATE edl
      SET
        status = 'signed',
        updated_at = NOW()
      WHERE id = NEW.entity_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_activate_lease_on_edl ON public.edl;
DROP TRIGGER IF EXISTS tr_check_activate_lease ON public.lease_signers;
DROP TRIGGER IF EXISTS trg_invoice_on_lease_fully_signed ON public.leases;
DROP TRIGGER IF EXISTS trg_invoice_engine_on_lease_active ON public.leases;

-- -----------------------------------------------------------------------------
-- Reversements Stripe Connect / payouts
-- -----------------------------------------------------------------------------

ALTER TABLE public.stripe_transfers
  ADD COLUMN IF NOT EXISTS stripe_source_transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_destination_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS payout_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS idx_stripe_transfers_unique_payment
  ON public.stripe_transfers(payment_id)
  WHERE payment_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_stripe_transfers_unique_invoice_transfer
  ON public.stripe_transfers(invoice_id, stripe_transfer_id);

CREATE TABLE IF NOT EXISTS public.stripe_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connect_account_id UUID NOT NULL REFERENCES public.stripe_connect_accounts(id) ON DELETE CASCADE,
  stripe_payout_id TEXT NOT NULL UNIQUE,
  stripe_balance_transaction_id TEXT,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'eur',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'failed', 'canceled', 'in_transit')),
  arrival_date TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  failure_code TEXT,
  failure_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stripe_payouts_connect_account
  ON public.stripe_payouts(connect_account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stripe_payouts_status
  ON public.stripe_payouts(status, created_at DESC);

ALTER TABLE public.stripe_payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can view own payouts" ON public.stripe_payouts;
CREATE POLICY "Owners can view own payouts" ON public.stripe_payouts
  FOR SELECT USING (
    connect_account_id IN (
      SELECT sca.id
      FROM public.stripe_connect_accounts sca
      WHERE sca.profile_id = public.user_profile_id()
    )
    OR public.user_role() = 'admin'
  );

DROP POLICY IF EXISTS "Service role full access payouts" ON public.stripe_payouts;
CREATE POLICY "Service role full access payouts" ON public.stripe_payouts
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

DROP TRIGGER IF EXISTS update_stripe_payouts_updated_at ON public.stripe_payouts;
CREATE TRIGGER update_stripe_payouts_updated_at
  BEFORE UPDATE ON public.stripe_payouts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'stripe_transfers'
      AND column_name = 'payout_id'
  ) THEN
    BEGIN
      ALTER TABLE public.stripe_transfers
        ADD CONSTRAINT fk_stripe_transfers_payout
        FOREIGN KEY (payout_id) REFERENCES public.stripe_payouts(id) ON DELETE SET NULL;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Backfills securises et idempotents
-- -----------------------------------------------------------------------------

UPDATE public.invoices
SET type = 'initial_invoice'
WHERE COALESCE(metadata->>'type', '') = 'initial_invoice'
  AND COALESCE(type, '') <> 'initial_invoice';

UPDATE public.invoices
SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('type', 'initial_invoice')
WHERE type = 'initial_invoice'
  AND COALESCE(metadata->>'type', '') <> 'initial_invoice';

UPDATE public.tenant_payment_methods tpm
SET sepa_mandate_id = sm.id,
    updated_at = NOW()
FROM public.sepa_mandates sm
WHERE tpm.type = 'sepa_debit'
  AND tpm.sepa_mandate_id IS NULL
  AND tpm.tenant_profile_id = sm.tenant_profile_id
  AND tpm.stripe_payment_method_id = sm.stripe_payment_method_id;

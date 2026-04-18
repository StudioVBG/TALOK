-- ====================================================================
-- Sprint B2 — Phase 4 CRITIQUE — Batch 6/10
-- 5 migrations
--
-- COMMENT UTILISER :
--   1. Ouvrir Supabase Dashboard → SQL Editor → New query
--   2. Coller CE FICHIER ENTIER
--   3. Cliquer Run
--   4. Vérifier que les messages NOTICE affichent toutes les migrations en succès
--   5. Signaler "suivant" pour recevoir le batch suivant
--
-- En cas d'échec : toute la transaction est rollback. Le message d'erreur indique
-- la migration fautive. Corriger manuellement puis re-coller ce batch.
-- ====================================================================

BEGIN;

-- --------------------------------------------------------------------
-- Migration: 20260310200000_add_signature_push_franceconnect.sql
-- Risk: CRITIQUE
-- Why: Touche auth.users
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260310200000_add_signature_push_franceconnect.sql'; END $pre$;

-- Migration: Ajout colonnes signatures (Yousign), table franceconnect_sessions,
-- et colonnes push Web Push sur notification_settings
-- Date: 2026-03-10

-- =============================================================================
-- 1. signatures: ajout colonnes provider et signing_url pour intégration Yousign
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'signatures' AND column_name = 'provider'
  ) THEN
    ALTER TABLE signatures ADD COLUMN provider TEXT DEFAULT 'internal';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'signatures' AND column_name = 'signing_url'
  ) THEN
    ALTER TABLE signatures ADD COLUMN signing_url TEXT;
  END IF;
END $$;

COMMENT ON COLUMN signatures.provider IS 'Provider de signature: internal, yousign, docusign';
COMMENT ON COLUMN signatures.signing_url IS 'URL de signature externe (Yousign)';

-- =============================================================================
-- 2. franceconnect_sessions: sessions OIDC FranceConnect / France Identité
-- =============================================================================
CREATE TABLE IF NOT EXISTS franceconnect_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  state TEXT NOT NULL UNIQUE,
  nonce TEXT NOT NULL,
  context TEXT NOT NULL DEFAULT 'identity_verification',
  callback_url TEXT NOT NULL DEFAULT '/',
  used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fc_sessions_user_id ON franceconnect_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_fc_sessions_state ON franceconnect_sessions(state);
CREATE INDEX IF NOT EXISTS idx_fc_sessions_expires_at ON franceconnect_sessions(expires_at);

-- RLS
ALTER TABLE franceconnect_sessions ENABLE ROW LEVEL SECURITY;

-- Les utilisateurs ne peuvent voir que leurs propres sessions
DROP POLICY IF EXISTS "Users can view own FC sessions" ON franceconnect_sessions;
CREATE POLICY "Users can view own FC sessions"
  ON franceconnect_sessions FOR SELECT
  USING (auth.uid() = user_id);

-- Seul le service role peut insérer/modifier (via l'API route)
DROP POLICY IF EXISTS "Service role can manage FC sessions" ON franceconnect_sessions;
CREATE POLICY "Service role can manage FC sessions"
  ON franceconnect_sessions FOR ALL
  USING (auth.role() = 'service_role');

-- Nettoyage automatique des sessions expirées (via pg_cron si disponible)
-- DELETE FROM franceconnect_sessions WHERE expires_at < NOW();

-- =============================================================================
-- 3. notification_settings: colonnes push_enabled et push_subscription
--    pour le Web Push API (VAPID)
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notification_settings' AND column_name = 'push_enabled'
  ) THEN
    ALTER TABLE notification_settings ADD COLUMN push_enabled BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notification_settings' AND column_name = 'push_subscription'
  ) THEN
    ALTER TABLE notification_settings ADD COLUMN push_subscription JSONB;
  END IF;
END $$;

COMMENT ON COLUMN notification_settings.push_enabled IS 'Web Push activé pour cet utilisateur';
COMMENT ON COLUMN notification_settings.push_subscription IS 'Objet PushSubscription (endpoint, keys) pour Web Push API';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260310200000', 'add_signature_push_franceconnect')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260310200000_add_signature_push_franceconnect.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260310200000_fix_property_limit_extra_properties.sql
-- Note: file on disk is 20260310200000_fix_property_limit_extra_properties.sql but will be renamed to 20260310200001_fix_property_limit_extra_properties.sql
-- Risk: CRITIQUE
-- Why: ALTER/DROP sur table billing (stripe_* / subscriptions*)
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260310200000_fix_property_limit_extra_properties.sql'; END $pre$;

-- =====================================================
-- Migration: Allow extra properties for paid plans
--
-- Problème: Le trigger enforce_property_limit() bloque la
-- création de biens au-delà de max_properties, même pour
-- les forfaits payants (Starter, Confort, Pro) qui permettent
-- d'ajouter des biens supplémentaires moyennant un surcoût.
--
-- Fix:
-- - Ajouter la colonne extra_property_price à subscription_plans
-- - Mettre à jour enforce_property_limit() pour ne pas bloquer
--   quand extra_property_price > 0 (biens supplémentaires autorisés)
-- =====================================================

-- 1. Ajouter la colonne extra_property_price si elle n'existe pas
ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS extra_property_price INTEGER DEFAULT 0;

COMMENT ON COLUMN subscription_plans.extra_property_price IS
  'Prix en centimes par bien supplémentaire au-delà du quota inclus. 0 = pas de bien suppl. autorisé.';

-- 2. Peupler la colonne pour les plans existants
UPDATE subscription_plans SET extra_property_price = 0   WHERE slug = 'gratuit';
UPDATE subscription_plans SET extra_property_price = 300 WHERE slug = 'starter';    -- 3€/bien suppl.
UPDATE subscription_plans SET extra_property_price = 250 WHERE slug = 'confort';    -- 2,50€/bien suppl.
UPDATE subscription_plans SET extra_property_price = 200 WHERE slug = 'pro';        -- 2€/bien suppl.
UPDATE subscription_plans SET extra_property_price = 0   WHERE slug LIKE 'enterprise%';

-- 3. Mettre à jour enforce_property_limit() pour autoriser les biens
--    supplémentaires sur les forfaits qui le permettent
CREATE OR REPLACE FUNCTION enforce_property_limit()
RETURNS TRIGGER AS $$
DECLARE
  current_count INTEGER;
  max_allowed INTEGER;
  plan_slug TEXT;
  v_extra_property_price INTEGER;
BEGIN
  -- Compter les propriétés actives (non soft-deleted) avec un vrai COUNT
  SELECT COUNT(*) INTO current_count
  FROM properties
  WHERE owner_id = NEW.owner_id
    AND deleted_at IS NULL;

  -- Récupérer la limite du plan et le prix des biens supplémentaires
  SELECT
    COALESCE(sp.max_properties, -1),
    COALESCE(s.plan_slug, 'gratuit'),
    COALESCE(sp.extra_property_price, 0)
  INTO max_allowed, plan_slug, v_extra_property_price
  FROM subscriptions s
  LEFT JOIN subscription_plans sp ON sp.slug = s.plan_slug
  WHERE s.owner_id = NEW.owner_id;

  -- Si pas de subscription trouvée, utiliser les limites du plan gratuit
  IF max_allowed IS NULL THEN
    max_allowed := 1;
    v_extra_property_price := 0;
  END IF;

  -- Si le forfait autorise des biens supplémentaires payants, ne pas bloquer
  IF v_extra_property_price > 0 THEN
    RETURN NEW;
  END IF;

  -- Vérifier la limite (sauf si illimité = -1)
  IF max_allowed != -1 AND current_count >= max_allowed THEN
    RAISE EXCEPTION 'SUBSCRIPTION_LIMIT_REACHED: Limite de % bien(s) atteinte pour le forfait "%". Passez à un forfait supérieur pour ajouter plus de biens.', max_allowed, plan_slug
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION enforce_property_limit() IS
  'Vérifie la limite de biens. Autorise les biens supplémentaires payants pour les forfaits avec extra_property_price > 0.';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260310200001', 'fix_property_limit_extra_properties')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260310200000_fix_property_limit_extra_properties.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260310300000_add_stripe_price_extra_property_id.sql
-- Risk: CRITIQUE
-- Why: ALTER/DROP sur table billing (stripe_* / subscriptions*)
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260310300000_add_stripe_price_extra_property_id.sql'; END $pre$;

-- Add stripe_price_extra_property_id column to subscription_plans
-- Stores the Stripe Price ID for per-unit extra property billing

ALTER TABLE subscription_plans
ADD COLUMN IF NOT EXISTS stripe_price_extra_property_id TEXT;

COMMENT ON COLUMN subscription_plans.stripe_price_extra_property_id
IS 'Stripe Price ID for recurring per-unit billing of extra properties beyond included quota';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260310300000', 'add_stripe_price_extra_property_id')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260310300000_add_stripe_price_extra_property_id.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260314001000_fix_stripe_connect_rls.sql
-- Risk: CRITIQUE
-- Why: ALTER/DROP sur table billing (stripe_* / subscriptions*)
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260314001000_fix_stripe_connect_rls.sql'; END $pre$;

-- Migration: corriger la RLS Stripe Connect avec profiles.id
-- Date: 2026-03-14

BEGIN;

ALTER TABLE stripe_connect_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can view own connect account" ON stripe_connect_accounts;
DROP POLICY IF EXISTS "Owners can create own connect account" ON stripe_connect_accounts;
DROP POLICY IF EXISTS "Service role full access connect" ON stripe_connect_accounts;

DROP POLICY IF EXISTS "Owners can view own connect account" ON stripe_connect_accounts;
CREATE POLICY "Owners can view own connect account" ON stripe_connect_accounts
  FOR SELECT
  USING (
    profile_id = public.user_profile_id()
    OR public.user_role() = 'admin'
  );

DROP POLICY IF EXISTS "Owners can create own connect account" ON stripe_connect_accounts;
CREATE POLICY "Owners can create own connect account" ON stripe_connect_accounts
  FOR INSERT
  WITH CHECK (
    profile_id = public.user_profile_id()
    OR public.user_role() = 'admin'
  );

DROP POLICY IF EXISTS "Owners can update own connect account" ON stripe_connect_accounts;
CREATE POLICY "Owners can update own connect account" ON stripe_connect_accounts
  FOR UPDATE
  USING (
    profile_id = public.user_profile_id()
    OR public.user_role() = 'admin'
  )
  WITH CHECK (
    profile_id = public.user_profile_id()
    OR public.user_role() = 'admin'
  );

DROP POLICY IF EXISTS "Service role full access connect" ON stripe_connect_accounts;
CREATE POLICY "Service role full access connect" ON stripe_connect_accounts
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS "Owners can view own transfers" ON stripe_transfers;
DROP POLICY IF EXISTS "Service role full access transfers" ON stripe_transfers;

DROP POLICY IF EXISTS "Owners can view own transfers" ON stripe_transfers;
CREATE POLICY "Owners can view own transfers" ON stripe_transfers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM stripe_connect_accounts sca
      WHERE sca.id = stripe_transfers.connect_account_id
        AND (
          sca.profile_id = public.user_profile_id()
          OR public.user_role() = 'admin'
        )
    )
  );

DROP POLICY IF EXISTS "Service role full access transfers" ON stripe_transfers;
CREATE POLICY "Service role full access transfers" ON stripe_transfers
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

COMMIT;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260314001000', 'fix_stripe_connect_rls')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260314001000_fix_stripe_connect_rls.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260314030000_payments_production_hardening.sql
-- Risk: CRITIQUE
-- Why: ALTER/DROP sur table billing (stripe_* / subscriptions*)
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260314030000_payments_production_hardening.sql'; END $pre$;

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

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260314030000', 'payments_production_hardening')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260314030000_payments_production_hardening.sql'; END $post$;

COMMIT;

-- END OF BATCH 6/10 (Phase 4 CRITIQUE)

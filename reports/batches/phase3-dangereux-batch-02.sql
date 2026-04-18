-- ====================================================================
-- Sprint B2 — Phase 3 DANGEREUX — Batch 2/11
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
-- Migration: 20260228100000_tenant_payment_methods_sota2026.sql
-- Risk: DANGEREUX
-- Why: UPDATE sans WHERE : using,on,of,using,on,on,invoices,of
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260228100000_tenant_payment_methods_sota2026.sql'; END $pre$;

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

DROP POLICY IF EXISTS "tpm_select_own" ON tenant_payment_methods;
CREATE POLICY "tpm_select_own" ON tenant_payment_methods
  FOR SELECT USING (tenant_profile_id = public.user_profile_id());

DROP POLICY IF EXISTS "tpm_insert_own" ON tenant_payment_methods;
CREATE POLICY "tpm_insert_own" ON tenant_payment_methods
  FOR INSERT WITH CHECK (tenant_profile_id = public.user_profile_id());

DROP POLICY IF EXISTS "tpm_update_own" ON tenant_payment_methods;
CREATE POLICY "tpm_update_own" ON tenant_payment_methods
  FOR UPDATE USING (tenant_profile_id = public.user_profile_id());

DROP POLICY IF EXISTS "tpm_delete_own" ON tenant_payment_methods;
CREATE POLICY "tpm_delete_own" ON tenant_payment_methods
  FOR DELETE USING (tenant_profile_id = public.user_profile_id());

DROP POLICY IF EXISTS "tpm_admin_all" ON tenant_payment_methods;
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

DROP POLICY IF EXISTS "sepa_select_tenant" ON sepa_mandates;
CREATE POLICY "sepa_select_tenant" ON sepa_mandates
  FOR SELECT USING (tenant_profile_id = public.user_profile_id());

DROP POLICY IF EXISTS "sepa_select_owner" ON sepa_mandates;
CREATE POLICY "sepa_select_owner" ON sepa_mandates
  FOR SELECT USING (owner_profile_id = public.user_profile_id());

DROP POLICY IF EXISTS "sepa_insert_tenant" ON sepa_mandates;
CREATE POLICY "sepa_insert_tenant" ON sepa_mandates
  FOR INSERT WITH CHECK (tenant_profile_id = public.user_profile_id());

DROP POLICY IF EXISTS "sepa_update_tenant" ON sepa_mandates;
CREATE POLICY "sepa_update_tenant" ON sepa_mandates
  FOR UPDATE USING (tenant_profile_id = public.user_profile_id());

DROP POLICY IF EXISTS "sepa_admin_all" ON sepa_mandates;
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

DROP POLICY IF EXISTS "ps_select_tenant" ON payment_schedules;
CREATE POLICY "ps_select_tenant" ON payment_schedules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE l.id = payment_schedules.lease_id
        AND ls.profile_id = public.user_profile_id()
    )
  );

DROP POLICY IF EXISTS "ps_select_owner" ON payment_schedules;
CREATE POLICY "ps_select_owner" ON payment_schedules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON p.id = l.property_id
      WHERE l.id = payment_schedules.lease_id
        AND p.owner_id = public.user_profile_id()
    )
  );

DROP POLICY IF EXISTS "ps_admin_all" ON payment_schedules;
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

DROP POLICY IF EXISTS "pmal_select_own" ON payment_method_audit_log;
CREATE POLICY "pmal_select_own" ON payment_method_audit_log
  FOR SELECT USING (tenant_profile_id = public.user_profile_id());

DROP POLICY IF EXISTS "pmal_admin_all" ON payment_method_audit_log;
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

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260228100000', 'tenant_payment_methods_sota2026')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260228100000_tenant_payment_methods_sota2026.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260301000000_create_key_handovers.sql
-- Risk: DANGEREUX
-- Why: UPDATE sans WHERE : on
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260301000000_create_key_handovers.sql'; END $pre$;

-- Migration: Create key_handovers table for digital key handover with QR code proof
-- This table records the formal handover of keys from owner to tenant,
-- with cryptographic proof, geolocation, and signature.

CREATE TABLE IF NOT EXISTS key_handovers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id uuid NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  property_id uuid REFERENCES properties(id) ON DELETE SET NULL,

  -- Participants
  owner_profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  tenant_profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,

  -- QR token
  token text NOT NULL,
  expires_at timestamptz NOT NULL,

  -- Keys handed over (JSON array from EDL)
  keys_list jsonb DEFAULT '[]'::jsonb,

  -- Tenant confirmation
  confirmed_at timestamptz,
  tenant_signature_path text,
  tenant_ip text,
  tenant_user_agent text,
  geolocation jsonb,

  -- Proof
  proof_id text,
  proof_metadata jsonb,

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_key_handovers_lease_id ON key_handovers(lease_id);
CREATE INDEX IF NOT EXISTS idx_key_handovers_token ON key_handovers(token);
CREATE INDEX IF NOT EXISTS idx_key_handovers_confirmed ON key_handovers(lease_id) WHERE confirmed_at IS NOT NULL;

-- RLS
ALTER TABLE key_handovers ENABLE ROW LEVEL SECURITY;

-- Owner can see and create handovers for their leases
DROP POLICY IF EXISTS "owner_key_handovers" ON key_handovers;
CREATE POLICY "owner_key_handovers" ON key_handovers
  FOR ALL
  USING (
    owner_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Tenant can see and confirm handovers for their leases
DROP POLICY IF EXISTS "tenant_key_handovers" ON key_handovers;
CREATE POLICY "tenant_key_handovers" ON key_handovers
  FOR ALL
  USING (
    tenant_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
    OR
    lease_id IN (
      SELECT lease_id FROM lease_signers
      WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- Updated at trigger
CREATE OR REPLACE TRIGGER set_key_handovers_updated_at
  BEFORE UPDATE ON key_handovers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE key_handovers IS 'Remise des clés digitale avec preuve QR code, signature et géolocalisation';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260301000000', 'create_key_handovers')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260301000000_create_key_handovers.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260301100000_entity_audit_and_propagation.sql
-- Risk: DANGEREUX
-- Why: UPDATE sans WHERE : on,or
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260301100000_entity_audit_and_propagation.sql'; END $pre$;

-- ============================================================================
-- Migration: Entity Audit Trail, Propagation, Contraintes SIRET, Guards
-- Date: 2026-03-01
-- Description:
--   1. Table entity_audit_log (historique des modifications)
--   2. Trigger propagation: UPDATE legal_entities → leases/invoices dénormalisés
--   3. Contrainte UNIQUE sur SIRET (actif uniquement)
--   4. Vérification bail actif avant transfert de bien (RPC)
-- Idempotent: peut être exécutée plusieurs fois sans effet secondaire.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. TABLE: entity_audit_log (historique des modifications)
-- ============================================================================

CREATE TABLE IF NOT EXISTS entity_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete', 'deactivate', 'reactivate')),
  changed_fields JSONB,           -- {"nom": {"old": "SCI A", "new": "SCI B"}}
  changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entity_audit_log_entity ON entity_audit_log(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_audit_log_action ON entity_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_entity_audit_log_date ON entity_audit_log(created_at);

-- RLS pour entity_audit_log
ALTER TABLE entity_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view audit logs of their entities" ON entity_audit_log;
CREATE POLICY "Users can view audit logs of their entities"
  ON entity_audit_log FOR SELECT
  USING (
    entity_id IN (
      SELECT id FROM legal_entities WHERE owner_profile_id IN (
        SELECT profile_id FROM owner_profiles
        WHERE profile_id IN (
          SELECT id FROM profiles WHERE user_id = auth.uid()
        )
      )
    )
  );

DROP POLICY IF EXISTS "Users can insert audit logs for their entities" ON entity_audit_log;
CREATE POLICY "Users can insert audit logs for their entities"
  ON entity_audit_log FOR INSERT
  WITH CHECK (
    entity_id IN (
      SELECT id FROM legal_entities WHERE owner_profile_id IN (
        SELECT profile_id FROM owner_profiles
        WHERE profile_id IN (
          SELECT id FROM profiles WHERE user_id = auth.uid()
        )
      )
    )
  );

DROP POLICY IF EXISTS "Admins can do everything on entity_audit_log" ON entity_audit_log;
CREATE POLICY "Admins can do everything on entity_audit_log"
  ON entity_audit_log FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================================
-- 2. TRIGGER: Propager les modifications d'entité aux tables dénormalisées
-- ============================================================================
-- Quand nom/adresse/siret changent sur legal_entities,
-- mettre à jour les champs dénormalisés sur leases et invoices.

CREATE OR REPLACE FUNCTION propagate_entity_changes()
RETURNS TRIGGER AS $$
DECLARE
  full_address TEXT;
BEGIN
  -- Construire l'adresse complète
  full_address := COALESCE(NEW.adresse_siege, '');
  IF NEW.code_postal_siege IS NOT NULL OR NEW.ville_siege IS NOT NULL THEN
    full_address := full_address || ', ' || COALESCE(NEW.code_postal_siege, '') || ' ' || COALESCE(NEW.ville_siege, '');
  END IF;

  -- Propager vers leases si nom, adresse ou siret a changé
  IF (OLD.nom IS DISTINCT FROM NEW.nom)
     OR (OLD.adresse_siege IS DISTINCT FROM NEW.adresse_siege)
     OR (OLD.code_postal_siege IS DISTINCT FROM NEW.code_postal_siege)
     OR (OLD.ville_siege IS DISTINCT FROM NEW.ville_siege)
     OR (OLD.siret IS DISTINCT FROM NEW.siret) THEN

    UPDATE leases SET
      bailleur_nom = CASE WHEN OLD.nom IS DISTINCT FROM NEW.nom THEN NEW.nom ELSE bailleur_nom END,
      bailleur_adresse = CASE
        WHEN (OLD.adresse_siege IS DISTINCT FROM NEW.adresse_siege)
             OR (OLD.code_postal_siege IS DISTINCT FROM NEW.code_postal_siege)
             OR (OLD.ville_siege IS DISTINCT FROM NEW.ville_siege)
        THEN full_address
        ELSE bailleur_adresse
      END,
      bailleur_siret = CASE WHEN OLD.siret IS DISTINCT FROM NEW.siret THEN NEW.siret ELSE bailleur_siret END
    WHERE signatory_entity_id = NEW.id;

    -- Propager vers invoices
    UPDATE invoices SET
      issuer_nom = CASE WHEN OLD.nom IS DISTINCT FROM NEW.nom THEN NEW.nom ELSE issuer_nom END,
      issuer_adresse = CASE
        WHEN (OLD.adresse_siege IS DISTINCT FROM NEW.adresse_siege)
             OR (OLD.code_postal_siege IS DISTINCT FROM NEW.code_postal_siege)
             OR (OLD.ville_siege IS DISTINCT FROM NEW.ville_siege)
        THEN full_address
        ELSE issuer_adresse
      END,
      issuer_siret = CASE WHEN OLD.siret IS DISTINCT FROM NEW.siret THEN NEW.siret ELSE issuer_siret END,
      issuer_tva = CASE WHEN OLD.numero_tva IS DISTINCT FROM NEW.numero_tva THEN NEW.numero_tva ELSE issuer_tva END
    WHERE issuer_entity_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_propagate_entity_changes ON legal_entities;
CREATE TRIGGER trg_propagate_entity_changes
  AFTER UPDATE ON legal_entities
  FOR EACH ROW
  EXECUTE FUNCTION propagate_entity_changes();

-- ============================================================================
-- 3. TRIGGER: Audit trail automatique sur modifications d'entité
-- ============================================================================

CREATE OR REPLACE FUNCTION log_entity_changes()
RETURNS TRIGGER AS $$
DECLARE
  changes JSONB := '{}';
  action_type TEXT;
  user_profile_id UUID;
BEGIN
  -- Déterminer l'ID du profil qui fait la modification
  SELECT id INTO user_profile_id FROM profiles WHERE user_id = auth.uid() LIMIT 1;

  IF TG_OP = 'INSERT' THEN
    action_type := 'create';
    changes := jsonb_build_object(
      'entity_type', NEW.entity_type,
      'nom', NEW.nom,
      'regime_fiscal', NEW.regime_fiscal
    );

    INSERT INTO entity_audit_log (entity_id, action, changed_fields, changed_by)
    VALUES (NEW.id, action_type, changes, user_profile_id);

    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Détecter les champs modifiés
    IF OLD.nom IS DISTINCT FROM NEW.nom THEN
      changes := changes || jsonb_build_object('nom', jsonb_build_object('old', OLD.nom, 'new', NEW.nom));
    END IF;
    IF OLD.entity_type IS DISTINCT FROM NEW.entity_type THEN
      changes := changes || jsonb_build_object('entity_type', jsonb_build_object('old', OLD.entity_type, 'new', NEW.entity_type));
    END IF;
    IF OLD.forme_juridique IS DISTINCT FROM NEW.forme_juridique THEN
      changes := changes || jsonb_build_object('forme_juridique', jsonb_build_object('old', OLD.forme_juridique, 'new', NEW.forme_juridique));
    END IF;
    IF OLD.regime_fiscal IS DISTINCT FROM NEW.regime_fiscal THEN
      changes := changes || jsonb_build_object('regime_fiscal', jsonb_build_object('old', OLD.regime_fiscal, 'new', NEW.regime_fiscal));
    END IF;
    IF OLD.siret IS DISTINCT FROM NEW.siret THEN
      changes := changes || jsonb_build_object('siret', jsonb_build_object('old', OLD.siret, 'new', NEW.siret));
    END IF;
    IF OLD.adresse_siege IS DISTINCT FROM NEW.adresse_siege THEN
      changes := changes || jsonb_build_object('adresse_siege', jsonb_build_object('old', OLD.adresse_siege, 'new', NEW.adresse_siege));
    END IF;
    IF OLD.code_postal_siege IS DISTINCT FROM NEW.code_postal_siege THEN
      changes := changes || jsonb_build_object('code_postal_siege', jsonb_build_object('old', OLD.code_postal_siege, 'new', NEW.code_postal_siege));
    END IF;
    IF OLD.ville_siege IS DISTINCT FROM NEW.ville_siege THEN
      changes := changes || jsonb_build_object('ville_siege', jsonb_build_object('old', OLD.ville_siege, 'new', NEW.ville_siege));
    END IF;
    IF OLD.capital_social IS DISTINCT FROM NEW.capital_social THEN
      changes := changes || jsonb_build_object('capital_social', jsonb_build_object('old', OLD.capital_social, 'new', NEW.capital_social));
    END IF;
    IF OLD.iban IS DISTINCT FROM NEW.iban THEN
      changes := changes || jsonb_build_object('iban', jsonb_build_object('old', 'MASKED', 'new', 'MASKED'));
    END IF;
    IF OLD.is_active IS DISTINCT FROM NEW.is_active THEN
      action_type := CASE WHEN NEW.is_active THEN 'reactivate' ELSE 'deactivate' END;
      changes := changes || jsonb_build_object('is_active', jsonb_build_object('old', OLD.is_active, 'new', NEW.is_active));
    ELSE
      action_type := 'update';
    END IF;

    -- Ne loguer que s'il y a des changements
    IF changes != '{}' THEN
      INSERT INTO entity_audit_log (entity_id, action, changed_fields, changed_by)
      VALUES (NEW.id, action_type, changes, user_profile_id);
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    action_type := 'delete';
    changes := jsonb_build_object('nom', OLD.nom, 'entity_type', OLD.entity_type);

    INSERT INTO entity_audit_log (entity_id, action, changed_fields, changed_by)
    VALUES (OLD.id, action_type, changes, user_profile_id);

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_log_entity_changes ON legal_entities;
CREATE TRIGGER trg_log_entity_changes
  AFTER INSERT OR UPDATE OR DELETE ON legal_entities
  FOR EACH ROW
  EXECUTE FUNCTION log_entity_changes();

-- ============================================================================
-- 4. CONTRAINTE UNIQUE sur SIRET (actif uniquement)
-- ============================================================================
-- Un même SIRET ne peut être utilisé que par une seule entité active

CREATE UNIQUE INDEX IF NOT EXISTS idx_legal_entities_siret_unique
  ON legal_entities (siret)
  WHERE siret IS NOT NULL AND is_active = true;

-- ============================================================================
-- 5. RPC: Vérifier si un transfert de bien est possible (bail actif ?)
-- ============================================================================

CREATE OR REPLACE FUNCTION check_property_transfer_feasibility(
  p_property_id UUID,
  p_from_entity_id UUID,
  p_to_entity_id UUID
) RETURNS TABLE (
  can_transfer BOOLEAN,
  blocking_reason TEXT,
  active_lease_count BIGINT,
  pending_signature_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH lease_checks AS (
    SELECT
      COUNT(*) FILTER (WHERE l.statut = 'active') AS active_count,
      COUNT(*) FILTER (WHERE l.statut IN ('pending_signature', 'fully_signed')) AS pending_count
    FROM leases l
    WHERE l.property_id = p_property_id
      AND l.signatory_entity_id = p_from_entity_id
  )
  SELECT
    (lc.active_count = 0 AND lc.pending_count = 0) AS can_transfer,
    CASE
      WHEN lc.pending_count > 0 THEN
        'Transfert impossible : ' || lc.pending_count || ' bail(aux) en cours de signature. Finalisez ou annulez les signatures avant de transférer.'
      WHEN lc.active_count > 0 THEN
        'Transfert avec bail(aux) actif(s) : ' || lc.active_count || ' bail(aux) devront être mis à jour avec la nouvelle entité signataire.'
      ELSE NULL
    END AS blocking_reason,
    lc.active_count AS active_lease_count,
    lc.pending_count AS pending_signature_count
  FROM lease_checks lc;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- 6. Backfill bailleur_nom/adresse/siret sur les baux existants qui en manquent
-- ============================================================================

UPDATE leases l
SET
  bailleur_nom = COALESCE(l.bailleur_nom, le.nom),
  bailleur_adresse = COALESCE(l.bailleur_adresse,
    COALESCE(le.adresse_siege, '') ||
    CASE WHEN le.code_postal_siege IS NOT NULL OR le.ville_siege IS NOT NULL
      THEN ', ' || COALESCE(le.code_postal_siege, '') || ' ' || COALESCE(le.ville_siege, '')
      ELSE ''
    END
  ),
  bailleur_siret = COALESCE(l.bailleur_siret, le.siret)
FROM legal_entities le
WHERE l.signatory_entity_id = le.id
  AND (l.bailleur_nom IS NULL OR l.bailleur_adresse IS NULL OR l.bailleur_siret IS NULL);

-- Même chose pour invoices
UPDATE invoices i
SET
  issuer_nom = COALESCE(i.issuer_nom, le.nom),
  issuer_adresse = COALESCE(i.issuer_adresse,
    COALESCE(le.adresse_siege, '') ||
    CASE WHEN le.code_postal_siege IS NOT NULL OR le.ville_siege IS NOT NULL
      THEN ', ' || COALESCE(le.code_postal_siege, '') || ' ' || COALESCE(le.ville_siege, '')
      ELSE ''
    END
  ),
  issuer_siret = COALESCE(i.issuer_siret, le.siret),
  issuer_tva = COALESCE(i.issuer_tva, le.numero_tva)
FROM legal_entities le
WHERE i.issuer_entity_id = le.id
  AND (i.issuer_nom IS NULL OR i.issuer_adresse IS NULL OR i.issuer_siret IS NULL);

COMMIT;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260301100000', 'entity_audit_and_propagation')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260301100000_entity_audit_and_propagation.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260303100000_entity_rls_fix_and_optimize.sql
-- Risk: DANGEREUX
-- Why: UPDATE sans WHERE : their,their
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260303100000_entity_rls_fix_and_optimize.sql'; END $pre$;

-- ============================================================================
-- Migration: Fix RLS policies for entity system
-- Date: 2026-03-03
-- Description:
--   1. Supprime la policy SELECT redondante sur entity_associates
--      (la policy FOR ALL couvre déjà SELECT)
--   2. Crée une fonction helper get_current_owner_profile_id()
--      pour optimiser les sous-requêtes RLS (3 niveaux → 1 appel)
--   3. Remplace les policies legal_entities par des versions optimisées
--   4. Remplace les policies entity_associates par une version optimisée
--   5. Remplace les policies property_ownership par des versions optimisées
-- Idempotent: peut être exécutée plusieurs fois sans effet secondaire.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. Fonction helper: get_current_owner_profile_id()
-- ============================================================================
-- Retourne le profile_id du propriétaire connecté (ou NULL si non-propriétaire).
-- Utilisée par toutes les policies RLS pour éviter les sous-requêtes imbriquées.

CREATE OR REPLACE FUNCTION get_current_owner_profile_id()
RETURNS UUID AS $$
  SELECT op.profile_id
  FROM owner_profiles op
  INNER JOIN profiles p ON p.id = op.profile_id
  WHERE p.user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- 2. Fix entity_associates: supprimer la policy SELECT redondante
-- ============================================================================

DROP POLICY IF EXISTS "Users can view associates of their entities" ON entity_associates;

-- Recréer la policy FOR ALL avec la fonction optimisée
DROP POLICY IF EXISTS "Users can manage associates of their entities" ON entity_associates;
CREATE POLICY "Users can manage associates of their entities"
  ON entity_associates FOR ALL
  USING (
    legal_entity_id IN (
      SELECT id FROM legal_entities
      WHERE owner_profile_id = get_current_owner_profile_id()
    )
  );

-- ============================================================================
-- 3. Optimiser les policies legal_entities
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their own entities" ON legal_entities;
CREATE POLICY "Users can view their own entities"
  ON legal_entities FOR SELECT
  USING (owner_profile_id = get_current_owner_profile_id());

DROP POLICY IF EXISTS "Users can insert their own entities" ON legal_entities;
CREATE POLICY "Users can insert their own entities"
  ON legal_entities FOR INSERT
  WITH CHECK (owner_profile_id = get_current_owner_profile_id());

DROP POLICY IF EXISTS "Users can update their own entities" ON legal_entities;
CREATE POLICY "Users can update their own entities"
  ON legal_entities FOR UPDATE
  USING (owner_profile_id = get_current_owner_profile_id());

DROP POLICY IF EXISTS "Users can delete their own entities" ON legal_entities;
CREATE POLICY "Users can delete their own entities"
  ON legal_entities FOR DELETE
  USING (owner_profile_id = get_current_owner_profile_id());

-- ============================================================================
-- 4. Optimiser les policies property_ownership
-- ============================================================================

DROP POLICY IF EXISTS "Users can view ownership of their properties" ON property_ownership;
CREATE POLICY "Users can view ownership of their properties"
  ON property_ownership FOR SELECT
  USING (
    property_id IN (
      SELECT id FROM properties
      WHERE owner_id = get_current_owner_profile_id()
    )
    OR legal_entity_id IN (
      SELECT id FROM legal_entities
      WHERE owner_profile_id = get_current_owner_profile_id()
    )
  );

DROP POLICY IF EXISTS "Users can manage ownership of their properties" ON property_ownership;
CREATE POLICY "Users can manage ownership of their properties"
  ON property_ownership FOR ALL
  USING (
    property_id IN (
      SELECT id FROM properties
      WHERE owner_id = get_current_owner_profile_id()
    )
    OR legal_entity_id IN (
      SELECT id FROM legal_entities
      WHERE owner_profile_id = get_current_owner_profile_id()
    )
  );

-- ============================================================================
-- 5. Optimiser les policies entity_audit_log
-- ============================================================================

DROP POLICY IF EXISTS "Users can view audit logs of their entities" ON entity_audit_log;
CREATE POLICY "Users can view audit logs of their entities"
  ON entity_audit_log FOR SELECT
  USING (
    entity_id IN (
      SELECT id FROM legal_entities
      WHERE owner_profile_id = get_current_owner_profile_id()
    )
  );

DROP POLICY IF EXISTS "Users can insert audit logs for their entities" ON entity_audit_log;
CREATE POLICY "Users can insert audit logs for their entities"
  ON entity_audit_log FOR INSERT
  WITH CHECK (
    entity_id IN (
      SELECT id FROM legal_entities
      WHERE owner_profile_id = get_current_owner_profile_id()
    )
  );

-- ============================================================================
-- 6. Ajouter les types micro_entrepreneur et association
-- ============================================================================

ALTER TABLE legal_entities DROP CONSTRAINT IF EXISTS legal_entities_entity_type_check;
ALTER TABLE legal_entities ADD CONSTRAINT legal_entities_entity_type_check CHECK (entity_type IN (
  'particulier',
  'sci_ir',
  'sci_is',
  'sci_construction_vente',
  'sarl',
  'sarl_famille',
  'eurl',
  'sas',
  'sasu',
  'sa',
  'snc',
  'indivision',
  'demembrement_usufruit',
  'demembrement_nue_propriete',
  'holding',
  'micro_entrepreneur',
  'association'
));

COMMIT;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260303100000', 'entity_rls_fix_and_optimize')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260303100000_entity_rls_fix_and_optimize.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260304000001_sync_sepa_collection_day.sql
-- Risk: DANGEREUX
-- Why: UPDATE sans WHERE : of
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260304000001_sync_sepa_collection_day.sql'; END $pre$;

-- ============================================
-- Migration : Synchroniser payment_schedules.collection_day avec leases.jour_paiement
-- Date : 2026-03-04
-- Description : Quand leases.jour_paiement est mis à jour, propager la valeur
--   vers payment_schedules.collection_day pour les prélèvements SEPA.
-- ============================================

-- Trigger function : propager jour_paiement vers payment_schedules
CREATE OR REPLACE FUNCTION sync_lease_jour_paiement_to_schedules()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Seulement si jour_paiement a changé
  IF NEW.jour_paiement IS DISTINCT FROM OLD.jour_paiement THEN
    UPDATE payment_schedules
    SET collection_day = COALESCE(NEW.jour_paiement, 5)
    WHERE lease_id = NEW.id
      AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$;

-- Créer le trigger
DROP TRIGGER IF EXISTS trg_sync_jour_paiement ON leases;
CREATE TRIGGER trg_sync_jour_paiement
  AFTER UPDATE OF jour_paiement ON leases
  FOR EACH ROW
  EXECUTE FUNCTION sync_lease_jour_paiement_to_schedules();

COMMENT ON FUNCTION sync_lease_jour_paiement_to_schedules IS 'Propage leases.jour_paiement vers payment_schedules.collection_day';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260304000001', 'sync_sepa_collection_day')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260304000001_sync_sepa_collection_day.sql'; END $post$;

COMMIT;

-- END OF BATCH 2/11 (Phase 3 DANGEREUX)

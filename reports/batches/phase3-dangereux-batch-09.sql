-- ====================================================================
-- Sprint B2 — Phase 3 DANGEREUX — Batch 9/11
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
-- Migration: 20260408220000_payment_architecture_sota.sql
-- Risk: DANGEREUX
-- Why: UPDATE sans WHERE : on
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260408220000_payment_architecture_sota.sql'; END $pre$;

-- =====================================================
-- Migration: Payment Architecture SOTA 2026
-- Date: 2026-04-08
--
-- 1. rent_payments table (Stripe Connect Express)
-- 2. security_deposits table
-- 3. Invoice state machine alignment (7 états)
-- 4. RLS policies
-- 5. Helper functions
-- =====================================================

BEGIN;

-- =====================================================
-- 1. RENT PAYMENTS — Stripe Connect Express
-- Tracks the split between tenant payment, platform
-- commission, and owner payout
-- =====================================================

CREATE TABLE IF NOT EXISTS rent_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,

  -- Montants (tous en centimes)
  amount_cents INTEGER NOT NULL,
  commission_amount_cents INTEGER NOT NULL,
  commission_rate NUMERIC(4,3) NOT NULL,
  owner_amount_cents INTEGER NOT NULL,

  -- Stripe Connect
  stripe_payment_intent_id TEXT NOT NULL,
  stripe_charge_id TEXT,
  stripe_transfer_id TEXT,
  payment_method TEXT DEFAULT 'sepa_debit'
    CHECK (payment_method IN ('sepa_debit', 'card', 'bank_transfer')),

  -- Statut
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'refunded', 'disputed')),

  -- Dates
  initiated_at TIMESTAMPTZ DEFAULT now(),
  succeeded_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),

  -- Prevent duplicate payments for same invoice
  UNIQUE(invoice_id, stripe_payment_intent_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_rent_payments_invoice_id ON rent_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_rent_payments_lease_id ON rent_payments(lease_id);
CREATE INDEX IF NOT EXISTS idx_rent_payments_status ON rent_payments(status);
CREATE INDEX IF NOT EXISTS idx_rent_payments_stripe_pi ON rent_payments(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_rent_payments_created_at ON rent_payments(created_at DESC);

-- RLS
ALTER TABLE rent_payments ENABLE ROW LEVEL SECURITY;

-- Owner can view rent payments for their properties
DROP POLICY IF EXISTS "Owner can view rent_payments" ON rent_payments;
CREATE POLICY "Owner can view rent_payments" ON rent_payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM invoices i
      JOIN properties p ON i.lease_id = (SELECT lease_id FROM leases WHERE id = rent_payments.lease_id LIMIT 1)
      WHERE i.id = rent_payments.invoice_id
        AND i.owner_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- Tenant can view their own payments
DROP POLICY IF EXISTS "Tenant can view own rent_payments" ON rent_payments;
CREATE POLICY "Tenant can view own rent_payments" ON rent_payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.id = rent_payments.invoice_id
        AND i.tenant_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- Admin full access
DROP POLICY IF EXISTS "Admin can manage rent_payments" ON rent_payments;
CREATE POLICY "Admin can manage rent_payments" ON rent_payments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Service role inserts (API routes use service role)
-- No INSERT policy needed for normal users — only backend inserts


-- =====================================================
-- 2. SECURITY DEPOSITS — Dépôts de garantie
-- =====================================================

CREATE TABLE IF NOT EXISTS security_deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES profiles(id),

  amount_cents INTEGER NOT NULL,
  paid_at TIMESTAMPTZ,
  payment_method TEXT
    CHECK (payment_method IS NULL OR payment_method IN ('sepa_debit', 'card', 'bank_transfer', 'check', 'cash')),

  -- Restitution
  restitution_amount_cents INTEGER,
  retenue_cents INTEGER DEFAULT 0,
  retenue_details JSONB DEFAULT '[]',
  restitution_due_date DATE,
  restituted_at TIMESTAMPTZ,
  restitution_method TEXT
    CHECK (restitution_method IS NULL OR restitution_method IN ('bank_transfer', 'check', 'sepa_credit')),

  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'received', 'partially_returned', 'returned', 'disputed')),

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_security_deposits_lease_id ON security_deposits(lease_id);
CREATE INDEX IF NOT EXISTS idx_security_deposits_tenant_id ON security_deposits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_security_deposits_status ON security_deposits(status);

-- Trigger updated_at
CREATE OR REPLACE TRIGGER set_updated_at_security_deposits
  BEFORE UPDATE ON security_deposits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE security_deposits ENABLE ROW LEVEL SECURITY;

-- Owner can manage deposits for their properties
DROP POLICY IF EXISTS "Owner can manage security_deposits" ON security_deposits;
CREATE POLICY "Owner can manage security_deposits" ON security_deposits
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON l.property_id = p.id
      WHERE l.id = security_deposits.lease_id
        AND p.owner_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- Tenant can view their own deposits
DROP POLICY IF EXISTS "Tenant can view own security_deposits" ON security_deposits;
CREATE POLICY "Tenant can view own security_deposits" ON security_deposits
  FOR SELECT USING (
    tenant_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Admin full access
DROP POLICY IF EXISTS "Admin can manage all security_deposits" ON security_deposits;
CREATE POLICY "Admin can manage all security_deposits" ON security_deposits
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'
    )
  );


-- =====================================================
-- 3. INVOICE STATUS ALIGNMENT
-- Add missing statuses to invoices CHECK constraint
-- Spec states: draft, sent, pending, paid, receipt_generated,
--              overdue, reminder_sent, collection, written_off
-- =====================================================

-- Add missing columns if they don't exist
DO $$
BEGIN
  -- period_start / period_end for spec alignment
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'period_start') THEN
    ALTER TABLE invoices ADD COLUMN period_start DATE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'period_end') THEN
    ALTER TABLE invoices ADD COLUMN period_end DATE;
  END IF;

  -- rent_amount_cents / charges_amount_cents / total_amount_cents
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'rent_amount_cents') THEN
    ALTER TABLE invoices ADD COLUMN rent_amount_cents INTEGER;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'charges_amount_cents') THEN
    ALTER TABLE invoices ADD COLUMN charges_amount_cents INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'total_amount_cents') THEN
    ALTER TABLE invoices ADD COLUMN total_amount_cents INTEGER;
  END IF;

  -- entity_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'entity_id') THEN
    ALTER TABLE invoices ADD COLUMN entity_id UUID REFERENCES legal_entities(id);
  END IF;

  -- receipt_document_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'receipt_document_id') THEN
    ALTER TABLE invoices ADD COLUMN receipt_document_id UUID REFERENCES documents(id);
  END IF;

  -- receipt_generated_at
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'receipt_generated_at') THEN
    ALTER TABLE invoices ADD COLUMN receipt_generated_at TIMESTAMPTZ;
  END IF;

  -- last_reminder_at (alias for existing last_reminder_sent_at)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'last_reminder_at') THEN
    ALTER TABLE invoices ADD COLUMN last_reminder_at TIMESTAMPTZ;
  END IF;

  -- metadata
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'metadata') THEN
    ALTER TABLE invoices ADD COLUMN metadata JSONB DEFAULT '{}';
  END IF;

  -- paid_at
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'paid_at') THEN
    ALTER TABLE invoices ADD COLUMN paid_at TIMESTAMPTZ;
  END IF;

  -- stripe_invoice_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'stripe_invoice_id') THEN
    ALTER TABLE invoices ADD COLUMN stripe_invoice_id TEXT;
  END IF;
END $$;

-- Backfill cents columns from existing euro columns
UPDATE invoices
SET
  rent_amount_cents = COALESCE(ROUND(montant_loyer * 100)::INTEGER, 0),
  charges_amount_cents = COALESCE(ROUND(montant_charges * 100)::INTEGER, 0),
  total_amount_cents = COALESCE(ROUND(montant_total * 100)::INTEGER, 0)
WHERE rent_amount_cents IS NULL AND montant_loyer IS NOT NULL;

-- Backfill period_start/period_end from periode (format: YYYY-MM)
UPDATE invoices
SET
  period_start = (periode || '-01')::DATE,
  period_end = ((periode || '-01')::DATE + INTERVAL '1 month' - INTERVAL '1 day')::DATE
WHERE period_start IS NULL AND periode IS NOT NULL;


-- =====================================================
-- 4. HELPER FUNCTION: Transition invoice status
-- Validates the state machine transitions
-- =====================================================

CREATE OR REPLACE FUNCTION transition_invoice_status(
  p_invoice_id UUID,
  p_new_status TEXT,
  p_metadata JSONB DEFAULT '{}'
) RETURNS BOOLEAN AS $$
DECLARE
  v_current_status TEXT;
  v_allowed BOOLEAN := FALSE;
BEGIN
  SELECT statut INTO v_current_status
  FROM invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice % not found', p_invoice_id;
  END IF;

  -- Validate transitions
  v_allowed := CASE
    WHEN v_current_status = 'draft' AND p_new_status = 'sent' THEN TRUE
    WHEN v_current_status = 'sent' AND p_new_status IN ('pending', 'paid', 'overdue') THEN TRUE
    WHEN v_current_status = 'pending' AND p_new_status IN ('paid', 'overdue') THEN TRUE
    WHEN v_current_status = 'paid' AND p_new_status = 'receipt_generated' THEN TRUE
    WHEN v_current_status = 'overdue' AND p_new_status IN ('paid', 'reminder_sent') THEN TRUE
    WHEN v_current_status = 'reminder_sent' AND p_new_status IN ('paid', 'collection') THEN TRUE
    WHEN v_current_status = 'collection' AND p_new_status IN ('paid', 'written_off') THEN TRUE
    -- Legacy status compatibility
    WHEN v_current_status = 'late' AND p_new_status IN ('paid', 'overdue', 'reminder_sent') THEN TRUE
    WHEN v_current_status = 'unpaid' AND p_new_status IN ('paid', 'overdue') THEN TRUE
    ELSE FALSE
  END;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Invalid transition: % -> %', v_current_status, p_new_status;
  END IF;

  UPDATE invoices
  SET
    statut = p_new_status,
    paid_at = CASE WHEN p_new_status = 'paid' THEN now() ELSE paid_at END,
    receipt_generated_at = CASE WHEN p_new_status = 'receipt_generated' THEN now() ELSE receipt_generated_at END,
    last_reminder_at = CASE WHEN p_new_status = 'reminder_sent' THEN now() ELSE last_reminder_at END,
    metadata = COALESCE(metadata, '{}'::JSONB) || p_metadata,
    updated_at = now()
  WHERE id = p_invoice_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =====================================================
-- 5. HELPER: Get owner Connect account for a property
-- =====================================================

CREATE OR REPLACE FUNCTION get_owner_connect_account_for_invoice(p_invoice_id UUID)
RETURNS TABLE(
  stripe_account_id TEXT,
  charges_enabled BOOLEAN,
  owner_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sca.stripe_account_id,
    sca.charges_enabled,
    i.owner_id
  FROM invoices i
  JOIN profiles p ON i.owner_id = p.id
  LEFT JOIN stripe_connect_accounts sca ON sca.owner_id = p.id AND sca.status = 'active'
  WHERE i.id = p_invoice_id
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =====================================================
-- 6. PERFORMANCE INDEXES
-- =====================================================

-- Fast lookups for overdue invoices (cron)
CREATE INDEX IF NOT EXISTS idx_invoices_overdue_check
  ON invoices(due_date, statut)
  WHERE statut IN ('sent', 'pending', 'overdue', 'late');

-- Fast lookups for receipt generation
CREATE INDEX IF NOT EXISTS idx_invoices_receipt_pending
  ON invoices(id)
  WHERE statut = 'paid' AND receipt_generated IS NOT TRUE;


COMMIT;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260408220000', 'payment_architecture_sota')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260408220000_payment_architecture_sota.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260409110000_fix_remaining_rls_recursion.sql
-- Risk: DANGEREUX
-- Why: UPDATE sans WHERE : to
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260409110000_fix_remaining_rls_recursion.sql'; END $pre$;

-- =====================================================
-- MIGRATION: Fix remaining RLS recursion on tables still using
--            direct sub-queries on profiles instead of get_my_profile_id()
-- Date: 2026-04-09
-- Problem: subscription_usage_metrics and api_webhook_deliveries still use
--          SELECT id FROM profiles WHERE user_id = auth.uid() in their RLS policies,
--          causing infinite recursion (42P17) when profiles table has RLS enabled.
-- Solution: Replace with public.get_my_profile_id() (SECURITY DEFINER, bypasses RLS).
-- =====================================================

-- ============================================
-- 1. FIX subscription_usage_metrics
-- ============================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subscription_usage_metrics') THEN
    DROP POLICY IF EXISTS "Owner can view own usage metrics" ON subscription_usage_metrics;
    CREATE POLICY "Owner can view own usage metrics" ON subscription_usage_metrics
      FOR SELECT TO authenticated
      USING (owner_id = public.get_my_profile_id());
  END IF;
END $$;

-- ============================================
-- 2. FIX api_webhook_deliveries
-- ============================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'api_webhook_deliveries') THEN
    DROP POLICY IF EXISTS "webhook_deliveries_owner_access" ON api_webhook_deliveries;
    CREATE POLICY "webhook_deliveries_owner_access" ON api_webhook_deliveries
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM api_webhooks w
          WHERE w.id = api_webhook_deliveries.webhook_id
            AND w.profile_id = public.get_my_profile_id()
        )
      );
  END IF;
END $$;

-- ============================================
-- 3. FIX rgpd_consent_records (if exists)
-- ============================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rgpd_consent_records') THEN
    DROP POLICY IF EXISTS "consent_records_select_own" ON rgpd_consent_records;
    DROP POLICY IF EXISTS "consent_records_insert_own" ON rgpd_consent_records;
    DROP POLICY IF EXISTS "consent_records_select_own" ON rgpd_consent_records;
    CREATE POLICY "consent_records_select_own" ON rgpd_consent_records
      FOR SELECT TO authenticated
      USING (
        profile_id = public.get_my_profile_id()
      );
    DROP POLICY IF EXISTS "consent_records_insert_own" ON rgpd_consent_records;
    CREATE POLICY "consent_records_insert_own" ON rgpd_consent_records
      FOR INSERT TO authenticated
      WITH CHECK (
        profile_id = public.get_my_profile_id()
      );
  END IF;
END $$;

-- ============================================
-- 4. FIX rgpd_data_requests (if exists)
-- ============================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rgpd_data_requests') THEN
    DROP POLICY IF EXISTS "data_requests_select_own" ON rgpd_data_requests;
    DROP POLICY IF EXISTS "data_requests_insert_own" ON rgpd_data_requests;
    DROP POLICY IF EXISTS "data_requests_update_own" ON rgpd_data_requests;
    DROP POLICY IF EXISTS "data_requests_select_own" ON rgpd_data_requests;
    CREATE POLICY "data_requests_select_own" ON rgpd_data_requests
      FOR SELECT TO authenticated
      USING (
        profile_id = public.get_my_profile_id()
      );
    DROP POLICY IF EXISTS "data_requests_insert_own" ON rgpd_data_requests;
    CREATE POLICY "data_requests_insert_own" ON rgpd_data_requests
      FOR INSERT TO authenticated
      WITH CHECK (
        profile_id = public.get_my_profile_id()
      );
    DROP POLICY IF EXISTS "data_requests_update_own" ON rgpd_data_requests;
    CREATE POLICY "data_requests_update_own" ON rgpd_data_requests
      FOR UPDATE TO authenticated
      USING (
        profile_id = public.get_my_profile_id()
      );
  END IF;
END $$;

-- ============================================
-- 5. FIX rgpd_processing_activities (if exists)
-- ============================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rgpd_processing_activities') THEN
    DROP POLICY IF EXISTS "processing_activities_select_own" ON rgpd_processing_activities;
    CREATE POLICY "processing_activities_select_own" ON rgpd_processing_activities
      FOR SELECT TO authenticated
      USING (
        profile_id IN (SELECT public.get_my_profile_id())
      );
  END IF;
END $$;

-- ============================================
-- VERIFICATION
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '=== Migration RLS recursion fix (remaining tables) applied ===';
  RAISE NOTICE 'Fixed: subscription_usage_metrics, api_webhook_deliveries, rgpd_consent_records, rgpd_data_requests, rgpd_processing_activities';
  RAISE NOTICE 'Method: get_my_profile_id() SECURITY DEFINER instead of direct sub-queries';
END $$;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260409110000', 'fix_remaining_rls_recursion')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260409110000_fix_remaining_rls_recursion.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260409160000_building_unit_lease_document_fk.sql
-- Risk: DANGEREUX
-- Why: UPDATE sans WHERE : on
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260409160000_building_unit_lease_document_fk.sql'; END $pre$;

-- ============================================
-- Migration : FK building_unit_id sur leases et documents
-- Sprint 2+3 : Permettre baux et documents par lot d'immeuble
-- ============================================

-- 1. FK leases → building_units
-- ============================================
ALTER TABLE leases
  ADD COLUMN IF NOT EXISTS building_unit_id UUID
    REFERENCES building_units(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leases_building_unit_id
  ON leases(building_unit_id) WHERE building_unit_id IS NOT NULL;

COMMENT ON COLUMN leases.building_unit_id IS
  'Lot d''immeuble associé (si le bail concerne un lot spécifique)';

-- 2. FK documents → building_units
-- ============================================
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS building_unit_id UUID
    REFERENCES building_units(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_documents_building_unit_id
  ON documents(building_unit_id) WHERE building_unit_id IS NOT NULL;

COMMENT ON COLUMN documents.building_unit_id IS
  'Lot d''immeuble associé (diagnostics lot, bail lot, EDL lot)';

-- 3. Colonne parent_property_id sur properties
-- ============================================
-- Les properties créées pour des lots d'immeuble pointent vers la property parent (type=immeuble).
-- Permet de les exclure de "Mes biens" et de les rattacher à l'immeuble.
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS parent_property_id UUID
    REFERENCES properties(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_properties_parent_property
  ON properties(parent_property_id) WHERE parent_property_id IS NOT NULL;

COMMENT ON COLUMN properties.parent_property_id IS
  'Si non-null, cette property est un lot d''immeuble rattaché à la property parent';

-- 4. Mise à jour building_units.status depuis les baux actifs
-- ============================================
-- Quand un bail actif est lié à un lot, le lot passe en "occupe"
CREATE OR REPLACE FUNCTION sync_building_unit_status_from_lease()
RETURNS TRIGGER AS $$
BEGIN
  -- Bail activé → lot occupé
  IF NEW.statut = 'active' AND NEW.building_unit_id IS NOT NULL THEN
    UPDATE building_units
    SET status = 'occupe', current_lease_id = NEW.id
    WHERE id = NEW.building_unit_id;
  END IF;

  -- Bail terminé → lot vacant
  IF NEW.statut IN ('terminated', 'archived', 'cancelled')
     AND OLD.statut = 'active'
     AND NEW.building_unit_id IS NOT NULL THEN
    UPDATE building_units
    SET status = 'vacant', current_lease_id = NULL
    WHERE id = NEW.building_unit_id AND current_lease_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_unit_status_on_lease ON leases;
CREATE TRIGGER trigger_sync_unit_status_on_lease
  AFTER UPDATE ON leases
  FOR EACH ROW
  WHEN (OLD.statut IS DISTINCT FROM NEW.statut)
  EXECUTE FUNCTION sync_building_unit_status_from_lease();

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260409160000', 'building_unit_lease_document_fk')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260409160000_building_unit_lease_document_fk.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260409170000_backfill_building_unit_properties.sql
-- Risk: DANGEREUX
-- Why: UPDATE sans WHERE : on,on
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260409170000_backfill_building_unit_properties.sql'; END $pre$;

-- ============================================
-- Migration : Compléter le schéma buildings + backfill lots
--
-- La table buildings existait depuis la migration copropriété (20251208)
-- avec un schéma minimal (site_id, name, code, floors_count, has_elevator).
-- Cette migration ajoute les colonnes nécessaires pour le module immeuble
-- locatif (property_id, owner_id, adresse, amenities) puis crée les
-- properties individuelles pour chaque lot.
-- ============================================

-- ============================================
-- 1. Colonnes manquantes sur buildings
-- ============================================
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id) ON DELETE SET NULL;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS adresse_complete TEXT;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS code_postal TEXT;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS ville TEXT;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS departement TEXT;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8);
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS floors INTEGER DEFAULT 1;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS surface_totale DECIMAL(10, 2);
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS has_ascenseur BOOLEAN DEFAULT false;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS has_gardien BOOLEAN DEFAULT false;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS has_interphone BOOLEAN DEFAULT false;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS has_digicode BOOLEAN DEFAULT false;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS has_local_velo BOOLEAN DEFAULT false;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS has_local_poubelles BOOLEAN DEFAULT false;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS has_parking_commun BOOLEAN DEFAULT false;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS has_jardin_commun BOOLEAN DEFAULT false;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE INDEX IF NOT EXISTS idx_buildings_owner ON buildings(owner_id);
CREATE INDEX IF NOT EXISTS idx_buildings_property ON buildings(property_id);
CREATE INDEX IF NOT EXISTS idx_buildings_ville ON buildings(ville);
CREATE INDEX IF NOT EXISTS idx_buildings_code_postal ON buildings(code_postal);

-- ============================================
-- 2. Table building_units si elle n'existe pas
-- ============================================
CREATE TABLE IF NOT EXISTS building_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  floor INTEGER NOT NULL DEFAULT 0 CHECK (floor >= -5 AND floor <= 50),
  position TEXT NOT NULL DEFAULT 'A',
  type TEXT NOT NULL CHECK (type IN (
    'appartement', 'studio', 'local_commercial', 'parking', 'cave', 'bureau'
  )),
  template TEXT CHECK (template IN (
    'studio', 't1', 't2', 't3', 't4', 't5', 'local', 'parking', 'cave'
  )),
  surface DECIMAL(8, 2) NOT NULL CHECK (surface > 0),
  nb_pieces INTEGER DEFAULT 1 CHECK (nb_pieces >= 0),
  loyer_hc DECIMAL(10, 2) DEFAULT 0 CHECK (loyer_hc >= 0),
  charges DECIMAL(10, 2) DEFAULT 0 CHECK (charges >= 0),
  depot_garantie DECIMAL(10, 2) DEFAULT 0 CHECK (depot_garantie >= 0),
  status TEXT DEFAULT 'vacant' CHECK (status IN ('vacant', 'occupe', 'travaux', 'reserve')),
  current_lease_id UUID REFERENCES leases(id) ON DELETE SET NULL,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(building_id, floor, position)
);

-- Colonnes manquantes sur building_units si la table existait déjà
ALTER TABLE building_units ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id) ON DELETE SET NULL;
ALTER TABLE building_units ADD COLUMN IF NOT EXISTS template TEXT;
ALTER TABLE building_units ADD COLUMN IF NOT EXISTS loyer_hc DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE building_units ADD COLUMN IF NOT EXISTS charges DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE building_units ADD COLUMN IF NOT EXISTS depot_garantie DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE building_units ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'vacant';
ALTER TABLE building_units ADD COLUMN IF NOT EXISTS current_lease_id UUID REFERENCES leases(id) ON DELETE SET NULL;
ALTER TABLE building_units ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE INDEX IF NOT EXISTS idx_building_units_building ON building_units(building_id);
CREATE INDEX IF NOT EXISTS idx_building_units_property ON building_units(property_id);
CREATE INDEX IF NOT EXISTS idx_building_units_status ON building_units(status);

-- ============================================
-- 3. Triggers updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_buildings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_buildings_updated_at ON buildings;
CREATE TRIGGER trigger_buildings_updated_at
  BEFORE UPDATE ON buildings
  FOR EACH ROW
  EXECUTE FUNCTION update_buildings_updated_at();

DROP TRIGGER IF EXISTS trigger_building_units_updated_at ON building_units;
CREATE TRIGGER trigger_building_units_updated_at
  BEFORE UPDATE ON building_units
  FOR EACH ROW
  EXECUTE FUNCTION update_buildings_updated_at();

-- ============================================
-- 4. RLS
-- ============================================
ALTER TABLE buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE building_units ENABLE ROW LEVEL SECURITY;

-- Service role bypass (pour les API routes)
DROP POLICY IF EXISTS "Service role full access buildings" ON buildings;
CREATE POLICY "Service role full access buildings" ON buildings
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access building_units" ON building_units;
CREATE POLICY "Service role full access building_units" ON building_units
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 5. Backfill : property par lot (si des lots existent)
-- ============================================

-- Fonction utilitaire temporaire
CREATE OR REPLACE FUNCTION _gen_prop_code()
RETURNS TEXT AS $$
DECLARE
  charset TEXT := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  result TEXT;
  i INT;
BEGIN
  LOOP
    result := 'PROP-';
    FOR i IN 1..4 LOOP
      result := result || substr(charset, floor(random() * length(charset) + 1)::int, 1);
    END LOOP;
    result := result || '-';
    FOR i IN 1..4 LOOP
      result := result || substr(charset, floor(random() * length(charset) + 1)::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM properties WHERE unique_code = result);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  rec RECORD;
  new_pid UUID;
  new_code TEXT;
  pp RECORD;
  lot_addr TEXT;
  fl TEXT;
BEGIN
  -- Parcourir building_units sans property_id, reliés à un building ayant property_id
  FOR rec IN
    SELECT
      bu.id AS unit_id, bu.building_id, bu.floor, bu.position,
      bu.type, bu.surface, bu.nb_pieces, bu.loyer_hc, bu.charges,
      bu.depot_garantie, bu.status,
      b.property_id AS parent_pid, b.has_ascenseur
    FROM building_units bu
    JOIN buildings b ON b.id = bu.building_id
    WHERE bu.property_id IS NULL
      AND b.property_id IS NOT NULL
  LOOP
    -- Parent property
    SELECT owner_id, legal_entity_id, adresse_complete, code_postal, ville, departement, etat
    INTO pp FROM properties WHERE id = rec.parent_pid;

    IF pp IS NULL THEN CONTINUE; END IF;

    -- Floor label
    IF rec.floor < 0 THEN fl := 'SS' || abs(rec.floor);
    ELSIF rec.floor = 0 THEN fl := 'RDC';
    ELSE fl := 'Étage ' || rec.floor;
    END IF;

    lot_addr := COALESCE(pp.adresse_complete, '') || ' - Lot ' || rec.position || ', ' || fl;
    new_code := _gen_prop_code();

    INSERT INTO properties (
      owner_id, legal_entity_id, parent_property_id, type, etat, unique_code,
      adresse_complete, code_postal, ville, departement,
      surface, nb_pieces, nb_chambres, ascenseur, meuble, loyer_hc, charges_mensuelles
    ) VALUES (
      pp.owner_id, pp.legal_entity_id, rec.parent_pid, rec.type,
      CASE WHEN pp.etat = 'published' THEN 'published' ELSE 'draft' END,
      new_code, lot_addr,
      COALESCE(pp.code_postal, ''), COALESCE(pp.ville, ''), COALESCE(pp.departement, ''),
      rec.surface, rec.nb_pieces, 0,
      COALESCE(rec.has_ascenseur, false),
      rec.type IN ('studio', 'local_commercial'),
      COALESCE(rec.loyer_hc, 0), COALESCE(rec.charges, 0)
    ) RETURNING id INTO new_pid;

    UPDATE building_units SET property_id = new_pid WHERE id = rec.unit_id;
    RAISE NOTICE 'Lot %/% → property %', rec.position, fl, new_pid;
  END LOOP;

  -- Backfill parent_property_id pour lots existants qui l'ont pas
  UPDATE properties p
  SET parent_property_id = b.property_id
  FROM building_units bu
  JOIN buildings b ON b.id = bu.building_id
  WHERE bu.property_id = p.id
    AND p.parent_property_id IS NULL
    AND b.property_id IS NOT NULL
    AND b.property_id != p.id;
END;
$$;

DROP FUNCTION IF EXISTS _gen_prop_code();

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260409170000', 'backfill_building_unit_properties')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260409170000_backfill_building_unit_properties.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260410210000_fix_protected_document_visibility.sql
-- Risk: DANGEREUX
-- Why: UPDATE sans WHERE : on
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260410210000_fix_protected_document_visibility.sql'; END $pre$;

-- =============================================================================
-- Migration : Fix protected document visibility for tenants
-- Date      : 2026-04-10
-- Bug       : Tenants hit 403 when downloading quittances from /tenant/documents
--
-- Root cause : The RPC `tenant_document_center()` and the view
--   `v_tenant_key_documents` return documents regardless of `visible_tenant`,
--   but `/api/documents/[id]/signed-url` enforces `visible_tenant != false`
--   (consistent with the `documents` table RLS). So a quittance with
--   visible_tenant = false shows up in the UI and then 403s on download.
--
-- Additionally, quittances (and other legally-mandatory documents like
-- bail, EDL, attestation de remise des cles) must always be visible to
-- tenants per Art. 21 Loi du 6 juillet 1989. The existing trigger
-- `force_visible_tenant_on_generated` only protects docs with
-- is_generated = true, which quittances from /api/payments/[pid]/receipt
-- are not.
--
-- Fix (4 parts in one migration):
--   1. Backfill visible_tenant = true for all protected document types
--   2. Harden trigger: force visible_tenant = true for protected types too
--   3. Patch view v_tenant_key_documents to filter visible_tenant
--   4. Patch RPCs tenant_document_center() and tenant_documents_search()
--      to filter visible_tenant (exception: tenant always sees their own
--      uploads via uploaded_by).
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. BACKFILL : Force visible_tenant = true for protected document types
-- =============================================================================

UPDATE documents
SET visible_tenant = true, updated_at = now()
WHERE type IN (
  'quittance',
  'bail', 'contrat', 'avenant',
  'bail_signe_locataire', 'bail_signe_proprietaire',
  'EDL_entree', 'edl_entree', 'EDL_sortie', 'edl_sortie',
  'attestation_remise_cles'
)
AND visible_tenant IS DISTINCT FROM true;


-- =============================================================================
-- 2. HARDEN TRIGGER : force visible_tenant on generated docs AND protected types
-- =============================================================================

CREATE OR REPLACE FUNCTION public.force_visible_tenant_on_generated()
RETURNS TRIGGER AS $$
BEGIN
    -- Generated documents are always visible to tenants
    IF NEW.is_generated = true THEN
        NEW.visible_tenant := true;
    END IF;

    -- Legally-mandatory document types must always be visible to tenants
    -- (quittances, bail, EDL, attestation de remise des cles)
    IF NEW.type IN (
        'quittance',
        'bail', 'contrat', 'avenant',
        'bail_signe_locataire', 'bail_signe_proprietaire',
        'EDL_entree', 'edl_entree', 'EDL_sortie', 'edl_sortie',
        'attestation_remise_cles'
    ) THEN
        NEW.visible_tenant := true;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.force_visible_tenant_on_generated() IS
  'Coerces visible_tenant = true for (a) any is_generated=true document and '
  '(b) legally-mandatory document types (quittance, bail, EDL, attestation '
  'de remise des cles) regardless of is_generated. Prevents owners from '
  'accidentally hiding documents tenants have a legal right to access.';

-- Recreate trigger (same name, same timing) to pick up the new function body
DROP TRIGGER IF EXISTS trg_force_visible_tenant_on_generated ON documents;
CREATE TRIGGER trg_force_visible_tenant_on_generated
    BEFORE INSERT OR UPDATE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION public.force_visible_tenant_on_generated();


-- =============================================================================
-- 3. PATCH VIEW : v_tenant_key_documents — filter visible_tenant
-- =============================================================================

CREATE OR REPLACE VIEW v_tenant_key_documents AS
WITH ranked_docs AS (
  SELECT
    d.id,
    d.type,
    d.title,
    d.storage_path,
    d.created_at,
    d.tenant_id,
    d.lease_id,
    d.property_id,
    d.metadata,
    d.verification_status,
    d.ged_status,
    CASE
      WHEN d.type IN ('bail', 'contrat', 'avenant', 'bail_signe_locataire', 'bail_signe_proprietaire') THEN 'bail'
      WHEN d.type IN ('quittance') THEN 'quittance'
      WHEN d.type IN ('EDL_entree', 'edl_entree', 'inventaire') THEN 'edl'
      WHEN d.type IN ('attestation_assurance', 'assurance_pno') THEN 'assurance'
      ELSE NULL
    END AS slot_key,
    ROW_NUMBER() OVER (
      PARTITION BY
        d.tenant_id,
        CASE
          WHEN d.type IN ('bail', 'contrat', 'avenant', 'bail_signe_locataire', 'bail_signe_proprietaire') THEN 'bail'
          WHEN d.type IN ('quittance') THEN 'quittance'
          WHEN d.type IN ('EDL_entree', 'edl_entree', 'inventaire') THEN 'edl'
          WHEN d.type IN ('attestation_assurance', 'assurance_pno') THEN 'assurance'
        END
      ORDER BY
        CASE WHEN (d.metadata->>'final')::boolean = true THEN 0 ELSE 1 END,
        CASE WHEN d.ged_status = 'signed' THEN 0 WHEN d.ged_status = 'active' THEN 1 ELSE 2 END,
        d.created_at DESC
    ) AS rn
  FROM documents d
  WHERE d.tenant_id IS NOT NULL
    AND d.type IN (
      'bail', 'contrat', 'avenant', 'bail_signe_locataire', 'bail_signe_proprietaire',
      'quittance',
      'EDL_entree', 'edl_entree', 'inventaire',
      'attestation_assurance', 'assurance_pno'
    )
    -- Only surface documents the tenant can actually download.
    -- Tenant always sees their own uploads (uploaded_by match).
    AND (d.visible_tenant IS NOT FALSE OR d.uploaded_by = d.tenant_id)
)
SELECT
  id,
  type,
  title,
  storage_path,
  created_at,
  tenant_id,
  lease_id,
  property_id,
  metadata,
  verification_status,
  ged_status,
  slot_key
FROM ranked_docs
WHERE rn = 1 AND slot_key IS NOT NULL;

COMMENT ON VIEW v_tenant_key_documents IS
  'Documents cles par locataire (bail, derniere quittance, EDL entree, assurance). '
  'Filtre visible_tenant pour ne retourner que les documents effectivement '
  'telechargeables par le locataire (alignement avec /api/documents/[id]/signed-url).';


-- =============================================================================
-- 4. PATCH RPC : tenant_document_center() — filter visible_tenant
-- =============================================================================

CREATE OR REPLACE FUNCTION public.tenant_document_center(p_profile_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id UUID;
  v_result JSONB;
  v_pending_actions JSONB;
  v_key_documents JSONB;
  v_all_documents JSONB;
  v_stats JSONB;
BEGIN
  -- Resolve profile_id (parameter or current user)
  IF p_profile_id IS NOT NULL THEN
    v_profile_id := p_profile_id;
  ELSE
    SELECT id INTO v_profile_id
    FROM profiles
    WHERE user_id = auth.uid()
    LIMIT 1;
  END IF;

  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Profile not found');
  END IF;

  -- Zone 1 : Pending actions
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'action_type', action_type,
      'entity_id', entity_id,
      'label', action_label,
      'description', action_description,
      'href', action_href,
      'priority', priority,
      'created_at', action_created_at
    ) ORDER BY
      CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
      action_created_at DESC
  ), '[]'::jsonb)
  INTO v_pending_actions
  FROM v_tenant_pending_actions
  WHERE tenant_profile_id = v_profile_id;

  -- Zone 2 : Key documents (4 slots) — view already filters visible_tenant
  SELECT COALESCE(jsonb_object_agg(
    slot_key,
    jsonb_build_object(
      'id', id,
      'type', type,
      'title', title,
      'storage_path', storage_path,
      'created_at', created_at,
      'lease_id', lease_id,
      'property_id', property_id,
      'metadata', COALESCE(metadata, '{}'::jsonb),
      'verification_status', verification_status,
      'ged_status', ged_status
    )
  ), '{}'::jsonb)
  INTO v_key_documents
  FROM v_tenant_key_documents
  WHERE tenant_id = v_profile_id;

  -- Zone 3 : All documents (50 most recent, deduplicated, visible only)
  SELECT COALESCE(jsonb_agg(doc ORDER BY doc->>'created_at' DESC), '[]'::jsonb)
  INTO v_all_documents
  FROM (
    SELECT DISTINCT ON (d.type, COALESCE(d.lease_id, d.property_id, d.id))
      jsonb_build_object(
        'id', d.id,
        'type', d.type,
        'title', d.title,
        'storage_path', d.storage_path,
        'created_at', d.created_at,
        'tenant_id', d.tenant_id,
        'lease_id', d.lease_id,
        'property_id', d.property_id,
        'metadata', COALESCE(d.metadata, '{}'::jsonb),
        'verification_status', d.verification_status,
        'ged_status', d.ged_status,
        'file_size', d.file_size,
        'mime_type', d.mime_type,
        'original_filename', d.original_filename
      ) AS doc
    FROM documents d
    WHERE (
        d.tenant_id = v_profile_id
        OR d.lease_id IN (
          SELECT ls.lease_id FROM lease_signers ls WHERE ls.profile_id = v_profile_id
        )
      )
      -- Align with /api/documents/[id]/signed-url permission check:
      -- tenant always sees their own uploads; owner-shared docs require
      -- visible_tenant IS NOT FALSE.
      AND (d.visible_tenant IS NOT FALSE OR d.uploaded_by = v_profile_id)
    ORDER BY d.type, COALESCE(d.lease_id, d.property_id, d.id), d.created_at DESC
    LIMIT 100
  ) sub
  LIMIT 50;

  -- Stats (must use the same filter to stay consistent with the list)
  SELECT jsonb_build_object(
    'total_documents', (
      SELECT COUNT(*) FROM documents d
      WHERE (
          d.tenant_id = v_profile_id
          OR d.lease_id IN (SELECT ls.lease_id FROM lease_signers ls WHERE ls.profile_id = v_profile_id)
        )
        AND (d.visible_tenant IS NOT FALSE OR d.uploaded_by = v_profile_id)
    ),
    'pending_actions_count', jsonb_array_length(v_pending_actions),
    'has_bail', v_key_documents ? 'bail',
    'has_quittance', v_key_documents ? 'quittance',
    'has_edl', v_key_documents ? 'edl',
    'has_assurance', v_key_documents ? 'assurance'
  ) INTO v_stats;

  v_result := jsonb_build_object(
    'pending_actions', v_pending_actions,
    'key_documents', v_key_documents,
    'documents', v_all_documents,
    'stats', v_stats
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.tenant_document_center IS
  'Endpoint unique pour le Document Center locataire. Retourne : pending_actions, '
  'key_documents (4 slots), documents (tous, dedoublonnes), stats. '
  'Filtre visible_tenant pour ne retourner que les documents effectivement '
  'telechargeables par le locataire (alignement avec /api/documents/[id]/signed-url).';

GRANT EXECUTE ON FUNCTION public.tenant_document_center TO authenticated;


-- =============================================================================
-- 5. PATCH RPC : tenant_documents_search() — filter visible_tenant
-- =============================================================================

CREATE OR REPLACE FUNCTION public.tenant_documents_search(
  p_query TEXT DEFAULT NULL,
  p_type TEXT DEFAULT NULL,
  p_period TEXT DEFAULT NULL,
  p_sort TEXT DEFAULT 'date_desc',
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id UUID;
  v_result JSONB;
  v_period_start TIMESTAMPTZ;
BEGIN
  SELECT id INTO v_profile_id
  FROM profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Profile not found', 'documents', '[]'::jsonb);
  END IF;

  v_period_start := CASE p_period
    WHEN '1m' THEN NOW() - INTERVAL '1 month'
    WHEN '3m' THEN NOW() - INTERVAL '3 months'
    WHEN '6m' THEN NOW() - INTERVAL '6 months'
    WHEN '1y' THEN NOW() - INTERVAL '1 year'
    ELSE NULL
  END;

  SELECT jsonb_build_object(
    'documents', COALESCE(jsonb_agg(doc), '[]'::jsonb),
    'total', COUNT(*) OVER()
  )
  INTO v_result
  FROM (
    SELECT jsonb_build_object(
      'id', d.id,
      'type', d.type,
      'title', d.title,
      'storage_path', d.storage_path,
      'created_at', d.created_at,
      'tenant_id', d.tenant_id,
      'lease_id', d.lease_id,
      'property_id', d.property_id,
      'metadata', COALESCE(d.metadata, '{}'::jsonb),
      'verification_status', d.verification_status,
      'ged_status', d.ged_status,
      'file_size', d.file_size,
      'mime_type', d.mime_type,
      'original_filename', d.original_filename,
      'is_recent', (d.created_at > NOW() - INTERVAL '7 days')
    ) AS doc,
    d.created_at,
    d.type
    FROM documents d
    WHERE (
      d.tenant_id = v_profile_id
      OR d.lease_id IN (
        SELECT ls.lease_id FROM lease_signers ls WHERE ls.profile_id = v_profile_id
      )
    )
    -- Align with signed-url permission check (see tenant_document_center)
    AND (d.visible_tenant IS NOT FALSE OR d.uploaded_by = v_profile_id)
    AND (p_query IS NULL OR p_query = '' OR
      d.search_vector @@ plainto_tsquery('french', p_query)
      OR d.title ILIKE '%' || p_query || '%'
      OR d.type ILIKE '%' || p_query || '%'
    )
    AND (p_type IS NULL OR p_type = 'all' OR d.type = p_type)
    AND (v_period_start IS NULL OR d.created_at >= v_period_start)
    ORDER BY
      CASE WHEN p_sort = 'date_desc' THEN d.created_at END DESC NULLS LAST,
      CASE WHEN p_sort = 'date_asc'  THEN d.created_at END ASC NULLS LAST,
      CASE WHEN p_sort = 'type'      THEN d.type END ASC,
      d.created_at DESC
    LIMIT p_limit
    OFFSET p_offset
  ) sub;

  RETURN COALESCE(v_result, jsonb_build_object('documents', '[]'::jsonb, 'total', 0));
END;
$$;

COMMENT ON FUNCTION public.tenant_documents_search IS
  'Recherche full-text dans les documents du locataire avec filtres (type, periode) et tri. '
  'Filtre visible_tenant pour ne retourner que les documents effectivement '
  'telechargeables par le locataire.';

GRANT EXECUTE ON FUNCTION public.tenant_documents_search TO authenticated;


COMMIT;

-- =============================================================================
-- Rollback notes :
--   1. Restore previous trigger body (force only on is_generated = true)
--   2. Restore v_tenant_key_documents without visible_tenant filter
--   3. Restore tenant_document_center() and tenant_documents_search() without
--      visible_tenant filter
--   (See migration 20260216000000_tenant_document_center.sql and
--    20260329190000_force_visible_tenant_generated_docs.sql for original bodies)
-- =============================================================================

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260410210000', 'fix_protected_document_visibility')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260410210000_fix_protected_document_visibility.sql'; END $post$;

COMMIT;

-- END OF BATCH 9/11 (Phase 3 DANGEREUX)

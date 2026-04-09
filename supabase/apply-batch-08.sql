-- Batch 8 — migrations 165 a 169 sur 169
-- 5 migrations

-- === [165/169] 20260408130000_security_deposits.sql ===
-- =====================================================
-- Migration: Table des dépôts de garantie (lifecycle tracking)
-- Date: 2026-04-08
-- Spec: talok-paiements — Section 7
-- =====================================================

BEGIN;

-- Table principale : un enregistrement par dépôt de garantie par bail
CREATE TABLE IF NOT EXISTS security_deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES profiles(id),

  -- Montant
  amount_cents INTEGER NOT NULL,
  paid_at TIMESTAMPTZ,
  payment_method TEXT,

  -- Restitution
  restitution_amount_cents INTEGER,
  retenue_cents INTEGER DEFAULT 0,
  retenue_details JSONB DEFAULT '[]'::jsonb,
  -- Format: [{ "motif": "Dégradations", "amount_cents": 15000, "justification": "Photos EDL" }]
  restitution_due_date DATE,           -- date sortie + 1 ou 2 mois selon EDL
  restituted_at TIMESTAMPTZ,
  restitution_method TEXT,             -- 'virement' | 'cheque' | 'especes'

  -- Statut lifecycle
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'received', 'partially_returned', 'returned', 'disputed')),

  -- Pénalité de retard (10% loyer/mois)
  late_penalty_cents INTEGER DEFAULT 0,

  -- Métadonnées
  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Un seul dépôt par bail
  UNIQUE(lease_id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_security_deposits_lease_id ON security_deposits(lease_id);
CREATE INDEX IF NOT EXISTS idx_security_deposits_tenant_id ON security_deposits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_security_deposits_status ON security_deposits(status);
CREATE INDEX IF NOT EXISTS idx_security_deposits_restitution_due ON security_deposits(restitution_due_date)
  WHERE status = 'received' AND restitution_due_date IS NOT NULL;

-- Trigger updated_at
CREATE OR REPLACE TRIGGER set_updated_at_security_deposits
  BEFORE UPDATE ON security_deposits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE security_deposits ENABLE ROW LEVEL SECURITY;

-- Politique: Le propriétaire peut gérer les dépôts de ses baux
DROP POLICY IF EXISTS "Owner manages security_deposits" ON security_deposits;
CREATE POLICY "Owner manages security_deposits" ON security_deposits
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON l.property_id = p.id
      WHERE l.id = security_deposits.lease_id
      AND p.owner_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- Politique: Le locataire peut voir son dépôt
DROP POLICY IF EXISTS "Tenant views own security_deposit" ON security_deposits;
CREATE POLICY "Tenant views own security_deposit" ON security_deposits
  FOR SELECT
  USING (
    tenant_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Politique: Admin peut tout gérer
DROP POLICY IF EXISTS "Admin manages all security_deposits" ON security_deposits;
CREATE POLICY "Admin manages all security_deposits" ON security_deposits
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- Trigger : créer automatiquement un security_deposit à la signature du bail
-- =====================================================
CREATE OR REPLACE FUNCTION create_security_deposit_on_lease_activation()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant_id UUID;
  v_deposit_amount INTEGER;
BEGIN
  -- Seulement quand le bail passe à 'active'
  IF NEW.statut = 'active' AND (OLD.statut IS DISTINCT FROM 'active') THEN
    -- Récupérer le montant du dépôt (stocké en euros dans leases, convertir en centimes)
    v_deposit_amount := COALESCE(NEW.depot_de_garantie, 0) * 100;

    -- Pas de dépôt si montant = 0 (bail mobilité interdit)
    IF v_deposit_amount <= 0 THEN
      RETURN NEW;
    END IF;

    -- Récupérer le locataire principal
    SELECT ls.profile_id INTO v_tenant_id
    FROM lease_signers ls
    WHERE ls.lease_id = NEW.id
      AND ls.role = 'locataire_principal'
    LIMIT 1;

    IF v_tenant_id IS NULL THEN
      RETURN NEW;
    END IF;

    -- Créer le dépôt en statut 'pending'
    INSERT INTO security_deposits (lease_id, tenant_id, amount_cents, status)
    VALUES (NEW.id, v_tenant_id, v_deposit_amount, 'pending')
    ON CONFLICT (lease_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_create_security_deposit ON leases;
CREATE TRIGGER trg_create_security_deposit
  AFTER UPDATE ON leases
  FOR EACH ROW
  EXECUTE FUNCTION create_security_deposit_on_lease_activation();

COMMIT;


-- === [166/169] 20260408140000_tickets_module_sota.sql ===
-- =============================================
-- TICKETS MODULE SOTA — Upgrade complet
-- State machine: open → acknowledged → assigned → in_progress → resolved → closed
--                       ↓                                        ↓
--                    rejected                               reopened → in_progress
-- =============================================

-- 1. Ajouter les nouvelles colonnes à tickets
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES profiles(id);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES profiles(id);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS entity_id UUID;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]';
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS work_order_id UUID REFERENCES work_orders(id);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS resolution_notes TEXT;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS satisfaction_rating INTEGER;

-- 2. Contrainte satisfaction_rating
ALTER TABLE tickets ADD CONSTRAINT tickets_satisfaction_rating_check
  CHECK (satisfaction_rating IS NULL OR (satisfaction_rating >= 1 AND satisfaction_rating <= 5));

-- 3. Contrainte category
ALTER TABLE tickets ADD CONSTRAINT tickets_category_check
  CHECK (category IS NULL OR category IN (
    'plomberie','electricite','serrurerie','chauffage','humidite',
    'nuisibles','bruit','parties_communes','equipement','autre'
  ));

-- 4. Étendre la contrainte de statut (garder paused pour backward compat)
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_statut_check;
ALTER TABLE tickets ADD CONSTRAINT tickets_statut_check
  CHECK (statut IN (
    'open','acknowledged','assigned','in_progress',
    'resolved','closed','rejected','reopened','paused'
  ));

-- 5. Étendre la contrainte de priorité (garder anciennes valeurs françaises pour compat)
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_priorite_check;
ALTER TABLE tickets ADD CONSTRAINT tickets_priorite_check
  CHECK (priorite IN ('low','normal','urgent','emergency','basse','normale','haute','urgente'));

-- 6. Backfill owner_id depuis properties pour tickets existants
UPDATE tickets t
SET owner_id = p.owner_id
FROM properties p
WHERE t.property_id = p.id
  AND t.owner_id IS NULL;

-- 7. Nouveaux index
CREATE INDEX IF NOT EXISTS idx_tickets_category ON tickets(category);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_owner_id ON tickets(owner_id);

-- 8. Créer la table ticket_comments
CREATE TABLE IF NOT EXISTS ticket_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id),
  content TEXT NOT NULL,
  attachments JSONB DEFAULT '[]',
  is_internal BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ticket_comments ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket_id ON ticket_comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_author_id ON ticket_comments(author_id);

-- 9. RLS policies pour ticket_comments
DROP POLICY IF EXISTS "ticket_comments_select_owner" ON ticket_comments;
CREATE POLICY "ticket_comments_select_owner"
  ON ticket_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tickets t
      JOIN properties p ON p.id = t.property_id
      WHERE t.id = ticket_comments.ticket_id
        AND p.owner_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "ticket_comments_select_creator" ON ticket_comments;

CREATE POLICY "ticket_comments_select_creator"
  ON ticket_comments FOR SELECT
  USING (
    NOT is_internal AND EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_comments.ticket_id
        AND t.created_by_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "ticket_comments_select_assigned" ON ticket_comments;

CREATE POLICY "ticket_comments_select_assigned"
  ON ticket_comments FOR SELECT
  USING (
    NOT is_internal AND EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_comments.ticket_id
        AND t.assigned_to = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "ticket_comments_insert" ON ticket_comments;

CREATE POLICY "ticket_comments_insert"
  ON ticket_comments FOR INSERT
  WITH CHECK (
    author_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "ticket_comments_select_admin" ON ticket_comments;

CREATE POLICY "ticket_comments_select_admin"
  ON ticket_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- 10. Trigger updated_at pour tickets (si pas déjà présent)
CREATE OR REPLACE FUNCTION update_tickets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_tickets_updated_at ON tickets;
CREATE TRIGGER trigger_update_tickets_updated_at
  BEFORE UPDATE ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_tickets_updated_at();


-- === [167/169] 20260408200000_unified_notification_system.sql ===
-- =====================================================
-- MIGRATION: Système de notifications unifié
-- Ajoute la table notification_event_preferences (per-event)
-- et les colonnes manquantes sur notifications
-- =====================================================

-- 1. Ajouter colonnes manquantes à notifications
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'route') THEN
    ALTER TABLE notifications ADD COLUMN route TEXT;
    COMMENT ON COLUMN notifications.route IS 'Deep link route (e.g. /owner/invoices/xxx)';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'channels_sent') THEN
    ALTER TABLE notifications ADD COLUMN channels_sent TEXT[] DEFAULT '{}';
    COMMENT ON COLUMN notifications.channels_sent IS 'Channels actually used: email, push, in_app, sms';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'is_read') THEN
    ALTER TABLE notifications ADD COLUMN is_read BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'read_at') THEN
    ALTER TABLE notifications ADD COLUMN read_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'profile_id') THEN
    ALTER TABLE notifications ADD COLUMN profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END$$;

-- Index for profile-based queries
CREATE INDEX IF NOT EXISTS idx_notif_profile_read_created
  ON notifications(profile_id, is_read, created_at DESC);

-- 2. Table de préférences par événement
CREATE TABLE IF NOT EXISTS notification_event_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  email_enabled BOOLEAN DEFAULT true,
  push_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT false,
  in_app_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(profile_id, event_type)
);

CREATE INDEX IF NOT EXISTS idx_notif_event_prefs_profile
  ON notification_event_preferences(profile_id);

ALTER TABLE notification_event_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own event preferences" ON notification_event_preferences;
DROP POLICY IF EXISTS "Users can view own event preferences" ON notification_event_preferences;
CREATE POLICY "Users can view own event preferences"
  ON notification_event_preferences FOR SELECT
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can manage own event preferences" ON notification_event_preferences;
DROP POLICY IF EXISTS "Users can manage own event preferences" ON notification_event_preferences;
CREATE POLICY "Users can manage own event preferences"
  ON notification_event_preferences FOR ALL
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
  WITH CHECK (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Allow service role to insert
DROP POLICY IF EXISTS "Service can manage event preferences" ON notification_event_preferences;
DROP POLICY IF EXISTS "Service can manage event preferences" ON notification_event_preferences;
CREATE POLICY "Service can manage event preferences"
  ON notification_event_preferences FOR ALL
  USING (true)
  WITH CHECK (true);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_notification_event_prefs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_notif_event_prefs ON notification_event_preferences;
CREATE TRIGGER trigger_update_notif_event_prefs
  BEFORE UPDATE ON notification_event_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_event_prefs_updated_at();

COMMENT ON TABLE notification_event_preferences IS 'Per-event notification channel preferences for each user';

SELECT 'Unified notification system migration complete' AS result;


-- === [168/169] 20260408220000_payment_architecture_sota.sql ===
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


-- === [169/169] 20260409100000_add_missing_rls.sql ===
-- ==========================================================
-- Migration: Add missing RLS to 8 unprotected tables
-- Date: 2026-04-09
-- Context: Audit express identified 8 tables without RLS
-- ==========================================================

-- ──────────────────────────────────────────────
-- 1. tenants (system multi-tenant table, no user column)
-- Admin-only access via service role
-- ──────────────────────────────────────────────
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenants_admin_only" ON tenants;

CREATE POLICY "tenants_admin_only"
  ON tenants FOR ALL
  USING (false);
-- Service role bypasses RLS; app code uses service client for admin ops

-- ──────────────────────────────────────────────
-- 2. two_factor_sessions (security-critical, has user_id)
-- ──────────────────────────────────────────────
ALTER TABLE two_factor_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_2fa_sessions" ON two_factor_sessions;

CREATE POLICY "users_own_2fa_sessions"
  ON two_factor_sessions FOR ALL
  USING (auth.uid() = user_id);

-- ──────────────────────────────────────────────
-- 3. lease_templates (system-wide templates, read-only for users)
-- ──────────────────────────────────────────────
ALTER TABLE lease_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lease_templates_read_authenticated" ON lease_templates;

CREATE POLICY "lease_templates_read_authenticated"
  ON lease_templates FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "lease_templates_write_admin_only" ON lease_templates;

CREATE POLICY "lease_templates_write_admin_only"
  ON lease_templates FOR ALL
  USING (false);
-- Admin writes via service role

-- ──────────────────────────────────────────────
-- 4. idempotency_keys (API utility, no user column)
-- ──────────────────────────────────────────────
ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "idempotency_keys_service_only" ON idempotency_keys;

CREATE POLICY "idempotency_keys_service_only"
  ON idempotency_keys FOR ALL
  USING (false);
-- Only accessed via service role in API middleware

-- ──────────────────────────────────────────────
-- 5. repair_cost_grid (reference table, read-only)
-- ──────────────────────────────────────────────
ALTER TABLE repair_cost_grid ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "repair_cost_grid_read_authenticated" ON repair_cost_grid;

CREATE POLICY "repair_cost_grid_read_authenticated"
  ON repair_cost_grid FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "repair_cost_grid_write_admin_only" ON repair_cost_grid;

CREATE POLICY "repair_cost_grid_write_admin_only"
  ON repair_cost_grid FOR ALL
  USING (false);
-- Admin writes via service role

-- ──────────────────────────────────────────────
-- 6. vetuste_grid (reference table for depreciation, read-only)
-- ──────────────────────────────────────────────
ALTER TABLE vetuste_grid ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vetuste_grid_read_authenticated" ON vetuste_grid;

CREATE POLICY "vetuste_grid_read_authenticated"
  ON vetuste_grid FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "vetuste_grid_write_admin_only" ON vetuste_grid;

CREATE POLICY "vetuste_grid_write_admin_only"
  ON vetuste_grid FOR ALL
  USING (false);

-- ──────────────────────────────────────────────
-- 7. vetusty_grid (variant of vetuste_grid, read-only)
-- ──────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vetusty_grid') THEN
    ALTER TABLE vetusty_grid ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vetusty_grid') THEN
    EXECUTE 'CREATE POLICY "vetusty_grid_read_authenticated" ON vetusty_grid FOR SELECT USING (auth.role() = ''authenticated'')';
    EXECUTE 'CREATE POLICY "vetusty_grid_write_admin_only" ON vetusty_grid FOR ALL USING (false)';
  END IF;
END $$;

-- ──────────────────────────────────────────────
-- 8. api_webhook_deliveries (indirect user link via webhook_id)
-- ──────────────────────────────────────────────
ALTER TABLE api_webhook_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "webhook_deliveries_owner_access" ON api_webhook_deliveries;

CREATE POLICY "webhook_deliveries_owner_access"
  ON api_webhook_deliveries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM api_webhooks w
      WHERE w.id = api_webhook_deliveries.webhook_id
        AND w.profile_id IN (
          SELECT id FROM profiles WHERE user_id = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "webhook_deliveries_write_service_only" ON api_webhook_deliveries;

CREATE POLICY "webhook_deliveries_write_service_only"
  ON api_webhook_deliveries FOR INSERT
  USING (false);
-- Deliveries are created by the system (service role), users can only read their own



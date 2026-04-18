-- ====================================================================
-- Sprint B2 — Phase 3 DANGEREUX — Batch 8/11
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
-- Migration: 20260408130000_insurance_policies.sql
-- Note: file on disk is 20260408130000_insurance_policies.sql but will be renamed to 20260408130007_insurance_policies.sql
-- Risk: DANGEREUX
-- Why: UPDATE sans WHERE : own,on
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260408130000_insurance_policies.sql'; END $pre$;

-- =============================================
-- Migration: Evolve insurance_policies table
-- From tenant-only to multi-role (PNO, multirisques, RC Pro, decennale, GLI, garantie financiere)
-- Original table: 20240101000009_tenant_advanced.sql
-- =============================================

BEGIN;

-- 1. Add new columns to existing table
ALTER TABLE insurance_policies
  ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS insurance_type TEXT,
  ADD COLUMN IF NOT EXISTS amount_covered_cents INTEGER,
  ADD COLUMN IF NOT EXISTS document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_sent_30j BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminder_sent_7j BOOLEAN DEFAULT false;

-- 2. Migrate data: copy tenant_profile_id -> profile_id, coverage_type -> insurance_type
UPDATE insurance_policies
SET profile_id = tenant_profile_id
WHERE profile_id IS NULL AND tenant_profile_id IS NOT NULL;

UPDATE insurance_policies
SET insurance_type = CASE
  WHEN coverage_type = 'habitation' THEN 'multirisques'
  WHEN coverage_type = 'responsabilite' THEN 'rc_pro'
  WHEN coverage_type = 'comprehensive' THEN 'multirisques'
  ELSE 'multirisques'
END
WHERE insurance_type IS NULL AND coverage_type IS NOT NULL;

-- 3. Make lease_id optional (was NOT NULL, now multi-role policies may not have a lease)
ALTER TABLE insurance_policies ALTER COLUMN lease_id DROP NOT NULL;

-- 4. Make policy_number optional (was NOT NULL)
ALTER TABLE insurance_policies ALTER COLUMN policy_number DROP NOT NULL;

-- 5. Add insurance_type CHECK constraint
ALTER TABLE insurance_policies DROP CONSTRAINT IF EXISTS insurance_policies_coverage_type_check;
ALTER TABLE insurance_policies ADD CONSTRAINT chk_insurance_type
  CHECK (insurance_type IN ('pno', 'multirisques', 'rc_pro', 'decennale', 'garantie_financiere', 'gli'));

-- 6. Add business constraints
ALTER TABLE insurance_policies ADD CONSTRAINT chk_insurance_dates
  CHECK (end_date > start_date);
ALTER TABLE insurance_policies ADD CONSTRAINT chk_insurance_amount_positive
  CHECK (amount_covered_cents IS NULL OR amount_covered_cents > 0);

-- 7. New indexes
CREATE INDEX IF NOT EXISTS idx_insurance_profile ON insurance_policies(profile_id);
CREATE INDEX IF NOT EXISTS idx_insurance_property ON insurance_policies(property_id) WHERE property_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_insurance_expiry_active ON insurance_policies(end_date) WHERE end_date > now();
CREATE INDEX IF NOT EXISTS idx_insurance_type ON insurance_policies(insurance_type);

-- 8. RLS (drop old policies from tenant_rls if they exist, add new multi-role ones)
ALTER TABLE insurance_policies ENABLE ROW LEVEL SECURITY;

-- Drop old policies safely
DROP POLICY IF EXISTS "Tenants can view own insurance policies" ON insurance_policies;
DROP POLICY IF EXISTS "Tenants can insert own insurance policies" ON insurance_policies;
DROP POLICY IF EXISTS "Tenants can update own insurance policies" ON insurance_policies;
DROP POLICY IF EXISTS "Tenants can delete own insurance policies" ON insurance_policies;
DROP POLICY IF EXISTS "Owners can view tenant insurance policies" ON insurance_policies;
DROP POLICY IF EXISTS insurance_owner_select ON insurance_policies;
DROP POLICY IF EXISTS insurance_owner_insert ON insurance_policies;
DROP POLICY IF EXISTS insurance_owner_update ON insurance_policies;
DROP POLICY IF EXISTS insurance_owner_delete ON insurance_policies;
DROP POLICY IF EXISTS insurance_owner_view_tenants ON insurance_policies;

-- Users can manage their own policies
DROP POLICY IF EXISTS insurance_self_select ON insurance_policies;
CREATE POLICY insurance_self_select ON insurance_policies
  FOR SELECT TO authenticated
  USING (
    profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR public.user_role() = 'admin'
  );

DROP POLICY IF EXISTS insurance_self_insert ON insurance_policies;
CREATE POLICY insurance_self_insert ON insurance_policies
  FOR INSERT TO authenticated
  WITH CHECK (
    profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS insurance_self_update ON insurance_policies;
CREATE POLICY insurance_self_update ON insurance_policies
  FOR UPDATE TO authenticated
  USING (profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS insurance_self_delete ON insurance_policies;
CREATE POLICY insurance_self_delete ON insurance_policies
  FOR DELETE TO authenticated
  USING (profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Owners can view tenant insurance linked to their properties
DROP POLICY IF EXISTS insurance_owner_view_tenants ON insurance_policies;
CREATE POLICY insurance_owner_view_tenants ON insurance_policies
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON l.property_id = p.id
      JOIN profiles prof ON p.owner_id = prof.id
      WHERE l.id = insurance_policies.lease_id
        AND prof.user_id = auth.uid()
    )
  );

-- Admin full access
DROP POLICY IF EXISTS insurance_admin_all ON insurance_policies;
CREATE POLICY insurance_admin_all ON insurance_policies
  FOR ALL TO authenticated
  USING (public.user_role() = 'admin')
  WITH CHECK (public.user_role() = 'admin');

-- 9. Trigger updated_at (idempotent)
CREATE OR REPLACE FUNCTION update_insurance_policies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_insurance_updated_at ON insurance_policies;
CREATE TRIGGER trg_insurance_updated_at
  BEFORE UPDATE ON insurance_policies
  FOR EACH ROW
  EXECUTE FUNCTION update_insurance_policies_updated_at();

-- 10. View: assurances expirant bientot
CREATE OR REPLACE VIEW insurance_expiring_soon AS
SELECT
  ip.id,
  ip.profile_id,
  ip.property_id,
  ip.lease_id,
  ip.insurance_type,
  ip.insurer_name,
  ip.policy_number,
  ip.start_date,
  ip.end_date,
  ip.amount_covered_cents,
  ip.document_id,
  ip.is_verified,
  ip.reminder_sent_30j,
  ip.reminder_sent_7j,
  p.first_name,
  p.last_name,
  p.email,
  p.role,
  prop.adresse_complete AS property_address,
  CASE
    WHEN ip.end_date <= CURRENT_DATE THEN 'expired'
    WHEN ip.end_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'critical'
    WHEN ip.end_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'warning'
    ELSE 'ok'
  END AS expiry_status,
  ip.end_date - CURRENT_DATE AS days_until_expiry
FROM insurance_policies ip
JOIN profiles p ON ip.profile_id = p.id
LEFT JOIN properties prop ON ip.property_id = prop.id
WHERE ip.end_date <= CURRENT_DATE + INTERVAL '30 days';

COMMIT;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260408130007', 'insurance_policies')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260408130000_insurance_policies.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260408130000_seasonal_rental_module.sql
-- Note: file on disk is 20260408130000_seasonal_rental_module.sql but will be renamed to 20260408130010_seasonal_rental_module.sql
-- Risk: DANGEREUX
-- Why: UPDATE sans WHERE : on,on
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260408130000_seasonal_rental_module.sql'; END $pre$;

-- ============================================================
-- Migration: Location saisonnière (seasonal rental module)
-- Tables: seasonal_listings, seasonal_rates, reservations, seasonal_blocked_dates
-- ============================================================

-- Vérifier que l'extension btree_gist est disponible pour la contrainte EXCLUDE
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ============================================================
-- 1. seasonal_listings — Annonces saisonnières
-- ============================================================
CREATE TABLE IF NOT EXISTS seasonal_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  min_nights INTEGER DEFAULT 1 CHECK (min_nights >= 1),
  max_nights INTEGER DEFAULT 90 CHECK (max_nights >= 1),
  max_guests INTEGER DEFAULT 4 CHECK (max_guests >= 1),
  check_in_time TEXT DEFAULT '15:00',
  check_out_time TEXT DEFAULT '11:00',
  house_rules TEXT,
  amenities TEXT[] DEFAULT '{}',
  cleaning_fee_cents INTEGER DEFAULT 0 CHECK (cleaning_fee_cents >= 0),
  security_deposit_cents INTEGER DEFAULT 0 CHECK (security_deposit_cents >= 0),
  tourist_tax_per_night_cents INTEGER DEFAULT 0 CHECK (tourist_tax_per_night_cents >= 0),
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE seasonal_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owners_manage_own_listings" ON seasonal_listings;
CREATE POLICY "owners_manage_own_listings" ON seasonal_listings
  FOR ALL USING (owner_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ));

CREATE INDEX idx_seasonal_listings_property ON seasonal_listings(property_id);
CREATE INDEX idx_seasonal_listings_owner ON seasonal_listings(owner_id);
CREATE INDEX idx_seasonal_listings_published ON seasonal_listings(is_published) WHERE is_published = true;

-- ============================================================
-- 2. seasonal_rates — Tarifs par saison
-- ============================================================
CREATE TABLE IF NOT EXISTS seasonal_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES seasonal_listings(id) ON DELETE CASCADE,
  season_name TEXT NOT NULL CHECK (season_name IN ('haute', 'basse', 'moyenne', 'fetes')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  nightly_rate_cents INTEGER NOT NULL CHECK (nightly_rate_cents > 0),
  weekly_rate_cents INTEGER CHECK (weekly_rate_cents > 0),
  monthly_rate_cents INTEGER CHECK (monthly_rate_cents > 0),
  min_nights_override INTEGER CHECK (min_nights_override >= 1),
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_rate_dates CHECK (end_date > start_date)
);

ALTER TABLE seasonal_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owners_manage_rates" ON seasonal_rates;
CREATE POLICY "owners_manage_rates" ON seasonal_rates
  FOR ALL USING (listing_id IN (
    SELECT id FROM seasonal_listings WHERE owner_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  ));

CREATE INDEX idx_seasonal_rates_listing ON seasonal_rates(listing_id);
CREATE INDEX idx_seasonal_rates_dates ON seasonal_rates(start_date, end_date);

-- ============================================================
-- 3. reservations — Réservations saisonnières
-- ============================================================
CREATE TABLE IF NOT EXISTS reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES seasonal_listings(id) ON DELETE RESTRICT,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
  guest_name TEXT NOT NULL,
  guest_email TEXT NOT NULL,
  guest_phone TEXT,
  guest_count INTEGER DEFAULT 1 CHECK (guest_count >= 1),
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  nights INTEGER NOT NULL CHECK (nights >= 1),
  nightly_rate_cents INTEGER NOT NULL CHECK (nightly_rate_cents > 0),
  subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents >= 0),
  cleaning_fee_cents INTEGER DEFAULT 0 CHECK (cleaning_fee_cents >= 0),
  tourist_tax_cents INTEGER DEFAULT 0 CHECK (tourist_tax_cents >= 0),
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  deposit_cents INTEGER DEFAULT 0 CHECK (deposit_cents >= 0),
  source TEXT DEFAULT 'direct' CHECK (source IN ('direct','airbnb','booking','other')),
  external_id TEXT,
  status TEXT DEFAULT 'confirmed' CHECK (status IN (
    'pending','confirmed','checked_in','checked_out','cancelled','no_show'
  )),
  check_in_at TIMESTAMPTZ,
  check_out_at TIMESTAMPTZ,
  cleaning_status TEXT DEFAULT 'pending' CHECK (cleaning_status IN ('pending','scheduled','done')),
  cleaning_provider_id UUID REFERENCES providers(id),
  notes TEXT,
  stripe_payment_intent_id TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_reservation_dates CHECK (check_out > check_in),
  CONSTRAINT no_overlap EXCLUDE USING gist (
    listing_id WITH =,
    daterange(check_in, check_out) WITH &&
  ) WHERE (status NOT IN ('cancelled','no_show'))
);

ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owners_manage_reservations" ON reservations;
CREATE POLICY "owners_manage_reservations" ON reservations
  FOR ALL USING (listing_id IN (
    SELECT id FROM seasonal_listings WHERE owner_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  ));

CREATE INDEX idx_reservations_listing ON reservations(listing_id);
CREATE INDEX idx_reservations_property ON reservations(property_id);
CREATE INDEX idx_reservations_dates ON reservations(check_in, check_out);
CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_reservations_source ON reservations(source);
CREATE INDEX idx_reservations_cleaning ON reservations(cleaning_status) WHERE cleaning_status != 'done';

-- ============================================================
-- 4. seasonal_blocked_dates — Dates bloquées
-- ============================================================
CREATE TABLE IF NOT EXISTS seasonal_blocked_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES seasonal_listings(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT DEFAULT 'owner_block',
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_blocked_dates CHECK (end_date >= start_date)
);

ALTER TABLE seasonal_blocked_dates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owners_manage_blocked" ON seasonal_blocked_dates;
CREATE POLICY "owners_manage_blocked" ON seasonal_blocked_dates
  FOR ALL USING (listing_id IN (
    SELECT id FROM seasonal_listings WHERE owner_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  ));

CREATE INDEX idx_blocked_dates_listing ON seasonal_blocked_dates(listing_id);
CREATE INDEX idx_blocked_dates_range ON seasonal_blocked_dates(start_date, end_date);

-- ============================================================
-- 5. Triggers updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_seasonal_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_seasonal_listings_updated_at
  BEFORE UPDATE ON seasonal_listings
  FOR EACH ROW EXECUTE FUNCTION update_seasonal_updated_at();

CREATE TRIGGER trg_reservations_updated_at
  BEFORE UPDATE ON reservations
  FOR EACH ROW EXECUTE FUNCTION update_seasonal_updated_at();

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260408130010', 'seasonal_rental_module')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260408130000_seasonal_rental_module.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260408130000_security_deposits.sql
-- Note: file on disk is 20260408130000_security_deposits.sql but will be renamed to 20260408130011_security_deposits.sql
-- Risk: DANGEREUX
-- Why: UPDATE sans WHERE : on,on
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260408130000_security_deposits.sql'; END $pre$;

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

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260408130011', 'security_deposits')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260408130000_security_deposits.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260408140000_tickets_module_sota.sql
-- Risk: DANGEREUX
-- Why: UPDATE sans WHERE : on
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260408140000_tickets_module_sota.sql'; END $pre$;

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

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260408140000', 'tickets_module_sota')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260408140000_tickets_module_sota.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260408200000_unified_notification_system.sql
-- Risk: DANGEREUX
-- Why: UPDATE sans WHERE : on
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260408200000_unified_notification_system.sql'; END $pre$;

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
CREATE POLICY "Users can view own event preferences"
  ON notification_event_preferences FOR SELECT
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can manage own event preferences" ON notification_event_preferences;
CREATE POLICY "Users can manage own event preferences"
  ON notification_event_preferences FOR ALL
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
  WITH CHECK (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Allow service role to insert
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

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260408200000', 'unified_notification_system')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260408200000_unified_notification_system.sql'; END $post$;

COMMIT;

-- END OF BATCH 8/11 (Phase 3 DANGEREUX)

-- Batch 8 — migrations 161 a 169 sur 169
-- 9 migrations

-- === [161/169] 20260408130000_insurance_policies.sql ===
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
CREATE POLICY insurance_self_select ON insurance_policies
  FOR SELECT TO authenticated
  USING (
    profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR public.user_role() = 'admin'
  );

CREATE POLICY insurance_self_insert ON insurance_policies
  FOR INSERT TO authenticated
  WITH CHECK (
    profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY insurance_self_update ON insurance_policies
  FOR UPDATE TO authenticated
  USING (profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY insurance_self_delete ON insurance_policies
  FOR DELETE TO authenticated
  USING (profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Owners can view tenant insurance linked to their properties
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


-- === [162/169] 20260408130000_lease_amendments_table.sql ===
-- ============================================================================
-- Lease Amendments (Avenants) — Table + RLS
--
-- Stores lease amendments (avenants) for active leases. Amendments track
-- rent revisions, roommate changes, charges adjustments, and other
-- contractual modifications. Each amendment references its parent lease
-- and optionally a signed document in the GED.
-- ============================================================================

-- 1. Create the lease_amendments table
CREATE TABLE IF NOT EXISTS lease_amendments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  amendment_type TEXT NOT NULL CHECK (amendment_type IN (
    'loyer_revision',
    'ajout_colocataire',
    'retrait_colocataire',
    'changement_charges',
    'travaux',
    'autre'
  )),
  description TEXT NOT NULL,
  effective_date DATE NOT NULL,
  old_values JSONB DEFAULT '{}'::jsonb,
  new_values JSONB DEFAULT '{}'::jsonb,
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  signed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE lease_amendments ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies

-- Owner can view amendments for their leases
CREATE POLICY "owner_select_amendments"
  ON lease_amendments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON p.id = l.property_id
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE l.id = lease_amendments.lease_id
        AND pr.user_id = auth.uid()
    )
  );

-- Tenant can view amendments for leases they signed
CREATE POLICY "tenant_select_amendments"
  ON lease_amendments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM lease_signers ls
      JOIN profiles pr ON pr.id = ls.profile_id
      WHERE ls.lease_id = lease_amendments.lease_id
        AND pr.user_id = auth.uid()
    )
  );

-- Owner can create amendments for their leases
CREATE POLICY "owner_insert_amendments"
  ON lease_amendments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON p.id = l.property_id
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE l.id = lease_amendments.lease_id
        AND pr.user_id = auth.uid()
    )
  );

-- Owner can update amendments for their leases (only unsigned ones)
CREATE POLICY "owner_update_amendments"
  ON lease_amendments
  FOR UPDATE
  USING (
    signed_at IS NULL
    AND EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON p.id = l.property_id
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE l.id = lease_amendments.lease_id
        AND pr.user_id = auth.uid()
    )
  );

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_lease_amendments_lease_id
  ON lease_amendments (lease_id);

CREATE INDEX IF NOT EXISTS idx_lease_amendments_type
  ON lease_amendments (amendment_type);

CREATE INDEX IF NOT EXISTS idx_lease_amendments_effective_date
  ON lease_amendments (effective_date);

-- 5. Auto-update updated_at
CREATE OR REPLACE FUNCTION update_lease_amendments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_lease_amendments_updated_at
  BEFORE UPDATE ON lease_amendments
  FOR EACH ROW
  EXECUTE FUNCTION update_lease_amendments_updated_at();

-- 6. Comments
COMMENT ON TABLE lease_amendments IS 'Avenants au bail — modifications contractuelles';
COMMENT ON COLUMN lease_amendments.amendment_type IS 'Type: loyer_revision, ajout/retrait_colocataire, changement_charges, travaux, autre';
COMMENT ON COLUMN lease_amendments.old_values IS 'Valeurs avant modification (JSONB)';
COMMENT ON COLUMN lease_amendments.new_values IS 'Valeurs après modification (JSONB)';
COMMENT ON COLUMN lease_amendments.signed_at IS 'Date de signature de l''avenant par toutes les parties';


-- === [163/169] 20260408130000_rgpd_consent_records_and_data_requests.sql ===
-- Migration RGPD : consent_records (historique granulaire) + data_requests (demandes export/suppression)
-- Complète la table user_consents existante avec un historique versionné

-- ============================================
-- 1. consent_records : historique granulaire des consentements
-- ============================================
CREATE TABLE IF NOT EXISTS consent_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL CHECK (consent_type IN (
    'cgu', 'privacy_policy', 'marketing', 'analytics',
    'cookies_functional', 'cookies_analytics'
  )),
  granted BOOLEAN NOT NULL,
  granted_at TIMESTAMPTZ DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  ip_address INET,
  user_agent TEXT,
  version TEXT NOT NULL
);

ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own consent records"
  ON consent_records FOR SELECT
  USING (profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can insert own consent records"
  ON consent_records FOR INSERT
  WITH CHECK (profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ));

CREATE INDEX idx_consent_records_profile_id ON consent_records(profile_id);
CREATE INDEX idx_consent_records_type ON consent_records(consent_type);

-- ============================================
-- 2. data_requests : demandes RGPD (export, suppression, rectification)
-- ============================================
CREATE TABLE IF NOT EXISTS data_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL CHECK (request_type IN ('export', 'deletion', 'rectification')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
  reason TEXT,
  completed_at TIMESTAMPTZ,
  download_url TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE data_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own data requests"
  ON data_requests FOR SELECT
  USING (profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can insert own data requests"
  ON data_requests FOR INSERT
  WITH CHECK (profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can update own pending data requests"
  ON data_requests FOR UPDATE
  USING (
    profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND status = 'pending'
  );

CREATE INDEX idx_data_requests_profile_id ON data_requests(profile_id);
CREATE INDEX idx_data_requests_status ON data_requests(status);


-- === [164/169] 20260408130000_seasonal_rental_module.sql ===
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
CREATE POLICY "Tenant views own security_deposit" ON security_deposits
  FOR SELECT
  USING (
    tenant_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Politique: Admin peut tout gérer
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

CREATE POLICY "ticket_comments_select_creator"
  ON ticket_comments FOR SELECT
  USING (
    NOT is_internal AND EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_comments.ticket_id
        AND t.created_by_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "ticket_comments_select_assigned"
  ON ticket_comments FOR SELECT
  USING (
    NOT is_internal AND EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_comments.ticket_id
        AND t.assigned_to = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "ticket_comments_insert"
  ON ticket_comments FOR INSERT
  WITH CHECK (
    author_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

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
CREATE POLICY "Tenant can view own rent_payments" ON rent_payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.id = rent_payments.invoice_id
        AND i.tenant_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- Admin full access
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
CREATE POLICY "Tenant can view own security_deposits" ON security_deposits
  FOR SELECT USING (
    tenant_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Admin full access
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

CREATE POLICY "tenants_admin_only"
  ON tenants FOR ALL
  USING (false);
-- Service role bypasses RLS; app code uses service client for admin ops

-- ──────────────────────────────────────────────
-- 2. two_factor_sessions (security-critical, has user_id)
-- ──────────────────────────────────────────────
ALTER TABLE two_factor_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_2fa_sessions"
  ON two_factor_sessions FOR ALL
  USING (auth.uid() = user_id);

-- ──────────────────────────────────────────────
-- 3. lease_templates (system-wide templates, read-only for users)
-- ──────────────────────────────────────────────
ALTER TABLE lease_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lease_templates_read_authenticated"
  ON lease_templates FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "lease_templates_write_admin_only"
  ON lease_templates FOR ALL
  USING (false);
-- Admin writes via service role

-- ──────────────────────────────────────────────
-- 4. idempotency_keys (API utility, no user column)
-- ──────────────────────────────────────────────
ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "idempotency_keys_service_only"
  ON idempotency_keys FOR ALL
  USING (false);
-- Only accessed via service role in API middleware

-- ──────────────────────────────────────────────
-- 5. repair_cost_grid (reference table, read-only)
-- ──────────────────────────────────────────────
ALTER TABLE repair_cost_grid ENABLE ROW LEVEL SECURITY;

CREATE POLICY "repair_cost_grid_read_authenticated"
  ON repair_cost_grid FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "repair_cost_grid_write_admin_only"
  ON repair_cost_grid FOR ALL
  USING (false);
-- Admin writes via service role

-- ──────────────────────────────────────────────
-- 6. vetuste_grid (reference table for depreciation, read-only)
-- ──────────────────────────────────────────────
ALTER TABLE vetuste_grid ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vetuste_grid_read_authenticated"
  ON vetuste_grid FOR SELECT
  USING (auth.role() = 'authenticated');

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

CREATE POLICY "webhook_deliveries_write_service_only"
  ON api_webhook_deliveries FOR INSERT
  USING (false);
-- Deliveries are created by the system (service role), users can only read their own



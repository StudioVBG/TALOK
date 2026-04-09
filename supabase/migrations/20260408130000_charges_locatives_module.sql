-- =====================================================
-- CHARGES LOCATIVES MODULE
-- Tables: charge_categories, charge_entries, charge_regularizations_v2
-- Décret 87-713 : 6 catégories de charges récupérables
-- =====================================================

-- 1. CHARGE_CATEGORIES
-- Catégories de charges par bien (décret 87-713)
CREATE TABLE IF NOT EXISTS charge_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN (
    'ascenseurs',
    'eau_chauffage',
    'installations_individuelles',
    'parties_communes',
    'espaces_exterieurs',
    'taxes_redevances'
  )),
  label TEXT NOT NULL,
  is_recoverable BOOLEAN NOT NULL DEFAULT true,
  annual_budget_cents INTEGER NOT NULL DEFAULT 0 CHECK (annual_budget_cents >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_charge_categories_property ON charge_categories(property_id);
CREATE INDEX idx_charge_categories_category ON charge_categories(category);

ALTER TABLE charge_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "charge_categories_owner_access" ON charge_categories
  FOR ALL TO authenticated
  USING (
    property_id IN (
      SELECT p.id FROM properties p
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE pr.user_id = auth.uid()
    )
  )
  WITH CHECK (
    property_id IN (
      SELECT p.id FROM properties p
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE pr.user_id = auth.uid()
    )
  );

-- Tenants can read categories for their leased properties
CREATE POLICY "charge_categories_tenant_read" ON charge_categories
  FOR SELECT TO authenticated
  USING (
    property_id IN (
      SELECT l.property_id FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      JOIN profiles pr ON pr.id = ls.profile_id
      WHERE pr.user_id = auth.uid()
        AND l.statut IN ('active', 'terminated')
        AND ls.role IN ('locataire_principal', 'colocataire')
    )
  );

-- 2. CHARGE_ENTRIES
-- Individual charge entries (actual expenses)
CREATE TABLE IF NOT EXISTS charge_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES charge_categories(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  date DATE NOT NULL,
  is_recoverable BOOLEAN NOT NULL DEFAULT true,
  justificatif_document_id UUID,
  accounting_entry_id UUID,
  fiscal_year INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_charge_entries_property ON charge_entries(property_id);
CREATE INDEX idx_charge_entries_category ON charge_entries(category_id);
CREATE INDEX idx_charge_entries_fiscal_year ON charge_entries(fiscal_year);
CREATE INDEX idx_charge_entries_date ON charge_entries(date);

ALTER TABLE charge_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "charge_entries_owner_access" ON charge_entries
  FOR ALL TO authenticated
  USING (
    property_id IN (
      SELECT p.id FROM properties p
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE pr.user_id = auth.uid()
    )
  )
  WITH CHECK (
    property_id IN (
      SELECT p.id FROM properties p
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE pr.user_id = auth.uid()
    )
  );

-- Tenants can read recoverable entries for their leased properties
CREATE POLICY "charge_entries_tenant_read" ON charge_entries
  FOR SELECT TO authenticated
  USING (
    is_recoverable = true
    AND property_id IN (
      SELECT l.property_id FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      JOIN profiles pr ON pr.id = ls.profile_id
      WHERE pr.user_id = auth.uid()
        AND l.statut IN ('active', 'terminated')
        AND ls.role IN ('locataire_principal', 'colocataire')
    )
  );

-- 3. LEASE_CHARGE_REGULARIZATIONS
-- Annual regularization per lease (replaces basic charge_reconciliations)
CREATE TABLE IF NOT EXISTS lease_charge_regularizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  fiscal_year INTEGER NOT NULL,
  total_provisions_cents INTEGER NOT NULL DEFAULT 0,
  total_actual_cents INTEGER NOT NULL DEFAULT 0,
  balance_cents INTEGER GENERATED ALWAYS AS (
    total_actual_cents - total_provisions_cents
  ) STORED, -- positive = tenant owes, negative = overpaid
  detail_per_category JSONB NOT NULL DEFAULT '[]'::jsonb,
  document_id UUID, -- PDF du décompte
  sent_at TIMESTAMPTZ,
  contested BOOLEAN NOT NULL DEFAULT false,
  contest_reason TEXT,
  contest_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'calculated', 'sent', 'acknowledged', 'contested', 'settled'
  )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(lease_id, fiscal_year)
);

CREATE INDEX idx_lease_charge_reg_lease ON lease_charge_regularizations(lease_id);
CREATE INDEX idx_lease_charge_reg_property ON lease_charge_regularizations(property_id);
CREATE INDEX idx_lease_charge_reg_year ON lease_charge_regularizations(fiscal_year);
CREATE INDEX idx_lease_charge_reg_status ON lease_charge_regularizations(status);

ALTER TABLE lease_charge_regularizations ENABLE ROW LEVEL SECURITY;

-- Owner full access
CREATE POLICY "lease_charge_reg_owner_access" ON lease_charge_regularizations
  FOR ALL TO authenticated
  USING (
    property_id IN (
      SELECT p.id FROM properties p
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE pr.user_id = auth.uid()
    )
  )
  WITH CHECK (
    property_id IN (
      SELECT p.id FROM properties p
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE pr.user_id = auth.uid()
    )
  );

-- Tenant can read and update (for contestation) their own regularizations
CREATE POLICY "lease_charge_reg_tenant_read" ON lease_charge_regularizations
  FOR SELECT TO authenticated
  USING (
    lease_id IN (
      SELECT l.id FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      JOIN profiles pr ON pr.id = ls.profile_id
      WHERE pr.user_id = auth.uid()
        AND ls.role IN ('locataire_principal', 'colocataire')
    )
  );

CREATE POLICY "lease_charge_reg_tenant_contest" ON lease_charge_regularizations
  FOR UPDATE TO authenticated
  USING (
    lease_id IN (
      SELECT l.id FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      JOIN profiles pr ON pr.id = ls.profile_id
      WHERE pr.user_id = auth.uid()
        AND ls.role IN ('locataire_principal', 'colocataire')
    )
  )
  WITH CHECK (
    -- Tenant can only update contestation fields
    status = 'sent'
  );

-- 4. TRIGGER: auto-update updated_at
CREATE OR REPLACE FUNCTION update_charges_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_charge_categories_updated
  BEFORE UPDATE ON charge_categories
  FOR EACH ROW EXECUTE FUNCTION update_charges_updated_at();

CREATE TRIGGER trg_charge_entries_updated
  BEFORE UPDATE ON charge_entries
  FOR EACH ROW EXECUTE FUNCTION update_charges_updated_at();

CREATE TRIGGER trg_lease_charge_reg_updated
  BEFORE UPDATE ON lease_charge_regularizations
  FOR EACH ROW EXECUTE FUNCTION update_charges_updated_at();

-- ============================================
-- Migration: Property Meters, Diagnostics & Equipment Tables
-- Date: 2026-02-14
-- Description: Creates dedicated tables for property meters (compteurs),
--   diagnostics, and equipment. Adds new columns to properties for
--   tax regime, construction year, rent control, and DOM-TOM support.
-- ============================================

-- ============================================
-- 1. NEW COLUMNS ON PROPERTIES TABLE
-- ============================================

-- Tax regime
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS tax_regime TEXT CHECK (tax_regime IN (
    'micro_foncier', 'reel', 'micro_bic', 'lmnp', 'lmp', 'sci_ir', 'sci_is'
  ));

-- Construction year
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS construction_year INTEGER CHECK (
    construction_year IS NULL OR (construction_year >= 1600 AND construction_year <= EXTRACT(YEAR FROM NOW()) + 5)
  );

-- Furnished distinction (ALUR)
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS is_furnished BOOLEAN NOT NULL DEFAULT false;

-- Total floors in the building
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS total_floors INTEGER CHECK (total_floors IS NULL OR total_floors >= 0);

-- Number of bathrooms
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS nb_bathrooms INTEGER CHECK (nb_bathrooms IS NULL OR nb_bathrooms >= 0);

-- Heating type for hot water
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS hot_water_type TEXT CHECK (hot_water_type IN (
    'electrique_indiv', 'gaz_indiv', 'collectif', 'solaire', 'thermodynamique', 'autre'
  ));

-- Property name/label
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS label TEXT;

-- Property description
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS description TEXT;

-- Rent control fields
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS is_rent_controlled BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS rent_control_zone TEXT;

-- DOM-TOM territory flag
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS is_dom_tom BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS dom_tom_territory TEXT CHECK (dom_tom_territory IN (
    'guadeloupe', 'martinique', 'guyane', 'reunion', 'mayotte',
    'saint_martin', 'saint_barthelemy', 'saint_pierre_miquelon',
    'wallis_futuna', 'polynesie_francaise', 'nouvelle_caledonie'
  ));

-- Charges type (provision vs forfait)
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS charges_type TEXT CHECK (charges_type IN ('provision', 'forfait')) DEFAULT 'provision';

-- Metadata JSONB for future extensions
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- ============================================
-- 2. PROPERTY METERS TABLE (Compteurs)
-- ============================================

CREATE TABLE IF NOT EXISTS property_meters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  meter_type TEXT NOT NULL CHECK (meter_type IN (
    'electricity', 'gas', 'water', 'hot_water', 'heating'
  )),
  meter_number TEXT,
  location TEXT,
  is_individual BOOLEAN NOT NULL DEFAULT true,
  provider TEXT,
  last_reading_value NUMERIC(12, 2),
  last_reading_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_property_meters_property_id ON property_meters(property_id);
CREATE INDEX IF NOT EXISTS idx_property_meters_type ON property_meters(meter_type);

-- Updated_at trigger
CREATE TRIGGER update_property_meters_updated_at
  BEFORE UPDATE ON property_meters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 3. PROPERTY DIAGNOSTICS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS property_diagnostics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  diagnostic_type TEXT NOT NULL CHECK (diagnostic_type IN (
    'dpe', 'amiante', 'plomb', 'termites', 'electricite', 'gaz',
    'erp', 'bruit', 'assainissement', 'merule', 'radon',
    'surface_carrez', 'risques_naturels'
  )),
  date_performed DATE,
  expiry_date DATE,
  result JSONB DEFAULT '{}'::jsonb,
  document_url TEXT,
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  provider_name TEXT,
  provider_certification TEXT,
  is_valid BOOLEAN GENERATED ALWAYS AS (
    CASE
      WHEN expiry_date IS NULL THEN true
      WHEN expiry_date >= CURRENT_DATE THEN true
      ELSE false
    END
  ) STORED,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_property_diagnostics_property_id ON property_diagnostics(property_id);
CREATE INDEX IF NOT EXISTS idx_property_diagnostics_type ON property_diagnostics(diagnostic_type);
CREATE INDEX IF NOT EXISTS idx_property_diagnostics_expiry ON property_diagnostics(expiry_date) WHERE expiry_date IS NOT NULL;

-- Unique constraint: one active diagnostic per type per property
CREATE UNIQUE INDEX IF NOT EXISTS idx_property_diagnostics_unique_active
  ON property_diagnostics(property_id, diagnostic_type)
  WHERE expiry_date IS NULL OR expiry_date >= CURRENT_DATE;

-- Updated_at trigger
CREATE TRIGGER update_property_diagnostics_updated_at
  BEFORE UPDATE ON property_diagnostics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 4. PROPERTY EQUIPMENT TABLE
-- ============================================
-- Replaces the TEXT[] array for detailed equipment tracking

CREATE TABLE IF NOT EXISTS property_equipment (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN (
    'kitchen', 'bathroom', 'heating', 'security', 'outdoor',
    'furniture', 'appliance', 'connectivity', 'accessibility',
    'storage', 'laundry', 'comfort', 'other'
  )),
  name TEXT NOT NULL,
  brand TEXT,
  model TEXT,
  serial_number TEXT,
  condition TEXT CHECK (condition IN (
    'new', 'good', 'fair', 'poor', 'broken'
  )) DEFAULT 'good',
  installation_date DATE,
  warranty_end DATE,
  is_included_in_lease BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_property_equipment_property_id ON property_equipment(property_id);
CREATE INDEX IF NOT EXISTS idx_property_equipment_category ON property_equipment(category);

-- Updated_at trigger
CREATE TRIGGER update_property_equipment_updated_at
  BEFORE UPDATE ON property_equipment
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 5. RLS POLICIES
-- ============================================

-- Property Meters
ALTER TABLE property_meters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_select_property_meters"
  ON property_meters FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = property_meters.property_id
      AND p.owner_id = public.get_my_profile_id()
    )
  );

CREATE POLICY "owner_insert_property_meters"
  ON property_meters FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = property_meters.property_id
      AND p.owner_id = public.get_my_profile_id()
    )
  );

CREATE POLICY "owner_update_property_meters"
  ON property_meters FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = property_meters.property_id
      AND p.owner_id = public.get_my_profile_id()
    )
  );

CREATE POLICY "owner_delete_property_meters"
  ON property_meters FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = property_meters.property_id
      AND p.owner_id = public.get_my_profile_id()
    )
  );

CREATE POLICY "tenant_select_property_meters"
  ON property_meters FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM properties p
      JOIN leases l ON l.property_id = p.id
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE p.id = property_meters.property_id
      AND ls.profile_id = public.get_my_profile_id()
      AND l.statut = 'active'
    )
  );

CREATE POLICY "admin_all_property_meters"
  ON property_meters FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Property Diagnostics
ALTER TABLE property_diagnostics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_select_property_diagnostics"
  ON property_diagnostics FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = property_diagnostics.property_id
      AND p.owner_id = public.get_my_profile_id()
    )
  );

CREATE POLICY "owner_insert_property_diagnostics"
  ON property_diagnostics FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = property_diagnostics.property_id
      AND p.owner_id = public.get_my_profile_id()
    )
  );

CREATE POLICY "owner_update_property_diagnostics"
  ON property_diagnostics FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = property_diagnostics.property_id
      AND p.owner_id = public.get_my_profile_id()
    )
  );

CREATE POLICY "owner_delete_property_diagnostics"
  ON property_diagnostics FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = property_diagnostics.property_id
      AND p.owner_id = public.get_my_profile_id()
    )
  );

CREATE POLICY "tenant_select_property_diagnostics"
  ON property_diagnostics FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM properties p
      JOIN leases l ON l.property_id = p.id
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE p.id = property_diagnostics.property_id
      AND ls.profile_id = public.get_my_profile_id()
      AND l.statut = 'active'
    )
  );

CREATE POLICY "admin_all_property_diagnostics"
  ON property_diagnostics FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Property Equipment
ALTER TABLE property_equipment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_select_property_equipment"
  ON property_equipment FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = property_equipment.property_id
      AND p.owner_id = public.get_my_profile_id()
    )
  );

CREATE POLICY "owner_insert_property_equipment"
  ON property_equipment FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = property_equipment.property_id
      AND p.owner_id = public.get_my_profile_id()
    )
  );

CREATE POLICY "owner_update_property_equipment"
  ON property_equipment FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = property_equipment.property_id
      AND p.owner_id = public.get_my_profile_id()
    )
  );

CREATE POLICY "owner_delete_property_equipment"
  ON property_equipment FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = property_equipment.property_id
      AND p.owner_id = public.get_my_profile_id()
    )
  );

CREATE POLICY "tenant_select_property_equipment"
  ON property_equipment FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM properties p
      JOIN leases l ON l.property_id = p.id
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE p.id = property_equipment.property_id
      AND ls.profile_id = public.get_my_profile_id()
      AND l.statut = 'active'
    )
  );

CREATE POLICY "admin_all_property_equipment"
  ON property_equipment FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================
-- 6. HELPER FUNCTION: Get required diagnostics for property
-- ============================================

CREATE OR REPLACE FUNCTION get_required_diagnostics(
  p_property_type TEXT,
  p_is_dom_tom BOOLEAN DEFAULT false,
  p_construction_year INTEGER DEFAULT NULL,
  p_is_furnished BOOLEAN DEFAULT false
)
RETURNS TEXT[] AS $$
DECLARE
  required TEXT[];
BEGIN
  required := ARRAY['dpe', 'erp'];

  -- Habitation types always require these
  IF p_property_type IN ('appartement', 'maison', 'studio', 'colocation', 'villa', 'chambre', 'saisonnier') THEN
    required := required || ARRAY['electricite'];

    -- Plomb required if built before 1949
    IF p_construction_year IS NOT NULL AND p_construction_year < 1949 THEN
      required := required || ARRAY['plomb'];
    END IF;

    -- Amiante required if built before 1997
    IF p_construction_year IS NOT NULL AND p_construction_year < 1997 THEN
      required := required || ARRAY['amiante'];
    END IF;

    -- Gas diagnostic if gas heating/hot water
    -- (checked at application level)
  END IF;

  -- DOM-TOM: Termites ALWAYS required
  IF p_is_dom_tom THEN
    required := required || ARRAY['termites'];
  END IF;

  -- DOM-TOM: Risques naturels (cyclone, seismic, volcanic)
  IF p_is_dom_tom THEN
    required := required || ARRAY['risques_naturels'];
  END IF;

  -- Noise diagnostic for areas near airports (checked at application level)
  -- Surface Carrez for co-ownership (checked at application level)

  RETURN required;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- 7. AUTO-DETECT DOM-TOM FROM POSTAL CODE
-- ============================================

CREATE OR REPLACE FUNCTION detect_dom_tom_from_postal_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.code_postal IS NOT NULL AND NEW.code_postal ~ '^97[1-6]' THEN
    NEW.is_dom_tom := true;
    NEW.dom_tom_territory := CASE
      WHEN NEW.code_postal ~ '^971' THEN 'guadeloupe'
      WHEN NEW.code_postal ~ '^972' THEN 'martinique'
      WHEN NEW.code_postal ~ '^973' THEN 'guyane'
      WHEN NEW.code_postal ~ '^974' THEN 'reunion'
      WHEN NEW.code_postal ~ '^976' THEN 'mayotte'
      ELSE NULL
    END;
  ELSE
    NEW.is_dom_tom := false;
    NEW.dom_tom_territory := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_detect_dom_tom
  BEFORE INSERT OR UPDATE OF code_postal ON properties
  FOR EACH ROW EXECUTE FUNCTION detect_dom_tom_from_postal_code();

-- ============================================
-- 8. INDEXES ON EXISTING PROPERTIES TABLE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(etat) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_properties_is_dom_tom ON properties(is_dom_tom) WHERE is_dom_tom = true;
CREATE INDEX IF NOT EXISTS idx_properties_tax_regime ON properties(tax_regime) WHERE tax_regime IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_properties_is_rent_controlled ON properties(is_rent_controlled) WHERE is_rent_controlled = true;

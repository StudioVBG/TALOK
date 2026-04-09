-- =============================================================================
-- Migration: property_diagnostics + rent_control_zones
-- Diagnostics immobiliers obligatoires (DDT) et encadrement des loyers
-- =============================================================================

-- 1. Table property_diagnostics
CREATE TABLE IF NOT EXISTS property_diagnostics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  diagnostic_type TEXT NOT NULL CHECK (diagnostic_type IN (
    'dpe','amiante','plomb','gaz','electricite','termites','erp','surface_boutin','bruit'
  )),
  performed_date DATE NOT NULL,
  expiry_date DATE,
  result TEXT,
  diagnostiqueur_name TEXT,
  diagnostiqueur_certification TEXT,
  document_id UUID REFERENCES documents(id),
  is_valid BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(property_id, diagnostic_type)
);

-- RLS
ALTER TABLE property_diagnostics ENABLE ROW LEVEL SECURITY;

-- Owners can manage diagnostics on their properties
CREATE POLICY "property_diagnostics_owner_select"
  ON property_diagnostics FOR SELECT
  USING (
    property_id IN (
      SELECT id FROM properties WHERE owner_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "property_diagnostics_owner_insert"
  ON property_diagnostics FOR INSERT
  WITH CHECK (
    property_id IN (
      SELECT id FROM properties WHERE owner_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "property_diagnostics_owner_update"
  ON property_diagnostics FOR UPDATE
  USING (
    property_id IN (
      SELECT id FROM properties WHERE owner_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "property_diagnostics_owner_delete"
  ON property_diagnostics FOR DELETE
  USING (
    property_id IN (
      SELECT id FROM properties WHERE owner_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

-- Tenants can view diagnostics for their leased properties
CREATE POLICY "property_diagnostics_tenant_select"
  ON property_diagnostics FOR SELECT
  USING (
    property_id IN (
      SELECT l.property_id FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      JOIN profiles p ON p.id = ls.profile_id
      WHERE p.user_id = auth.uid()
        AND l.statut = 'active'
    )
  );

-- Indexes
CREATE INDEX idx_property_diagnostics_property ON property_diagnostics(property_id);
CREATE INDEX idx_property_diagnostics_type ON property_diagnostics(diagnostic_type);
CREATE INDEX idx_property_diagnostics_expiry ON property_diagnostics(expiry_date) WHERE expiry_date IS NOT NULL;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_property_diagnostics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_property_diagnostics_updated_at
  BEFORE UPDATE ON property_diagnostics
  FOR EACH ROW EXECUTE FUNCTION update_property_diagnostics_updated_at();

-- 2. Table rent_control_zones (reference data)
CREATE TABLE IF NOT EXISTS rent_control_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city TEXT NOT NULL,
  zone TEXT NOT NULL,
  type_logement TEXT NOT NULL,
  nb_pieces INTEGER,
  loyer_reference NUMERIC(6,2),
  loyer_majore NUMERIC(6,2),
  loyer_minore NUMERIC(6,2),
  year INTEGER NOT NULL,
  quarter INTEGER,
  source_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: read-only for all authenticated users
ALTER TABLE rent_control_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rent_control_zones_read"
  ON rent_control_zones FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Index for fast lookups
CREATE INDEX idx_rent_control_city_year ON rent_control_zones(city, year);
CREATE INDEX idx_rent_control_type ON rent_control_zones(type_logement, nb_pieces);

-- 3. Seed initial rent control reference data (Paris 2026 Q1 examples)
INSERT INTO rent_control_zones (city, zone, type_logement, nb_pieces, loyer_reference, loyer_majore, loyer_minore, year, quarter) VALUES
  ('Paris', '1', 'nu_ancien', 1, 28.30, 33.96, 19.81, 2026, 1),
  ('Paris', '1', 'nu_ancien', 2, 25.50, 30.60, 17.85, 2026, 1),
  ('Paris', '1', 'nu_ancien', 3, 23.10, 27.72, 16.17, 2026, 1),
  ('Paris', '1', 'meuble_ancien', 1, 33.10, 39.72, 23.17, 2026, 1),
  ('Paris', '1', 'meuble_ancien', 2, 29.80, 35.76, 20.86, 2026, 1),
  ('Paris', '1', 'meuble_ancien', 3, 27.40, 32.88, 19.18, 2026, 1),
  ('Paris', '2', 'nu_ancien', 1, 26.80, 32.16, 18.76, 2026, 1),
  ('Paris', '2', 'nu_ancien', 2, 24.20, 29.04, 16.94, 2026, 1),
  ('Paris', '2', 'meuble_ancien', 1, 31.50, 37.80, 22.05, 2026, 1),
  ('Paris', '2', 'meuble_ancien', 2, 28.30, 33.96, 19.81, 2026, 1),
  ('Lyon', '1', 'nu_ancien', 1, 14.50, 17.40, 10.15, 2026, 1),
  ('Lyon', '1', 'nu_ancien', 2, 12.80, 15.36, 8.96, 2026, 1),
  ('Lyon', '1', 'meuble_ancien', 1, 17.20, 20.64, 12.04, 2026, 1),
  ('Lille', '1', 'nu_ancien', 1, 13.80, 16.56, 9.66, 2026, 1),
  ('Lille', '1', 'nu_ancien', 2, 12.10, 14.52, 8.47, 2026, 1),
  ('Lille', '1', 'meuble_ancien', 1, 16.50, 19.80, 11.55, 2026, 1),
  ('Bordeaux', '1', 'nu_ancien', 1, 14.00, 16.80, 9.80, 2026, 1),
  ('Bordeaux', '1', 'meuble_ancien', 1, 16.80, 20.16, 11.76, 2026, 1),
  ('Montpellier', '1', 'nu_ancien', 1, 13.20, 15.84, 9.24, 2026, 1),
  ('Montpellier', '1', 'meuble_ancien', 1, 15.80, 18.96, 11.06, 2026, 1)
ON CONFLICT DO NOTHING;

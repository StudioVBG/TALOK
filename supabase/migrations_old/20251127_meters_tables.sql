-- Migration: Tables pour les compteurs et relevés
-- Permet aux locataires de saisir leurs relevés de compteurs

BEGIN;

-- Table des compteurs (associés à un logement)
CREATE TABLE IF NOT EXISTS meters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('electricity', 'water', 'gas', 'heating')),
  serial_number TEXT NOT NULL,
  location TEXT, -- ex: "Cuisine", "Entrée", "Cellier"
  unit TEXT NOT NULL DEFAULT 'kWh', -- kWh, m³, etc.
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Index pour les recherches par propriété
CREATE INDEX IF NOT EXISTS idx_meters_property_id ON meters(property_id);

-- Table des relevés de compteurs
CREATE TABLE IF NOT EXISTS meter_readings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meter_id UUID NOT NULL REFERENCES meters(id) ON DELETE CASCADE,
  value NUMERIC(12, 2) NOT NULL,
  reading_date DATE NOT NULL,
  photo_url TEXT,
  notes TEXT,
  recorded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Index pour les recherches et tri
CREATE INDEX IF NOT EXISTS idx_meter_readings_meter_id ON meter_readings(meter_id);
CREATE INDEX IF NOT EXISTS idx_meter_readings_date ON meter_readings(reading_date DESC);

-- RLS pour meters
ALTER TABLE meters ENABLE ROW LEVEL SECURITY;

-- Admins peuvent tout voir
CREATE POLICY "Admins can view all meters" ON meters
  FOR SELECT USING (public.user_role() = 'admin');

-- Propriétaires peuvent gérer les compteurs de leurs biens
CREATE POLICY "Owners can manage meters of their properties" ON meters
  FOR ALL USING (
    public.user_role() = 'owner' AND 
    property_id IN (SELECT id FROM properties WHERE owner_id = public.user_profile_id())
  );

-- Locataires peuvent voir les compteurs de leur logement
CREATE POLICY "Tenants can view meters of their leased property" ON meters
  FOR SELECT USING (
    public.user_role() = 'tenant' AND
    property_id IN (
      SELECT l.property_id FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE ls.profile_id = public.user_profile_id() AND l.statut = 'active'
    )
  );

-- RLS pour meter_readings
ALTER TABLE meter_readings ENABLE ROW LEVEL SECURITY;

-- Admins peuvent tout voir
CREATE POLICY "Admins can view all readings" ON meter_readings
  FOR SELECT USING (public.user_role() = 'admin');

-- Propriétaires peuvent voir tous les relevés de leurs compteurs
CREATE POLICY "Owners can view readings of their meters" ON meter_readings
  FOR SELECT USING (
    public.user_role() = 'owner' AND
    meter_id IN (
      SELECT m.id FROM meters m
      JOIN properties p ON m.property_id = p.id
      WHERE p.owner_id = public.user_profile_id()
    )
  );

-- Locataires peuvent voir et créer des relevés pour leurs compteurs
CREATE POLICY "Tenants can view readings of their meters" ON meter_readings
  FOR SELECT USING (
    public.user_role() = 'tenant' AND
    meter_id IN (
      SELECT m.id FROM meters m
      WHERE m.property_id IN (
        SELECT l.property_id FROM leases l
        JOIN lease_signers ls ON ls.lease_id = l.id
        WHERE ls.profile_id = public.user_profile_id() AND l.statut = 'active'
      )
    )
  );

CREATE POLICY "Tenants can create readings for their meters" ON meter_readings
  FOR INSERT WITH CHECK (
    public.user_role() = 'tenant' AND
    meter_id IN (
      SELECT m.id FROM meters m
      WHERE m.property_id IN (
        SELECT l.property_id FROM leases l
        JOIN lease_signers ls ON ls.lease_id = l.id
        WHERE ls.profile_id = public.user_profile_id() AND l.statut = 'active'
      )
    )
  );

-- Triggers pour updated_at
CREATE TRIGGER set_meters_updated_at
  BEFORE UPDATE ON meters
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER set_meter_readings_updated_at
  BEFORE UPDATE ON meter_readings
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

COMMIT;


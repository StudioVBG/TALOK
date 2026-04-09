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

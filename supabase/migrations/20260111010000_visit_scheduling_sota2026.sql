-- ============================================
-- Migration: Visit Scheduling System SOTA 2026
-- Description: Complete visit scheduling for property visits
-- Tables: owner_availability_patterns, availability_exceptions, visit_slots, visit_bookings, calendar_connections
-- ============================================

-- ============================================
-- 1. OWNER AVAILABILITY PATTERNS
-- Patterns de disponibilité récurrents du propriétaire
-- ============================================

CREATE TABLE IF NOT EXISTS owner_availability_patterns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE, -- NULL = toutes propriétés

  -- Pattern de récurrence
  recurrence_type TEXT NOT NULL DEFAULT 'weekly'
    CHECK (recurrence_type IN ('daily', 'weekly', 'monthly', 'custom')),
  day_of_week INTEGER[] DEFAULT '{6}'::INTEGER[], -- 0=Dimanche, 1=Lundi... 6=Samedi

  -- Plage horaire
  start_time TIME NOT NULL DEFAULT '10:00',
  end_time TIME NOT NULL DEFAULT '18:00',
  slot_duration_minutes INTEGER NOT NULL DEFAULT 30 CHECK (slot_duration_minutes >= 15 AND slot_duration_minutes <= 180),
  buffer_minutes INTEGER NOT NULL DEFAULT 15 CHECK (buffer_minutes >= 0 AND buffer_minutes <= 60),

  -- Période de validité
  valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,

  -- Configuration
  max_bookings_per_slot INTEGER NOT NULL DEFAULT 1, -- Pour visites groupées
  auto_confirm BOOLEAN NOT NULL DEFAULT false, -- Confirmation automatique

  -- Métadonnées
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Contraintes
  CONSTRAINT valid_time_range CHECK (start_time < end_time),
  CONSTRAINT valid_date_range CHECK (valid_until IS NULL OR valid_until >= valid_from)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_availability_patterns_owner ON owner_availability_patterns(owner_id);
CREATE INDEX IF NOT EXISTS idx_availability_patterns_property ON owner_availability_patterns(property_id);
CREATE INDEX IF NOT EXISTS idx_availability_patterns_active ON owner_availability_patterns(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_availability_patterns_valid ON owner_availability_patterns(valid_from, valid_until);

-- ============================================
-- 2. AVAILABILITY EXCEPTIONS
-- Exceptions aux patterns (vacances, indisponibilités ponctuelles)
-- ============================================

CREATE TABLE IF NOT EXISTS availability_exceptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pattern_id UUID REFERENCES owner_availability_patterns(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,

  -- Exception
  exception_date DATE NOT NULL,
  exception_type TEXT NOT NULL CHECK (exception_type IN ('unavailable', 'modified')),

  -- Si modifié, nouvelles heures (optionnel)
  modified_start_time TIME,
  modified_end_time TIME,

  -- Métadonnées
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Contraintes
  CONSTRAINT modified_times_check CHECK (
    exception_type = 'unavailable' OR
    (modified_start_time IS NOT NULL AND modified_end_time IS NOT NULL AND modified_start_time < modified_end_time)
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_availability_exceptions_owner ON availability_exceptions(owner_id);
CREATE INDEX IF NOT EXISTS idx_availability_exceptions_pattern ON availability_exceptions(pattern_id);
CREATE INDEX IF NOT EXISTS idx_availability_exceptions_date ON availability_exceptions(exception_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_availability_exceptions_unique ON availability_exceptions(owner_id, property_id, exception_date)
  WHERE property_id IS NOT NULL;

-- ============================================
-- 3. VISIT SLOTS
-- Créneaux de visite matérialisés (générés à partir des patterns)
-- ============================================

CREATE TABLE IF NOT EXISTS visit_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pattern_id UUID REFERENCES owner_availability_patterns(id) ON DELETE SET NULL,

  -- Créneau
  slot_date DATE NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,

  -- Statut
  status TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'booked', 'blocked', 'cancelled', 'completed')),

  -- Capacité (pour visites groupées)
  max_visitors INTEGER NOT NULL DEFAULT 1,
  current_visitors INTEGER NOT NULL DEFAULT 0,

  -- Métadonnées
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Contraintes
  CONSTRAINT valid_slot_times CHECK (start_time < end_time),
  CONSTRAINT valid_visitor_count CHECK (current_visitors >= 0 AND current_visitors <= max_visitors)
);

-- Indexes pour performance
CREATE INDEX IF NOT EXISTS idx_visit_slots_property ON visit_slots(property_id);
CREATE INDEX IF NOT EXISTS idx_visit_slots_owner ON visit_slots(owner_id);
CREATE INDEX IF NOT EXISTS idx_visit_slots_date ON visit_slots(slot_date);
CREATE INDEX IF NOT EXISTS idx_visit_slots_status ON visit_slots(status);
CREATE INDEX IF NOT EXISTS idx_visit_slots_available ON visit_slots(property_id, slot_date, status) WHERE status = 'available';
CREATE UNIQUE INDEX IF NOT EXISTS idx_visit_slots_unique ON visit_slots(property_id, start_time);

-- ============================================
-- 4. VISIT BOOKINGS
-- Réservations de visites par les locataires
-- ============================================

CREATE TABLE IF NOT EXISTS visit_bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slot_id UUID NOT NULL REFERENCES visit_slots(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Statut de la visite
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending',      -- En attente de confirmation
      'confirmed',    -- Confirmée par le propriétaire
      'cancelled',    -- Annulée
      'completed',    -- Visite effectuée
      'no_show'       -- Le locataire ne s'est pas présenté
    )),

  -- Informations complémentaires
  tenant_message TEXT,
  owner_notes TEXT,

  -- Contact du locataire pour la visite
  contact_phone TEXT,
  contact_email TEXT,

  -- Nombre de personnes
  party_size INTEGER NOT NULL DEFAULT 1 CHECK (party_size >= 1 AND party_size <= 5),

  -- Rappels
  reminder_sent_at TIMESTAMPTZ,
  reminder_24h_sent BOOLEAN NOT NULL DEFAULT false,
  reminder_1h_sent BOOLEAN NOT NULL DEFAULT false,

  -- Calendrier externe
  external_calendar_event_id TEXT,
  external_calendar_provider TEXT CHECK (external_calendar_provider IS NULL OR external_calendar_provider IN ('google', 'outlook', 'apple', 'caldav')),

  -- Feedback après visite (optionnel)
  feedback_rating INTEGER CHECK (feedback_rating IS NULL OR (feedback_rating >= 1 AND feedback_rating <= 5)),
  feedback_comment TEXT,

  -- Métadonnées
  booked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  cancelled_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_visit_bookings_slot ON visit_bookings(slot_id);
CREATE INDEX IF NOT EXISTS idx_visit_bookings_property ON visit_bookings(property_id);
CREATE INDEX IF NOT EXISTS idx_visit_bookings_tenant ON visit_bookings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_visit_bookings_status ON visit_bookings(status);
CREATE INDEX IF NOT EXISTS idx_visit_bookings_pending ON visit_bookings(status, booked_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_visit_bookings_upcoming ON visit_bookings(status) WHERE status IN ('pending', 'confirmed');

-- Un locataire ne peut avoir qu'une réservation active par bien
CREATE UNIQUE INDEX IF NOT EXISTS idx_visit_bookings_tenant_property_active
  ON visit_bookings(tenant_id, property_id)
  WHERE status IN ('pending', 'confirmed');

-- ============================================
-- 5. CALENDAR CONNECTIONS
-- Connexions aux calendriers externes
-- ============================================

CREATE TABLE IF NOT EXISTS calendar_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  provider TEXT NOT NULL CHECK (provider IN ('google', 'outlook', 'apple', 'caldav')),

  -- OAuth tokens (stockés encryptés via extension pgcrypto)
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ,

  -- Calendar info
  calendar_id TEXT NOT NULL,
  calendar_name TEXT,
  calendar_color TEXT, -- Couleur du calendrier (hex)

  -- Sync settings
  sync_enabled BOOLEAN NOT NULL DEFAULT true,
  sync_direction TEXT NOT NULL DEFAULT 'both'
    CHECK (sync_direction IN ('to_external', 'from_external', 'both')),
  last_sync_at TIMESTAMPTZ,
  last_sync_error TEXT,

  -- Métadonnées
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, provider, calendar_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_calendar_connections_user ON calendar_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_connections_provider ON calendar_connections(provider);
CREATE INDEX IF NOT EXISTS idx_calendar_connections_sync ON calendar_connections(sync_enabled, last_sync_at) WHERE sync_enabled = true;

-- ============================================
-- 6. FUNCTION: generate_visit_slots
-- Génère les créneaux à partir des patterns pour une propriété
-- ============================================

CREATE OR REPLACE FUNCTION generate_visit_slots(
  p_property_id UUID,
  p_start_date DATE,
  p_end_date DATE
) RETURNS INTEGER AS $$
DECLARE
  v_pattern RECORD;
  v_date DATE;
  v_slot_start TIMESTAMPTZ;
  v_slot_end TIMESTAMPTZ;
  v_count INTEGER := 0;
  v_day_of_week INTEGER;
BEGIN
  -- Parcourir tous les patterns actifs pour cette propriété
  FOR v_pattern IN
    SELECT * FROM owner_availability_patterns
    WHERE (property_id = p_property_id OR property_id IS NULL)
      AND is_active = true
      AND valid_from <= p_end_date
      AND (valid_until IS NULL OR valid_until >= p_start_date)
      AND EXISTS (
        SELECT 1 FROM properties p
        WHERE p.id = p_property_id
        AND p.owner_id = owner_availability_patterns.owner_id
      )
  LOOP
    v_date := GREATEST(p_start_date, v_pattern.valid_from);

    -- Boucle sur chaque jour de la période
    WHILE v_date <= LEAST(p_end_date, COALESCE(v_pattern.valid_until, p_end_date)) LOOP
      v_day_of_week := EXTRACT(DOW FROM v_date)::INTEGER;

      -- Vérifier si le jour correspond au pattern
      IF v_pattern.day_of_week IS NULL
         OR v_day_of_week = ANY(v_pattern.day_of_week) THEN

        -- Vérifier les exceptions (indisponibilité)
        IF NOT EXISTS (
          SELECT 1 FROM availability_exceptions
          WHERE (pattern_id = v_pattern.id OR (owner_id = v_pattern.owner_id AND (property_id = p_property_id OR property_id IS NULL)))
            AND exception_date = v_date
            AND exception_type = 'unavailable'
        ) THEN
          -- Générer les créneaux pour cette journée
          v_slot_start := v_date + v_pattern.start_time;

          WHILE (v_slot_start::TIME) < v_pattern.end_time LOOP
            v_slot_end := v_slot_start + (v_pattern.slot_duration_minutes || ' minutes')::INTERVAL;

            -- Ne pas dépasser l'heure de fin
            IF (v_slot_end::TIME) <= v_pattern.end_time THEN
              INSERT INTO visit_slots (
                property_id,
                owner_id,
                pattern_id,
                slot_date,
                start_time,
                end_time,
                max_visitors
              )
              VALUES (
                p_property_id,
                v_pattern.owner_id,
                v_pattern.id,
                v_date,
                v_slot_start,
                v_slot_end,
                v_pattern.max_bookings_per_slot
              )
              ON CONFLICT (property_id, start_time) DO NOTHING;

              v_count := v_count + 1;
            END IF;

            -- Prochain créneau = fin du créneau actuel + buffer
            v_slot_start := v_slot_end + (v_pattern.buffer_minutes || ' minutes')::INTERVAL;
          END LOOP;
        END IF;
      END IF;

      v_date := v_date + INTERVAL '1 day';
    END LOOP;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. FUNCTION: cleanup_old_visit_slots
-- Nettoie les créneaux passés non réservés
-- ============================================

CREATE OR REPLACE FUNCTION cleanup_old_visit_slots() RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM visit_slots
  WHERE slot_date < CURRENT_DATE - INTERVAL '7 days'
    AND status = 'available';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 8. FUNCTION: book_visit_slot
-- Réserve un créneau de visite (avec vérification atomique)
-- ============================================

CREATE OR REPLACE FUNCTION book_visit_slot(
  p_slot_id UUID,
  p_tenant_id UUID,
  p_message TEXT DEFAULT NULL,
  p_contact_phone TEXT DEFAULT NULL,
  p_contact_email TEXT DEFAULT NULL,
  p_party_size INTEGER DEFAULT 1
) RETURNS UUID AS $$
DECLARE
  v_slot visit_slots%ROWTYPE;
  v_booking_id UUID;
  v_pattern_auto_confirm BOOLEAN;
BEGIN
  -- Verrouiller le créneau pour éviter les doubles réservations
  SELECT * INTO v_slot
  FROM visit_slots
  WHERE id = p_slot_id
  FOR UPDATE;

  IF v_slot IS NULL THEN
    RAISE EXCEPTION 'Créneau non trouvé';
  END IF;

  IF v_slot.status != 'available' THEN
    RAISE EXCEPTION 'Ce créneau n''est plus disponible';
  END IF;

  IF v_slot.current_visitors + p_party_size > v_slot.max_visitors THEN
    RAISE EXCEPTION 'Capacité maximale dépassée';
  END IF;

  -- Vérifier si le locataire n'a pas déjà une réservation active sur ce bien
  IF EXISTS (
    SELECT 1 FROM visit_bookings
    WHERE tenant_id = p_tenant_id
      AND property_id = v_slot.property_id
      AND status IN ('pending', 'confirmed')
  ) THEN
    RAISE EXCEPTION 'Vous avez déjà une réservation en cours pour ce bien';
  END IF;

  -- Récupérer le paramètre auto_confirm du pattern
  SELECT auto_confirm INTO v_pattern_auto_confirm
  FROM owner_availability_patterns
  WHERE id = v_slot.pattern_id;

  -- Créer la réservation
  INSERT INTO visit_bookings (
    slot_id,
    property_id,
    tenant_id,
    status,
    tenant_message,
    contact_phone,
    contact_email,
    party_size,
    confirmed_at
  ) VALUES (
    p_slot_id,
    v_slot.property_id,
    p_tenant_id,
    CASE WHEN COALESCE(v_pattern_auto_confirm, false) THEN 'confirmed' ELSE 'pending' END,
    p_message,
    p_contact_phone,
    p_contact_email,
    p_party_size,
    CASE WHEN COALESCE(v_pattern_auto_confirm, false) THEN NOW() ELSE NULL END
  )
  RETURNING id INTO v_booking_id;

  -- Mettre à jour le créneau
  UPDATE visit_slots
  SET
    current_visitors = current_visitors + p_party_size,
    status = CASE
      WHEN current_visitors + p_party_size >= max_visitors THEN 'booked'
      ELSE status
    END,
    updated_at = NOW()
  WHERE id = p_slot_id;

  RETURN v_booking_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 9. FUNCTION: cancel_visit_booking
-- Annule une réservation et libère le créneau
-- ============================================

CREATE OR REPLACE FUNCTION cancel_visit_booking(
  p_booking_id UUID,
  p_cancelled_by UUID,
  p_reason TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  v_booking visit_bookings%ROWTYPE;
BEGIN
  SELECT * INTO v_booking
  FROM visit_bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF v_booking IS NULL THEN
    RAISE EXCEPTION 'Réservation non trouvée';
  END IF;

  IF v_booking.status NOT IN ('pending', 'confirmed') THEN
    RAISE EXCEPTION 'Cette réservation ne peut plus être annulée';
  END IF;

  -- Mettre à jour la réservation
  UPDATE visit_bookings
  SET
    status = 'cancelled',
    cancelled_at = NOW(),
    cancelled_by = p_cancelled_by,
    cancellation_reason = p_reason,
    updated_at = NOW()
  WHERE id = p_booking_id;

  -- Libérer le créneau
  UPDATE visit_slots
  SET
    current_visitors = GREATEST(0, current_visitors - v_booking.party_size),
    status = 'available',
    updated_at = NOW()
  WHERE id = v_booking.slot_id
    AND status = 'booked';

  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 10. TRIGGERS
-- ============================================

-- Trigger updated_at pour toutes les tables
DROP TRIGGER IF EXISTS update_owner_availability_patterns_updated_at ON owner_availability_patterns;
CREATE TRIGGER update_owner_availability_patterns_updated_at
  BEFORE UPDATE ON owner_availability_patterns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_visit_slots_updated_at ON visit_slots;
CREATE TRIGGER update_visit_slots_updated_at
  BEFORE UPDATE ON visit_slots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_visit_bookings_updated_at ON visit_bookings;
CREATE TRIGGER update_visit_bookings_updated_at
  BEFORE UPDATE ON visit_bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_calendar_connections_updated_at ON calendar_connections;
CREATE TRIGGER update_calendar_connections_updated_at
  BEFORE UPDATE ON calendar_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 11. ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE owner_availability_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_connections ENABLE ROW LEVEL SECURITY;

-- Policies pour owner_availability_patterns
DROP POLICY IF EXISTS "Owners can manage their availability patterns" ON owner_availability_patterns;
CREATE POLICY "Owners can manage their availability patterns"
  ON owner_availability_patterns
  FOR ALL
  USING (
    owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins can view all availability patterns" ON owner_availability_patterns;
CREATE POLICY "Admins can view all availability patterns"
  ON owner_availability_patterns
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Policies pour availability_exceptions
DROP POLICY IF EXISTS "Owners can manage their exceptions" ON availability_exceptions;
CREATE POLICY "Owners can manage their exceptions"
  ON availability_exceptions
  FOR ALL
  USING (
    owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Policies pour visit_slots
DROP POLICY IF EXISTS "Owners can manage their visit slots" ON visit_slots;
CREATE POLICY "Owners can manage their visit slots"
  ON visit_slots
  FOR ALL
  USING (
    owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Tenants can view available slots" ON visit_slots;
CREATE POLICY "Tenants can view available slots"
  ON visit_slots
  FOR SELECT
  USING (
    status = 'available' AND slot_date >= CURRENT_DATE
  );

-- Policies pour visit_bookings
DROP POLICY IF EXISTS "Owners can view and manage bookings for their properties" ON visit_bookings;
CREATE POLICY "Owners can view and manage bookings for their properties"
  ON visit_bookings
  FOR ALL
  USING (
    property_id IN (
      SELECT id FROM properties
      WHERE owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Tenants can view and manage their own bookings" ON visit_bookings;
CREATE POLICY "Tenants can view and manage their own bookings"
  ON visit_bookings
  FOR ALL
  USING (
    tenant_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins can view all bookings" ON visit_bookings;
CREATE POLICY "Admins can view all bookings"
  ON visit_bookings
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Policies pour calendar_connections
DROP POLICY IF EXISTS "Users can manage their calendar connections" ON calendar_connections;
CREATE POLICY "Users can manage their calendar connections"
  ON calendar_connections
  FOR ALL
  USING (
    user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- ============================================
-- 12. COMMENTS (Documentation)
-- ============================================

COMMENT ON TABLE owner_availability_patterns IS 'Patterns de disponibilité récurrents des propriétaires pour les visites';
COMMENT ON TABLE availability_exceptions IS 'Exceptions aux patterns (vacances, indisponibilités ponctuelles)';
COMMENT ON TABLE visit_slots IS 'Créneaux de visite matérialisés générés à partir des patterns';
COMMENT ON TABLE visit_bookings IS 'Réservations de visites par les locataires potentiels';
COMMENT ON TABLE calendar_connections IS 'Connexions OAuth aux calendriers externes (Google, Outlook, etc.)';

COMMENT ON FUNCTION generate_visit_slots(UUID, DATE, DATE) IS 'Génère les créneaux de visite pour une propriété sur une période donnée';
COMMENT ON FUNCTION book_visit_slot(UUID, UUID, TEXT, TEXT, TEXT, INTEGER) IS 'Réserve un créneau de visite de manière atomique';
COMMENT ON FUNCTION cancel_visit_booking(UUID, UUID, TEXT) IS 'Annule une réservation et libère le créneau';

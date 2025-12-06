-- =====================================================
-- MIGRATION: Tables et fonctions manquantes prestataire
-- Corrige les erreurs critiques du module prestataire
-- =====================================================

-- =====================================================
-- 1. TABLE: provider_reviews (avis clients)
-- =====================================================

CREATE TABLE IF NOT EXISTS provider_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Relations
  provider_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reviewer_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  work_order_id UUID REFERENCES work_orders(id) ON DELETE SET NULL,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  
  -- Notes (1-5)
  rating_overall INTEGER NOT NULL CHECK (rating_overall BETWEEN 1 AND 5),
  rating_punctuality INTEGER CHECK (rating_punctuality BETWEEN 1 AND 5),
  rating_quality INTEGER CHECK (rating_quality BETWEEN 1 AND 5),
  rating_communication INTEGER CHECK (rating_communication BETWEEN 1 AND 5),
  rating_value INTEGER CHECK (rating_value BETWEEN 1 AND 5),
  
  -- Contenu
  title TEXT,
  comment TEXT,
  would_recommend BOOLEAN DEFAULT true,
  
  -- Réponse du prestataire
  provider_response TEXT,
  provider_response_at TIMESTAMPTZ,
  
  -- Modération
  is_published BOOLEAN DEFAULT true,
  is_flagged BOOLEAN DEFAULT false,
  flag_reason TEXT,
  moderated_at TIMESTAMPTZ,
  moderated_by UUID REFERENCES profiles(id),
  
  -- Métadonnées
  helpful_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_provider_reviews_provider ON provider_reviews(provider_profile_id);
CREATE INDEX IF NOT EXISTS idx_provider_reviews_reviewer ON provider_reviews(reviewer_profile_id);
CREATE INDEX IF NOT EXISTS idx_provider_reviews_rating ON provider_reviews(rating_overall);
CREATE INDEX IF NOT EXISTS idx_provider_reviews_published ON provider_reviews(is_published) WHERE is_published = true;

-- RLS
ALTER TABLE provider_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read published reviews" ON provider_reviews;
CREATE POLICY "Anyone can read published reviews"
  ON provider_reviews FOR SELECT
  USING (is_published = true);

DROP POLICY IF EXISTS "Providers can read own reviews" ON provider_reviews;
CREATE POLICY "Providers can read own reviews"
  ON provider_reviews FOR SELECT
  USING (provider_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Owners can create reviews" ON provider_reviews;
CREATE POLICY "Owners can create reviews"
  ON provider_reviews FOR INSERT
  WITH CHECK (reviewer_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid() AND role = 'owner'));

DROP POLICY IF EXISTS "Providers can respond to reviews" ON provider_reviews;
CREATE POLICY "Providers can respond to reviews"
  ON provider_reviews FOR UPDATE
  USING (provider_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
  WITH CHECK (provider_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- =====================================================
-- 2. TABLE: provider_availability (disponibilités)
-- =====================================================

CREATE TABLE IF NOT EXISTS provider_availability (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Type de créneau
  type TEXT NOT NULL CHECK (type IN ('available', 'busy', 'vacation')),
  
  -- Récurrence ou date unique
  is_recurring BOOLEAN DEFAULT false,
  day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6), -- 0 = dimanche
  
  -- Horaires
  start_time TIME,
  end_time TIME,
  
  -- Pour les dates uniques
  specific_date DATE,
  
  -- Notes
  notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_provider_availability_provider ON provider_availability(provider_profile_id);
CREATE INDEX IF NOT EXISTS idx_provider_availability_date ON provider_availability(specific_date);
CREATE INDEX IF NOT EXISTS idx_provider_availability_day ON provider_availability(day_of_week);

-- RLS
ALTER TABLE provider_availability ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Providers can manage own availability" ON provider_availability;
CREATE POLICY "Providers can manage own availability"
  ON provider_availability FOR ALL
  USING (provider_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
  WITH CHECK (provider_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Owners can view provider availability" ON provider_availability;
CREATE POLICY "Owners can view provider availability"
  ON provider_availability FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'owner'));

-- =====================================================
-- 3. TABLE: provider_quotes (devis)
-- =====================================================

CREATE TABLE IF NOT EXISTS provider_quotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Numérotation
  reference TEXT UNIQUE NOT NULL,
  
  -- Relations
  provider_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  owner_profile_id UUID REFERENCES profiles(id),
  property_id UUID REFERENCES properties(id),
  ticket_id UUID REFERENCES tickets(id),
  
  -- Contenu
  title TEXT NOT NULL,
  description TEXT,
  
  -- Montants
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  tax_rate DECIMAL(5,2) NOT NULL DEFAULT 20,
  tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  
  -- Validité
  valid_until DATE,
  
  -- Statut
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired', 'converted')),
  
  -- Dates
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  
  -- Conversion en facture
  converted_invoice_id UUID,
  
  -- Notes
  internal_notes TEXT,
  terms_and_conditions TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_provider_quotes_provider ON provider_quotes(provider_profile_id);
CREATE INDEX IF NOT EXISTS idx_provider_quotes_owner ON provider_quotes(owner_profile_id);
CREATE INDEX IF NOT EXISTS idx_provider_quotes_status ON provider_quotes(status);
CREATE INDEX IF NOT EXISTS idx_provider_quotes_reference ON provider_quotes(reference);

-- RLS
ALTER TABLE provider_quotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Providers can manage own quotes" ON provider_quotes;
CREATE POLICY "Providers can manage own quotes"
  ON provider_quotes FOR ALL
  USING (provider_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
  WITH CHECK (provider_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Owners can view quotes addressed to them" ON provider_quotes;
CREATE POLICY "Owners can view quotes addressed to them"
  ON provider_quotes FOR SELECT
  USING (owner_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- =====================================================
-- 4. TABLE: provider_quote_items (lignes de devis)
-- =====================================================

CREATE TABLE IF NOT EXISTS provider_quote_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id UUID NOT NULL REFERENCES provider_quotes(id) ON DELETE CASCADE,
  
  description TEXT NOT NULL,
  quantity DECIMAL(10,3) NOT NULL DEFAULT 1,
  unit TEXT DEFAULT 'unité',
  unit_price DECIMAL(10,2) NOT NULL,
  tax_rate DECIMAL(5,2) NOT NULL DEFAULT 20,
  
  subtotal DECIMAL(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_provider_quote_items_quote ON provider_quote_items(quote_id);

-- RLS
ALTER TABLE provider_quote_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage quote items via quotes" ON provider_quote_items;
CREATE POLICY "Users can manage quote items via quotes"
  ON provider_quote_items FOR ALL
  USING (
    quote_id IN (
      SELECT id FROM provider_quotes 
      WHERE provider_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- =====================================================
-- 5. FONCTION: provider_dashboard (dashboard principal)
-- =====================================================

CREATE OR REPLACE FUNCTION provider_dashboard(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile_id UUID;
  v_result JSONB;
  v_stats JSONB;
  v_pending_orders JSONB;
  v_recent_reviews JSONB;
BEGIN
  -- Récupérer le profil prestataire
  SELECT id INTO v_profile_id
  FROM profiles
  WHERE user_id = p_user_id AND role = 'provider';
  
  IF v_profile_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Statistiques
  SELECT jsonb_build_object(
    'total_interventions', COUNT(*),
    'completed_interventions', COUNT(*) FILTER (WHERE statut = 'done'),
    'pending_interventions', COUNT(*) FILTER (WHERE statut IN ('assigned', 'scheduled')),
    'in_progress_interventions', COUNT(*) FILTER (WHERE statut = 'in_progress'),
    'total_revenue', COALESCE(SUM(cout_final) FILTER (WHERE statut = 'done'), 0),
    'avg_rating', (
      SELECT ROUND(AVG(rating_overall)::NUMERIC, 1)
      FROM provider_reviews
      WHERE provider_profile_id = v_profile_id AND is_published = true
    ),
    'total_reviews', (
      SELECT COUNT(*) FROM provider_reviews
      WHERE provider_profile_id = v_profile_id AND is_published = true
    )
  ) INTO v_stats
  FROM work_orders
  WHERE provider_id = v_profile_id;
  
  -- Interventions en attente (avec détails)
  SELECT COALESCE(jsonb_agg(order_data ORDER BY order_data->>'created_at' DESC), '[]'::jsonb)
  INTO v_pending_orders
  FROM (
    SELECT jsonb_build_object(
      'id', wo.id,
      'ticket_id', wo.ticket_id,
      'statut', wo.statut,
      'cout_estime', wo.cout_estime,
      'date_intervention_prevue', wo.date_intervention_prevue,
      'created_at', wo.created_at,
      'ticket', jsonb_build_object(
        'titre', t.titre,
        'priorite', t.priorite
      ),
      'property', jsonb_build_object(
        'adresse', p.adresse_complete,
        'ville', p.ville
      )
    ) as order_data
    FROM work_orders wo
    JOIN tickets t ON t.id = wo.ticket_id
    JOIN properties p ON p.id = t.property_id
    WHERE wo.provider_id = v_profile_id
    AND wo.statut IN ('assigned', 'scheduled', 'in_progress')
    ORDER BY wo.created_at DESC
    LIMIT 10
  ) sub;
  
  -- Avis récents
  SELECT COALESCE(jsonb_agg(review_data ORDER BY review_data->>'created_at' DESC), '[]'::jsonb)
  INTO v_recent_reviews
  FROM (
    SELECT jsonb_build_object(
      'id', pr.id,
      'rating_overall', pr.rating_overall,
      'comment', pr.comment,
      'created_at', pr.created_at,
      'reviewer', jsonb_build_object(
        'prenom', prof.prenom,
        'nom', LEFT(prof.nom, 1) || '.'
      )
    ) as review_data
    FROM provider_reviews pr
    JOIN profiles prof ON prof.id = pr.reviewer_profile_id
    WHERE pr.provider_profile_id = v_profile_id
    AND pr.is_published = true
    ORDER BY pr.created_at DESC
    LIMIT 5
  ) sub;
  
  -- Construire le résultat final
  v_result := jsonb_build_object(
    'profile_id', v_profile_id,
    'stats', v_stats,
    'pending_orders', v_pending_orders,
    'recent_reviews', v_recent_reviews
  );
  
  RETURN v_result;
END;
$$;

-- =====================================================
-- 6. FONCTION: Génération numéro de devis
-- =====================================================

CREATE OR REPLACE FUNCTION generate_quote_reference(p_provider_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_year INTEGER;
  v_count INTEGER;
BEGIN
  v_year := EXTRACT(YEAR FROM CURRENT_DATE);
  
  SELECT COUNT(*) + 1 INTO v_count
  FROM provider_quotes
  WHERE provider_profile_id = p_provider_id
  AND EXTRACT(YEAR FROM created_at) = v_year;
  
  RETURN 'DEV-' || v_year || '-' || LPAD(v_count::TEXT, 4, '0');
END;
$$;

-- Trigger pour générer automatiquement la référence
CREATE OR REPLACE FUNCTION trigger_generate_quote_reference()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.reference IS NULL THEN
    NEW.reference := generate_quote_reference(NEW.provider_profile_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_quote_reference ON provider_quotes;
CREATE TRIGGER trg_generate_quote_reference
  BEFORE INSERT ON provider_quotes
  FOR EACH ROW EXECUTE FUNCTION trigger_generate_quote_reference();

-- =====================================================
-- 7. TRIGGER: Calcul automatique des totaux de devis
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_quote_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_subtotal DECIMAL(10,2);
  v_tax_amount DECIMAL(10,2);
BEGIN
  SELECT 
    COALESCE(SUM(quantity * unit_price), 0),
    COALESCE(SUM(quantity * unit_price * tax_rate / 100), 0)
  INTO v_subtotal, v_tax_amount
  FROM provider_quote_items
  WHERE quote_id = COALESCE(NEW.quote_id, OLD.quote_id);
  
  UPDATE provider_quotes
  SET 
    subtotal = v_subtotal,
    tax_amount = v_tax_amount,
    total_amount = v_subtotal + v_tax_amount,
    updated_at = NOW()
  WHERE id = COALESCE(NEW.quote_id, OLD.quote_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calculate_quote_totals ON provider_quote_items;
CREATE TRIGGER trg_calculate_quote_totals
  AFTER INSERT OR UPDATE OR DELETE ON provider_quote_items
  FOR EACH ROW EXECUTE FUNCTION calculate_quote_totals();

-- =====================================================
-- 8. TRIGGERS: updated_at
-- =====================================================

DROP TRIGGER IF EXISTS trg_provider_reviews_updated_at ON provider_reviews;
CREATE TRIGGER trg_provider_reviews_updated_at
  BEFORE UPDATE ON provider_reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_provider_availability_updated_at ON provider_availability;
CREATE TRIGGER trg_provider_availability_updated_at
  BEFORE UPDATE ON provider_availability
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_provider_quotes_updated_at ON provider_quotes;
CREATE TRIGGER trg_provider_quotes_updated_at
  BEFORE UPDATE ON provider_quotes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 9. COMMENTAIRES
-- =====================================================

COMMENT ON TABLE provider_reviews IS 'Avis clients sur les prestataires';
COMMENT ON TABLE provider_availability IS 'Disponibilités et créneaux des prestataires';
COMMENT ON TABLE provider_quotes IS 'Devis des prestataires';
COMMENT ON TABLE provider_quote_items IS 'Lignes de devis';
COMMENT ON FUNCTION provider_dashboard IS 'Dashboard principal du prestataire avec stats et interventions';


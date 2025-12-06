-- =====================================================
-- MIGRATION: Avis et Notations Prestataires
-- Description: Système de notation et avis pour les prestataires
-- =====================================================

-- =====================================================
-- TABLE: provider_reviews (avis prestataires)
-- =====================================================
CREATE TABLE IF NOT EXISTS provider_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Relations
  provider_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reviewer_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  work_order_id UUID REFERENCES work_orders(id) ON DELETE SET NULL,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  
  -- Notes (1-5 étoiles)
  overall_rating INTEGER NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
  punctuality_rating INTEGER CHECK (punctuality_rating BETWEEN 1 AND 5),
  quality_rating INTEGER CHECK (quality_rating BETWEEN 1 AND 5),
  communication_rating INTEGER CHECK (communication_rating BETWEEN 1 AND 5),
  value_rating INTEGER CHECK (value_rating BETWEEN 1 AND 5), -- Rapport qualité/prix
  
  -- Commentaire
  title TEXT,
  comment TEXT,
  
  -- Réponse du prestataire
  provider_response TEXT,
  provider_response_at TIMESTAMPTZ,
  
  -- Modération
  status TEXT DEFAULT 'published' CHECK (status IN ('pending', 'published', 'hidden', 'flagged')),
  flagged_reason TEXT,
  moderated_by UUID REFERENCES profiles(id),
  moderated_at TIMESTAMPTZ,
  
  -- Recommandation
  would_recommend BOOLEAN DEFAULT TRUE,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Un avis par work_order
  UNIQUE(work_order_id, reviewer_profile_id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_provider_reviews_provider ON provider_reviews(provider_profile_id);
CREATE INDEX IF NOT EXISTS idx_provider_reviews_reviewer ON provider_reviews(reviewer_profile_id);
CREATE INDEX IF NOT EXISTS idx_provider_reviews_rating ON provider_reviews(overall_rating);
CREATE INDEX IF NOT EXISTS idx_provider_reviews_status ON provider_reviews(status);

-- =====================================================
-- TABLE: provider_stats (statistiques prestataires)
-- Vue matérialisée pour les stats de chaque prestataire
-- =====================================================
CREATE TABLE IF NOT EXISTS provider_stats (
  provider_profile_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Compteurs
  total_reviews INTEGER DEFAULT 0,
  total_work_orders INTEGER DEFAULT 0,
  completed_work_orders INTEGER DEFAULT 0,
  
  -- Moyennes des notes
  average_rating NUMERIC(3,2) DEFAULT 0,
  average_punctuality NUMERIC(3,2) DEFAULT 0,
  average_quality NUMERIC(3,2) DEFAULT 0,
  average_communication NUMERIC(3,2) DEFAULT 0,
  average_value NUMERIC(3,2) DEFAULT 0,
  
  -- Taux
  recommendation_rate NUMERIC(5,2) DEFAULT 0, -- % de recommandations
  completion_rate NUMERIC(5,2) DEFAULT 0, -- % de travaux complétés
  response_rate NUMERIC(5,2) DEFAULT 0, -- % de réponses aux avis
  
  -- Distribution des notes
  rating_1_count INTEGER DEFAULT 0,
  rating_2_count INTEGER DEFAULT 0,
  rating_3_count INTEGER DEFAULT 0,
  rating_4_count INTEGER DEFAULT 0,
  rating_5_count INTEGER DEFAULT 0,
  
  -- Dernière mise à jour
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- FONCTION: Mettre à jour les stats du prestataire
-- =====================================================
CREATE OR REPLACE FUNCTION update_provider_stats()
RETURNS TRIGGER AS $$
DECLARE
  v_provider_id UUID;
BEGIN
  -- Récupérer l'ID du prestataire
  v_provider_id := COALESCE(NEW.provider_profile_id, OLD.provider_profile_id);
  
  -- Mettre à jour ou créer les stats
  INSERT INTO provider_stats (provider_profile_id, updated_at)
  VALUES (v_provider_id, NOW())
  ON CONFLICT (provider_profile_id) DO NOTHING;
  
  -- Calculer les nouvelles stats
  UPDATE provider_stats
  SET
    total_reviews = (
      SELECT COUNT(*) FROM provider_reviews 
      WHERE provider_profile_id = v_provider_id AND status = 'published'
    ),
    average_rating = COALESCE((
      SELECT AVG(overall_rating)::NUMERIC(3,2) FROM provider_reviews 
      WHERE provider_profile_id = v_provider_id AND status = 'published'
    ), 0),
    average_punctuality = COALESCE((
      SELECT AVG(punctuality_rating)::NUMERIC(3,2) FROM provider_reviews 
      WHERE provider_profile_id = v_provider_id AND status = 'published' AND punctuality_rating IS NOT NULL
    ), 0),
    average_quality = COALESCE((
      SELECT AVG(quality_rating)::NUMERIC(3,2) FROM provider_reviews 
      WHERE provider_profile_id = v_provider_id AND status = 'published' AND quality_rating IS NOT NULL
    ), 0),
    average_communication = COALESCE((
      SELECT AVG(communication_rating)::NUMERIC(3,2) FROM provider_reviews 
      WHERE provider_profile_id = v_provider_id AND status = 'published' AND communication_rating IS NOT NULL
    ), 0),
    average_value = COALESCE((
      SELECT AVG(value_rating)::NUMERIC(3,2) FROM provider_reviews 
      WHERE provider_profile_id = v_provider_id AND status = 'published' AND value_rating IS NOT NULL
    ), 0),
    recommendation_rate = COALESCE((
      SELECT (COUNT(*) FILTER (WHERE would_recommend = TRUE) * 100.0 / NULLIF(COUNT(*), 0))::NUMERIC(5,2)
      FROM provider_reviews 
      WHERE provider_profile_id = v_provider_id AND status = 'published'
    ), 0),
    response_rate = COALESCE((
      SELECT (COUNT(*) FILTER (WHERE provider_response IS NOT NULL) * 100.0 / NULLIF(COUNT(*), 0))::NUMERIC(5,2)
      FROM provider_reviews 
      WHERE provider_profile_id = v_provider_id AND status = 'published'
    ), 0),
    rating_1_count = (SELECT COUNT(*) FROM provider_reviews WHERE provider_profile_id = v_provider_id AND status = 'published' AND overall_rating = 1),
    rating_2_count = (SELECT COUNT(*) FROM provider_reviews WHERE provider_profile_id = v_provider_id AND status = 'published' AND overall_rating = 2),
    rating_3_count = (SELECT COUNT(*) FROM provider_reviews WHERE provider_profile_id = v_provider_id AND status = 'published' AND overall_rating = 3),
    rating_4_count = (SELECT COUNT(*) FROM provider_reviews WHERE provider_profile_id = v_provider_id AND status = 'published' AND overall_rating = 4),
    rating_5_count = (SELECT COUNT(*) FROM provider_reviews WHERE provider_profile_id = v_provider_id AND status = 'published' AND overall_rating = 5),
    updated_at = NOW()
  WHERE provider_profile_id = v_provider_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour les stats
DROP TRIGGER IF EXISTS trigger_update_provider_stats ON provider_reviews;
CREATE TRIGGER trigger_update_provider_stats
  AFTER INSERT OR UPDATE OR DELETE ON provider_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_provider_stats();

-- =====================================================
-- RLS POLICIES
-- =====================================================
ALTER TABLE provider_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_stats ENABLE ROW LEVEL SECURITY;

-- Tout le monde peut voir les avis publiés
CREATE POLICY "Anyone can view published reviews"
  ON provider_reviews FOR SELECT
  USING (status = 'published');

-- Les prestataires peuvent voir tous leurs avis
CREATE POLICY "Providers can view all their reviews"
  ON provider_reviews FOR SELECT
  USING (
    provider_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Les reviewers peuvent voir leurs propres avis
CREATE POLICY "Reviewers can view their own reviews"
  ON provider_reviews FOR SELECT
  USING (
    reviewer_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Les propriétaires peuvent créer des avis
CREATE POLICY "Owners can create reviews"
  ON provider_reviews FOR INSERT
  WITH CHECK (
    reviewer_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- Les reviewers peuvent modifier leurs avis non modérés
CREATE POLICY "Reviewers can update their own reviews"
  ON provider_reviews FOR UPDATE
  USING (
    reviewer_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND status != 'flagged'
  );

-- Les prestataires peuvent répondre à leurs avis
CREATE POLICY "Providers can respond to reviews"
  ON provider_reviews FOR UPDATE
  USING (
    provider_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Stats visibles par tous
CREATE POLICY "Anyone can view provider stats"
  ON provider_stats FOR SELECT
  USING (true);


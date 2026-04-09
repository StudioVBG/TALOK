-- Migration : Workflow Candidatures Locatives
-- Tables : property_listings, applications
-- RLS policies pour owner, tenant et accès public

-- ============================================
-- 1. TABLE PROPERTY_LISTINGS (Annonces)
-- ============================================

CREATE TABLE IF NOT EXISTS property_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  rent_amount_cents INTEGER NOT NULL CHECK (rent_amount_cents >= 0),
  charges_cents INTEGER DEFAULT 0 CHECK (charges_cents >= 0),
  available_from DATE NOT NULL,
  bail_type TEXT NOT NULL CHECK (bail_type IN ('nu', 'meuble', 'colocation', 'saisonnier', 'commercial')),
  photos JSONB DEFAULT '[]'::jsonb,
  is_published BOOLEAN DEFAULT false,
  public_url_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  views_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index
CREATE INDEX idx_property_listings_property ON property_listings(property_id);
CREATE INDEX idx_property_listings_owner ON property_listings(owner_id);
CREATE INDEX idx_property_listings_published ON property_listings(is_published) WHERE is_published = true;
CREATE INDEX idx_property_listings_token ON property_listings(public_url_token);

-- RLS
ALTER TABLE property_listings ENABLE ROW LEVEL SECURITY;

-- Owner peut tout faire sur ses annonces
CREATE POLICY property_listings_owner_all ON property_listings
  FOR ALL USING (owner_id = (SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1));

-- Annonces publiées lisibles par tous (page publique)
CREATE POLICY property_listings_public_read ON property_listings
  FOR SELECT USING (is_published = true);

-- Trigger updated_at
CREATE TRIGGER update_property_listings_updated_at
  BEFORE UPDATE ON property_listings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 2. TABLE APPLICATIONS (Candidatures)
-- ============================================

CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES property_listings(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  applicant_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  applicant_name TEXT NOT NULL,
  applicant_email TEXT NOT NULL,
  applicant_phone TEXT,
  message TEXT,
  documents JSONB DEFAULT '[]'::jsonb,
  completeness_score INTEGER DEFAULT 0 CHECK (completeness_score >= 0 AND completeness_score <= 100),
  ai_score INTEGER CHECK (ai_score >= 0 AND ai_score <= 100),
  scoring_id UUID,
  status TEXT DEFAULT 'received' CHECK (status IN (
    'received', 'documents_pending', 'complete', 'scoring',
    'shortlisted', 'accepted', 'rejected', 'withdrawn'
  )),
  rejection_reason TEXT,
  accepted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index
CREATE INDEX idx_applications_listing ON applications(listing_id);
CREATE INDEX idx_applications_property ON applications(property_id);
CREATE INDEX idx_applications_owner ON applications(owner_id);
CREATE INDEX idx_applications_status ON applications(status);
CREATE INDEX idx_applications_email ON applications(applicant_email);

-- RLS
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

-- Owner peut voir les candidatures pour ses biens
CREATE POLICY applications_owner_all ON applications
  FOR ALL USING (owner_id = (SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1));

-- Candidat authentifié peut voir ses propres candidatures
CREATE POLICY applications_applicant_read ON applications
  FOR SELECT USING (applicant_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1));

-- Insertion publique (candidats non authentifiés peuvent postuler)
CREATE POLICY applications_public_insert ON applications
  FOR INSERT WITH CHECK (true);

-- Trigger updated_at
CREATE TRIGGER update_applications_updated_at
  BEFORE UPDATE ON applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 3. FONCTION : Calcul automatique complétude
-- ============================================

CREATE OR REPLACE FUNCTION calculate_application_completeness()
RETURNS TRIGGER AS $$
DECLARE
  score INTEGER := 0;
  docs JSONB;
BEGIN
  docs := COALESCE(NEW.documents, '[]'::jsonb);

  -- Nom et email toujours fournis (20 points)
  score := 20;

  -- Téléphone (10 points)
  IF NEW.applicant_phone IS NOT NULL AND NEW.applicant_phone != '' THEN
    score := score + 10;
  END IF;

  -- Message / lettre de motivation (10 points)
  IF NEW.message IS NOT NULL AND length(NEW.message) > 20 THEN
    score := score + 10;
  END IF;

  -- Documents : CNI (20 points)
  IF docs @> '[{"type": "identity"}]'::jsonb THEN
    score := score + 20;
  END IF;

  -- Documents : Justificatifs de revenus (20 points)
  IF docs @> '[{"type": "income"}]'::jsonb THEN
    score := score + 20;
  END IF;

  -- Documents : Avis d'imposition (20 points)
  IF docs @> '[{"type": "tax_notice"}]'::jsonb THEN
    score := score + 20;
  END IF;

  NEW.completeness_score := LEAST(score, 100);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER applications_calculate_completeness
  BEFORE INSERT OR UPDATE OF documents, applicant_phone, message ON applications
  FOR EACH ROW EXECUTE FUNCTION calculate_application_completeness();

-- ============================================
-- 4. FONCTION : Nettoyage RGPD des candidatures refusées (> 6 mois)
-- ============================================

CREATE OR REPLACE FUNCTION cleanup_rejected_applications()
RETURNS void AS $$
BEGIN
  -- Supprimer les documents des candidatures refusées depuis plus de 6 mois
  UPDATE applications
  SET documents = '[]'::jsonb,
      applicant_phone = NULL,
      message = NULL
  WHERE status = 'rejected'
    AND rejected_at < now() - INTERVAL '6 months'
    AND documents != '[]'::jsonb;
END;
$$ LANGUAGE plpgsql;

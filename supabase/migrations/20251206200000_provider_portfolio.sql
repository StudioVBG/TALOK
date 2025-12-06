-- =====================================================
-- MIGRATION: Portfolio prestataire
-- Photos avant/après des réalisations
-- =====================================================

-- =====================================================
-- 1. TABLE: provider_portfolio_items
-- Réalisations des prestataires avec photos avant/après
-- =====================================================

CREATE TABLE IF NOT EXISTS provider_portfolio_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Source (optionnel, si issu d'une intervention)
  work_order_id UUID REFERENCES work_orders(id) ON DELETE SET NULL,
  
  -- Catégorie
  service_type TEXT NOT NULL,
  intervention_type TEXT, -- depannage, installation, renovation, entretien
  
  -- Titre et description
  title TEXT NOT NULL,
  description TEXT,
  
  -- Photos AVANT / APRÈS
  before_photo_url TEXT,
  before_photo_caption TEXT,
  after_photo_url TEXT NOT NULL,
  after_photo_caption TEXT,
  
  -- Photos supplémentaires (JSONB array)
  additional_photos JSONB DEFAULT '[]',
  -- Format: [{ "url": "...", "caption": "...", "type": "before|after|during" }]
  
  -- Contexte
  location_type TEXT CHECK (location_type IN ('appartement', 'maison', 'commerce', 'bureau', 'autre')),
  location_city TEXT,
  location_department TEXT,
  completed_at DATE,
  duration_hours DECIMAL(5,2),
  
  -- Coût (optionnel, pour référence)
  total_cost DECIMAL(10,2),
  
  -- Visibilité
  is_public BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  
  -- Modération
  moderation_status TEXT DEFAULT 'pending' CHECK (moderation_status IN (
    'pending',    -- En attente de modération
    'approved',   -- Approuvé et visible
    'rejected'    -- Rejeté
  )),
  moderated_by UUID REFERENCES auth.users(id),
  moderated_at TIMESTAMPTZ,
  rejection_reason TEXT,
  
  -- Stats
  view_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  
  -- Métadonnées
  tags TEXT[] DEFAULT '{}',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX idx_portfolio_provider ON provider_portfolio_items(provider_profile_id);
CREATE INDEX idx_portfolio_service ON provider_portfolio_items(service_type);
CREATE INDEX idx_portfolio_public ON provider_portfolio_items(is_public, moderation_status) 
  WHERE is_public = true AND moderation_status = 'approved';
CREATE INDEX idx_portfolio_featured ON provider_portfolio_items(provider_profile_id, is_featured)
  WHERE is_featured = true;
CREATE INDEX idx_portfolio_moderation ON provider_portfolio_items(moderation_status)
  WHERE moderation_status = 'pending';

-- Contrainte: max 3 items en vedette par prestataire
CREATE OR REPLACE FUNCTION check_max_featured_items()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_featured = true THEN
    IF (SELECT COUNT(*) FROM provider_portfolio_items 
        WHERE provider_profile_id = NEW.provider_profile_id 
        AND is_featured = true 
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)) >= 3 THEN
      RAISE EXCEPTION 'Maximum 3 items en vedette par prestataire';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_max_featured ON provider_portfolio_items;
CREATE TRIGGER trg_check_max_featured
  BEFORE INSERT OR UPDATE OF is_featured ON provider_portfolio_items
  FOR EACH ROW EXECUTE FUNCTION check_max_featured_items();

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_portfolio_items_updated_at ON provider_portfolio_items;
CREATE TRIGGER trg_portfolio_items_updated_at
  BEFORE UPDATE ON provider_portfolio_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 2. VUE: Portfolio public avec stats prestataire
-- =====================================================

-- Vue simplifiée sans dépendance à provider_reviews
CREATE OR REPLACE VIEW provider_portfolio_public AS
SELECT 
  ppi.*,
  p.prenom || ' ' || p.nom AS provider_name,
  pp.type_services,
  pp.certifications
FROM provider_portfolio_items ppi
JOIN profiles p ON p.id = ppi.provider_profile_id
LEFT JOIN provider_profiles pp ON pp.profile_id = ppi.provider_profile_id
WHERE ppi.is_public = true 
  AND ppi.moderation_status = 'approved';

-- =====================================================
-- 3. FONCTION: Obtenir le portfolio d'un prestataire
-- =====================================================

CREATE OR REPLACE FUNCTION get_provider_portfolio(
  p_provider_id UUID,
  p_include_private BOOLEAN DEFAULT false
)
RETURNS SETOF provider_portfolio_items
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM provider_portfolio_items
  WHERE provider_profile_id = p_provider_id
    AND (p_include_private OR (is_public = true AND moderation_status = 'approved'))
  ORDER BY is_featured DESC, display_order ASC, created_at DESC;
END;
$$;

-- =====================================================
-- 4. FONCTION: Importer depuis une intervention
-- =====================================================

CREATE OR REPLACE FUNCTION import_portfolio_from_work_order(
  p_work_order_id UUID,
  p_title TEXT,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_work_order RECORD;
  v_ticket RECORD;
  v_portfolio_id UUID;
BEGIN
  -- Récupérer les infos de l'intervention
  SELECT * INTO v_work_order 
  FROM work_orders 
  WHERE id = p_work_order_id;
  
  IF v_work_order IS NULL THEN
    RAISE EXCEPTION 'Work order non trouvé';
  END IF;
  
  -- Récupérer le ticket associé
  SELECT t.*, p.type AS property_type, p.ville, p.code_postal
  INTO v_ticket
  FROM tickets t
  JOIN properties p ON p.id = t.property_id
  WHERE t.id = v_work_order.ticket_id;
  
  -- Créer l'item de portfolio
  INSERT INTO provider_portfolio_items (
    provider_profile_id,
    work_order_id,
    service_type,
    title,
    description,
    before_photo_url,
    after_photo_url,
    location_type,
    location_city,
    completed_at,
    total_cost
  ) VALUES (
    v_work_order.provider_id,
    p_work_order_id,
    COALESCE(v_ticket.categorie, 'autre'),
    p_title,
    COALESCE(p_description, v_work_order.completion_report),
    (v_work_order.before_photos->0->>'url')::TEXT,
    (v_work_order.after_photos->0->>'url')::TEXT,
    v_ticket.property_type,
    v_ticket.ville,
    v_work_order.work_completed_at::DATE,
    v_work_order.cout_final
  )
  RETURNING id INTO v_portfolio_id;
  
  RETURN v_portfolio_id;
END;
$$;

-- =====================================================
-- 5. RLS POLICIES
-- =====================================================

ALTER TABLE provider_portfolio_items ENABLE ROW LEVEL SECURITY;

-- Tout le monde peut voir les portfolios publics approuvés
DROP POLICY IF EXISTS "Anyone can view public portfolios" ON provider_portfolio_items;
CREATE POLICY "Anyone can view public portfolios"
  ON provider_portfolio_items FOR SELECT
  USING (is_public = true AND moderation_status = 'approved');

-- Les prestataires peuvent gérer leur propre portfolio
DROP POLICY IF EXISTS "Providers can manage own portfolio" ON provider_portfolio_items;
CREATE POLICY "Providers can manage own portfolio"
  ON provider_portfolio_items FOR ALL
  USING (
    provider_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    provider_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Les admins peuvent tout voir et modérer
DROP POLICY IF EXISTS "Admins can manage all portfolios" ON provider_portfolio_items;
CREATE POLICY "Admins can manage all portfolios"
  ON provider_portfolio_items FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- =====================================================
-- 6. COMMENTAIRES
-- =====================================================

COMMENT ON TABLE provider_portfolio_items IS 'Portfolio des réalisations prestataires avec photos avant/après';
COMMENT ON FUNCTION get_provider_portfolio IS 'Récupère le portfolio d''un prestataire (public ou complet)';
COMMENT ON FUNCTION import_portfolio_from_work_order IS 'Importe une intervention terminée dans le portfolio';


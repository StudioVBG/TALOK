-- =====================================================
-- MIGRATION CONSOLIDÉE : Toutes les tables et fonctions manquantes
-- Résout les erreurs API 500 du module prestataire et notifications
-- =====================================================

-- =====================================================
-- 1. TABLE NOTIFICATIONS - Adaptation pour profile_id
-- =====================================================

-- Créer la table si elle n'existe pas
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  link TEXT,
  data JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  related_id UUID,
  related_type TEXT,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  action_url TEXT,
  action_label TEXT,
  channels_status JSONB DEFAULT '{"in_app": "pending"}',
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ajouter les colonnes manquantes si la table existe
DO $$
BEGIN
  -- Ajouter profile_id si n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' AND column_name = 'profile_id'
  ) THEN
    ALTER TABLE notifications ADD COLUMN profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
  
  -- Ajouter is_read si n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' AND column_name = 'is_read'
  ) THEN
    ALTER TABLE notifications ADD COLUMN is_read BOOLEAN DEFAULT false;
  END IF;
  
  -- Ajouter priority si n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' AND column_name = 'priority'
  ) THEN
    ALTER TABLE notifications ADD COLUMN priority TEXT DEFAULT 'normal';
  END IF;
  
  -- Ajouter action_url si n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' AND column_name = 'action_url'
  ) THEN
    ALTER TABLE notifications ADD COLUMN action_url TEXT;
  END IF;
  
  -- Ajouter action_label si n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' AND column_name = 'action_label'
  ) THEN
    ALTER TABLE notifications ADD COLUMN action_label TEXT;
  END IF;
END $$;

-- Index pour notifications
CREATE INDEX IF NOT EXISTS idx_notifications_profile_id ON notifications(profile_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- RLS pour notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications by profile" ON notifications;
CREATE POLICY "Users can view own notifications by profile"
  ON notifications FOR SELECT
  USING (
    profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (
    profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "System can insert notifications" ON notifications;
CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

-- =====================================================
-- 2. FONCTIONS RPC NOTIFICATIONS
-- =====================================================

-- Fonction pour récupérer les notifications récentes
CREATE OR REPLACE FUNCTION get_recent_notifications(
  p_profile_id UUID,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0,
  p_unread_only BOOLEAN DEFAULT false
)
RETURNS TABLE (
  id UUID,
  type TEXT,
  title TEXT,
  message TEXT,
  link TEXT,
  data JSONB,
  is_read BOOLEAN,
  read_at TIMESTAMPTZ,
  priority TEXT,
  action_url TEXT,
  action_label TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    n.id,
    n.type,
    n.title,
    n.message,
    n.link,
    n.data,
    COALESCE(n.is_read, false),
    n.read_at,
    COALESCE(n.priority, 'normal'),
    n.action_url,
    n.action_label,
    n.created_at
  FROM notifications n
  WHERE n.profile_id = p_profile_id
    AND (NOT p_unread_only OR COALESCE(n.is_read, false) = false)
  ORDER BY n.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Fonction pour compter les notifications non lues
CREATE OR REPLACE FUNCTION get_unread_notification_count(p_profile_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER INTO v_count
  FROM notifications
  WHERE profile_id = p_profile_id
    AND COALESCE(is_read, false) = false;
  
  RETURN COALESCE(v_count, 0);
END;
$$;

-- Fonction pour marquer une notification comme lue
CREATE OR REPLACE FUNCTION mark_notification_read(p_notification_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE notifications
  SET is_read = true, read_at = NOW(), updated_at = NOW()
  WHERE id = p_notification_id
    AND profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid());
  
  RETURN FOUND;
END;
$$;

-- Fonction pour marquer toutes les notifications comme lues
CREATE OR REPLACE FUNCTION mark_all_notifications_read(p_profile_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH updated AS (
    UPDATE notifications
    SET is_read = true, read_at = NOW(), updated_at = NOW()
    WHERE profile_id = p_profile_id
      AND COALESCE(is_read, false) = false
    RETURNING id
  )
  SELECT COUNT(*)::INTEGER INTO v_count FROM updated;
  
  RETURN COALESCE(v_count, 0);
END;
$$;

-- =====================================================
-- 3. TABLES PRESTATAIRE - DEVIS
-- =====================================================

-- Table provider_quotes
CREATE TABLE IF NOT EXISTS provider_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT UNIQUE,
  provider_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  owner_profile_id UUID REFERENCES profiles(id),
  property_id UUID REFERENCES properties(id),
  ticket_id UUID REFERENCES tickets(id),
  title TEXT NOT NULL,
  description TEXT,
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  tax_rate DECIMAL(5,2) NOT NULL DEFAULT 20,
  tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  valid_until DATE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired', 'converted')),
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  converted_invoice_id UUID,
  internal_notes TEXT,
  terms_and_conditions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour provider_quotes
CREATE INDEX IF NOT EXISTS idx_provider_quotes_provider ON provider_quotes(provider_profile_id);
CREATE INDEX IF NOT EXISTS idx_provider_quotes_owner ON provider_quotes(owner_profile_id);
CREATE INDEX IF NOT EXISTS idx_provider_quotes_status ON provider_quotes(status);

-- RLS pour provider_quotes
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

-- Table provider_quote_items
CREATE TABLE IF NOT EXISTS provider_quote_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES provider_quotes(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity DECIMAL(10,3) NOT NULL DEFAULT 1,
  unit TEXT DEFAULT 'unité',
  unit_price DECIMAL(10,2) NOT NULL,
  tax_rate DECIMAL(5,2) NOT NULL DEFAULT 20,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour provider_quote_items
CREATE INDEX IF NOT EXISTS idx_provider_quote_items_quote ON provider_quote_items(quote_id);

-- RLS pour provider_quote_items
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
-- 4. TABLES PRESTATAIRE - FACTURES
-- =====================================================

CREATE TABLE IF NOT EXISTS provider_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT UNIQUE,
  provider_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  owner_profile_id UUID REFERENCES profiles(id),
  property_id UUID REFERENCES properties(id),
  work_order_id UUID REFERENCES work_orders(id),
  quote_id UUID REFERENCES provider_quotes(id),
  title TEXT NOT NULL,
  description TEXT,
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  tax_rate DECIMAL(5,2) NOT NULL DEFAULT 20,
  tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'paid', 'partial', 'overdue', 'cancelled')),
  due_date DATE,
  paid_at TIMESTAMPTZ,
  paid_amount DECIMAL(10,2) DEFAULT 0,
  payment_method TEXT,
  payment_reference TEXT,
  sent_at TIMESTAMPTZ,
  internal_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour provider_invoices
CREATE INDEX IF NOT EXISTS idx_provider_invoices_provider ON provider_invoices(provider_profile_id);
CREATE INDEX IF NOT EXISTS idx_provider_invoices_owner ON provider_invoices(owner_profile_id);
CREATE INDEX IF NOT EXISTS idx_provider_invoices_status ON provider_invoices(status);

-- RLS pour provider_invoices
ALTER TABLE provider_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Providers can manage own invoices" ON provider_invoices;
CREATE POLICY "Providers can manage own invoices"
  ON provider_invoices FOR ALL
  USING (provider_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
  WITH CHECK (provider_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Owners can view invoices addressed to them" ON provider_invoices;
CREATE POLICY "Owners can view invoices addressed to them"
  ON provider_invoices FOR SELECT
  USING (owner_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- =====================================================
-- 5. TABLES PRESTATAIRE - AVIS
-- =====================================================

CREATE TABLE IF NOT EXISTS provider_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reviewer_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  work_order_id UUID REFERENCES work_orders(id) ON DELETE SET NULL,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  rating_overall INTEGER NOT NULL CHECK (rating_overall BETWEEN 1 AND 5),
  rating_punctuality INTEGER CHECK (rating_punctuality BETWEEN 1 AND 5),
  rating_quality INTEGER CHECK (rating_quality BETWEEN 1 AND 5),
  rating_communication INTEGER CHECK (rating_communication BETWEEN 1 AND 5),
  rating_value INTEGER CHECK (rating_value BETWEEN 1 AND 5),
  title TEXT,
  comment TEXT,
  would_recommend BOOLEAN DEFAULT true,
  provider_response TEXT,
  provider_response_at TIMESTAMPTZ,
  is_published BOOLEAN DEFAULT true,
  is_flagged BOOLEAN DEFAULT false,
  flag_reason TEXT,
  moderated_at TIMESTAMPTZ,
  moderated_by UUID REFERENCES profiles(id),
  helpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour provider_reviews
CREATE INDEX IF NOT EXISTS idx_provider_reviews_provider ON provider_reviews(provider_profile_id);
CREATE INDEX IF NOT EXISTS idx_provider_reviews_reviewer ON provider_reviews(reviewer_profile_id);
CREATE INDEX IF NOT EXISTS idx_provider_reviews_published ON provider_reviews(is_published) WHERE is_published = true;

-- RLS pour provider_reviews
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

-- =====================================================
-- 6. FONCTION RPC DASHBOARD PRESTATAIRE
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
  v_provider_info JSONB;
BEGIN
  -- Récupérer le profil prestataire
  SELECT id INTO v_profile_id
  FROM profiles
  WHERE user_id = p_user_id AND role = 'provider';
  
  IF v_profile_id IS NULL THEN
    -- Retourner un objet vide si pas de profil prestataire
    RETURN jsonb_build_object(
      'error', 'Profil prestataire non trouvé',
      'profile_id', NULL
    );
  END IF;
  
  -- Informations du profil prestataire
  SELECT jsonb_build_object(
    'status', COALESCE(pp.status, 'pending'),
    'kyc_status', COALESCE(pp.kyc_status, 'incomplete'),
    'compliance_score', COALESCE(pp.compliance_score, 0),
    'type_services', COALESCE(pp.type_services, ARRAY[]::TEXT[]),
    'raison_sociale', pp.raison_sociale
  ) INTO v_provider_info
  FROM provider_profiles pp
  WHERE pp.profile_id = v_profile_id;
  
  -- Statistiques des work_orders
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
  
  -- Si pas de stats, créer des valeurs par défaut
  IF v_stats IS NULL THEN
    v_stats := jsonb_build_object(
      'total_interventions', 0,
      'completed_interventions', 0,
      'pending_interventions', 0,
      'in_progress_interventions', 0,
      'total_revenue', 0,
      'avg_rating', NULL,
      'total_reviews', 0
    );
  END IF;
  
  -- Interventions en attente
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
      'ticket', CASE WHEN t.id IS NOT NULL THEN jsonb_build_object(
        'titre', t.titre,
        'priorite', t.priorite
      ) ELSE NULL END,
      'property', CASE WHEN p.id IS NOT NULL THEN jsonb_build_object(
        'adresse', p.adresse_complete,
        'ville', p.ville
      ) ELSE NULL END
    ) as order_data
    FROM work_orders wo
    LEFT JOIN tickets t ON t.id = wo.ticket_id
    LEFT JOIN properties p ON p.id = t.property_id
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
        'prenom', COALESCE(prof.prenom, 'Utilisateur'),
        'nom', CASE WHEN prof.nom IS NOT NULL THEN LEFT(prof.nom, 1) || '.' ELSE '' END
      )
    ) as review_data
    FROM provider_reviews pr
    LEFT JOIN profiles prof ON prof.id = pr.reviewer_profile_id
    WHERE pr.provider_profile_id = v_profile_id
    AND pr.is_published = true
    ORDER BY pr.created_at DESC
    LIMIT 5
  ) sub;
  
  -- Construire le résultat final
  v_result := jsonb_build_object(
    'profile_id', v_profile_id,
    'provider', COALESCE(v_provider_info, jsonb_build_object('status', 'pending', 'kyc_status', 'incomplete', 'compliance_score', 0)),
    'stats', v_stats,
    'pending_orders', COALESCE(v_pending_orders, '[]'::jsonb),
    'recent_reviews', COALESCE(v_recent_reviews, '[]'::jsonb)
  );
  
  RETURN v_result;
END;
$$;

-- =====================================================
-- 7. FONCTIONS UTILITAIRES
-- =====================================================

-- Génération numéro de devis
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

-- Génération numéro de facture
CREATE OR REPLACE FUNCTION generate_invoice_reference(p_provider_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_year INTEGER;
  v_count INTEGER;
BEGIN
  v_year := EXTRACT(YEAR FROM CURRENT_DATE);
  
  SELECT COUNT(*) + 1 INTO v_count
  FROM provider_invoices
  WHERE provider_profile_id = p_provider_id
  AND EXTRACT(YEAR FROM created_at) = v_year;
  
  RETURN 'FAC-' || v_year || '-' || LPAD(v_count::TEXT, 4, '0');
END;
$$;

-- Trigger pour générer automatiquement la référence des devis
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

-- Trigger pour générer automatiquement la référence des factures
CREATE OR REPLACE FUNCTION trigger_generate_invoice_reference()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.reference IS NULL THEN
    NEW.reference := generate_invoice_reference(NEW.provider_profile_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_invoice_reference ON provider_invoices;
CREATE TRIGGER trg_generate_invoice_reference
  BEFORE INSERT ON provider_invoices
  FOR EACH ROW EXECUTE FUNCTION trigger_generate_invoice_reference();

-- =====================================================
-- 8. TRIGGER: Calcul automatique des totaux de devis
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_quote_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_subtotal DECIMAL(10,2);
  v_tax_amount DECIMAL(10,2);
  v_quote_id UUID;
BEGIN
  v_quote_id := COALESCE(NEW.quote_id, OLD.quote_id);
  
  SELECT 
    COALESCE(SUM(quantity * unit_price), 0),
    COALESCE(SUM(quantity * unit_price * tax_rate / 100), 0)
  INTO v_subtotal, v_tax_amount
  FROM provider_quote_items
  WHERE quote_id = v_quote_id;
  
  UPDATE provider_quotes
  SET 
    subtotal = v_subtotal,
    tax_amount = v_tax_amount,
    total_amount = v_subtotal + v_tax_amount,
    updated_at = NOW()
  WHERE id = v_quote_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calculate_quote_totals ON provider_quote_items;
CREATE TRIGGER trg_calculate_quote_totals
  AFTER INSERT OR UPDATE OR DELETE ON provider_quote_items
  FOR EACH ROW EXECUTE FUNCTION calculate_quote_totals();

-- =====================================================
-- 9. ASSURER QUE work_orders A provider_id
-- =====================================================

DO $$
BEGIN
  -- Vérifier si la colonne provider_id existe dans work_orders
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'work_orders' AND column_name = 'provider_id'
  ) THEN
    ALTER TABLE work_orders ADD COLUMN provider_id UUID REFERENCES profiles(id);
    CREATE INDEX IF NOT EXISTS idx_work_orders_provider ON work_orders(provider_id);
  END IF;
END $$;

-- =====================================================
-- 10. COMMENTAIRES
-- =====================================================

COMMENT ON TABLE notifications IS 'Notifications utilisateurs centralisées';
COMMENT ON TABLE provider_quotes IS 'Devis des prestataires';
COMMENT ON TABLE provider_quote_items IS 'Lignes de devis prestataires';
COMMENT ON TABLE provider_invoices IS 'Factures des prestataires';
COMMENT ON TABLE provider_reviews IS 'Avis clients sur les prestataires';
COMMENT ON FUNCTION provider_dashboard IS 'Dashboard principal du prestataire avec stats et interventions';
COMMENT ON FUNCTION get_recent_notifications IS 'Récupère les notifications récentes d''un profil';
COMMENT ON FUNCTION get_unread_notification_count IS 'Compte les notifications non lues';

-- =====================================================
-- FIN DE LA MIGRATION
-- =====================================================
SELECT 'Migration tables/fonctions manquantes appliquée avec succès!' as result;


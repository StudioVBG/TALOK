-- =====================================================
-- MIGRATION: Modules Prestataire et Locataire complets
-- =====================================================

-- =====================================================
-- 1. TABLE: provider_services (Services des prestataires)
-- =====================================================
CREATE TABLE IF NOT EXISTS provider_services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Service
  service_type TEXT NOT NULL CHECK (service_type IN (
    'plomberie', 'electricite', 'chauffage', 'climatisation',
    'serrurerie', 'vitrerie', 'menuiserie', 'peinture',
    'nettoyage', 'jardinage', 'elagage', 'demenagement',
    'debarras', 'depannage_urgence', 'renovation', 'isolation',
    'diagnostic', 'autre'
  )),
  
  -- Description
  description TEXT,
  
  -- Tarification
  tarif_type TEXT CHECK (tarif_type IN ('horaire', 'forfait', 'devis')),
  tarif_min DECIMAL(10,2),
  tarif_max DECIMAL(10,2),
  
  -- Disponibilité
  is_available BOOLEAN DEFAULT true,
  disponibilite_urgence BOOLEAN DEFAULT false,
  
  -- Métadonnées
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_provider_services_provider ON provider_services(provider_profile_id);
CREATE INDEX IF NOT EXISTS idx_provider_services_type ON provider_services(service_type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_services_unique ON provider_services(provider_profile_id, service_type);

-- =====================================================
-- 2. TABLE: provider_availability (Disponibilités)
-- =====================================================
CREATE TABLE IF NOT EXISTS provider_availability (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Jour et horaires
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Dimanche
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  
  is_available BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(provider_profile_id, day_of_week)
);

-- =====================================================
-- 3. TABLE: provider_reviews (Avis sur les prestataires)
-- =====================================================
CREATE TABLE IF NOT EXISTS provider_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reviewer_profile_id UUID NOT NULL REFERENCES profiles(id),
  work_order_id UUID REFERENCES work_orders(id),
  
  -- Notes
  rating_overall INTEGER NOT NULL CHECK (rating_overall BETWEEN 1 AND 5),
  rating_quality INTEGER CHECK (rating_quality BETWEEN 1 AND 5),
  rating_punctuality INTEGER CHECK (rating_punctuality BETWEEN 1 AND 5),
  rating_communication INTEGER CHECK (rating_communication BETWEEN 1 AND 5),
  rating_price INTEGER CHECK (rating_price BETWEEN 1 AND 5),
  
  -- Commentaire
  comment TEXT,
  
  -- Réponse du prestataire
  provider_response TEXT,
  provider_responded_at TIMESTAMPTZ,
  
  -- Modération
  is_published BOOLEAN DEFAULT true,
  moderation_status TEXT DEFAULT 'pending' CHECK (moderation_status IN (
    'pending', 'approved', 'rejected'
  )),
  moderation_reason TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(work_order_id) -- Un avis par intervention
);

-- Index
CREATE INDEX IF NOT EXISTS idx_provider_reviews_provider ON provider_reviews(provider_profile_id);
CREATE INDEX IF NOT EXISTS idx_provider_reviews_rating ON provider_reviews(rating_overall);

-- =====================================================
-- 4. TABLE: tenant_payment_history (Historique paiements locataire)
-- =====================================================
CREATE TABLE IF NOT EXISTS tenant_payment_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lease_id UUID NOT NULL REFERENCES leases(id),
  
  -- Statistiques de paiement
  month_year TEXT NOT NULL, -- Format YYYY-MM
  
  amount_due DECIMAL(10,2) NOT NULL,
  amount_paid DECIMAL(10,2) NOT NULL DEFAULT 0,
  
  due_date DATE NOT NULL,
  payment_date DATE,
  
  days_late INTEGER GENERATED ALWAYS AS (
    CASE 
      WHEN payment_date IS NOT NULL THEN 
        GREATEST(0, payment_date - due_date)
      ELSE 
        GREATEST(0, CURRENT_DATE - due_date)
    END
  ) STORED,
  
  status TEXT NOT NULL CHECK (status IN (
    'pending', 'partial', 'paid', 'late', 'very_late'
  )),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(tenant_profile_id, lease_id, month_year)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_tenant_payment_history_tenant ON tenant_payment_history(tenant_profile_id);
CREATE INDEX IF NOT EXISTS idx_tenant_payment_history_status ON tenant_payment_history(status);

-- =====================================================
-- 5. FONCTIONS
-- =====================================================

-- Fonction: Dashboard Prestataire
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
  v_upcoming_orders JSONB;
  v_recent_reviews JSONB;
BEGIN
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
    AND wo.statut IN ('assigned', 'scheduled')
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
    LIMIT 5
  ) sub;
  
  v_result := jsonb_build_object(
    'profile_id', v_profile_id,
    'stats', v_stats,
    'pending_orders', v_pending_orders,
    'recent_reviews', v_recent_reviews
  );
  
  RETURN v_result;
END;
$$;

-- Fonction: Dashboard Locataire (compléter)
CREATE OR REPLACE FUNCTION tenant_dashboard_v2(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile_id UUID;
  v_result JSONB;
  v_leases JSONB;
  v_pending_payments JSONB;
  v_active_tickets JSONB;
  v_payment_stats JSONB;
BEGIN
  SELECT id INTO v_profile_id
  FROM profiles
  WHERE user_id = p_user_id AND role = 'tenant';
  
  IF v_profile_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Baux actifs avec détails
  SELECT COALESCE(jsonb_agg(lease_data), '[]'::jsonb)
  INTO v_leases
  FROM (
    SELECT jsonb_build_object(
      'id', l.id,
      'loyer', l.loyer,
      'charges', l.charges_forfaitaires,
      'date_debut', l.date_debut,
      'date_fin', l.date_fin,
      'statut', l.statut,
      'property', jsonb_build_object(
        'id', p.id,
        'adresse', p.adresse_complete,
        'ville', p.ville,
        'type', p.type
      ),
      'owner', jsonb_build_object(
        'prenom', owner.prenom,
        'nom', owner.nom
      ),
      'next_payment', (
        SELECT jsonb_build_object(
          'amount', sp.amount,
          'date', sp.scheduled_date
        )
        FROM scheduled_payments sp
        JOIN payment_schedules ps ON ps.id = sp.schedule_id
        WHERE ps.lease_id = l.id
        AND sp.status = 'pending'
        ORDER BY sp.scheduled_date
        LIMIT 1
      )
    ) as lease_data
    FROM lease_signers ls
    JOIN leases l ON l.id = ls.lease_id
    JOIN properties p ON p.id = l.property_id
    JOIN profiles owner ON owner.id = p.owner_id
    WHERE ls.profile_id = v_profile_id
    AND ls.role IN ('locataire_principal', 'colocataire')
    AND l.statut = 'active'
  ) sub;
  
  -- Paiements en attente
  SELECT COALESCE(jsonb_agg(payment_data ORDER BY payment_data->>'periode'), '[]'::jsonb)
  INTO v_pending_payments
  FROM (
    SELECT jsonb_build_object(
      'id', i.id,
      'periode', i.periode,
      'montant_total', i.montant_total,
      'statut', i.statut,
      'property_adresse', p.adresse_complete
    ) as payment_data
    FROM invoices i
    JOIN leases l ON l.id = i.lease_id
    JOIN properties p ON p.id = l.property_id
    WHERE i.tenant_id = v_profile_id
    AND i.statut IN ('sent', 'late')
    LIMIT 5
  ) sub;
  
  -- Tickets actifs
  SELECT COALESCE(jsonb_agg(ticket_data ORDER BY ticket_data->>'created_at' DESC), '[]'::jsonb)
  INTO v_active_tickets
  FROM (
    SELECT jsonb_build_object(
      'id', t.id,
      'titre', t.titre,
      'statut', t.statut,
      'priorite', t.priorite,
      'created_at', t.created_at,
      'property_adresse', p.adresse_complete
    ) as ticket_data
    FROM tickets t
    JOIN properties p ON p.id = t.property_id
    WHERE t.created_by_profile_id = v_profile_id
    AND t.statut NOT IN ('resolved', 'closed')
    LIMIT 5
  ) sub;
  
  -- Statistiques de paiement
  SELECT jsonb_build_object(
    'total_payments', COUNT(*),
    'on_time_payments', COUNT(*) FILTER (WHERE days_late = 0),
    'late_payments', COUNT(*) FILTER (WHERE days_late > 0),
    'avg_days_late', ROUND(AVG(days_late) FILTER (WHERE days_late > 0))
  ) INTO v_payment_stats
  FROM tenant_payment_history
  WHERE tenant_profile_id = v_profile_id;
  
  v_result := jsonb_build_object(
    'profile_id', v_profile_id,
    'leases', v_leases,
    'pending_payments', v_pending_payments,
    'active_tickets', v_active_tickets,
    'payment_stats', v_payment_stats
  );
  
  RETURN v_result;
END;
$$;

-- =====================================================
-- 6. RLS POLICIES
-- =====================================================

ALTER TABLE provider_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_payment_history ENABLE ROW LEVEL SECURITY;

-- Policies provider_services
CREATE POLICY "Prestataires peuvent gérer leurs services"
  ON provider_services FOR ALL
  USING (provider_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Tout le monde peut voir les services des prestataires"
  ON provider_services FOR SELECT
  USING (is_available = true);

-- Policies provider_availability
CREATE POLICY "Prestataires peuvent gérer leurs disponibilités"
  ON provider_availability FOR ALL
  USING (provider_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Propriétaires peuvent voir les disponibilités"
  ON provider_availability FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'owner'));

-- Policies provider_reviews
CREATE POLICY "Propriétaires peuvent créer des avis"
  ON provider_reviews FOR INSERT
  WITH CHECK (reviewer_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Prestataires peuvent répondre à leurs avis"
  ON provider_reviews FOR UPDATE
  USING (provider_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
  WITH CHECK (provider_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Avis publiés visibles par tous"
  ON provider_reviews FOR SELECT
  USING (is_published = true OR provider_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Policies tenant_payment_history
CREATE POLICY "Locataires peuvent voir leur historique"
  ON tenant_payment_history FOR SELECT
  USING (tenant_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Propriétaires peuvent voir l'historique de leurs locataires"
  ON tenant_payment_history FOR SELECT
  USING (
    lease_id IN (
      SELECT l.id FROM leases l
      JOIN properties p ON p.id = l.property_id
      WHERE p.owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- =====================================================
-- 7. TRIGGERS
-- =====================================================

CREATE TRIGGER trg_provider_services_updated_at
  BEFORE UPDATE ON provider_services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_provider_availability_updated_at
  BEFORE UPDATE ON provider_availability
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_provider_reviews_updated_at
  BEFORE UPDATE ON provider_reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 8. COMMENTAIRES
-- =====================================================
COMMENT ON TABLE provider_services IS 'Services proposés par les prestataires';
COMMENT ON TABLE provider_availability IS 'Disponibilités hebdomadaires des prestataires';
COMMENT ON TABLE provider_reviews IS 'Avis et notes sur les prestataires';
COMMENT ON TABLE tenant_payment_history IS 'Historique des paiements par locataire';








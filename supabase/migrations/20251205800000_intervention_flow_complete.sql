-- =====================================================
-- MIGRATION: Flux Intervention Complet SOTA 2025
-- Cycle: Visite → Devis → Acompte → Travaux → Solde
-- Frais transparents: 2.4% + 0.75€ (payés par prestataire)
-- =====================================================

-- =====================================================
-- 1. EXTENSION: work_orders - Nouveaux statuts
-- =====================================================

-- Supprimer l'ancienne contrainte
ALTER TABLE work_orders 
  DROP CONSTRAINT IF EXISTS work_orders_statut_check;

-- Ajouter les nouveaux statuts
ALTER TABLE work_orders 
  ADD CONSTRAINT work_orders_statut_check 
  CHECK (statut IN (
    -- Flux initial
    'assigned',           -- Assigné, en attente acceptation prestataire
    'accepted',           -- Accepté, en attente prise de RDV visite
    'refused',            -- Refusé par le prestataire
    
    -- Phase visite
    'visit_scheduled',    -- RDV visite planifié
    'visit_completed',    -- Visite effectuée, en attente devis
    
    -- Phase devis
    'quote_sent',         -- Devis envoyé
    'quote_accepted',     -- Devis accepté, en attente acompte
    'quote_refused',      -- Devis refusé
    
    -- Phase paiement acompte
    'deposit_pending',    -- Acompte en attente de paiement
    'deposit_paid',       -- Acompte payé (2/3), fonds en escrow
    
    -- Phase travaux
    'work_scheduled',     -- Travaux planifiés
    'in_progress',        -- Travaux en cours
    'work_completed',     -- Travaux terminés
    
    -- Phase solde
    'balance_pending',    -- Solde en attente de paiement
    'fully_paid',         -- Entièrement payé
    
    -- Clôture
    'pending_review',     -- En attente d'avis
    'closed',             -- Clôturé
    
    -- Cas particuliers
    'cancelled',          -- Annulé
    'disputed'            -- Litige en cours
  ));

-- Nouveaux champs pour le flux complet
ALTER TABLE work_orders
  -- Dates clés
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refused_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refusal_reason TEXT,
  ADD COLUMN IF NOT EXISTS visit_scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS visit_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS visit_notes TEXT,
  ADD COLUMN IF NOT EXISTS work_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS work_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completion_report TEXT,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  
  -- Lien avec le devis accepté
  ADD COLUMN IF NOT EXISTS accepted_quote_id UUID,
  
  -- Photos
  ADD COLUMN IF NOT EXISTS visit_photos JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS before_photos JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS after_photos JSONB DEFAULT '[]';

-- =====================================================
-- 2. TABLE: payment_fee_config
-- Configuration des frais de paiement
-- =====================================================

CREATE TABLE IF NOT EXISTS payment_fee_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Identifiant unique de la config
  config_key TEXT UNIQUE NOT NULL DEFAULT 'default',
  
  -- Frais Stripe (incompressibles)
  stripe_percent DECIMAL(5,4) NOT NULL DEFAULT 0.014,    -- 1.4%
  stripe_fixed DECIMAL(10,2) NOT NULL DEFAULT 0.25,      -- 0.25€
  
  -- Marge plateforme
  platform_percent DECIMAL(5,4) NOT NULL DEFAULT 0.01,   -- 1.0%
  platform_fixed DECIMAL(10,2) NOT NULL DEFAULT 0.50,    -- 0.50€
  
  -- Qui paie les frais
  fee_payer TEXT NOT NULL DEFAULT 'provider' CHECK (fee_payer IN ('provider', 'owner', 'split')),
  
  -- Acompte
  deposit_percent DECIMAL(5,2) NOT NULL DEFAULT 66.67,   -- 2/3
  
  -- Actif
  is_active BOOLEAN DEFAULT true,
  
  -- Dates
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_until DATE,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insérer la configuration par défaut
INSERT INTO payment_fee_config (config_key, stripe_percent, stripe_fixed, platform_percent, platform_fixed, fee_payer, deposit_percent)
VALUES ('default', 0.014, 0.25, 0.01, 0.50, 'provider', 66.67)
ON CONFLICT (config_key) DO NOTHING;

-- =====================================================
-- 3. TABLE: work_order_payments
-- Paiements d'intervention (acompte + solde)
-- =====================================================

CREATE TABLE IF NOT EXISTS work_order_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Relations
  work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  quote_id UUID REFERENCES provider_quotes(id),
  payer_profile_id UUID NOT NULL REFERENCES profiles(id),       -- Propriétaire qui paie
  payee_profile_id UUID NOT NULL REFERENCES profiles(id),       -- Prestataire qui reçoit
  
  -- Type de paiement
  payment_type TEXT NOT NULL CHECK (payment_type IN (
    'deposit',     -- Acompte (2/3)
    'balance',     -- Solde (1/3)
    'full',        -- Paiement intégral
    'refund'       -- Remboursement
  )),
  
  -- Montants bruts
  gross_amount DECIMAL(10,2) NOT NULL CHECK (gross_amount > 0),  -- Montant payé par propriétaire
  percentage_of_total DECIMAL(5,2),                               -- 66.67 ou 33.33
  
  -- Frais détaillés
  stripe_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
  platform_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_fees DECIMAL(10,2) NOT NULL DEFAULT 0,
  
  -- Montant net pour le prestataire
  net_amount DECIMAL(10,2) NOT NULL,
  
  -- Méthode de paiement
  payment_method TEXT CHECK (payment_method IN ('card', 'sepa_debit', 'bank_transfer', 'direct')),
  
  -- Stripe
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,
  stripe_transfer_id TEXT,          -- Transfer vers le compte Connect du prestataire
  
  -- Escrow (séquestre)
  escrow_status TEXT DEFAULT 'none' CHECK (escrow_status IN (
    'none',       -- Pas d'escrow (paiement direct)
    'pending',    -- En attente de paiement
    'held',       -- Fonds bloqués sur la plateforme
    'released',   -- Libéré vers prestataire
    'refunded',   -- Remboursé au propriétaire
    'disputed'    -- En litige
  )),
  escrow_held_at TIMESTAMPTZ,
  escrow_released_at TIMESTAMPTZ,
  escrow_release_reason TEXT,
  
  -- Statut global
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',      -- En attente
    'processing',   -- En cours de traitement
    'succeeded',    -- Réussi
    'failed',       -- Échoué
    'cancelled',    -- Annulé
    'refunded',     -- Remboursé
    'disputed'      -- Contesté
  )),
  
  -- Dates
  initiated_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT,
  failure_code TEXT,
  
  -- Facture de frais générée
  fee_invoice_id UUID,
  
  -- Métadonnées
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_wo_payments_work_order ON work_order_payments(work_order_id);
CREATE INDEX IF NOT EXISTS idx_wo_payments_payer ON work_order_payments(payer_profile_id);
CREATE INDEX IF NOT EXISTS idx_wo_payments_payee ON work_order_payments(payee_profile_id);
CREATE INDEX IF NOT EXISTS idx_wo_payments_status ON work_order_payments(status);
CREATE INDEX IF NOT EXISTS idx_wo_payments_escrow ON work_order_payments(escrow_status);
CREATE INDEX IF NOT EXISTS idx_wo_payments_type ON work_order_payments(payment_type);
CREATE INDEX IF NOT EXISTS idx_wo_payments_stripe ON work_order_payments(stripe_payment_intent_id);

-- =====================================================
-- 4. TABLE: work_order_timeline
-- Historique complet des étapes
-- =====================================================

CREATE TABLE IF NOT EXISTS work_order_timeline (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  
  -- Événement
  event_type TEXT NOT NULL CHECK (event_type IN (
    -- Création et assignation
    'created', 'assigned', 'accepted', 'refused',
    
    -- Visite
    'visit_proposed', 'visit_scheduled', 'visit_rescheduled', 'visit_completed', 'visit_cancelled',
    
    -- Devis
    'quote_created', 'quote_sent', 'quote_viewed', 'quote_accepted', 'quote_refused', 'quote_expired',
    
    -- Paiements
    'deposit_requested', 'deposit_paid', 'deposit_failed',
    'balance_requested', 'balance_paid', 'balance_failed',
    'payment_refunded',
    
    -- Travaux
    'work_scheduled', 'work_started', 'work_paused', 'work_resumed', 'work_completed',
    
    -- Clôture
    'review_requested', 'review_submitted', 'review_responded',
    'closed',
    
    -- Incidents
    'cancelled', 'dispute_opened', 'dispute_resolved',
    
    -- Communication
    'message_sent', 'photo_added', 'document_added',
    
    -- Système
    'reminder_sent', 'status_changed', 'auto_action'
  )),
  
  -- Acteur
  actor_profile_id UUID REFERENCES profiles(id),
  actor_role TEXT CHECK (actor_role IN ('owner', 'provider', 'tenant', 'admin', 'system')),
  
  -- Changement de statut
  old_status TEXT,
  new_status TEXT,
  
  -- Données de l'événement
  event_data JSONB DEFAULT '{}',
  
  -- Commentaire/description
  description TEXT,
  
  -- Visibilité
  is_internal BOOLEAN DEFAULT false,  -- Si true, visible uniquement par admin
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_wo_timeline_work_order ON work_order_timeline(work_order_id);
CREATE INDEX IF NOT EXISTS idx_wo_timeline_event ON work_order_timeline(event_type);
CREATE INDEX IF NOT EXISTS idx_wo_timeline_created ON work_order_timeline(created_at);
CREATE INDEX IF NOT EXISTS idx_wo_timeline_actor ON work_order_timeline(actor_profile_id);

-- =====================================================
-- 5. FONCTION: Calcul des frais de paiement
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_payment_fees(
  p_amount DECIMAL(10,2),
  p_config_key TEXT DEFAULT 'default'
)
RETURNS TABLE (
  gross_amount DECIMAL(10,2),
  stripe_fee DECIMAL(10,2),
  platform_fee DECIMAL(10,2),
  total_fees DECIMAL(10,2),
  net_amount DECIMAL(10,2),
  effective_rate DECIMAL(5,2)
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_config payment_fee_config%ROWTYPE;
  v_stripe_fee DECIMAL(10,2);
  v_platform_fee DECIMAL(10,2);
  v_total_fees DECIMAL(10,2);
  v_net_amount DECIMAL(10,2);
BEGIN
  -- Récupérer la configuration
  SELECT * INTO v_config
  FROM payment_fee_config
  WHERE config_key = p_config_key AND is_active = true
  LIMIT 1;
  
  IF v_config IS NULL THEN
    -- Config par défaut si non trouvée
    v_stripe_fee := (p_amount * 0.014) + 0.25;
    v_platform_fee := (p_amount * 0.01) + 0.50;
  ELSE
    v_stripe_fee := (p_amount * v_config.stripe_percent) + v_config.stripe_fixed;
    v_platform_fee := (p_amount * v_config.platform_percent) + v_config.platform_fixed;
  END IF;
  
  -- Arrondir à 2 décimales
  v_stripe_fee := ROUND(v_stripe_fee, 2);
  v_platform_fee := ROUND(v_platform_fee, 2);
  v_total_fees := v_stripe_fee + v_platform_fee;
  v_net_amount := p_amount - v_total_fees;
  
  RETURN QUERY SELECT 
    p_amount,
    v_stripe_fee,
    v_platform_fee,
    v_total_fees,
    v_net_amount,
    ROUND((v_total_fees / p_amount * 100)::DECIMAL, 2);
END;
$$;

-- =====================================================
-- 6. FONCTION: Calcul acompte et solde
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_deposit_and_balance(
  p_total_amount DECIMAL(10,2),
  p_config_key TEXT DEFAULT 'default'
)
RETURNS TABLE (
  total_amount DECIMAL(10,2),
  deposit_percent DECIMAL(5,2),
  deposit_amount DECIMAL(10,2),
  deposit_fees DECIMAL(10,2),
  deposit_net DECIMAL(10,2),
  balance_percent DECIMAL(5,2),
  balance_amount DECIMAL(10,2),
  balance_fees DECIMAL(10,2),
  balance_net DECIMAL(10,2),
  total_fees DECIMAL(10,2),
  total_net DECIMAL(10,2)
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_config payment_fee_config%ROWTYPE;
  v_deposit_pct DECIMAL(5,2);
  v_deposit_amt DECIMAL(10,2);
  v_balance_amt DECIMAL(10,2);
  v_deposit_fees RECORD;
  v_balance_fees RECORD;
BEGIN
  -- Récupérer la configuration
  SELECT * INTO v_config
  FROM payment_fee_config
  WHERE config_key = p_config_key AND is_active = true
  LIMIT 1;
  
  v_deposit_pct := COALESCE(v_config.deposit_percent, 66.67);
  v_deposit_amt := ROUND(p_total_amount * v_deposit_pct / 100, 2);
  v_balance_amt := p_total_amount - v_deposit_amt;
  
  -- Calculer les frais pour chaque paiement
  SELECT * INTO v_deposit_fees FROM calculate_payment_fees(v_deposit_amt, p_config_key);
  SELECT * INTO v_balance_fees FROM calculate_payment_fees(v_balance_amt, p_config_key);
  
  RETURN QUERY SELECT 
    p_total_amount,
    v_deposit_pct,
    v_deposit_amt,
    v_deposit_fees.total_fees,
    v_deposit_fees.net_amount,
    (100 - v_deposit_pct),
    v_balance_amt,
    v_balance_fees.total_fees,
    v_balance_fees.net_amount,
    (v_deposit_fees.total_fees + v_balance_fees.total_fees),
    (v_deposit_fees.net_amount + v_balance_fees.net_amount);
END;
$$;

-- =====================================================
-- 7. FONCTION: Ajouter un événement au timeline
-- =====================================================

CREATE OR REPLACE FUNCTION add_work_order_event(
  p_work_order_id UUID,
  p_event_type TEXT,
  p_actor_profile_id UUID DEFAULT NULL,
  p_actor_role TEXT DEFAULT 'system',
  p_old_status TEXT DEFAULT NULL,
  p_new_status TEXT DEFAULT NULL,
  p_event_data JSONB DEFAULT '{}',
  p_description TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO work_order_timeline (
    work_order_id,
    event_type,
    actor_profile_id,
    actor_role,
    old_status,
    new_status,
    event_data,
    description
  ) VALUES (
    p_work_order_id,
    p_event_type,
    p_actor_profile_id,
    p_actor_role,
    p_old_status,
    p_new_status,
    p_event_data,
    p_description
  )
  RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$;

-- =====================================================
-- 8. TRIGGER: Log automatique des changements de statut
-- =====================================================

CREATE OR REPLACE FUNCTION log_work_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.statut IS DISTINCT FROM NEW.statut THEN
    PERFORM add_work_order_event(
      NEW.id,
      'status_changed',
      NULL,
      'system',
      OLD.statut,
      NEW.statut,
      jsonb_build_object(
        'changed_at', NOW(),
        'trigger', 'auto'
      ),
      'Statut changé de ' || COALESCE(OLD.statut, 'null') || ' à ' || NEW.statut
    );
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_work_order_status ON work_orders;
CREATE TRIGGER trg_log_work_order_status
  AFTER UPDATE OF statut ON work_orders
  FOR EACH ROW
  EXECUTE FUNCTION log_work_order_status_change();

-- =====================================================
-- 9. RLS POLICIES
-- =====================================================

ALTER TABLE payment_fee_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_order_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_order_timeline ENABLE ROW LEVEL SECURITY;

-- payment_fee_config: lecture publique
CREATE POLICY "Anyone can read fee config"
  ON payment_fee_config FOR SELECT
  USING (is_active = true);

-- Admins peuvent modifier la config
CREATE POLICY "Admins can manage fee config"
  ON payment_fee_config FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'));

-- work_order_payments: visible par payer et payee
DROP POLICY IF EXISTS "Payment parties can view" ON work_order_payments;
CREATE POLICY "Payment parties can view"
  ON work_order_payments FOR SELECT
  USING (
    payer_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR payee_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Seul le système/admin peut créer des paiements
CREATE POLICY "System can create payments"
  ON work_order_payments FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('admin', 'owner'))
  );

-- work_order_timeline: visible par les parties de l'intervention
DROP POLICY IF EXISTS "Work order parties can view timeline" ON work_order_timeline;
CREATE POLICY "Work order parties can view timeline"
  ON work_order_timeline FOR SELECT
  USING (
    work_order_id IN (
      SELECT wo.id FROM work_orders wo
      JOIN tickets t ON t.id = wo.ticket_id
      JOIN properties p ON p.id = t.property_id
      WHERE wo.provider_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
         OR p.owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- =====================================================
-- 10. EXTENSION: provider_quotes pour acompte
-- =====================================================

ALTER TABLE provider_quotes
  ADD COLUMN IF NOT EXISTS requires_deposit BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS deposit_percent DECIMAL(5,2) DEFAULT 66.67,
  ADD COLUMN IF NOT EXISTS deposit_amount DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS balance_amount DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS requires_visit BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS visit_completed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS visit_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS visit_notes TEXT;

-- =====================================================
-- 11. VUE: Résumé intervention avec paiements
-- =====================================================

CREATE OR REPLACE VIEW v_work_order_payment_summary AS
SELECT 
  wo.id AS work_order_id,
  wo.ticket_id,
  wo.provider_id,
  wo.statut,
  wo.created_at,
  
  -- Devis accepté
  pq.id AS quote_id,
  pq.total_amount AS quote_amount,
  pq.deposit_percent,
  pq.deposit_amount,
  pq.balance_amount,
  
  -- Paiement acompte
  dep.id AS deposit_payment_id,
  dep.status AS deposit_status,
  dep.gross_amount AS deposit_paid,
  dep.paid_at AS deposit_paid_at,
  dep.escrow_status AS deposit_escrow,
  
  -- Paiement solde
  bal.id AS balance_payment_id,
  bal.status AS balance_status,
  bal.gross_amount AS balance_paid,
  bal.paid_at AS balance_paid_at,
  
  -- Totaux
  COALESCE(dep.gross_amount, 0) + COALESCE(bal.gross_amount, 0) AS total_paid,
  COALESCE(dep.total_fees, 0) + COALESCE(bal.total_fees, 0) AS total_fees,
  COALESCE(dep.net_amount, 0) + COALESCE(bal.net_amount, 0) AS total_net_provider

FROM work_orders wo
LEFT JOIN provider_quotes pq ON pq.id = wo.accepted_quote_id
LEFT JOIN work_order_payments dep ON dep.work_order_id = wo.id AND dep.payment_type = 'deposit'
LEFT JOIN work_order_payments bal ON bal.work_order_id = wo.id AND bal.payment_type = 'balance';

-- =====================================================
-- 12. COMMENTAIRES
-- =====================================================

COMMENT ON TABLE payment_fee_config IS 'Configuration des frais de paiement (Stripe + plateforme)';
COMMENT ON TABLE work_order_payments IS 'Paiements d''intervention (acompte 2/3 + solde 1/3)';
COMMENT ON TABLE work_order_timeline IS 'Historique complet des événements d''une intervention';
COMMENT ON FUNCTION calculate_payment_fees IS 'Calcule les frais pour un montant donné';
COMMENT ON FUNCTION calculate_deposit_and_balance IS 'Calcule l''acompte (2/3) et le solde (1/3) avec frais';


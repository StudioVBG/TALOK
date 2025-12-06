-- =====================================================
-- MIGRATION: Module Paiements SEPA complet
-- Description: Mandats SEPA, prélèvements automatiques, échéanciers
-- =====================================================

-- =====================================================
-- 1. TABLE: sepa_mandates (Mandats de prélèvement SEPA)
-- =====================================================
CREATE TABLE IF NOT EXISTS sepa_mandates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Liens
  tenant_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lease_id UUID REFERENCES leases(id) ON DELETE SET NULL,
  owner_profile_id UUID NOT NULL REFERENCES profiles(id),
  
  -- Informations du mandat
  mandate_reference TEXT NOT NULL UNIQUE, -- Référence Unique du Mandat (RUM)
  signature_date DATE NOT NULL,
  
  -- Informations bancaires du débiteur
  debtor_name TEXT NOT NULL,
  debtor_iban TEXT NOT NULL,
  debtor_bic TEXT,
  debtor_address TEXT,
  debtor_city TEXT,
  debtor_postal_code TEXT,
  debtor_country TEXT DEFAULT 'FR',
  
  -- Informations du créancier (propriétaire)
  creditor_name TEXT NOT NULL,
  creditor_iban TEXT NOT NULL,
  creditor_bic TEXT,
  creditor_id TEXT, -- Identifiant Créancier SEPA (ICS)
  
  -- Type de mandat
  mandate_type TEXT NOT NULL DEFAULT 'RCUR' CHECK (mandate_type IN (
    'RCUR', -- Récurrent
    'OOFF'  -- Ponctuel (One-Off)
  )),
  
  -- Fréquence
  frequency TEXT CHECK (frequency IN (
    'monthly', 'quarterly', 'yearly', 'one_time'
  )) DEFAULT 'monthly',
  
  -- Montant
  amount DECIMAL(10,2), -- Montant fixe (null = variable)
  
  -- Statut
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',      -- En attente de signature
    'active',       -- Actif
    'suspended',    -- Suspendu
    'cancelled',    -- Annulé
    'expired'       -- Expiré
  )),
  
  -- Signature
  signed_at TIMESTAMPTZ,
  signature_method TEXT CHECK (signature_method IN (
    'electronic', 'paper', 'api'
  )),
  signature_ip TEXT,
  signature_user_agent TEXT,
  document_id UUID REFERENCES documents(id),
  
  -- Stripe
  stripe_mandate_id TEXT,
  stripe_payment_method_id TEXT,
  stripe_customer_id TEXT,
  
  -- Dates
  first_collection_date DATE,
  last_collection_date DATE,
  next_collection_date DATE,
  
  -- Compteurs
  total_collections INTEGER DEFAULT 0,
  total_amount_collected DECIMAL(12,2) DEFAULT 0,
  failed_collections INTEGER DEFAULT 0,
  
  -- Expiration
  expiration_date DATE,
  
  -- Métadonnées
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT
);

-- Index
CREATE INDEX IF NOT EXISTS idx_sepa_mandates_tenant ON sepa_mandates(tenant_profile_id);
CREATE INDEX IF NOT EXISTS idx_sepa_mandates_lease ON sepa_mandates(lease_id);
CREATE INDEX IF NOT EXISTS idx_sepa_mandates_status ON sepa_mandates(status);
CREATE INDEX IF NOT EXISTS idx_sepa_mandates_next_collection ON sepa_mandates(next_collection_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sepa_mandates_stripe ON sepa_mandates(stripe_mandate_id) WHERE stripe_mandate_id IS NOT NULL;

-- =====================================================
-- 2. TABLE: sepa_collections (Prélèvements effectués)
-- =====================================================
CREATE TABLE IF NOT EXISTS sepa_collections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mandate_id UUID NOT NULL REFERENCES sepa_mandates(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  
  -- Montant
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'EUR',
  
  -- Dates
  collection_date DATE NOT NULL,
  settlement_date DATE, -- Date de règlement effectif
  
  -- Statut
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',      -- En attente
    'processing',   -- En cours de traitement
    'succeeded',    -- Réussi
    'failed',       -- Échoué
    'returned',     -- Retourné (R-transaction)
    'refunded',     -- Remboursé
    'cancelled'     -- Annulé
  )),
  
  -- Stripe
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,
  
  -- Codes retour SEPA
  return_code TEXT, -- Code retour si échec (ex: AC01, AM04, MS03...)
  return_reason TEXT,
  
  -- Référence
  end_to_end_id TEXT UNIQUE, -- Référence unique de bout en bout
  
  -- Métadonnées
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- Index
CREATE INDEX IF NOT EXISTS idx_sepa_collections_mandate ON sepa_collections(mandate_id);
CREATE INDEX IF NOT EXISTS idx_sepa_collections_invoice ON sepa_collections(invoice_id);
CREATE INDEX IF NOT EXISTS idx_sepa_collections_status ON sepa_collections(status);
CREATE INDEX IF NOT EXISTS idx_sepa_collections_date ON sepa_collections(collection_date);

-- =====================================================
-- 3. TABLE: payment_schedules (Échéanciers de paiement)
-- =====================================================
CREATE TABLE IF NOT EXISTS payment_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  
  -- Configuration
  payment_method TEXT NOT NULL CHECK (payment_method IN (
    'sepa', 'card', 'manual'
  )),
  mandate_id UUID REFERENCES sepa_mandates(id),
  
  -- Jour de prélèvement
  collection_day INTEGER NOT NULL CHECK (collection_day BETWEEN 1 AND 28),
  
  -- Montants
  rent_amount DECIMAL(10,2) NOT NULL,
  charges_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) GENERATED ALWAYS AS (rent_amount + charges_amount) STORED,
  
  -- Statut
  is_active BOOLEAN DEFAULT true,
  
  -- Dates
  start_date DATE NOT NULL,
  end_date DATE,
  
  -- Métadonnées
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(lease_id) -- Un seul échéancier actif par bail
);

-- Index
CREATE INDEX IF NOT EXISTS idx_payment_schedules_lease ON payment_schedules(lease_id);
CREATE INDEX IF NOT EXISTS idx_payment_schedules_mandate ON payment_schedules(mandate_id);
CREATE INDEX IF NOT EXISTS idx_payment_schedules_active ON payment_schedules(is_active);

-- =====================================================
-- 4. TABLE: scheduled_payments (Paiements programmés)
-- =====================================================
CREATE TABLE IF NOT EXISTS scheduled_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_id UUID NOT NULL REFERENCES payment_schedules(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices(id),
  
  -- Montant et date
  amount DECIMAL(10,2) NOT NULL,
  scheduled_date DATE NOT NULL,
  
  -- Statut
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',    -- À venir
    'processing', -- En cours
    'completed',  -- Effectué
    'failed',     -- Échoué
    'skipped',    -- Ignoré
    'cancelled'   -- Annulé
  )),
  
  -- Exécution
  executed_at TIMESTAMPTZ,
  collection_id UUID REFERENCES sepa_collections(id),
  
  -- Erreur
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  next_retry_date DATE,
  
  -- Métadonnées
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(schedule_id, scheduled_date)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_scheduled_payments_schedule ON scheduled_payments(schedule_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_payments_date ON scheduled_payments(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_scheduled_payments_status ON scheduled_payments(status);

-- =====================================================
-- 5. FONCTIONS
-- =====================================================

-- Fonction: Générer une référence unique de mandat (RUM)
CREATE OR REPLACE FUNCTION generate_mandate_reference()
RETURNS TEXT AS $$
DECLARE
  v_ref TEXT;
  v_exists BOOLEAN;
BEGIN
  LOOP
    v_ref := 'RUM-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
             UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8));
    SELECT EXISTS(SELECT 1 FROM sepa_mandates WHERE mandate_reference = v_ref) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  RETURN v_ref;
END;
$$ LANGUAGE plpgsql;

-- Fonction: Générer un end-to-end ID pour une collection
CREATE OR REPLACE FUNCTION generate_e2e_id()
RETURNS TEXT AS $$
DECLARE
  v_id TEXT;
  v_exists BOOLEAN;
BEGIN
  LOOP
    v_id := 'E2E-' || TO_CHAR(NOW(), 'YYYYMMDDHH24MISS') || '-' || 
            UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));
    SELECT EXISTS(SELECT 1 FROM sepa_collections WHERE end_to_end_id = v_id) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Fonction: Créer les paiements programmés pour un mois
CREATE OR REPLACE FUNCTION generate_scheduled_payments(p_month DATE)
RETURNS INTEGER AS $$
DECLARE
  v_schedule RECORD;
  v_payment_date DATE;
  v_count INTEGER := 0;
BEGIN
  FOR v_schedule IN
    SELECT * FROM payment_schedules
    WHERE is_active = true
    AND start_date <= p_month
    AND (end_date IS NULL OR end_date >= p_month)
  LOOP
    -- Calculer la date de paiement pour ce mois
    v_payment_date := DATE_TRUNC('month', p_month) + (v_schedule.collection_day - 1);
    
    -- Si le jour n'existe pas dans le mois (ex: 31 février), utiliser le dernier jour
    IF EXTRACT(DAY FROM v_payment_date) != v_schedule.collection_day THEN
      v_payment_date := (DATE_TRUNC('month', p_month) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
    END IF;
    
    -- Insérer le paiement programmé s'il n'existe pas
    INSERT INTO scheduled_payments (schedule_id, amount, scheduled_date)
    VALUES (v_schedule.id, v_schedule.total_amount, v_payment_date)
    ON CONFLICT (schedule_id, scheduled_date) DO NOTHING;
    
    IF FOUND THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Fonction: Exécuter les prélèvements du jour
CREATE OR REPLACE FUNCTION process_daily_collections()
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_processed INTEGER := 0;
  v_success INTEGER := 0;
  v_failed INTEGER := 0;
BEGIN
  -- Marquer les paiements comme "processing"
  UPDATE scheduled_payments
  SET status = 'processing', updated_at = NOW()
  WHERE scheduled_date = CURRENT_DATE
  AND status = 'pending';
  
  GET DIAGNOSTICS v_processed = ROW_COUNT;
  
  -- Note: L'exécution réelle des prélèvements se fait via l'API Stripe
  -- Cette fonction marque simplement les paiements à traiter
  
  v_result := jsonb_build_object(
    'date', CURRENT_DATE,
    'processed', v_processed,
    'success', v_success,
    'failed', v_failed
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. RLS POLICIES
-- =====================================================

ALTER TABLE sepa_mandates ENABLE ROW LEVEL SECURITY;
ALTER TABLE sepa_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_payments ENABLE ROW LEVEL SECURITY;

-- Policies sepa_mandates
CREATE POLICY "Locataires peuvent voir leurs mandats"
  ON sepa_mandates FOR SELECT
  USING (tenant_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Locataires peuvent créer leurs mandats"
  ON sepa_mandates FOR INSERT
  WITH CHECK (tenant_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Propriétaires peuvent voir les mandats de leurs baux"
  ON sepa_mandates FOR SELECT
  USING (
    owner_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR lease_id IN (
      SELECT l.id FROM leases l
      JOIN properties p ON p.id = l.property_id
      WHERE p.owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Admins ont accès complet aux mandats"
  ON sepa_mandates FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'));

-- Policies sepa_collections
CREATE POLICY "Accès aux collections via mandats"
  ON sepa_collections FOR SELECT
  USING (
    mandate_id IN (
      SELECT id FROM sepa_mandates
      WHERE tenant_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
      OR owner_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Admins ont accès complet aux collections"
  ON sepa_collections FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'));

-- Policies payment_schedules
CREATE POLICY "Propriétaires peuvent gérer les échéanciers"
  ON payment_schedules FOR ALL
  USING (
    lease_id IN (
      SELECT l.id FROM leases l
      JOIN properties p ON p.id = l.property_id
      WHERE p.owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Locataires peuvent voir leurs échéanciers"
  ON payment_schedules FOR SELECT
  USING (
    lease_id IN (
      SELECT lease_id FROM lease_signers
      WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Admins ont accès complet aux échéanciers"
  ON payment_schedules FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'));

-- Policies scheduled_payments
CREATE POLICY "Accès aux paiements programmés via échéanciers"
  ON scheduled_payments FOR SELECT
  USING (
    schedule_id IN (
      SELECT id FROM payment_schedules ps
      WHERE ps.lease_id IN (
        SELECT l.id FROM leases l
        JOIN properties p ON p.id = l.property_id
        WHERE p.owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
      )
      OR ps.lease_id IN (
        SELECT lease_id FROM lease_signers
        WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
      )
    )
  );

CREATE POLICY "Admins ont accès complet aux paiements programmés"
  ON scheduled_payments FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'));

-- =====================================================
-- 7. TRIGGERS
-- =====================================================

-- Trigger: Générer la référence du mandat
CREATE OR REPLACE FUNCTION trigger_generate_mandate_reference()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.mandate_reference IS NULL THEN
    NEW.mandate_reference := generate_mandate_reference();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_mandate_reference ON sepa_mandates;
CREATE TRIGGER trg_generate_mandate_reference
  BEFORE INSERT ON sepa_mandates
  FOR EACH ROW
  EXECUTE FUNCTION trigger_generate_mandate_reference();

-- Trigger: Générer l'end-to-end ID
CREATE OR REPLACE FUNCTION trigger_generate_e2e_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.end_to_end_id IS NULL THEN
    NEW.end_to_end_id := generate_e2e_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_e2e_id ON sepa_collections;
CREATE TRIGGER trg_generate_e2e_id
  BEFORE INSERT ON sepa_collections
  FOR EACH ROW
  EXECUTE FUNCTION trigger_generate_e2e_id();

-- Triggers updated_at
CREATE TRIGGER trg_sepa_mandates_updated_at
  BEFORE UPDATE ON sepa_mandates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_sepa_collections_updated_at
  BEFORE UPDATE ON sepa_collections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_payment_schedules_updated_at
  BEFORE UPDATE ON payment_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_scheduled_payments_updated_at
  BEFORE UPDATE ON scheduled_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 8. COMMENTAIRES
-- =====================================================
COMMENT ON TABLE sepa_mandates IS 'Mandats de prélèvement SEPA des locataires';
COMMENT ON TABLE sepa_collections IS 'Historique des prélèvements SEPA effectués';
COMMENT ON TABLE payment_schedules IS 'Échéanciers de paiement par bail';
COMMENT ON TABLE scheduled_payments IS 'Paiements programmés individuels';
COMMENT ON FUNCTION generate_mandate_reference() IS 'Génère une Référence Unique de Mandat (RUM)';
COMMENT ON FUNCTION generate_e2e_id() IS 'Génère un identifiant End-to-End unique';








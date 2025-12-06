-- =====================================================
-- MIGRATION: Régularisation des charges complète
-- Description: Provisions, charges réelles, régularisation annuelle
-- =====================================================

-- =====================================================
-- 1. TABLE: charge_regularizations
-- =====================================================
CREATE TABLE IF NOT EXISTS charge_regularizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  
  -- Période de régularisation
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  -- Provisions versées par le locataire
  provisions_paid DECIMAL(10,2) NOT NULL DEFAULT 0,
  
  -- Charges réelles
  actual_charges DECIMAL(10,2) NOT NULL DEFAULT 0,
  
  -- Solde (positif = remboursement au locataire, négatif = dû par le locataire)
  balance DECIMAL(10,2) GENERATED ALWAYS AS (provisions_paid - actual_charges) STORED,
  
  -- Détail par catégorie (JSONB)
  charge_details JSONB NOT NULL DEFAULT '[]',
  -- Structure: [{category, description, budgeted, actual, documents: []}]
  
  -- Justificatifs
  supporting_documents JSONB DEFAULT '[]', -- Liste des document_ids
  
  -- Statut
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft',              -- Brouillon
    'pending_documents',  -- En attente de justificatifs
    'calculated',         -- Calculé
    'sent',               -- Envoyé au locataire
    'contested',          -- Contesté
    'validated',          -- Validé
    'paid',               -- Réglé (remboursement ou paiement)
    'archived'            -- Archivé
  )),
  
  -- Envoi au locataire
  sent_at TIMESTAMPTZ,
  sent_method TEXT CHECK (sent_method IN ('email', 'letter', 'both')),
  
  -- Contestation
  contested_at TIMESTAMPTZ,
  contest_reason TEXT,
  
  -- Validation
  validated_at TIMESTAMPTZ,
  validated_by UUID REFERENCES profiles(id),
  
  -- Règlement
  payment_date DATE,
  payment_method TEXT CHECK (payment_method IN ('virement', 'cheque', 'prelevement', 'deduction')),
  payment_reference TEXT,
  
  -- Facture générée
  invoice_id UUID REFERENCES invoices(id),
  
  -- Notes
  notes TEXT,
  
  -- Métadonnées
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  
  -- Contraintes
  UNIQUE(lease_id, period_start, period_end),
  CHECK (period_end > period_start)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_charge_regularizations_lease ON charge_regularizations(lease_id);
CREATE INDEX IF NOT EXISTS idx_charge_regularizations_period ON charge_regularizations(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_charge_regularizations_status ON charge_regularizations(status);

-- =====================================================
-- 2. TABLE: lease_indexations (Compléter)
-- =====================================================

-- Ajouter les colonnes manquantes si elles n'existent pas
DO $$
BEGIN
  -- Colonne applied_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lease_indexations' AND column_name = 'applied_at'
  ) THEN
    ALTER TABLE lease_indexations ADD COLUMN applied_at TIMESTAMPTZ;
  END IF;
  
  -- Colonne applied_by
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lease_indexations' AND column_name = 'applied_by'
  ) THEN
    ALTER TABLE lease_indexations ADD COLUMN applied_by UUID REFERENCES profiles(id);
  END IF;
  
  -- Colonne notification_sent
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lease_indexations' AND column_name = 'notification_sent'
  ) THEN
    ALTER TABLE lease_indexations ADD COLUMN notification_sent BOOLEAN DEFAULT false;
  END IF;
  
  -- Colonne tenant_notified_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lease_indexations' AND column_name = 'tenant_notified_at'
  ) THEN
    ALTER TABLE lease_indexations ADD COLUMN tenant_notified_at TIMESTAMPTZ;
  END IF;
END $$;

-- =====================================================
-- 3. FONCTIONS
-- =====================================================

-- Fonction: Calculer la régularisation des charges pour un bail
CREATE OR REPLACE FUNCTION calculate_charge_regularization(
  p_lease_id UUID,
  p_period_start DATE,
  p_period_end DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lease RECORD;
  v_provisions DECIMAL(10,2);
  v_actual DECIMAL(10,2);
  v_details JSONB;
  v_months INTEGER;
BEGIN
  -- Récupérer le bail
  SELECT * INTO v_lease FROM leases WHERE id = p_lease_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Bail non trouvé');
  END IF;
  
  -- Calculer le nombre de mois
  v_months := EXTRACT(YEAR FROM AGE(p_period_end, p_period_start)) * 12 +
              EXTRACT(MONTH FROM AGE(p_period_end, p_period_start));
  
  -- Provisions versées = charges forfaitaires × nombre de mois
  v_provisions := v_lease.charges_forfaitaires * v_months;
  
  -- Récupérer les charges réelles de la période
  SELECT COALESCE(SUM(montant), 0)
  INTO v_actual
  FROM charges c
  JOIN properties p ON p.id = c.property_id
  WHERE p.id = v_lease.property_id
  AND c.refacturable_locataire = true;
  
  -- Pour une vraie implémentation, il faudrait :
  -- 1. Récupérer les relevés de compteurs
  -- 2. Calculer les consommations réelles
  -- 3. Appliquer les clés de répartition si copropriété
  
  -- Détail par catégorie (simplifié)
  SELECT jsonb_agg(jsonb_build_object(
    'category', c.type,
    'description', COALESCE(c.type, 'Charge'),
    'budgeted', (c.montant * v_months / 12),
    'actual', (c.montant * v_months / 12),
    'refacturable', c.refacturable_locataire
  ))
  INTO v_details
  FROM charges c
  WHERE c.property_id = v_lease.property_id;
  
  RETURN jsonb_build_object(
    'lease_id', p_lease_id,
    'period_start', p_period_start,
    'period_end', p_period_end,
    'months', v_months,
    'provisions_paid', v_provisions,
    'actual_charges', v_actual,
    'balance', v_provisions - v_actual,
    'details', COALESCE(v_details, '[]'::jsonb)
  );
END;
$$;

-- Fonction: Appliquer une indexation de loyer
CREATE OR REPLACE FUNCTION apply_lease_indexation(
  p_indexation_id UUID,
  p_applied_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_indexation RECORD;
  v_lease RECORD;
BEGIN
  -- Récupérer l'indexation
  SELECT * INTO v_indexation
  FROM lease_indexations
  WHERE id = p_indexation_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Indexation non trouvée');
  END IF;
  
  IF v_indexation.status = 'applied' THEN
    RETURN jsonb_build_object('error', 'Indexation déjà appliquée');
  END IF;
  
  -- Mettre à jour le loyer du bail
  UPDATE leases
  SET 
    loyer = v_indexation.new_rent,
    indice_courant = v_indexation.irl_value,
    next_indexation_date = (v_indexation.indexation_date + INTERVAL '1 year')::DATE,
    updated_at = NOW()
  WHERE id = v_indexation.lease_id;
  
  -- Marquer l'indexation comme appliquée
  UPDATE lease_indexations
  SET 
    status = 'applied',
    applied_at = NOW(),
    applied_by = p_applied_by
  WHERE id = p_indexation_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'old_rent', v_indexation.old_rent,
    'new_rent', v_indexation.new_rent,
    'increase_percent', ROUND(((v_indexation.new_rent - v_indexation.old_rent) / v_indexation.old_rent * 100)::NUMERIC, 2)
  );
END;
$$;

-- =====================================================
-- 4. RLS POLICIES
-- =====================================================

ALTER TABLE charge_regularizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Propriétaires peuvent gérer les régularisations"
  ON charge_regularizations FOR ALL
  USING (
    lease_id IN (
      SELECT l.id FROM leases l
      JOIN properties p ON p.id = l.property_id
      WHERE p.owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Locataires peuvent voir leurs régularisations"
  ON charge_regularizations FOR SELECT
  USING (
    lease_id IN (
      SELECT lease_id FROM lease_signers
      WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Admins ont accès complet aux régularisations"
  ON charge_regularizations FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'));

-- =====================================================
-- 5. TRIGGERS
-- =====================================================

CREATE TRIGGER trg_charge_regularizations_updated_at
  BEFORE UPDATE ON charge_regularizations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 6. COMMENTAIRES
-- =====================================================

COMMENT ON TABLE charge_regularizations IS 'Régularisation annuelle des charges locatives';
COMMENT ON FUNCTION calculate_charge_regularization(UUID, DATE, DATE) IS 'Calcule automatiquement la régularisation pour une période';
COMMENT ON FUNCTION apply_lease_indexation(UUID, UUID) IS 'Applique une indexation de loyer et met à jour le bail';








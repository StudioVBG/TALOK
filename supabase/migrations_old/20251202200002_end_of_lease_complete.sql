-- =====================================================
-- MIGRATION: Module Fin de Bail complet
-- Description: Préavis, solde de tout compte, retenues DG
-- =====================================================

-- =====================================================
-- 1. TABLE: departure_notices (Préavis de départ)
-- =====================================================
CREATE TABLE IF NOT EXISTS departure_notices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  
  -- Qui donne le préavis
  initiated_by TEXT NOT NULL CHECK (initiated_by IN ('tenant', 'owner')),
  initiator_profile_id UUID NOT NULL REFERENCES profiles(id),
  
  -- Dates
  notice_date DATE NOT NULL, -- Date de notification du préavis
  expected_departure_date DATE NOT NULL, -- Date de départ prévue
  actual_departure_date DATE, -- Date de départ effective
  
  -- Durée du préavis
  notice_period_months INTEGER NOT NULL DEFAULT 3, -- 1 mois zone tendue, 3 mois standard
  
  -- Motif (pour réduction préavis)
  reason TEXT CHECK (reason IN (
    'standard', -- Préavis standard
    'zone_tendue', -- Zone tendue (1 mois)
    'mutation_professionnelle', -- Mutation professionnelle (1 mois)
    'perte_emploi', -- Perte d'emploi (1 mois)
    'nouvel_emploi', -- Nouvel emploi (1 mois)
    'raison_sante', -- Raison de santé (1 mois)
    'rsa_beneficiaire', -- RSA (1 mois)
    'aah_beneficiaire', -- AAH (1 mois)
    'premier_logement', -- Attribution logement social (1 mois)
    'conge_vente', -- Congé pour vendre (propriétaire)
    'conge_reprise', -- Congé pour reprise (propriétaire)
    'motif_legitime', -- Motif légitime et sérieux (propriétaire)
    'autre'
  )),
  reason_details TEXT,
  reason_document_id UUID REFERENCES documents(id),
  
  -- Statut
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', -- En attente de validation
    'accepted', -- Accepté
    'contested', -- Contesté
    'withdrawn', -- Retiré
    'completed' -- Terminé (départ effectif)
  )),
  
  -- Contestation
  contested_at TIMESTAMPTZ,
  contest_reason TEXT,
  contest_resolved_at TIMESTAMPTZ,
  
  -- Accusé de réception
  acknowledgment_date DATE,
  acknowledgment_method TEXT CHECK (acknowledgment_method IN (
    'lettre_recommandee', 'acte_huissier', 'remise_main_propre', 'email_certifie'
  )),
  
  -- Notes
  notes TEXT,
  
  -- Métadonnées
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Un seul préavis actif par bail
  UNIQUE(lease_id) -- Peut être retiré si on veut garder l'historique
);

-- Index
CREATE INDEX IF NOT EXISTS idx_departure_notices_lease ON departure_notices(lease_id);
CREATE INDEX IF NOT EXISTS idx_departure_notices_status ON departure_notices(status);
CREATE INDEX IF NOT EXISTS idx_departure_notices_departure_date ON departure_notices(expected_departure_date);

-- =====================================================
-- 2. TABLE: dg_settlements (Solde de tout compte - Dépôt de garantie)
-- =====================================================
CREATE TABLE IF NOT EXISTS dg_settlements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  departure_notice_id UUID REFERENCES departure_notices(id),
  
  -- Montants
  deposit_amount DECIMAL(10,2) NOT NULL, -- Dépôt de garantie initial
  
  -- Retenues
  total_deductions DECIMAL(10,2) NOT NULL DEFAULT 0, -- Total des retenues
  
  -- Détail des retenues (JSONB pour flexibilité)
  deductions JSONB NOT NULL DEFAULT '[]', -- [{type, description, amount, document_id}]
  
  -- Régularisation charges
  charge_regularization_amount DECIMAL(10,2) DEFAULT 0, -- Positif = dû par locataire, Négatif = dû au locataire
  
  -- Loyers impayés
  unpaid_rent_amount DECIMAL(10,2) DEFAULT 0,
  
  -- Réparations locatives
  repair_amount DECIMAL(10,2) DEFAULT 0,
  
  -- Nettoyage
  cleaning_amount DECIMAL(10,2) DEFAULT 0,
  
  -- Autres retenues
  other_deductions_amount DECIMAL(10,2) DEFAULT 0,
  
  -- Calcul final
  amount_to_return DECIMAL(10,2) NOT NULL, -- Montant à rendre au locataire
  amount_to_pay DECIMAL(10,2) DEFAULT 0, -- Montant que le locataire doit payer (si retenues > DG)
  
  -- Justificatifs
  edl_entry_id UUID REFERENCES edl(id),
  edl_exit_id UUID REFERENCES edl(id),
  comparison_document_id UUID REFERENCES documents(id),
  
  -- Statut
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', -- Brouillon
    'pending_validation', -- En attente validation locataire
    'contested', -- Contesté par locataire
    'validated', -- Validé
    'paid', -- Remboursement effectué
    'collected' -- Encaissement effectué (si locataire doit payer)
  )),
  
  -- Validation
  validated_at TIMESTAMPTZ,
  validated_by UUID REFERENCES profiles(id),
  
  -- Contestation
  contested_at TIMESTAMPTZ,
  contest_reason TEXT,
  
  -- Paiement
  payment_date DATE,
  payment_method TEXT CHECK (payment_method IN ('virement', 'cheque', 'especes')),
  payment_reference TEXT,
  
  -- Délai légal
  legal_deadline DATE, -- 1 mois si EDL conforme, 2 mois sinon
  is_overdue BOOLEAN GENERATED ALWAYS AS (
    status NOT IN ('paid', 'collected') AND legal_deadline < CURRENT_DATE
  ) STORED,
  
  -- Notes
  notes TEXT,
  
  -- Métadonnées
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  
  UNIQUE(lease_id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_dg_settlements_lease ON dg_settlements(lease_id);
CREATE INDEX IF NOT EXISTS idx_dg_settlements_status ON dg_settlements(status);
CREATE INDEX IF NOT EXISTS idx_dg_settlements_deadline ON dg_settlements(legal_deadline);

-- =====================================================
-- 3. TABLE: settlement_deduction_items (Détail des retenues)
-- =====================================================
CREATE TABLE IF NOT EXISTS settlement_deduction_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  settlement_id UUID NOT NULL REFERENCES dg_settlements(id) ON DELETE CASCADE,
  
  -- Type de retenue
  deduction_type TEXT NOT NULL CHECK (deduction_type IN (
    'unpaid_rent', -- Loyers impayés
    'unpaid_charges', -- Charges impayées
    'repair', -- Réparations locatives
    'cleaning', -- Nettoyage
    'missing_equipment', -- Équipement manquant
    'damage', -- Dégradations
    'key_replacement', -- Remplacement clés
    'charge_regularization', -- Régularisation charges
    'other' -- Autre
  )),
  
  -- Description
  description TEXT NOT NULL,
  
  -- Montant
  amount DECIMAL(10,2) NOT NULL,
  
  -- Justificatif
  document_id UUID REFERENCES documents(id),
  invoice_reference TEXT, -- Référence facture/devis
  
  -- Photo EDL associée
  edl_item_id UUID REFERENCES edl_items(id),
  
  -- Validation
  is_validated BOOLEAN DEFAULT false,
  validated_at TIMESTAMPTZ,
  
  -- Contestation
  is_contested BOOLEAN DEFAULT false,
  contest_reason TEXT,
  
  -- Métadonnées
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_deduction_items_settlement ON settlement_deduction_items(settlement_id);
CREATE INDEX IF NOT EXISTS idx_deduction_items_type ON settlement_deduction_items(deduction_type);

-- =====================================================
-- 4. FONCTIONS RPC
-- =====================================================

-- Fonction: Calculer le solde de tout compte
CREATE OR REPLACE FUNCTION calculate_settlement(p_lease_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lease RECORD;
  v_deposit DECIMAL(10,2);
  v_unpaid_rent DECIMAL(10,2);
  v_unpaid_charges DECIMAL(10,2);
  v_edl_differences JSONB;
  v_total_deductions DECIMAL(10,2);
  v_amount_to_return DECIMAL(10,2);
  v_legal_deadline DATE;
  v_departure_date DATE;
  v_edl_identical BOOLEAN;
BEGIN
  -- Récupérer les infos du bail
  SELECT l.*, p.adresse_complete
  INTO v_lease
  FROM leases l
  JOIN properties p ON p.id = l.property_id
  WHERE l.id = p_lease_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Bail non trouvé');
  END IF;
  
  v_deposit := v_lease.depot_de_garantie;
  
  -- Calculer les loyers impayés
  SELECT COALESCE(SUM(montant_total), 0)
  INTO v_unpaid_rent
  FROM invoices
  WHERE lease_id = p_lease_id
  AND statut IN ('sent', 'late');
  
  -- Récupérer la date de départ prévue
  SELECT expected_departure_date INTO v_departure_date
  FROM departure_notices
  WHERE lease_id = p_lease_id
  AND status NOT IN ('withdrawn');
  
  -- Vérifier si les EDL sont identiques (simplification)
  -- En réalité, on comparerait les items d'EDL entrée et sortie
  SELECT COUNT(*) = 0 INTO v_edl_identical
  FROM edl
  WHERE lease_id = p_lease_id
  AND type = 'sortie'
  AND status = 'disputed';
  
  -- Calculer le délai légal (1 mois si EDL conforme, 2 mois sinon)
  v_legal_deadline := COALESCE(v_departure_date, CURRENT_DATE) + 
    CASE WHEN v_edl_identical THEN INTERVAL '1 month' ELSE INTERVAL '2 months' END;
  
  -- Total des retenues
  v_total_deductions := v_unpaid_rent;
  
  -- Montant à rendre
  v_amount_to_return := GREATEST(0, v_deposit - v_total_deductions);
  
  RETURN jsonb_build_object(
    'lease_id', p_lease_id,
    'deposit_amount', v_deposit,
    'unpaid_rent', v_unpaid_rent,
    'total_deductions', v_total_deductions,
    'amount_to_return', v_amount_to_return,
    'amount_to_pay', GREATEST(0, v_total_deductions - v_deposit),
    'legal_deadline', v_legal_deadline,
    'edl_identical', v_edl_identical,
    'departure_date', v_departure_date
  );
END;
$$;

-- Fonction: Générer le solde de tout compte
CREATE OR REPLACE FUNCTION generate_settlement(
  p_lease_id UUID,
  p_created_by UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_calculation JSONB;
  v_settlement_id UUID;
  v_departure_notice_id UUID;
BEGIN
  -- Calculer les montants
  v_calculation := calculate_settlement(p_lease_id);
  
  IF v_calculation ? 'error' THEN
    RAISE EXCEPTION '%', v_calculation->>'error';
  END IF;
  
  -- Récupérer l'ID du préavis
  SELECT id INTO v_departure_notice_id
  FROM departure_notices
  WHERE lease_id = p_lease_id
  AND status NOT IN ('withdrawn');
  
  -- Créer ou mettre à jour le settlement
  INSERT INTO dg_settlements (
    lease_id,
    departure_notice_id,
    deposit_amount,
    unpaid_rent_amount,
    total_deductions,
    amount_to_return,
    amount_to_pay,
    legal_deadline,
    created_by
  )
  VALUES (
    p_lease_id,
    v_departure_notice_id,
    (v_calculation->>'deposit_amount')::DECIMAL,
    (v_calculation->>'unpaid_rent')::DECIMAL,
    (v_calculation->>'total_deductions')::DECIMAL,
    (v_calculation->>'amount_to_return')::DECIMAL,
    (v_calculation->>'amount_to_pay')::DECIMAL,
    (v_calculation->>'legal_deadline')::DATE,
    p_created_by
  )
  ON CONFLICT (lease_id) 
  DO UPDATE SET
    deposit_amount = EXCLUDED.deposit_amount,
    unpaid_rent_amount = EXCLUDED.unpaid_rent_amount,
    total_deductions = EXCLUDED.total_deductions,
    amount_to_return = EXCLUDED.amount_to_return,
    amount_to_pay = EXCLUDED.amount_to_pay,
    legal_deadline = EXCLUDED.legal_deadline,
    updated_at = NOW()
  RETURNING id INTO v_settlement_id;
  
  RETURN v_settlement_id;
END;
$$;

-- =====================================================
-- 5. RLS POLICIES
-- =====================================================

-- Activer RLS
ALTER TABLE departure_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE dg_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement_deduction_items ENABLE ROW LEVEL SECURITY;

-- Policies departure_notices
CREATE POLICY "Propriétaires peuvent gérer les préavis de leurs baux"
  ON departure_notices FOR ALL
  USING (
    lease_id IN (
      SELECT l.id FROM leases l
      JOIN properties p ON p.id = l.property_id
      WHERE p.owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Locataires peuvent voir et créer leurs préavis"
  ON departure_notices FOR ALL
  USING (
    lease_id IN (
      SELECT lease_id FROM lease_signers
      WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Admins ont accès complet aux préavis"
  ON departure_notices FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'));

-- Policies dg_settlements
CREATE POLICY "Propriétaires peuvent gérer les soldes de leurs baux"
  ON dg_settlements FOR ALL
  USING (
    lease_id IN (
      SELECT l.id FROM leases l
      JOIN properties p ON p.id = l.property_id
      WHERE p.owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Locataires peuvent voir leurs soldes"
  ON dg_settlements FOR SELECT
  USING (
    lease_id IN (
      SELECT lease_id FROM lease_signers
      WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Admins ont accès complet aux soldes"
  ON dg_settlements FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'));

-- Policies settlement_deduction_items
CREATE POLICY "Accès aux retenues via settlement"
  ON settlement_deduction_items FOR ALL
  USING (
    settlement_id IN (
      SELECT id FROM dg_settlements
      WHERE lease_id IN (
        SELECT l.id FROM leases l
        JOIN properties p ON p.id = l.property_id
        WHERE p.owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
      )
    )
  );

CREATE POLICY "Admins ont accès complet aux retenues"
  ON settlement_deduction_items FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'));

-- =====================================================
-- 6. TRIGGERS
-- =====================================================

CREATE TRIGGER trg_departure_notices_updated_at
  BEFORE UPDATE ON departure_notices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_dg_settlements_updated_at
  BEFORE UPDATE ON dg_settlements
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 7. COMMENTAIRES
-- =====================================================
COMMENT ON TABLE departure_notices IS 'Préavis de départ (locataire ou propriétaire)';
COMMENT ON TABLE dg_settlements IS 'Solde de tout compte et restitution du dépôt de garantie';
COMMENT ON TABLE settlement_deduction_items IS 'Détail des retenues sur le dépôt de garantie';
COMMENT ON FUNCTION calculate_settlement(UUID) IS 'Calcule automatiquement le solde de tout compte';
COMMENT ON FUNCTION generate_settlement(UUID, UUID) IS 'Génère ou met à jour le solde de tout compte';








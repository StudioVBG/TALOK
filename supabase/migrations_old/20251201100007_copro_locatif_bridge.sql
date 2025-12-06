-- =====================================================
-- MIGRATION: Bridge COPRO ↔ LOCATIF
-- Description: Charges récupérables et régularisation locative
-- =====================================================

-- =====================================================
-- TABLE: locative_charge_rules (règles de récupération)
-- =====================================================
CREATE TABLE IF NOT EXISTS locative_charge_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Contexte
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
  service_id UUID REFERENCES copro_services(id) ON DELETE CASCADE,
  
  -- Règle
  service_type TEXT, -- Type de service si pas de service_id spécifique
  
  -- Récupérabilité
  is_recuperable BOOLEAN NOT NULL DEFAULT true,
  recuperable_ratio NUMERIC(5,4) NOT NULL DEFAULT 1.0 
    CHECK (recuperable_ratio >= 0 AND recuperable_ratio <= 1),
  
  -- Base légale
  legal_reference TEXT, -- Ex: "Décret 87-713, Annexe 1"
  
  -- Notes
  notes TEXT,
  
  -- Métadonnées
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(site_id, service_id),
  UNIQUE(site_id, service_type) -- Si service_type sans service_id
);

-- Index
CREATE INDEX IF NOT EXISTS idx_locative_rules_site ON locative_charge_rules(site_id);
CREATE INDEX IF NOT EXISTS idx_locative_rules_service ON locative_charge_rules(service_id);

-- =====================================================
-- TABLE: tenant_charges_base (charges récupérables par locataire)
-- =====================================================
CREATE TABLE IF NOT EXISTS tenant_charges_base (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Références
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES copro_units(id) ON DELETE CASCADE,
  charge_copro_id UUID REFERENCES charges_copro(id) ON DELETE SET NULL,
  service_id UUID REFERENCES copro_services(id) ON DELETE SET NULL,
  
  -- Période
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  fiscal_year INTEGER NOT NULL,
  
  -- Description
  label TEXT NOT NULL,
  service_type TEXT,
  
  -- Montants COPRO (pour référence)
  copro_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  
  -- Récupérabilité
  recuperable_ratio NUMERIC(5,4) NOT NULL DEFAULT 1.0,
  
  -- Prorata temporis (si bail partiel sur la période)
  prorata_days INTEGER, -- Nombre de jours effectifs
  total_period_days INTEGER, -- Nombre de jours de la période
  prorata_ratio NUMERIC(5,4) DEFAULT 1.0,
  
  -- Montant final récupérable
  recuperable_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  
  -- État
  status TEXT NOT NULL DEFAULT 'calculated' CHECK (status IN (
    'calculated', 'validated', 'invoiced', 'cancelled'
  )),
  validated_at TIMESTAMPTZ,
  validated_by UUID REFERENCES auth.users(id),
  
  -- Métadonnées
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(charge_copro_id, lease_id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_tenant_charges_lease ON tenant_charges_base(lease_id);
CREATE INDEX IF NOT EXISTS idx_tenant_charges_unit ON tenant_charges_base(unit_id);
CREATE INDEX IF NOT EXISTS idx_tenant_charges_period ON tenant_charges_base(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_tenant_charges_fiscal ON tenant_charges_base(fiscal_year);

-- =====================================================
-- TABLE: tenant_charge_regularisations (régularisations)
-- =====================================================
CREATE TABLE IF NOT EXISTS tenant_charge_regularisations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Références
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES copro_units(id) ON DELETE CASCADE,
  
  -- Période de régularisation
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  fiscal_year INTEGER NOT NULL,
  
  -- Montants
  total_charges_recuperables NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_provisions_versees NUMERIC(15,2) NOT NULL DEFAULT 0,
  
  -- Résultat
  regularisation_amount NUMERIC(15,2) NOT NULL DEFAULT 0, -- Positif = dû par locataire, Négatif = à rembourser
  regularisation_type TEXT NOT NULL CHECK (regularisation_type IN (
    'due_by_tenant',    -- Locataire doit payer
    'refund_to_tenant', -- Remboursement au locataire
    'balanced'          -- Équilibré
  )),
  
  -- Détail par poste
  details_by_service JSONB DEFAULT '[]', -- [{service_type, label, copro_amount, recuperable_amount}]
  
  -- État
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft',      -- Brouillon
    'validated',  -- Validé par propriétaire
    'sent',       -- Envoyé au locataire
    'accepted',   -- Accepté par locataire
    'disputed',   -- Contesté
    'paid',       -- Réglé
    'cancelled'   -- Annulé
  )),
  
  -- Dates
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  validated_at TIMESTAMPTZ,
  validated_by UUID REFERENCES auth.users(id),
  sent_at TIMESTAMPTZ,
  
  -- Documents
  pdf_document_id UUID,
  detail_document_id UUID,
  
  -- Notes
  notes TEXT,
  tenant_notes TEXT, -- Notes/contestation du locataire
  
  -- Paiement
  payment_date DATE,
  payment_method TEXT,
  payment_reference TEXT,
  
  -- Métadonnées
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(lease_id, fiscal_year)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_regularisations_lease ON tenant_charge_regularisations(lease_id);
CREATE INDEX IF NOT EXISTS idx_regularisations_unit ON tenant_charge_regularisations(unit_id);
CREATE INDEX IF NOT EXISTS idx_regularisations_fiscal ON tenant_charge_regularisations(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_regularisations_status ON tenant_charge_regularisations(status);

-- =====================================================
-- TRIGGERS
-- =====================================================

DROP TRIGGER IF EXISTS trg_locative_rules_updated ON locative_charge_rules;
CREATE TRIGGER trg_locative_rules_updated
  BEFORE UPDATE ON locative_charge_rules FOR EACH ROW
  EXECUTE FUNCTION trigger_update_timestamp();

DROP TRIGGER IF EXISTS trg_tenant_charges_updated ON tenant_charges_base;
CREATE TRIGGER trg_tenant_charges_updated
  BEFORE UPDATE ON tenant_charges_base FOR EACH ROW
  EXECUTE FUNCTION trigger_update_timestamp();

DROP TRIGGER IF EXISTS trg_regularisations_updated ON tenant_charge_regularisations;
CREATE TRIGGER trg_regularisations_updated
  BEFORE UPDATE ON tenant_charge_regularisations FOR EACH ROW
  EXECUTE FUNCTION trigger_update_timestamp();

-- =====================================================
-- SEED: Règles de récupération par défaut (décret 87-713)
-- =====================================================
INSERT INTO locative_charge_rules (site_id, service_type, is_recuperable, recuperable_ratio, legal_reference, notes)
VALUES
  -- 100% récupérables
  (NULL, 'eau', true, 1.0, 'Décret 87-713, Art. 1', 'Eau froide et eau chaude'),
  (NULL, 'eau_chaude', true, 1.0, 'Décret 87-713, Art. 1', 'Eau chaude sanitaire'),
  (NULL, 'chauffage', true, 1.0, 'Décret 87-713, Art. 1', 'Chauffage collectif'),
  (NULL, 'ascenseur', true, 1.0, 'Décret 87-713, Art. 2', 'Exploitation et entretien ascenseur'),
  (NULL, 'menage', true, 1.0, 'Décret 87-713, Art. 3', 'Nettoyage parties communes'),
  (NULL, 'ordures_menageres', true, 1.0, 'Décret 87-713, Art. 4', 'Enlèvement ordures ménagères'),
  (NULL, 'electricite_commune', true, 1.0, 'Décret 87-713, Art. 3', 'Électricité parties communes'),
  (NULL, 'jardinage', true, 1.0, 'Décret 87-713, Art. 5', 'Entretien espaces verts'),
  (NULL, 'gardiennage', true, 0.75, 'Décret 87-713, Art. 6', '75% récupérable pour gardien'),
  (NULL, 'interphone', true, 1.0, 'Décret 87-713, Art. 2', 'Entretien interphone/digicode'),
  (NULL, 'videosurveillance', true, 1.0, 'Décret 87-713, Art. 2', 'Vidéosurveillance parties communes'),
  
  -- Non récupérables
  (NULL, 'assurance_immeuble', false, 0, 'Loi 89-462', 'Non récupérable sur locataire'),
  (NULL, 'honoraires_syndic', false, 0, 'Loi 89-462', 'Non récupérable'),
  (NULL, 'frais_bancaires', false, 0, 'Loi 89-462', 'Non récupérable'),
  (NULL, 'travaux_exceptionnels', false, 0, 'Loi 89-462', 'Gros travaux non récupérables'),
  (NULL, 'ravalement', false, 0, 'Loi 89-462', 'Non récupérable'),
  
  -- Partiellement récupérables
  (NULL, 'entretien_equipements', true, 0.5, 'Décret 87-713', 'À évaluer selon nature des travaux'),
  (NULL, 'contrat_maintenance', true, 1.0, 'Décret 87-713', 'Contrats d''entretien courant')
ON CONFLICT DO NOTHING;

-- =====================================================
-- FUNCTIONS: Calculs de régularisation
-- =====================================================

-- Fonction: Calculer les jours de bail sur une période
CREATE OR REPLACE FUNCTION calculate_lease_days_in_period(
  p_lease_id UUID,
  p_period_start DATE,
  p_period_end DATE
)
RETURNS TABLE (
  lease_start DATE,
  lease_end DATE,
  period_start DATE,
  period_end DATE,
  overlap_start DATE,
  overlap_end DATE,
  overlap_days INTEGER,
  total_period_days INTEGER,
  prorata_ratio NUMERIC
) AS $$
DECLARE
  v_lease RECORD;
  v_overlap_start DATE;
  v_overlap_end DATE;
  v_total_days INTEGER;
  v_overlap_days INTEGER;
BEGIN
  -- Récupérer le bail
  SELECT l.start_date, COALESCE(l.end_date, p_period_end) as end_date
  INTO v_lease
  FROM leases l WHERE l.id = p_lease_id;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Calculer le chevauchement
  v_overlap_start := GREATEST(v_lease.start_date, p_period_start);
  v_overlap_end := LEAST(v_lease.end_date, p_period_end);
  
  -- Vérifier s'il y a chevauchement
  IF v_overlap_start > v_overlap_end THEN
    RETURN;
  END IF;
  
  v_total_days := (p_period_end - p_period_start) + 1;
  v_overlap_days := (v_overlap_end - v_overlap_start) + 1;
  
  RETURN QUERY SELECT
    v_lease.start_date as lease_start,
    v_lease.end_date as lease_end,
    p_period_start,
    p_period_end,
    v_overlap_start as overlap_start,
    v_overlap_end as overlap_end,
    v_overlap_days as overlap_days,
    v_total_days as total_period_days,
    ROUND(v_overlap_days::NUMERIC / v_total_days, 4) as prorata_ratio;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction: Transformer les charges copro en charges locatives
CREATE OR REPLACE FUNCTION transform_copro_to_tenant_charges(
  p_unit_id UUID,
  p_fiscal_year INTEGER
)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  v_unit RECORD;
  v_lease RECORD;
  v_charge RECORD;
  v_rule RECORD;
  v_lease_days RECORD;
  v_recuperable_ratio NUMERIC;
  v_final_amount NUMERIC;
BEGIN
  -- Récupérer le lot
  SELECT * INTO v_unit FROM copro_units WHERE id = p_unit_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lot non trouvé';
  END IF;
  
  -- Vérifier qu'il y a un bail actif lié
  IF v_unit.linked_property_id IS NULL THEN
    RETURN 0; -- Pas de propriété liée
  END IF;
  
  -- Parcourir les baux actifs sur la propriété liée
  FOR v_lease IN 
    SELECT l.* FROM leases l
    WHERE l.property_id = v_unit.linked_property_id
      AND l.status IN ('active', 'terminated')
      AND (
        (l.start_date <= (p_fiscal_year || '-12-31')::DATE)
        AND (l.end_date IS NULL OR l.end_date >= (p_fiscal_year || '-01-01')::DATE)
      )
  LOOP
    -- Parcourir les charges copro de l'année
    FOR v_charge IN 
      SELECT cc.*, cs.service_type, cs.label as service_label, cs.is_recuperable_locatif
      FROM charges_copro cc
      LEFT JOIN copro_services cs ON cs.id = cc.service_id
      WHERE cc.unit_id = p_unit_id
        AND cc.fiscal_year = p_fiscal_year
        AND cc.status NOT IN ('cancelled')
    LOOP
      -- Récupérer la règle de récupération
      SELECT * INTO v_rule 
      FROM locative_charge_rules 
      WHERE (site_id = v_unit.site_id OR site_id IS NULL)
        AND (service_id = v_charge.service_id OR service_type = v_charge.service_type)
      ORDER BY site_id NULLS LAST, service_id NULLS LAST
      LIMIT 1;
      
      -- Déterminer le ratio de récupération
      IF v_rule IS NOT NULL AND v_rule.is_recuperable THEN
        v_recuperable_ratio := v_rule.recuperable_ratio;
      ELSIF v_charge.is_recuperable_locatif THEN
        v_recuperable_ratio := COALESCE(v_charge.amount_recuperable / NULLIF(v_charge.amount, 0), 0);
      ELSE
        v_recuperable_ratio := 0;
      END IF;
      
      -- Calculer le prorata temporis
      SELECT * INTO v_lease_days 
      FROM calculate_lease_days_in_period(v_lease.id, v_charge.period_start, v_charge.period_end);
      
      IF v_lease_days IS NULL OR v_lease_days.overlap_days <= 0 THEN
        CONTINUE; -- Pas de chevauchement
      END IF;
      
      -- Calculer le montant final
      v_final_amount := ROUND(
        v_charge.amount * v_recuperable_ratio * v_lease_days.prorata_ratio, 2
      );
      
      -- Insérer ou mettre à jour la charge locative
      INSERT INTO tenant_charges_base (
        lease_id, unit_id, charge_copro_id, service_id,
        period_start, period_end, fiscal_year,
        label, service_type,
        copro_amount, recuperable_ratio,
        prorata_days, total_period_days, prorata_ratio,
        recuperable_amount, status
      )
      VALUES (
        v_lease.id, p_unit_id, v_charge.id, v_charge.service_id,
        v_charge.period_start, v_charge.period_end, p_fiscal_year,
        COALESCE(v_charge.service_label, 'Charges'), v_charge.service_type,
        v_charge.amount, v_recuperable_ratio,
        v_lease_days.overlap_days, v_lease_days.total_period_days, v_lease_days.prorata_ratio,
        v_final_amount, 'calculated'
      )
      ON CONFLICT (charge_copro_id, lease_id) DO UPDATE SET
        copro_amount = EXCLUDED.copro_amount,
        recuperable_ratio = EXCLUDED.recuperable_ratio,
        prorata_days = EXCLUDED.prorata_days,
        total_period_days = EXCLUDED.total_period_days,
        prorata_ratio = EXCLUDED.prorata_ratio,
        recuperable_amount = EXCLUDED.recuperable_amount,
        updated_at = NOW();
      
      v_count := v_count + 1;
    END LOOP;
  END LOOP;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction: Calculer la régularisation pour un bail
CREATE OR REPLACE FUNCTION calculate_lease_regularisation(
  p_lease_id UUID,
  p_fiscal_year INTEGER
)
RETURNS UUID AS $$
DECLARE
  v_lease RECORD;
  v_unit RECORD;
  v_total_charges NUMERIC := 0;
  v_total_provisions NUMERIC := 0;
  v_regularisation NUMERIC;
  v_type TEXT;
  v_details JSONB := '[]'::JSONB;
  v_result_id UUID;
BEGIN
  -- Récupérer le bail
  SELECT l.*, p.id as property_id
  INTO v_lease
  FROM leases l
  JOIN properties p ON p.id = l.property_id
  WHERE l.id = p_lease_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bail non trouvé';
  END IF;
  
  -- Trouver le lot copro lié
  SELECT * INTO v_unit 
  FROM copro_units 
  WHERE linked_property_id = v_lease.property_id
  LIMIT 1;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Aucun lot de copropriété lié à cette propriété';
  END IF;
  
  -- Transformer les charges copro en charges locatives si pas encore fait
  PERFORM transform_copro_to_tenant_charges(v_unit.id, p_fiscal_year);
  
  -- Calculer le total des charges récupérables
  SELECT COALESCE(SUM(recuperable_amount), 0) INTO v_total_charges
  FROM tenant_charges_base
  WHERE lease_id = p_lease_id AND fiscal_year = p_fiscal_year AND status != 'cancelled';
  
  -- Calculer le total des provisions versées (depuis les paiements de loyer)
  -- On suppose que les charges sont incluses dans le loyer avec un montant forfaitaire
  SELECT COALESCE(SUM(
    CASE 
      WHEN i.period_start >= (p_fiscal_year || '-01-01')::DATE 
        AND i.period_end <= (p_fiscal_year || '-12-31')::DATE
      THEN COALESCE(i.charges_amount, 0)
      ELSE 0
    END
  ), 0) INTO v_total_provisions
  FROM invoices i
  WHERE i.lease_id = p_lease_id 
    AND i.status = 'paid'
    AND EXTRACT(YEAR FROM i.period_start) = p_fiscal_year;
  
  -- Calculer la régularisation
  v_regularisation := ROUND(v_total_charges - v_total_provisions, 2);
  
  -- Déterminer le type
  IF v_regularisation > 0 THEN
    v_type := 'due_by_tenant';
  ELSIF v_regularisation < 0 THEN
    v_type := 'refund_to_tenant';
  ELSE
    v_type := 'balanced';
  END IF;
  
  -- Construire le détail par service
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'service_type', service_type,
    'label', label,
    'copro_amount', SUM(copro_amount),
    'recuperable_amount', SUM(recuperable_amount)
  )), '[]'::JSONB) INTO v_details
  FROM tenant_charges_base
  WHERE lease_id = p_lease_id AND fiscal_year = p_fiscal_year AND status != 'cancelled'
  GROUP BY service_type, label;
  
  -- Insérer ou mettre à jour la régularisation
  INSERT INTO tenant_charge_regularisations (
    lease_id, unit_id,
    period_start, period_end, fiscal_year,
    total_charges_recuperables, total_provisions_versees,
    regularisation_amount, regularisation_type,
    details_by_service, status
  )
  VALUES (
    p_lease_id, v_unit.id,
    (p_fiscal_year || '-01-01')::DATE, (p_fiscal_year || '-12-31')::DATE, p_fiscal_year,
    v_total_charges, v_total_provisions,
    v_regularisation, v_type,
    v_details, 'draft'
  )
  ON CONFLICT (lease_id, fiscal_year) DO UPDATE SET
    total_charges_recuperables = EXCLUDED.total_charges_recuperables,
    total_provisions_versees = EXCLUDED.total_provisions_versees,
    regularisation_amount = EXCLUDED.regularisation_amount,
    regularisation_type = EXCLUDED.regularisation_type,
    details_by_service = EXCLUDED.details_by_service,
    calculated_at = NOW(),
    updated_at = NOW()
  RETURNING id INTO v_result_id;
  
  RETURN v_result_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- VIEWS
-- =====================================================

-- Vue: Synthèse charges locatives par bail
CREATE OR REPLACE VIEW v_tenant_charges_summary AS
SELECT 
  tcb.lease_id,
  l.property_id,
  tcb.unit_id,
  tcb.fiscal_year,
  COUNT(*) as charges_count,
  SUM(tcb.copro_amount) as total_copro_amount,
  SUM(tcb.recuperable_amount) as total_recuperable_amount,
  ROUND(AVG(tcb.prorata_ratio), 4) as avg_prorata_ratio
FROM tenant_charges_base tcb
JOIN leases l ON l.id = tcb.lease_id
WHERE tcb.status != 'cancelled'
GROUP BY tcb.lease_id, l.property_id, tcb.unit_id, tcb.fiscal_year;

-- Vue: Régularisations avec détails
CREATE OR REPLACE VIEW v_regularisations_detailed AS
SELECT 
  tcr.*,
  l.property_id,
  p.address_line1 as property_address,
  cu.lot_number,
  t.first_name as tenant_first_name,
  t.last_name as tenant_last_name,
  t.email as tenant_email
FROM tenant_charge_regularisations tcr
JOIN leases l ON l.id = tcr.lease_id
JOIN properties p ON p.id = l.property_id
LEFT JOIN copro_units cu ON cu.id = tcr.unit_id
LEFT JOIN profiles t ON t.id = l.tenant_id;

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Rules
ALTER TABLE locative_charge_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "locative_rules_select" ON locative_charge_rules
  FOR SELECT USING (
    site_id IS NULL -- Règles globales
    OR site_id IN (SELECT accessible_site_ids())
    OR has_role('platform_admin')
  );

CREATE POLICY "locative_rules_insert" ON locative_charge_rules
  FOR INSERT WITH CHECK (
    site_id IS NULL AND has_role('platform_admin')
    OR is_syndic_of(site_id)
    OR has_role('platform_admin')
  );

CREATE POLICY "locative_rules_update" ON locative_charge_rules
  FOR UPDATE USING (
    has_role('platform_admin')
    OR (site_id IS NOT NULL AND is_syndic_of(site_id))
  );

CREATE POLICY "locative_rules_delete" ON locative_charge_rules
  FOR DELETE USING (has_role('platform_admin'));

-- Tenant charges base
ALTER TABLE tenant_charges_base ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_charges_select" ON tenant_charges_base
  FOR SELECT USING (
    lease_id IN (SELECT id FROM leases WHERE owner_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    ))
    OR lease_id IN (SELECT id FROM leases WHERE tenant_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    ))
    OR unit_id IN (SELECT owned_unit_ids())
    OR unit_id IN (
      SELECT cu.id FROM copro_units cu 
      WHERE cu.site_id IN (SELECT accessible_site_ids())
    )
    OR has_role('platform_admin')
  );

CREATE POLICY "tenant_charges_insert" ON tenant_charges_base
  FOR INSERT WITH CHECK (
    lease_id IN (SELECT id FROM leases WHERE owner_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    ))
    OR unit_id IN (SELECT owned_unit_ids())
    OR has_role('platform_admin')
  );

CREATE POLICY "tenant_charges_update" ON tenant_charges_base
  FOR UPDATE USING (
    lease_id IN (SELECT id FROM leases WHERE owner_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    ))
    OR unit_id IN (SELECT owned_unit_ids())
    OR has_role('platform_admin')
  );

CREATE POLICY "tenant_charges_delete" ON tenant_charges_base
  FOR DELETE USING (has_role('platform_admin'));

-- Regularisations
ALTER TABLE tenant_charge_regularisations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "regularisations_select" ON tenant_charge_regularisations
  FOR SELECT USING (
    lease_id IN (SELECT id FROM leases WHERE owner_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    ))
    OR lease_id IN (SELECT id FROM leases WHERE tenant_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    ))
    OR unit_id IN (SELECT owned_unit_ids())
    OR has_role('platform_admin')
  );

CREATE POLICY "regularisations_insert" ON tenant_charge_regularisations
  FOR INSERT WITH CHECK (
    lease_id IN (SELECT id FROM leases WHERE owner_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    ))
    OR unit_id IN (SELECT owned_unit_ids())
    OR has_role('platform_admin')
  );

CREATE POLICY "regularisations_update" ON tenant_charge_regularisations
  FOR UPDATE USING (
    lease_id IN (SELECT id FROM leases WHERE owner_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    ))
    OR unit_id IN (SELECT owned_unit_ids())
    OR has_role('platform_admin')
  );

CREATE POLICY "regularisations_delete" ON tenant_charge_regularisations
  FOR DELETE USING (has_role('platform_admin'));

-- =====================================================
-- GRANTS
-- =====================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON locative_charge_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_charges_base TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_charge_regularisations TO authenticated;

GRANT SELECT ON v_tenant_charges_summary TO authenticated;
GRANT SELECT ON v_regularisations_detailed TO authenticated;

GRANT EXECUTE ON FUNCTION calculate_lease_days_in_period TO authenticated;
GRANT EXECUTE ON FUNCTION transform_copro_to_tenant_charges TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_lease_regularisation TO authenticated;

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE locative_charge_rules IS 'Règles de récupération des charges sur les locataires';
COMMENT ON TABLE tenant_charges_base IS 'Charges copro transformées en charges récupérables locatives';
COMMENT ON TABLE tenant_charge_regularisations IS 'Régularisations annuelles de charges locatives';

COMMENT ON COLUMN tenant_charges_base.prorata_ratio IS 'Ratio d''occupation du bail sur la période de la charge';
COMMENT ON COLUMN tenant_charge_regularisations.regularisation_amount IS 'Positif = locataire doit payer, Négatif = remboursement';


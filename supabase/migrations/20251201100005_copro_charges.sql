-- =====================================================
-- MIGRATION: Services, Charges et Appels de fonds COPRO
-- Description: Gestion complète des charges de copropriété
-- =====================================================

-- =====================================================
-- TABLE: copro_services (types de charges/services)
-- =====================================================
CREATE TABLE IF NOT EXISTS copro_services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  
  -- Identification
  label TEXT NOT NULL,
  code TEXT, -- Code comptable interne
  
  -- Type de service
  service_type TEXT NOT NULL CHECK (service_type IN (
    'eau', 'eau_chaude', 'chauffage', 'climatisation',
    'electricite_commune', 'gaz_commun',
    'ascenseur', 'interphone', 'digicode', 'videosurveillance',
    'menage', 'gardiennage', 'jardinage', 'piscine',
    'ordures_menageres', 'tout_a_legout',
    'assurance_immeuble', 'assurance_rc',
    'honoraires_syndic', 'frais_bancaires', 'frais_juridiques',
    'entretien_equipements', 'contrat_maintenance',
    'travaux_courants', 'travaux_exceptionnels', 'ravalement',
    'impots_taxes', 'taxe_fonciere',
    'autre'
  )),
  
  -- Périmètre d'application
  scope_type TEXT NOT NULL DEFAULT 'site' CHECK (scope_type IN (
    'site',        -- Tous les lots
    'building',    -- Un bâtiment spécifique
    'unit_group',  -- Groupe de lots spécifiques
    'unit_type'    -- Par type de lot (appartements, parkings, etc.)
  )),
  scope_building_id UUID REFERENCES buildings(id) ON DELETE SET NULL,
  scope_unit_ids UUID[] DEFAULT '{}',
  scope_unit_types TEXT[] DEFAULT '{}',
  
  -- Mode de répartition par défaut
  default_allocation_mode TEXT NOT NULL DEFAULT 'tantieme_general' CHECK (default_allocation_mode IN (
    'tantieme_general',    -- Au prorata des tantièmes généraux
    'tantieme_eau',        -- Tantièmes eau
    'tantieme_chauffage',  -- Tantièmes chauffage
    'tantieme_ascenseur',  -- Tantièmes ascenseur
    'per_unit',            -- Par lot (égalitaire)
    'surface_m2',          -- Au prorata des surfaces
    'consommation',        -- Selon compteurs individuels
    'custom'               -- Répartition manuelle
  )),
  
  -- Récurrence
  is_recurring BOOLEAN NOT NULL DEFAULT true,
  recurrence_period TEXT CHECK (recurrence_period IN (
    'monthly', 'bimonthly', 'quarterly', 'semiannual', 'yearly'
  )),
  
  -- Budget prévisionnel annuel
  budget_annual NUMERIC(15,2) DEFAULT 0,
  budget_monthly NUMERIC(15,2) GENERATED ALWAYS AS (budget_annual / 12) STORED,
  
  -- Charges récupérables sur locataires
  is_recuperable_locatif BOOLEAN NOT NULL DEFAULT false,
  recuperable_ratio_default NUMERIC(5,4) DEFAULT 1.0 
    CHECK (recuperable_ratio_default >= 0 AND recuperable_ratio_default <= 1),
  
  -- Comptabilité
  compte_comptable TEXT,
  tva_applicable BOOLEAN DEFAULT false,
  tva_rate NUMERIC(5,2) DEFAULT 0,
  
  -- État
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER DEFAULT 0,
  
  -- Métadonnées
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_copro_services_site ON copro_services(site_id);
CREATE INDEX IF NOT EXISTS idx_copro_services_type ON copro_services(service_type);
CREATE INDEX IF NOT EXISTS idx_copro_services_active ON copro_services(is_active);

-- =====================================================
-- TABLE: service_contracts (contrats fournisseurs)
-- =====================================================
CREATE TABLE IF NOT EXISTS service_contracts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_id UUID NOT NULL REFERENCES copro_services(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  
  -- Fournisseur
  provider_name TEXT NOT NULL,
  provider_siret TEXT,
  provider_address TEXT,
  provider_phone TEXT,
  provider_email TEXT,
  provider_profile_id UUID REFERENCES profiles(id), -- Si fournisseur dans le système
  
  -- Contrat
  contract_reference TEXT,
  contract_label TEXT,
  description TEXT,
  
  -- Dates
  start_date DATE NOT NULL,
  end_date DATE,
  renewal_type TEXT DEFAULT 'manual' CHECK (renewal_type IN (
    'manual', 'auto_annual', 'auto_tacit'
  )),
  notice_period_days INTEGER DEFAULT 90,
  next_renewal_date DATE,
  
  -- Montants
  amount_annual NUMERIC(15,2) NOT NULL DEFAULT 0,
  amount_monthly NUMERIC(15,2) GENERATED ALWAYS AS (amount_annual / 12) STORED,
  payment_frequency TEXT DEFAULT 'monthly' CHECK (payment_frequency IN (
    'monthly', 'quarterly', 'semiannual', 'yearly', 'on_demand'
  )),
  
  -- TVA
  is_tva_included BOOLEAN DEFAULT true,
  tva_rate NUMERIC(5,2) DEFAULT 20.0,
  
  -- Documents
  contract_document_id UUID,
  
  -- État
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'draft', 'active', 'suspended', 'terminated', 'expired'
  )),
  
  -- Alertes
  alert_before_end_days INTEGER DEFAULT 60,
  
  -- Métadonnées
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_service_contracts_service ON service_contracts(service_id);
CREATE INDEX IF NOT EXISTS idx_service_contracts_site ON service_contracts(site_id);
CREATE INDEX IF NOT EXISTS idx_service_contracts_status ON service_contracts(status);
CREATE INDEX IF NOT EXISTS idx_service_contracts_end_date ON service_contracts(end_date);

-- =====================================================
-- TABLE: service_expenses (factures/dépenses)
-- =====================================================
CREATE TABLE IF NOT EXISTS service_expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  service_id UUID REFERENCES copro_services(id) ON DELETE SET NULL,
  contract_id UUID REFERENCES service_contracts(id) ON DELETE SET NULL,
  
  -- Identification
  expense_number TEXT, -- Numéro interne
  invoice_number TEXT, -- Numéro facture fournisseur
  invoice_date DATE NOT NULL,
  
  -- Fournisseur (si pas de contrat)
  provider_name TEXT,
  provider_siret TEXT,
  
  -- Période couverte
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  fiscal_year INTEGER NOT NULL,
  
  -- Libellé
  label TEXT NOT NULL,
  description TEXT,
  
  -- Montants
  amount_ht NUMERIC(15,2) NOT NULL DEFAULT 0,
  amount_tva NUMERIC(15,2) DEFAULT 0,
  amount_ttc NUMERIC(15,2) NOT NULL DEFAULT 0,
  
  -- Répartition
  allocation_mode TEXT NOT NULL DEFAULT 'tantieme_general',
  is_allocated BOOLEAN NOT NULL DEFAULT false,
  allocated_at TIMESTAMPTZ,
  allocated_by UUID REFERENCES auth.users(id),
  
  -- Charges récupérables
  recuperable_amount NUMERIC(15,2) DEFAULT 0,
  non_recuperable_amount NUMERIC(15,2) DEFAULT 0,
  
  -- Paiement
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN (
    'pending', 'partial', 'paid', 'cancelled'
  )),
  payment_date DATE,
  payment_method TEXT,
  payment_reference TEXT,
  
  -- Documents
  invoice_document_id UUID,
  
  -- État
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'pending_validation', 'validated', 'allocated', 'cancelled'
  )),
  validated_at TIMESTAMPTZ,
  validated_by UUID REFERENCES auth.users(id),
  
  -- Métadonnées
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_service_expenses_site ON service_expenses(site_id);
CREATE INDEX IF NOT EXISTS idx_service_expenses_service ON service_expenses(service_id);
CREATE INDEX IF NOT EXISTS idx_service_expenses_period ON service_expenses(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_service_expenses_fiscal_year ON service_expenses(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_service_expenses_status ON service_expenses(status);
CREATE INDEX IF NOT EXISTS idx_service_expenses_allocated ON service_expenses(is_allocated);

-- =====================================================
-- TABLE: charges_copro (répartition par lot)
-- =====================================================
CREATE TABLE IF NOT EXISTS charges_copro (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Références
  expense_id UUID NOT NULL REFERENCES service_expenses(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES copro_units(id) ON DELETE CASCADE,
  service_id UUID REFERENCES copro_services(id) ON DELETE SET NULL,
  
  -- Période
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  fiscal_year INTEGER NOT NULL,
  
  -- Calcul
  allocation_mode TEXT NOT NULL,
  base_value NUMERIC(15,4) NOT NULL, -- Tantièmes ou surface utilisés
  total_base NUMERIC(15,4) NOT NULL, -- Total des bases pour cette répartition
  percentage NUMERIC(10,6) NOT NULL, -- Pourcentage de répartition
  
  -- Montants
  amount NUMERIC(15,2) NOT NULL,
  amount_recuperable NUMERIC(15,2) DEFAULT 0, -- Part récupérable sur locataire
  amount_non_recuperable NUMERIC(15,2) DEFAULT 0,
  
  -- Paiement
  is_paid BOOLEAN NOT NULL DEFAULT false,
  paid_amount NUMERIC(15,2) DEFAULT 0,
  remaining_amount NUMERIC(15,2) GENERATED ALWAYS AS (amount - paid_amount) STORED,
  
  -- État
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'invoiced', 'partial', 'paid', 'cancelled'
  )),
  
  -- Métadonnées
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(expense_id, unit_id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_charges_copro_expense ON charges_copro(expense_id);
CREATE INDEX IF NOT EXISTS idx_charges_copro_unit ON charges_copro(unit_id);
CREATE INDEX IF NOT EXISTS idx_charges_copro_period ON charges_copro(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_charges_copro_fiscal_year ON charges_copro(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_charges_copro_status ON charges_copro(status);

-- =====================================================
-- TABLE: calls_for_funds (appels de fonds)
-- =====================================================
CREATE TABLE IF NOT EXISTS calls_for_funds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  
  -- Identification
  call_number TEXT NOT NULL,
  label TEXT NOT NULL,
  
  -- Type d'appel
  call_type TEXT NOT NULL DEFAULT 'provision' CHECK (call_type IN (
    'provision',      -- Appel de provisions courantes
    'regularisation', -- Régularisation annuelle
    'travaux',        -- Appel pour travaux votés
    'exceptionnel'    -- Appel exceptionnel
  )),
  
  -- Période
  period_label TEXT NOT NULL, -- "1er trimestre 2025"
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  fiscal_year INTEGER NOT NULL,
  
  -- Échéance
  due_date DATE NOT NULL,
  
  -- Montants globaux
  total_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  
  -- Dates
  created_date DATE NOT NULL DEFAULT CURRENT_DATE,
  sent_at TIMESTAMPTZ,
  sent_by UUID REFERENCES auth.users(id),
  
  -- État
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'validated', 'sent', 'partial', 'closed', 'cancelled'
  )),
  
  -- Documents
  pdf_document_id UUID,
  
  -- Métadonnées
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(site_id, call_number)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_calls_for_funds_site ON calls_for_funds(site_id);
CREATE INDEX IF NOT EXISTS idx_calls_for_funds_period ON calls_for_funds(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_calls_for_funds_fiscal_year ON calls_for_funds(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_calls_for_funds_status ON calls_for_funds(status);
CREATE INDEX IF NOT EXISTS idx_calls_for_funds_due_date ON calls_for_funds(due_date);

-- =====================================================
-- TABLE: call_for_funds_items (lignes d'appel par lot)
-- =====================================================
CREATE TABLE IF NOT EXISTS call_for_funds_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_id UUID NOT NULL REFERENCES calls_for_funds(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES copro_units(id) ON DELETE CASCADE,
  
  -- Propriétaire au moment de l'appel
  owner_profile_id UUID REFERENCES profiles(id),
  owner_name TEXT,
  owner_email TEXT,
  
  -- Détails lot
  lot_number TEXT NOT NULL,
  tantieme_general INTEGER NOT NULL,
  
  -- Montants
  amount NUMERIC(15,2) NOT NULL,
  previous_balance NUMERIC(15,2) DEFAULT 0, -- Solde antérieur
  total_due NUMERIC(15,2) GENERATED ALWAYS AS (amount + previous_balance) STORED,
  
  -- Paiement
  paid_amount NUMERIC(15,2) DEFAULT 0,
  remaining_amount NUMERIC(15,2) GENERATED ALWAYS AS (amount + previous_balance - paid_amount) STORED,
  
  -- État
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'sent', 'partial', 'paid', 'cancelled'
  )),
  
  -- Envoi
  sent_at TIMESTAMPTZ,
  sent_method TEXT CHECK (sent_method IN ('email', 'postal', 'both')),
  email_sent BOOLEAN DEFAULT false,
  postal_sent BOOLEAN DEFAULT false,
  
  -- Relances
  reminder_count INTEGER DEFAULT 0,
  last_reminder_at TIMESTAMPTZ,
  
  -- Métadonnées
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(call_id, unit_id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_call_items_call ON call_for_funds_items(call_id);
CREATE INDEX IF NOT EXISTS idx_call_items_unit ON call_for_funds_items(unit_id);
CREATE INDEX IF NOT EXISTS idx_call_items_owner ON call_for_funds_items(owner_profile_id);
CREATE INDEX IF NOT EXISTS idx_call_items_status ON call_for_funds_items(status);

-- =====================================================
-- TABLE: copro_payments (paiements copropriétaires)
-- =====================================================
CREATE TABLE IF NOT EXISTS copro_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES copro_units(id) ON DELETE CASCADE,
  
  -- Source du paiement
  call_item_id UUID REFERENCES call_for_funds_items(id) ON DELETE SET NULL,
  charge_id UUID REFERENCES charges_copro(id) ON DELETE SET NULL,
  
  -- Payeur
  payer_profile_id UUID REFERENCES profiles(id),
  payer_name TEXT,
  
  -- Paiement
  amount NUMERIC(15,2) NOT NULL,
  payment_date DATE NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN (
    'virement', 'cheque', 'prelevement', 'cb', 'especes', 'autre'
  )),
  
  -- Références
  reference TEXT, -- Référence de paiement
  bank_reference TEXT, -- Référence bancaire
  check_number TEXT,
  
  -- État
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'validated', 'rejected', 'cancelled'
  )),
  validated_at TIMESTAMPTZ,
  validated_by UUID REFERENCES auth.users(id),
  
  -- Notes
  notes TEXT,
  
  -- Métadonnées
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_copro_payments_site ON copro_payments(site_id);
CREATE INDEX IF NOT EXISTS idx_copro_payments_unit ON copro_payments(unit_id);
CREATE INDEX IF NOT EXISTS idx_copro_payments_call_item ON copro_payments(call_item_id);
CREATE INDEX IF NOT EXISTS idx_copro_payments_date ON copro_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_copro_payments_status ON copro_payments(status);

-- =====================================================
-- TRIGGERS: Mise à jour automatique
-- =====================================================

-- Trigger pour updated_at
DROP TRIGGER IF EXISTS trg_copro_services_updated ON copro_services;
CREATE TRIGGER trg_copro_services_updated
  BEFORE UPDATE ON copro_services FOR EACH ROW
  EXECUTE FUNCTION trigger_update_timestamp();

DROP TRIGGER IF EXISTS trg_service_contracts_updated ON service_contracts;
CREATE TRIGGER trg_service_contracts_updated
  BEFORE UPDATE ON service_contracts FOR EACH ROW
  EXECUTE FUNCTION trigger_update_timestamp();

DROP TRIGGER IF EXISTS trg_service_expenses_updated ON service_expenses;
CREATE TRIGGER trg_service_expenses_updated
  BEFORE UPDATE ON service_expenses FOR EACH ROW
  EXECUTE FUNCTION trigger_update_timestamp();

DROP TRIGGER IF EXISTS trg_charges_copro_updated ON charges_copro;
CREATE TRIGGER trg_charges_copro_updated
  BEFORE UPDATE ON charges_copro FOR EACH ROW
  EXECUTE FUNCTION trigger_update_timestamp();

DROP TRIGGER IF EXISTS trg_calls_for_funds_updated ON calls_for_funds;
CREATE TRIGGER trg_calls_for_funds_updated
  BEFORE UPDATE ON calls_for_funds FOR EACH ROW
  EXECUTE FUNCTION trigger_update_timestamp();

DROP TRIGGER IF EXISTS trg_call_items_updated ON call_for_funds_items;
CREATE TRIGGER trg_call_items_updated
  BEFORE UPDATE ON call_for_funds_items FOR EACH ROW
  EXECUTE FUNCTION trigger_update_timestamp();

DROP TRIGGER IF EXISTS trg_copro_payments_updated ON copro_payments;
CREATE TRIGGER trg_copro_payments_updated
  BEFORE UPDATE ON copro_payments FOR EACH ROW
  EXECUTE FUNCTION trigger_update_timestamp();

-- =====================================================
-- FUNCTIONS: Allocation des charges
-- =====================================================

-- Fonction: Calculer la répartition d'une dépense
CREATE OR REPLACE FUNCTION calculate_expense_allocation(
  p_expense_id UUID,
  p_allocation_mode TEXT DEFAULT NULL
)
RETURNS TABLE (
  unit_id UUID,
  lot_number TEXT,
  base_value NUMERIC,
  total_base NUMERIC,
  percentage NUMERIC,
  amount NUMERIC,
  recuperable_amount NUMERIC
) AS $$
DECLARE
  v_expense RECORD;
  v_mode TEXT;
  v_total_base NUMERIC;
  v_service RECORD;
BEGIN
  -- Récupérer la dépense
  SELECT se.*, cs.is_recuperable_locatif, cs.recuperable_ratio_default
  INTO v_expense
  FROM service_expenses se
  LEFT JOIN copro_services cs ON cs.id = se.service_id
  WHERE se.id = p_expense_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dépense non trouvée';
  END IF;
  
  -- Déterminer le mode d'allocation
  v_mode := COALESCE(p_allocation_mode, v_expense.allocation_mode, 'tantieme_general');
  
  -- Calculer le total des bases
  SELECT COALESCE(SUM(
    CASE v_mode
      WHEN 'tantieme_general' THEN cu.tantieme_general
      WHEN 'tantieme_eau' THEN cu.tantieme_eau
      WHEN 'tantieme_chauffage' THEN cu.tantieme_chauffage
      WHEN 'tantieme_ascenseur' THEN cu.tantieme_ascenseur
      WHEN 'surface_m2' THEN COALESCE(cu.surface_carrez, cu.surface_habitable, 0)
      WHEN 'per_unit' THEN 1
      ELSE cu.tantieme_general
    END
  ), 0) INTO v_total_base
  FROM copro_units cu
  WHERE cu.site_id = v_expense.site_id AND cu.is_active = true;
  
  IF v_total_base = 0 THEN
    RAISE EXCEPTION 'Total des bases égal à zéro pour ce mode de répartition';
  END IF;
  
  -- Retourner la répartition
  RETURN QUERY
  SELECT 
    cu.id as unit_id,
    cu.lot_number,
    (CASE v_mode
      WHEN 'tantieme_general' THEN cu.tantieme_general
      WHEN 'tantieme_eau' THEN cu.tantieme_eau
      WHEN 'tantieme_chauffage' THEN cu.tantieme_chauffage
      WHEN 'tantieme_ascenseur' THEN cu.tantieme_ascenseur
      WHEN 'surface_m2' THEN COALESCE(cu.surface_carrez, cu.surface_habitable, 0)
      WHEN 'per_unit' THEN 1
      ELSE cu.tantieme_general
    END)::NUMERIC as base_value,
    v_total_base as total_base,
    ROUND(
      (CASE v_mode
        WHEN 'tantieme_general' THEN cu.tantieme_general
        WHEN 'tantieme_eau' THEN cu.tantieme_eau
        WHEN 'tantieme_chauffage' THEN cu.tantieme_chauffage
        WHEN 'tantieme_ascenseur' THEN cu.tantieme_ascenseur
        WHEN 'surface_m2' THEN COALESCE(cu.surface_carrez, cu.surface_habitable, 0)
        WHEN 'per_unit' THEN 1
        ELSE cu.tantieme_general
      END)::NUMERIC / v_total_base * 100, 6
    ) as percentage,
    ROUND(
      v_expense.amount_ttc * (CASE v_mode
        WHEN 'tantieme_general' THEN cu.tantieme_general
        WHEN 'tantieme_eau' THEN cu.tantieme_eau
        WHEN 'tantieme_chauffage' THEN cu.tantieme_chauffage
        WHEN 'tantieme_ascenseur' THEN cu.tantieme_ascenseur
        WHEN 'surface_m2' THEN COALESCE(cu.surface_carrez, cu.surface_habitable, 0)
        WHEN 'per_unit' THEN 1
        ELSE cu.tantieme_general
      END)::NUMERIC / v_total_base, 2
    ) as amount,
    ROUND(
      v_expense.amount_ttc * (CASE v_mode
        WHEN 'tantieme_general' THEN cu.tantieme_general
        WHEN 'tantieme_eau' THEN cu.tantieme_eau
        WHEN 'tantieme_chauffage' THEN cu.tantieme_chauffage
        WHEN 'tantieme_ascenseur' THEN cu.tantieme_ascenseur
        WHEN 'surface_m2' THEN COALESCE(cu.surface_carrez, cu.surface_habitable, 0)
        WHEN 'per_unit' THEN 1
        ELSE cu.tantieme_general
      END)::NUMERIC / v_total_base 
      * COALESCE(v_expense.recuperable_ratio_default, 0), 2
    ) as recuperable_amount
  FROM copro_units cu
  WHERE cu.site_id = v_expense.site_id AND cu.is_active = true
  ORDER BY cu.lot_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction: Appliquer la répartition d'une dépense
CREATE OR REPLACE FUNCTION allocate_expense(p_expense_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_expense RECORD;
  v_count INTEGER := 0;
  v_alloc RECORD;
BEGIN
  -- Récupérer la dépense
  SELECT * INTO v_expense FROM service_expenses WHERE id = p_expense_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dépense non trouvée';
  END IF;
  
  IF v_expense.is_allocated THEN
    RAISE EXCEPTION 'Dépense déjà répartie';
  END IF;
  
  -- Supprimer les anciennes répartitions (au cas où)
  DELETE FROM charges_copro WHERE expense_id = p_expense_id;
  
  -- Insérer les nouvelles répartitions
  FOR v_alloc IN SELECT * FROM calculate_expense_allocation(p_expense_id) LOOP
    INSERT INTO charges_copro (
      expense_id, unit_id, service_id,
      period_start, period_end, fiscal_year,
      allocation_mode, base_value, total_base, percentage,
      amount, amount_recuperable, amount_non_recuperable,
      status
    )
    VALUES (
      p_expense_id, v_alloc.unit_id, v_expense.service_id,
      v_expense.period_start, v_expense.period_end, v_expense.fiscal_year,
      COALESCE(v_expense.allocation_mode, 'tantieme_general'),
      v_alloc.base_value, v_alloc.total_base, v_alloc.percentage,
      v_alloc.amount, v_alloc.recuperable_amount, 
      v_alloc.amount - v_alloc.recuperable_amount,
      'pending'
    );
    v_count := v_count + 1;
  END LOOP;
  
  -- Marquer la dépense comme répartie
  UPDATE service_expenses
  SET 
    is_allocated = true,
    allocated_at = NOW(),
    allocated_by = auth.uid(),
    status = 'allocated',
    updated_at = NOW()
  WHERE id = p_expense_id;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction: Générer un appel de fonds
CREATE OR REPLACE FUNCTION generate_call_for_funds(
  p_site_id UUID,
  p_call_type TEXT,
  p_period_label TEXT,
  p_period_start DATE,
  p_period_end DATE,
  p_due_date DATE
)
RETURNS UUID AS $$
DECLARE
  v_call_id UUID;
  v_call_number TEXT;
  v_fiscal_year INTEGER;
  v_total NUMERIC := 0;
  v_unit RECORD;
BEGIN
  -- Déterminer l'année fiscale
  v_fiscal_year := EXTRACT(YEAR FROM p_period_start)::INTEGER;
  
  -- Générer le numéro d'appel
  SELECT 'AF-' || v_fiscal_year || '-' || LPAD((COALESCE(MAX(
    SUBSTRING(call_number FROM 'AF-\d{4}-(\d+)')::INTEGER
  ), 0) + 1)::TEXT, 3, '0')
  INTO v_call_number
  FROM calls_for_funds
  WHERE site_id = p_site_id AND fiscal_year = v_fiscal_year;
  
  -- Créer l'appel de fonds
  INSERT INTO calls_for_funds (
    site_id, call_number, label, call_type,
    period_label, period_start, period_end, fiscal_year,
    due_date, status
  )
  VALUES (
    p_site_id, v_call_number, p_period_label || ' - Appel de fonds', p_call_type,
    p_period_label, p_period_start, p_period_end, v_fiscal_year,
    p_due_date, 'draft'
  )
  RETURNING id INTO v_call_id;
  
  -- Créer les lignes par lot
  FOR v_unit IN 
    SELECT 
      cu.id, cu.lot_number, cu.tantieme_general,
      o.profile_id as owner_profile_id,
      p.first_name || ' ' || p.last_name as owner_name,
      p.email as owner_email,
      COALESCE((
        SELECT SUM(cfi.remaining_amount)
        FROM call_for_funds_items cfi
        JOIN calls_for_funds cf ON cf.id = cfi.call_id
        WHERE cfi.unit_id = cu.id 
          AND cf.site_id = p_site_id
          AND cfi.status NOT IN ('paid', 'cancelled')
      ), 0) as previous_balance
    FROM copro_units cu
    LEFT JOIN ownerships o ON o.unit_id = cu.id AND o.is_current = true
    LEFT JOIN profiles p ON p.id = o.profile_id
    WHERE cu.site_id = p_site_id AND cu.is_active = true
  LOOP
    -- Calculer le montant de l'appel pour ce lot (basé sur le budget)
    -- On utilise les charges non payées de la période
    DECLARE
      v_amount NUMERIC;
    BEGIN
      SELECT COALESCE(SUM(cc.amount - cc.paid_amount), 0) INTO v_amount
      FROM charges_copro cc
      WHERE cc.unit_id = v_unit.id
        AND cc.period_start >= p_period_start
        AND cc.period_end <= p_period_end
        AND cc.status NOT IN ('paid', 'cancelled');
      
      -- Si pas de charges, calculer un montant provisoire basé sur le budget
      IF v_amount = 0 THEN
        SELECT COALESCE(
          SUM(cs.budget_annual * v_unit.tantieme_general / s.total_tantiemes_general) / 4, 
          0
        ) INTO v_amount
        FROM copro_services cs
        JOIN sites s ON s.id = cs.site_id
        WHERE cs.site_id = p_site_id AND cs.is_active = true;
      END IF;
      
      -- Insérer la ligne
      INSERT INTO call_for_funds_items (
        call_id, unit_id, owner_profile_id, owner_name, owner_email,
        lot_number, tantieme_general, amount, previous_balance, status
      )
      VALUES (
        v_call_id, v_unit.id, v_unit.owner_profile_id, v_unit.owner_name, v_unit.owner_email,
        v_unit.lot_number, v_unit.tantieme_general, v_amount, v_unit.previous_balance, 'pending'
      );
      
      v_total := v_total + v_amount + v_unit.previous_balance;
    END;
  END LOOP;
  
  -- Mettre à jour le total
  UPDATE calls_for_funds SET total_amount = v_total WHERE id = v_call_id;
  
  RETURN v_call_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- VIEWS: Vues de synthèse
-- =====================================================

-- Vue: Solde par lot
CREATE OR REPLACE VIEW v_unit_balance AS
SELECT 
  cu.id as unit_id,
  cu.lot_number,
  cu.site_id,
  s.name as site_name,
  cu.tantieme_general,
  COALESCE(owner_info.owner_name, 'Non attribué') as owner_name,
  COALESCE((
    SELECT SUM(amount)
    FROM charges_copro cc
    WHERE cc.unit_id = cu.id AND cc.status NOT IN ('cancelled')
  ), 0) as total_charges,
  COALESCE((
    SELECT SUM(paid_amount)
    FROM charges_copro cc
    WHERE cc.unit_id = cu.id AND cc.status NOT IN ('cancelled')
  ), 0) as total_paid,
  COALESCE((
    SELECT SUM(amount - paid_amount)
    FROM charges_copro cc
    WHERE cc.unit_id = cu.id AND cc.status NOT IN ('cancelled')
  ), 0) as balance_due
FROM copro_units cu
JOIN sites s ON s.id = cu.site_id
LEFT JOIN LATERAL (
  SELECT p.first_name || ' ' || p.last_name as owner_name
  FROM ownerships o
  JOIN profiles p ON p.id = o.profile_id
  WHERE o.unit_id = cu.id AND o.is_current = true
  LIMIT 1
) owner_info ON true
WHERE cu.is_active = true;

-- Vue: Synthèse charges par service et période
CREATE OR REPLACE VIEW v_charges_summary AS
SELECT 
  cs.id as service_id,
  cs.label as service_label,
  cs.service_type,
  se.fiscal_year,
  se.site_id,
  COUNT(DISTINCT se.id) as expenses_count,
  SUM(se.amount_ttc) as total_expenses,
  SUM(cc.amount) as total_allocated,
  SUM(cc.paid_amount) as total_paid,
  SUM(cc.amount - cc.paid_amount) as total_due
FROM copro_services cs
LEFT JOIN service_expenses se ON se.service_id = cs.id
LEFT JOIN charges_copro cc ON cc.expense_id = se.id
WHERE cs.is_active = true
GROUP BY cs.id, cs.label, cs.service_type, se.fiscal_year, se.site_id;

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Services
ALTER TABLE copro_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "copro_services_select" ON copro_services
  FOR SELECT USING (
    site_id IN (SELECT accessible_site_ids())
    OR has_role('platform_admin')
  );

CREATE POLICY "copro_services_insert" ON copro_services
  FOR INSERT WITH CHECK (is_syndic_of(site_id) OR has_role('platform_admin'));

CREATE POLICY "copro_services_update" ON copro_services
  FOR UPDATE USING (is_syndic_of(site_id) OR has_role('platform_admin'));

CREATE POLICY "copro_services_delete" ON copro_services
  FOR DELETE USING (is_syndic_of(site_id) OR has_role('platform_admin'));

-- Contracts
ALTER TABLE service_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_contracts_select" ON service_contracts
  FOR SELECT USING (
    site_id IN (SELECT accessible_site_ids())
    OR has_role('platform_admin')
  );

CREATE POLICY "service_contracts_insert" ON service_contracts
  FOR INSERT WITH CHECK (is_syndic_of(site_id) OR has_role('platform_admin'));

CREATE POLICY "service_contracts_update" ON service_contracts
  FOR UPDATE USING (is_syndic_of(site_id) OR has_role('platform_admin'));

CREATE POLICY "service_contracts_delete" ON service_contracts
  FOR DELETE USING (is_syndic_of(site_id) OR has_role('platform_admin'));

-- Expenses
ALTER TABLE service_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_expenses_select" ON service_expenses
  FOR SELECT USING (
    site_id IN (SELECT accessible_site_ids())
    OR has_role('platform_admin')
  );

CREATE POLICY "service_expenses_insert" ON service_expenses
  FOR INSERT WITH CHECK (is_syndic_of(site_id) OR has_role('platform_admin'));

CREATE POLICY "service_expenses_update" ON service_expenses
  FOR UPDATE USING (is_syndic_of(site_id) OR has_role('platform_admin'));

CREATE POLICY "service_expenses_delete" ON service_expenses
  FOR DELETE USING (is_syndic_of(site_id) OR has_role('platform_admin'));

-- Charges copro
ALTER TABLE charges_copro ENABLE ROW LEVEL SECURITY;

CREATE POLICY "charges_copro_select" ON charges_copro
  FOR SELECT USING (
    unit_id IN (SELECT owned_unit_ids())
    OR unit_id IN (
      SELECT cu.id FROM copro_units cu 
      WHERE cu.site_id IN (SELECT accessible_site_ids())
    )
    OR has_role('platform_admin')
  );

CREATE POLICY "charges_copro_insert" ON charges_copro
  FOR INSERT WITH CHECK (
    unit_id IN (
      SELECT cu.id FROM copro_units cu 
      WHERE is_syndic_of(cu.site_id)
    )
    OR has_role('platform_admin')
  );

CREATE POLICY "charges_copro_update" ON charges_copro
  FOR UPDATE USING (
    unit_id IN (
      SELECT cu.id FROM copro_units cu 
      WHERE is_syndic_of(cu.site_id)
    )
    OR has_role('platform_admin')
  );

CREATE POLICY "charges_copro_delete" ON charges_copro
  FOR DELETE USING (has_role('platform_admin'));

-- Calls for funds
ALTER TABLE calls_for_funds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "calls_for_funds_select" ON calls_for_funds
  FOR SELECT USING (
    site_id IN (SELECT accessible_site_ids())
    OR has_role('platform_admin')
  );

CREATE POLICY "calls_for_funds_insert" ON calls_for_funds
  FOR INSERT WITH CHECK (is_syndic_of(site_id) OR has_role('platform_admin'));

CREATE POLICY "calls_for_funds_update" ON calls_for_funds
  FOR UPDATE USING (is_syndic_of(site_id) OR has_role('platform_admin'));

CREATE POLICY "calls_for_funds_delete" ON calls_for_funds
  FOR DELETE USING (has_role('platform_admin'));

-- Call items
ALTER TABLE call_for_funds_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "call_items_select" ON call_for_funds_items
  FOR SELECT USING (
    unit_id IN (SELECT owned_unit_ids())
    OR call_id IN (
      SELECT cf.id FROM calls_for_funds cf 
      WHERE cf.site_id IN (SELECT accessible_site_ids())
    )
    OR has_role('platform_admin')
  );

CREATE POLICY "call_items_insert" ON call_for_funds_items
  FOR INSERT WITH CHECK (
    call_id IN (
      SELECT cf.id FROM calls_for_funds cf 
      WHERE is_syndic_of(cf.site_id)
    )
    OR has_role('platform_admin')
  );

CREATE POLICY "call_items_update" ON call_for_funds_items
  FOR UPDATE USING (
    call_id IN (
      SELECT cf.id FROM calls_for_funds cf 
      WHERE is_syndic_of(cf.site_id)
    )
    OR has_role('platform_admin')
  );

CREATE POLICY "call_items_delete" ON call_for_funds_items
  FOR DELETE USING (has_role('platform_admin'));

-- Payments
ALTER TABLE copro_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "copro_payments_select" ON copro_payments
  FOR SELECT USING (
    unit_id IN (SELECT owned_unit_ids())
    OR site_id IN (SELECT accessible_site_ids())
    OR has_role('platform_admin')
  );

CREATE POLICY "copro_payments_insert" ON copro_payments
  FOR INSERT WITH CHECK (
    is_syndic_of(site_id) 
    OR unit_id IN (SELECT owned_unit_ids())
    OR has_role('platform_admin')
  );

CREATE POLICY "copro_payments_update" ON copro_payments
  FOR UPDATE USING (is_syndic_of(site_id) OR has_role('platform_admin'));

CREATE POLICY "copro_payments_delete" ON copro_payments
  FOR DELETE USING (has_role('platform_admin'));

-- =====================================================
-- GRANTS
-- =====================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON copro_services TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON service_contracts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON service_expenses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON charges_copro TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON calls_for_funds TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON call_for_funds_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON copro_payments TO authenticated;

GRANT SELECT ON v_unit_balance TO authenticated;
GRANT SELECT ON v_charges_summary TO authenticated;

GRANT EXECUTE ON FUNCTION calculate_expense_allocation TO authenticated;
GRANT EXECUTE ON FUNCTION allocate_expense TO authenticated;
GRANT EXECUTE ON FUNCTION generate_call_for_funds TO authenticated;

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE copro_services IS 'Types de services/charges de la copropriété';
COMMENT ON TABLE service_contracts IS 'Contrats avec les fournisseurs';
COMMENT ON TABLE service_expenses IS 'Factures et dépenses à répartir';
COMMENT ON TABLE charges_copro IS 'Répartition des charges par lot';
COMMENT ON TABLE calls_for_funds IS 'Appels de fonds trimestriels';
COMMENT ON TABLE call_for_funds_items IS 'Lignes d''appel de fonds par lot';
COMMENT ON TABLE copro_payments IS 'Paiements des copropriétaires';


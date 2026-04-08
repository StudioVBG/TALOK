-- =====================================================
-- MIGRATION: Create entities view + entity_members table
-- Date: 2026-04-07
--
-- CONTEXT: Le module comptabilite (20260406210000) reference
-- les tables `entities` et `entity_members` qui n'existent pas.
-- La table `legal_entities` existe deja et est utilisee partout.
--
-- SOLUTION (Option B - non-destructive) :
-- 1. Creer une vue `entities` pointant vers `legal_entities`
-- 2. Creer la table `entity_members` (junction users <-> entites)
-- 3. Backfill entity_members depuis les proprietaires existants
-- 4. Ajouter colonne `territory` pour TVA DROM-COM
-- =====================================================

-- =====================================================
-- 1. VUE entities → legal_entities
-- Permet au module comptable de faire FROM entities
-- sans renommer la table existante
-- =====================================================
CREATE OR REPLACE VIEW entities AS
  SELECT
    id,
    owner_profile_id,
    entity_type AS type,
    nom AS name,
    nom_commercial,
    siren,
    siret,
    numero_tva,
    adresse_siege AS address,
    code_postal_siege,
    ville_siege,
    pays_siege,
    regime_fiscal,
    tva_assujetti,
    tva_regime,
    tva_taux_defaut,
    iban,
    bic,
    is_active,
    created_at,
    updated_at
  FROM legal_entities;

COMMENT ON VIEW entities IS 'Vue de compatibilite pour le module comptable. Source: legal_entities.';

-- =====================================================
-- 2. TABLE entity_members
-- Junction table: qui a acces a quelle entite
-- Utilisee par toutes les RLS policies du module compta
-- =====================================================
CREATE TABLE IF NOT EXISTS entity_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'member', 'readonly', 'ec')),
  share_percentage NUMERIC(5,2),
  invited_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT entity_member_unique UNIQUE (entity_id, user_id)
);

CREATE INDEX idx_entity_members_entity ON entity_members(entity_id);
CREATE INDEX idx_entity_members_user ON entity_members(user_id);
CREATE INDEX idx_entity_members_profile ON entity_members(profile_id) WHERE profile_id IS NOT NULL;

ALTER TABLE entity_members ENABLE ROW LEVEL SECURITY;

-- Policy: un utilisateur voit ses propres memberships
CREATE POLICY "entity_members_own_access" ON entity_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Policy: un admin d'une entite peut gerer ses membres
CREATE POLICY "entity_members_admin_manage" ON entity_members
  FOR ALL TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members em
      WHERE em.user_id = auth.uid() AND em.role = 'admin'
    )
  )
  WITH CHECK (
    entity_id IN (
      SELECT entity_id FROM entity_members em
      WHERE em.user_id = auth.uid() AND em.role = 'admin'
    )
  );

COMMENT ON TABLE entity_members IS 'Membres d''une entite (SCI, agence, copro). Utilise par RLS de toutes les tables comptables.';

-- =====================================================
-- 3. COLONNE territory sur legal_entities
-- Pour la validation TVA DROM-COM
-- =====================================================
ALTER TABLE legal_entities
  ADD COLUMN IF NOT EXISTS territory TEXT DEFAULT 'metropole'
  CHECK (territory IN ('metropole', 'martinique', 'guadeloupe', 'reunion', 'guyane', 'mayotte'));

COMMENT ON COLUMN legal_entities.territory IS 'Territoire pour taux TVA DROM-COM. Defaut: metropole (20%).';

-- =====================================================
-- 4. BACKFILL entity_members
-- Pour chaque legal_entity existante, creer un member admin
-- en suivant la chaine FK:
-- legal_entities.owner_profile_id → owner_profiles.profile_id
-- → profiles.id → profiles.user_id → auth.users.id
-- =====================================================
INSERT INTO entity_members (entity_id, user_id, profile_id, role)
SELECT
  le.id AS entity_id,
  p.user_id AS user_id,
  p.id AS profile_id,
  'admin' AS role
FROM legal_entities le
JOIN profiles p ON le.owner_profile_id = p.id
WHERE le.is_active = true
ON CONFLICT (entity_id, user_id) DO NOTHING;

-- Aussi backfill depuis entity_associates (associes de SCI, etc.)
INSERT INTO entity_members (entity_id, user_id, profile_id, role, share_percentage)
SELECT
  ea.legal_entity_id AS entity_id,
  p.user_id AS user_id,
  p.id AS profile_id,
  CASE
    WHEN ea.is_gerant THEN 'admin'
    ELSE 'member'
  END AS role,
  ea.pourcentage_capital AS share_percentage
FROM entity_associates ea
JOIN profiles p ON ea.profile_id = p.id
WHERE p.user_id IS NOT NULL
ON CONFLICT (entity_id, user_id) DO NOTHING;

-- =====================================================
-- 5. AUTO-PROVISION: trigger pour creer un entity_member
-- quand une nouvelle legal_entity est creee
-- =====================================================
CREATE OR REPLACE FUNCTION fn_auto_entity_member()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT user_id INTO v_user_id
  FROM profiles
  WHERE id = NEW.owner_profile_id;

  IF v_user_id IS NOT NULL THEN
    INSERT INTO entity_members (entity_id, user_id, profile_id, role)
    VALUES (NEW.id, v_user_id, NEW.owner_profile_id, 'admin')
    ON CONFLICT (entity_id, user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_entity_member ON legal_entities;
CREATE TRIGGER trg_auto_entity_member
  AFTER INSERT ON legal_entities
  FOR EACH ROW
  EXECUTE FUNCTION fn_auto_entity_member();

-- =====================================================
-- 6. Updated_at trigger pour entity_members
-- =====================================================
CREATE OR REPLACE FUNCTION fn_entity_members_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_entity_members_updated_at
  BEFORE UPDATE ON entity_members
  FOR EACH ROW
  EXECUTE FUNCTION fn_entity_members_updated_at();
-- =====================================================
-- MIGRATION: Module Comptabilite complet
-- Date: 2026-04-06
--
-- 15 tables, 16 index, RLS, triggers, fonctions SQL
-- Double-entry accounting, FEC, rapprochement bancaire,
-- plan comptable PCG + copro, amortissements, OCR, audit
-- =====================================================

-- =====================================================
-- 1. ACCOUNTING_EXERCISES
-- =====================================================
CREATE TABLE IF NOT EXISTS accounting_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closing', 'closed')),
  closed_by UUID REFERENCES auth.users(id),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT exercise_dates_valid CHECK (end_date > start_date),
  CONSTRAINT exercise_unique_period UNIQUE (entity_id, start_date, end_date)
);

CREATE INDEX idx_exercises_entity ON accounting_exercises(entity_id);
CREATE INDEX idx_exercises_status ON accounting_exercises(entity_id, status);

ALTER TABLE accounting_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exercises_entity_access" ON accounting_exercises
  FOR ALL TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- 2. CHART_OF_ACCOUNTS
-- =====================================================
CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  account_number TEXT NOT NULL,
  label TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN (
    'asset', 'liability', 'equity', 'income', 'expense'
  )),
  plan_type TEXT NOT NULL DEFAULT 'pcg' CHECK (plan_type IN ('pcg', 'copro', 'custom')),
  account_class INTEGER GENERATED ALWAYS AS (
    CAST(LEFT(account_number, 1) AS INTEGER)
  ) STORED,
  is_active BOOLEAN NOT NULL DEFAULT true,
  parent_account TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT account_number_entity_unique UNIQUE (entity_id, account_number)
);

CREATE INDEX idx_coa_entity ON chart_of_accounts(entity_id);
CREATE INDEX idx_coa_number ON chart_of_accounts(entity_id, account_number);
CREATE INDEX idx_coa_class ON chart_of_accounts(entity_id, account_class);

ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coa_entity_access" ON chart_of_accounts
  FOR ALL TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- 3. ACCOUNTING_JOURNALS
-- =====================================================
CREATE TABLE IF NOT EXISTS accounting_journals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  code TEXT NOT NULL CHECK (code IN ('ACH', 'VE', 'BQ', 'OD', 'AN', 'CL')),
  label TEXT NOT NULL,
  journal_type TEXT NOT NULL CHECK (journal_type IN (
    'purchase', 'sales', 'bank', 'miscellaneous', 'opening', 'closing'
  )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT journal_code_entity_unique UNIQUE (entity_id, code)
);

ALTER TABLE accounting_journals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "journals_entity_access" ON accounting_journals
  FOR ALL TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- 4. ACCOUNTING_ENTRIES
-- =====================================================
CREATE TABLE IF NOT EXISTS accounting_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES accounting_exercises(id),
  journal_code TEXT NOT NULL,
  entry_number TEXT NOT NULL,
  entry_date DATE NOT NULL,
  label TEXT NOT NULL,
  source TEXT,
  reference TEXT,
  is_validated BOOLEAN NOT NULL DEFAULT false,
  validated_by UUID REFERENCES auth.users(id),
  validated_at TIMESTAMPTZ,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  reversal_of UUID REFERENCES accounting_entries(id),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT entry_number_unique UNIQUE (entity_id, exercise_id, entry_number)
);

CREATE INDEX idx_entries_exercise ON accounting_entries(exercise_id);
CREATE INDEX idx_entries_journal ON accounting_entries(entity_id, journal_code);
CREATE INDEX idx_entries_date ON accounting_entries(entity_id, entry_date);

ALTER TABLE accounting_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "entries_entity_access" ON accounting_entries
  FOR ALL TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- 5. ACCOUNTING_ENTRY_LINES
-- =====================================================
CREATE TABLE IF NOT EXISTS accounting_entry_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES accounting_entries(id) ON DELETE CASCADE,
  account_number TEXT NOT NULL,
  label TEXT,
  debit_cents INTEGER NOT NULL DEFAULT 0 CHECK (debit_cents >= 0),
  credit_cents INTEGER NOT NULL DEFAULT 0 CHECK (credit_cents >= 0),
  lettrage TEXT,
  piece_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT single_side CHECK (
    (debit_cents > 0 AND credit_cents = 0) OR
    (debit_cents = 0 AND credit_cents > 0)
  )
);

CREATE INDEX idx_entry_lines_entry ON accounting_entry_lines(entry_id);
CREATE INDEX idx_entry_lines_account ON accounting_entry_lines(account_number);
CREATE INDEX idx_entry_lines_lettrage ON accounting_entry_lines(lettrage) WHERE lettrage IS NOT NULL;

ALTER TABLE accounting_entry_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "entry_lines_via_entry" ON accounting_entry_lines
  FOR ALL TO authenticated
  USING (
    entry_id IN (
      SELECT id FROM accounting_entries
      WHERE entity_id IN (
        SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    entry_id IN (
      SELECT id FROM accounting_entries
      WHERE entity_id IN (
        SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
      )
    )
  );

-- =====================================================
-- 6. BANK_CONNECTIONS
-- =====================================================
CREATE TABLE IF NOT EXISTS bank_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('nordigen', 'bridge', 'manual')),
  provider_connection_id TEXT,
  bank_name TEXT,
  iban_hash TEXT NOT NULL,
  account_type TEXT DEFAULT 'checking' CHECK (account_type IN ('checking', 'savings', 'other')),
  sync_status TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN (
    'pending', 'syncing', 'synced', 'error', 'expired'
  )),
  last_sync_at TIMESTAMPTZ,
  consent_expires_at TIMESTAMPTZ,
  error_message TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT iban_hash_unique UNIQUE (iban_hash)
);

CREATE INDEX idx_bank_conn_entity ON bank_connections(entity_id);

ALTER TABLE bank_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bank_conn_entity_access" ON bank_connections
  FOR ALL TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- 7. BANK_TRANSACTIONS
-- =====================================================
CREATE TABLE IF NOT EXISTS bank_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES bank_connections(id) ON DELETE CASCADE,
  provider_transaction_id TEXT,
  transaction_date DATE NOT NULL,
  value_date DATE,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  label TEXT,
  raw_label TEXT,
  category TEXT,
  counterpart_name TEXT,
  counterpart_iban TEXT,
  reconciliation_status TEXT NOT NULL DEFAULT 'pending' CHECK (reconciliation_status IN (
    'pending', 'matched_auto', 'matched_manual', 'suggested', 'orphan', 'ignored'
  )),
  matched_entry_id UUID REFERENCES accounting_entries(id),
  match_score NUMERIC(5,2),
  suggestion JSONB,
  is_internal_transfer BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bank_tx_connection ON bank_transactions(connection_id);
CREATE INDEX idx_bank_tx_date ON bank_transactions(transaction_date);
CREATE INDEX idx_bank_tx_status ON bank_transactions(reconciliation_status);
CREATE INDEX idx_bank_tx_matched ON bank_transactions(matched_entry_id) WHERE matched_entry_id IS NOT NULL;

ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bank_tx_via_connection" ON bank_transactions
  FOR ALL TO authenticated
  USING (
    connection_id IN (
      SELECT id FROM bank_connections
      WHERE entity_id IN (
        SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    connection_id IN (
      SELECT id FROM bank_connections
      WHERE entity_id IN (
        SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
      )
    )
  );

-- =====================================================
-- 8. DOCUMENT_ANALYSES (OCR + IA)
-- =====================================================
CREATE TABLE IF NOT EXISTS document_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL,
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  extracted_data JSONB NOT NULL DEFAULT '{}',
  confidence_score NUMERIC(5,4),
  suggested_account TEXT,
  suggested_journal TEXT,
  document_type TEXT,
  siret_verified BOOLEAN DEFAULT false,
  tva_coherent BOOLEAN DEFAULT false,
  processing_status TEXT NOT NULL DEFAULT 'pending' CHECK (processing_status IN (
    'pending', 'processing', 'completed', 'failed', 'validated', 'rejected'
  )),
  validated_by UUID REFERENCES auth.users(id),
  validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_doc_analyses_entity ON document_analyses(entity_id);
CREATE INDEX idx_doc_analyses_status ON document_analyses(processing_status);

ALTER TABLE document_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doc_analyses_entity_access" ON document_analyses
  FOR ALL TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- 9. AMORTIZATION_SCHEDULES
-- =====================================================
CREATE TABLE IF NOT EXISTS amortization_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  property_id UUID,
  component TEXT NOT NULL,
  acquisition_date DATE NOT NULL,
  total_amount_cents INTEGER NOT NULL CHECK (total_amount_cents > 0),
  terrain_percent NUMERIC(5,2) NOT NULL DEFAULT 15.00,
  depreciable_amount_cents INTEGER GENERATED ALWAYS AS (
    total_amount_cents - CAST(ROUND(total_amount_cents * terrain_percent / 100) AS INTEGER)
  ) STORED,
  duration_years INTEGER NOT NULL CHECK (duration_years > 0),
  amortization_method TEXT NOT NULL DEFAULT 'linear' CHECK (amortization_method IN ('linear', 'degressive')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_amort_sched_entity ON amortization_schedules(entity_id);

ALTER TABLE amortization_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "amort_sched_entity_access" ON amortization_schedules
  FOR ALL TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- 10. AMORTIZATION_LINES
-- =====================================================
CREATE TABLE IF NOT EXISTS amortization_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES amortization_schedules(id) ON DELETE CASCADE,
  exercise_year INTEGER NOT NULL,
  annual_amount_cents INTEGER NOT NULL CHECK (annual_amount_cents >= 0),
  cumulated_amount_cents INTEGER NOT NULL CHECK (cumulated_amount_cents >= 0),
  net_book_value_cents INTEGER NOT NULL CHECK (net_book_value_cents >= 0),
  is_prorata BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT amort_line_unique UNIQUE (schedule_id, exercise_year)
);

ALTER TABLE amortization_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "amort_lines_via_schedule" ON amortization_lines
  FOR ALL TO authenticated
  USING (
    schedule_id IN (
      SELECT id FROM amortization_schedules
      WHERE entity_id IN (
        SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    schedule_id IN (
      SELECT id FROM amortization_schedules
      WHERE entity_id IN (
        SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
      )
    )
  );

-- =====================================================
-- 11. DEFICIT_TRACKING
-- =====================================================
CREATE TABLE IF NOT EXISTS deficit_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES accounting_exercises(id),
  deficit_type TEXT NOT NULL CHECK (deficit_type IN ('foncier', 'bic_meuble')),
  origin_year INTEGER NOT NULL,
  initial_amount_cents INTEGER NOT NULL CHECK (initial_amount_cents > 0),
  used_amount_cents INTEGER NOT NULL DEFAULT 0 CHECK (used_amount_cents >= 0),
  remaining_amount_cents INTEGER GENERATED ALWAYS AS (
    initial_amount_cents - used_amount_cents
  ) STORED,
  expires_year INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_deficit_entity ON deficit_tracking(entity_id);

ALTER TABLE deficit_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deficit_entity_access" ON deficit_tracking
  FOR ALL TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- 12. CHARGE_REGULARIZATIONS
-- =====================================================
CREATE TABLE IF NOT EXISTS charge_regularizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  lease_id UUID,
  exercise_id UUID NOT NULL REFERENCES accounting_exercises(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  provisions_paid_cents INTEGER NOT NULL DEFAULT 0,
  actual_recoverable_cents INTEGER NOT NULL DEFAULT 0,
  actual_non_recoverable_cents INTEGER NOT NULL DEFAULT 0,
  balance_cents INTEGER GENERATED ALWAYS AS (
    provisions_paid_cents - actual_recoverable_cents
  ) STORED,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'calculated', 'sent', 'paid')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE charge_regularizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "charge_reg_entity_access" ON charge_regularizations
  FOR ALL TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- 13. EC_ACCESS + EC_ANNOTATIONS (Portail Expert-Comptable)
-- =====================================================
CREATE TABLE IF NOT EXISTS ec_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  ec_user_id UUID NOT NULL REFERENCES auth.users(id),
  ec_name TEXT NOT NULL,
  ec_email TEXT NOT NULL,
  access_level TEXT NOT NULL DEFAULT 'read' CHECK (access_level IN ('read', 'annotate', 'validate')),
  granted_by UUID NOT NULL REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ec_access_entity ON ec_access(entity_id);

ALTER TABLE ec_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ec_access_owner" ON ec_access
  FOR ALL TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
    OR ec_user_id = auth.uid()
  )
  WITH CHECK (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS ec_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  entry_id UUID REFERENCES accounting_entries(id),
  ec_user_id UUID NOT NULL REFERENCES auth.users(id),
  annotation_type TEXT NOT NULL CHECK (annotation_type IN (
    'comment', 'question', 'correction', 'validation'
  )),
  content TEXT NOT NULL,
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ec_annotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ec_annotations_access" ON ec_annotations
  FOR ALL TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
    OR ec_user_id = auth.uid()
  )
  WITH CHECK (
    ec_user_id = auth.uid()
  );

-- =====================================================
-- 14. COPRO_BUDGETS + COPRO_FUND_CALLS
-- =====================================================
CREATE TABLE IF NOT EXISTS copro_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES accounting_exercises(id),
  budget_name TEXT NOT NULL,
  budget_lines JSONB NOT NULL DEFAULT '[]',
  total_budget_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'voted', 'executed')),
  voted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE copro_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "copro_budgets_entity_access" ON copro_budgets
  FOR ALL TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS copro_fund_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  budget_id UUID NOT NULL REFERENCES copro_budgets(id) ON DELETE CASCADE,
  copro_lot_id UUID,
  owner_name TEXT NOT NULL,
  tantiemes INTEGER NOT NULL CHECK (tantiemes > 0),
  total_tantiemes INTEGER NOT NULL CHECK (total_tantiemes > 0),
  call_amount_cents INTEGER NOT NULL CHECK (call_amount_cents > 0),
  call_date DATE NOT NULL,
  due_date DATE NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN (
    'pending', 'partial', 'paid', 'overdue'
  )),
  paid_amount_cents INTEGER NOT NULL DEFAULT 0,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE copro_fund_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "copro_fund_calls_entity_access" ON copro_fund_calls
  FOR ALL TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- 15. MANDANT_ACCOUNTS + CRG_REPORTS
-- =====================================================
CREATE TABLE IF NOT EXISTS mandant_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  mandant_name TEXT NOT NULL,
  mandant_user_id UUID REFERENCES auth.users(id),
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (commission_rate >= 0 AND commission_rate <= 100),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE mandant_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mandant_accounts_entity_access" ON mandant_accounts
  FOR ALL TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS crg_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  mandant_id UUID NOT NULL REFERENCES mandant_accounts(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES accounting_exercises(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_income_cents INTEGER NOT NULL DEFAULT 0,
  total_expenses_cents INTEGER NOT NULL DEFAULT 0,
  commission_cents INTEGER NOT NULL DEFAULT 0,
  net_owner_cents INTEGER NOT NULL DEFAULT 0,
  report_data JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'generated', 'sent', 'validated')),
  generated_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE crg_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crg_reports_entity_access" ON crg_reports
  FOR ALL TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- 16. ACCOUNTING_AUDIT_LOG
-- =====================================================
CREATE TABLE IF NOT EXISTS accounting_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id),
  actor_type TEXT NOT NULL DEFAULT 'user' CHECK (actor_type IN ('user', 'system', 'api', 'ec')),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID,
  details JSONB NOT NULL DEFAULT '{}',
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_entity ON accounting_audit_log(entity_id);
CREATE INDEX idx_audit_target ON accounting_audit_log(target_type, target_id);
CREATE INDEX idx_audit_date ON accounting_audit_log(created_at);

ALTER TABLE accounting_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_entity_access" ON accounting_audit_log
  FOR SELECT TO authenticated
  USING (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

-- Audit log is insert-only for the system, read-only for users
CREATE POLICY "audit_log_system_insert" ON accounting_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (
    entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Trigger: Verify entry balance (sum debit = sum credit) before validation
CREATE OR REPLACE FUNCTION fn_check_entry_balance()
RETURNS TRIGGER AS $$
DECLARE
  total_debit INTEGER;
  total_credit INTEGER;
BEGIN
  IF NEW.is_validated = true AND (OLD.is_validated IS DISTINCT FROM true) THEN
    SELECT COALESCE(SUM(debit_cents), 0), COALESCE(SUM(credit_cents), 0)
    INTO total_debit, total_credit
    FROM accounting_entry_lines
    WHERE entry_id = NEW.id;

    IF total_debit != total_credit THEN
      RAISE EXCEPTION 'Entry balance error: debit (%) != credit (%)', total_debit, total_credit;
    END IF;

    IF total_debit = 0 THEN
      RAISE EXCEPTION 'Entry has no lines or all amounts are zero';
    END IF;

    NEW.is_locked := true;
    NEW.validated_at := now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_entry_balance ON accounting_entries;
CREATE TRIGGER trg_entry_balance
  BEFORE UPDATE ON accounting_entries
  FOR EACH ROW
  EXECUTE FUNCTION fn_check_entry_balance();

-- Trigger: Prevent modification of locked/validated entries (intangibilite)
CREATE OR REPLACE FUNCTION fn_locked_entry_guard()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_locked = true THEN
    -- Allow only reversal_of to be set on locked entries
    IF NEW.is_locked = OLD.is_locked
       AND NEW.is_validated = OLD.is_validated
       AND NEW.entry_date = OLD.entry_date
       AND NEW.label = OLD.label
       AND NEW.journal_code = OLD.journal_code THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Cannot modify a locked/validated entry. Use reversal (contre-passation) instead.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_locked_entry ON accounting_entries;
CREATE TRIGGER trg_locked_entry
  BEFORE UPDATE ON accounting_entries
  FOR EACH ROW
  EXECUTE FUNCTION fn_locked_entry_guard();

-- Trigger: Auto audit log on entry changes
CREATE OR REPLACE FUNCTION fn_audit_entry_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO accounting_audit_log (entity_id, actor_id, actor_type, action, target_type, target_id, details)
    VALUES (
      NEW.entity_id,
      NEW.created_by,
      'user',
      'create_entry',
      'accounting_entry',
      NEW.id,
      jsonb_build_object('journal_code', NEW.journal_code, 'entry_number', NEW.entry_number, 'label', NEW.label)
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.is_validated = true AND OLD.is_validated = false THEN
      INSERT INTO accounting_audit_log (entity_id, actor_id, actor_type, action, target_type, target_id, details)
      VALUES (
        NEW.entity_id,
        NEW.validated_by,
        'user',
        'validate_entry',
        'accounting_entry',
        NEW.id,
        jsonb_build_object('entry_number', NEW.entry_number)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_entries ON accounting_entries;
CREATE TRIGGER trg_audit_entries
  AFTER INSERT OR UPDATE ON accounting_entries
  FOR EACH ROW
  EXECUTE FUNCTION fn_audit_entry_changes();

-- Trigger: updated_at auto-update
CREATE OR REPLACE FUNCTION fn_accounting_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'accounting_exercises', 'accounting_entries', 'bank_connections',
      'bank_transactions', 'document_analyses', 'amortization_schedules',
      'deficit_tracking', 'charge_regularizations', 'copro_budgets',
      'copro_fund_calls', 'mandant_accounts', 'crg_reports'
    ])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated_at ON %I', tbl, tbl);
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION fn_accounting_updated_at()',
      tbl, tbl
    );
  END LOOP;
END;
$$;

-- =====================================================
-- HELPER: Generate next entry number
-- =====================================================
CREATE OR REPLACE FUNCTION fn_next_entry_number(
  p_entity_id UUID,
  p_exercise_id UUID,
  p_journal_code TEXT
)
RETURNS TEXT AS $$
DECLARE
  next_seq INTEGER;
  year_part TEXT;
BEGIN
  SELECT EXTRACT(YEAR FROM start_date)::TEXT INTO year_part
  FROM accounting_exercises WHERE id = p_exercise_id;

  SELECT COALESCE(MAX(
    CAST(SPLIT_PART(entry_number, '-', 3) AS INTEGER)
  ), 0) + 1
  INTO next_seq
  FROM accounting_entries
  WHERE entity_id = p_entity_id
    AND exercise_id = p_exercise_id
    AND journal_code = p_journal_code;

  RETURN p_journal_code || '-' || year_part || '-' || LPAD(next_seq::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE accounting_exercises IS 'Exercices comptables par entite (SCI, copro, agence)';
COMMENT ON TABLE chart_of_accounts IS 'Plan comptable PCG/copro/custom par entite';
COMMENT ON TABLE accounting_entries IS 'Ecritures comptables double-entry avec intangibilite';
COMMENT ON TABLE bank_transactions IS 'Transactions bancaires importees pour rapprochement';
COMMENT ON TABLE accounting_audit_log IS 'Journal audit comptable (insertion seule, lecture utilisateur)';
-- Migration: Audit fixes — missing indexes, CHECK constraints, and RLS
-- Idempotent: safe to run multiple times

-- 1. Missing index on sepa_mandates.owner_profile_id
CREATE INDEX IF NOT EXISTS idx_sepa_mandates_owner ON sepa_mandates(owner_profile_id);

-- 2. CHECK constraints on status columns
DO $$ BEGIN
  ALTER TABLE reconciliation_matches
    ADD CONSTRAINT chk_reconciliation_matches_status
    CHECK (status IN ('pending','matched','disputed','resolved'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE payment_schedules
    ADD CONSTRAINT chk_payment_schedules_status
    CHECK (status IN ('pending','active','paused','completed','cancelled'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE receipt_stubs
    ADD CONSTRAINT chk_receipt_stubs_status
    CHECK (status IN ('signed','cancelled','archived'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE subscriptions
    ADD CONSTRAINT chk_subscriptions_status
    CHECK (status IN ('trialing','active','past_due','canceled','incomplete','paused'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE visit_slots
    ADD CONSTRAINT chk_visit_slots_status
    CHECK (status IN ('available','booked','cancelled','completed'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE visit_bookings
    ADD CONSTRAINT chk_visit_bookings_status
    CHECK (status IN ('pending','confirmed','cancelled','no_show','completed'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Enable RLS on lease_notices (idempotent — ENABLE is a no-op if already on)
ALTER TABLE IF EXISTS lease_notices ENABLE ROW LEVEL SECURITY;
-- =====================================================
-- MIGRATION: Reconcile accounting schemas
-- Date: 2026-04-07
--
-- The old migration (20260110000001) created:
--   accounting_journals, accounting_entries, mandant_accounts,
--   charge_regularisations, deposit_operations, bank_reconciliations
--
-- The new migration (20260406210000) tries to create tables with
-- overlapping names but uses IF NOT EXISTS, so conflicting tables
-- are silently skipped.
--
-- This migration:
-- 1. Adds missing columns to old accounting_entries for double-entry support
-- 2. Adds missing columns to old accounting_journals for entity support
-- 3. Adds missing columns to old mandant_accounts for entity support
-- 4. Creates accounting_entry_lines if not exists (new table, no conflict)
-- 5. Ensures all new non-conflicting tables from 20260406210000 exist
-- =====================================================

-- =====================================================
-- 1. Extend accounting_journals with entity support
-- =====================================================
ALTER TABLE public.accounting_journals
  ADD COLUMN IF NOT EXISTS entity_id UUID REFERENCES legal_entities(id),
  ADD COLUMN IF NOT EXISTS label TEXT,
  ADD COLUMN IF NOT EXISTS journal_type TEXT;

-- Backfill label from libelle
UPDATE public.accounting_journals
SET label = libelle
WHERE label IS NULL AND libelle IS NOT NULL;

-- =====================================================
-- 2. Extend accounting_entries with double-entry header fields
-- =====================================================
ALTER TABLE public.accounting_entries
  ADD COLUMN IF NOT EXISTS entity_id UUID REFERENCES legal_entities(id),
  ADD COLUMN IF NOT EXISTS exercise_id UUID REFERENCES accounting_exercises(id),
  ADD COLUMN IF NOT EXISTS entry_number TEXT,
  ADD COLUMN IF NOT EXISTS entry_date DATE,
  ADD COLUMN IF NOT EXISTS label TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS reference TEXT,
  ADD COLUMN IF NOT EXISTS is_validated BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS validated_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS reversal_of UUID REFERENCES accounting_entries(id);

-- Backfill new columns from old columns
UPDATE public.accounting_entries
SET
  entry_number = ecriture_num,
  entry_date = ecriture_date,
  label = ecriture_lib,
  is_validated = (valid_date IS NOT NULL),
  validated_at = valid_date::timestamptz
WHERE entry_number IS NULL AND ecriture_num IS NOT NULL;

-- Add the unique constraint for new entry numbering (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'entry_number_unique'
  ) THEN
    -- Only add if no duplicates exist
    IF (SELECT COUNT(*) FROM (
      SELECT entity_id, exercise_id, entry_number
      FROM public.accounting_entries
      WHERE entity_id IS NOT NULL AND exercise_id IS NOT NULL AND entry_number IS NOT NULL
      GROUP BY entity_id, exercise_id, entry_number
      HAVING COUNT(*) > 1
    ) dups) = 0 THEN
      ALTER TABLE public.accounting_entries
        ADD CONSTRAINT entry_number_unique UNIQUE (entity_id, exercise_id, entry_number);
    END IF;
  END IF;
END $$;

-- =====================================================
-- 3. Extend mandant_accounts with entity support
-- =====================================================
ALTER TABLE public.mandant_accounts
  ADD COLUMN IF NOT EXISTS entity_id UUID REFERENCES legal_entities(id),
  ADD COLUMN IF NOT EXISTS mandant_name TEXT,
  ADD COLUMN IF NOT EXISTS mandant_user_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- =====================================================
-- 4. Ensure accounting_entry_lines exists
-- (This table is NEW — no conflict with old schema)
-- =====================================================
CREATE TABLE IF NOT EXISTS accounting_entry_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES accounting_entries(id) ON DELETE CASCADE,
  account_number TEXT NOT NULL,
  label TEXT,
  debit_cents INTEGER NOT NULL DEFAULT 0 CHECK (debit_cents >= 0),
  credit_cents INTEGER NOT NULL DEFAULT 0 CHECK (credit_cents >= 0),
  lettrage TEXT,
  piece_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT single_side CHECK (
    (debit_cents > 0 AND credit_cents = 0) OR
    (debit_cents = 0 AND credit_cents > 0)
  )
);

CREATE INDEX IF NOT EXISTS idx_entry_lines_entry ON accounting_entry_lines(entry_id);
CREATE INDEX IF NOT EXISTS idx_entry_lines_account ON accounting_entry_lines(account_number);
CREATE INDEX IF NOT EXISTS idx_entry_lines_lettrage ON accounting_entry_lines(lettrage)
  WHERE lettrage IS NOT NULL;

ALTER TABLE accounting_entry_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "entry_lines_via_entry" ON accounting_entry_lines;
CREATE POLICY "entry_lines_via_entry" ON accounting_entry_lines
  FOR ALL TO authenticated
  USING (
    entry_id IN (
      SELECT id FROM accounting_entries
      WHERE entity_id IN (
        SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    entry_id IN (
      SELECT id FROM accounting_entries
      WHERE entity_id IN (
        SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
      )
    )
  );

-- =====================================================
-- 5. Add entity_members RLS policies to old tables
-- (Old tables used role-based RLS, add entity-based too)
-- =====================================================

-- accounting_entries: add entity-based policy
DROP POLICY IF EXISTS "entries_entity_access" ON public.accounting_entries;
CREATE POLICY "entries_entity_access" ON public.accounting_entries
  FOR ALL TO authenticated
  USING (
    entity_id IS NULL  -- allow access to old entries without entity
    OR entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    entity_id IS NULL
    OR entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

-- mandant_accounts: add entity-based policy
DROP POLICY IF EXISTS "mandant_entity_access" ON public.mandant_accounts;
CREATE POLICY "mandant_entity_access" ON public.mandant_accounts
  FOR ALL TO authenticated
  USING (
    entity_id IS NULL
    OR entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    entity_id IS NULL
    OR entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- 6. Rename old accounting_accounts → keep as-is
-- The new chart_of_accounts is a separate table (no conflict)
-- Both can coexist: old for agency, new for owner/copro
-- =====================================================

COMMENT ON TABLE public.accounting_journals IS 'Journaux comptables — extended with entity support for multi-entity accounting';
COMMENT ON TABLE public.accounting_entries IS 'Ecritures comptables — extended with double-entry header fields and entity support';
COMMENT ON TABLE public.mandant_accounts IS 'Comptes mandants — extended with entity support';
-- =====================================================
-- MIGRATION: OCR Category Rules + document_analyses extensions
-- Date: 2026-04-07
-- =====================================================

-- Table for OCR learning rules
CREATE TABLE IF NOT EXISTS ocr_category_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  match_type TEXT NOT NULL CHECK (match_type IN ('supplier_name', 'supplier_siret', 'keyword')),
  match_value TEXT NOT NULL,
  target_account TEXT NOT NULL,
  target_category TEXT,
  target_journal TEXT,
  confidence_boost NUMERIC(5,2) DEFAULT 10.0,
  hit_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (entity_id, match_type, match_value)
);

CREATE INDEX IF NOT EXISTS idx_ocr_rules_entity ON ocr_category_rules(entity_id);
CREATE INDEX IF NOT EXISTS idx_ocr_rules_match ON ocr_category_rules(match_type, match_value);

ALTER TABLE ocr_category_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ocr_rules_entity_access" ON ocr_category_rules
  FOR ALL TO authenticated
  USING (entity_id IN (SELECT entity_id FROM entity_members WHERE user_id = auth.uid()))
  WITH CHECK (entity_id IN (SELECT entity_id FROM entity_members WHERE user_id = auth.uid()));

-- Extend document_analyses with OCR-specific columns
ALTER TABLE document_analyses ADD COLUMN IF NOT EXISTS entry_id UUID REFERENCES accounting_entries(id);
ALTER TABLE document_analyses ADD COLUMN IF NOT EXISTS raw_ocr_text TEXT;
ALTER TABLE document_analyses ADD COLUMN IF NOT EXISTS processing_time_ms INTEGER;
ALTER TABLE document_analyses ADD COLUMN IF NOT EXISTS suggested_entry JSONB;
-- Migration: Table expenses (dépenses/travaux propriétaire)
-- Date: 2026-04-08
-- RLS via chaîne : legal_entities.owner_profile_id → owner_profiles.profile_id
-- Compatible multi-entités (legal_entity_id) + particulier (owner_profile_id direct)

BEGIN;

-- ============================================
-- TABLE: expenses
-- ============================================

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Rattachement entité / propriétaire
  legal_entity_id UUID REFERENCES legal_entities(id) ON DELETE SET NULL,
  owner_profile_id UUID NOT NULL REFERENCES owner_profiles(profile_id) ON DELETE CASCADE,

  -- Rattachement bien (optionnel — une dépense peut concerner plusieurs biens)
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  lease_id UUID REFERENCES leases(id) ON DELETE SET NULL,

  -- Catégorie de dépense
  category TEXT NOT NULL CHECK (category IN (
    'travaux',              -- Travaux / réparations
    'entretien',            -- Entretien courant
    'assurance',            -- Assurance PNO, loyers impayés
    'taxe_fonciere',        -- Taxe foncière
    'charges_copro',        -- Charges de copropriété
    'frais_gestion',        -- Frais de gestion / comptable
    'frais_bancaires',      -- Frais bancaires
    'diagnostic',           -- Diagnostics (DPE, amiante, etc.)
    'mobilier',             -- Mobilier (meublé)
    'honoraires',           -- Honoraires (notaire, huissier, avocat)
    'autre'                 -- Autre
  )),

  -- Détail
  description TEXT NOT NULL,
  montant DECIMAL(12, 2) NOT NULL CHECK (montant > 0),
  date_depense DATE NOT NULL DEFAULT CURRENT_DATE,
  fournisseur TEXT,                              -- Nom du prestataire / fournisseur

  -- TVA
  tva_taux DECIMAL(5, 2) DEFAULT 0,
  tva_montant DECIMAL(12, 2) DEFAULT 0,
  montant_ttc DECIMAL(12, 2) GENERATED ALWAYS AS (montant + COALESCE(tva_montant, 0)) STORED,

  -- Déductibilité fiscale
  deductible BOOLEAN NOT NULL DEFAULT true,
  deduction_exercice INTEGER,                    -- Année de déduction fiscale

  -- Justificatif
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  receipt_storage_path TEXT,

  -- Récurrence (si charge régulière)
  recurrence TEXT CHECK (recurrence IS NULL OR recurrence IN (
    'mensuel', 'trimestriel', 'semestriel', 'annuel', 'ponctuel'
  )) DEFAULT 'ponctuel',

  -- Statut
  statut TEXT NOT NULL DEFAULT 'confirmed' CHECK (statut IN (
    'draft', 'confirmed', 'cancelled'
  )),

  -- Métadonnées
  notes TEXT,
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

-- ============================================
-- INDEX
-- ============================================

CREATE INDEX IF NOT EXISTS idx_expenses_owner ON expenses(owner_profile_id);
CREATE INDEX IF NOT EXISTS idx_expenses_entity ON expenses(legal_entity_id) WHERE legal_entity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_property ON expenses(property_id) WHERE property_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date_depense);
CREATE INDEX IF NOT EXISTS idx_expenses_year ON expenses(date_depense, owner_profile_id);
CREATE INDEX IF NOT EXISTS idx_expenses_statut ON expenses(statut) WHERE statut = 'confirmed';

-- ============================================
-- RLS
-- ============================================

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Propriétaires : accès via la chaîne legal_entities → owner_profiles
-- Supporte à la fois :
--   - Dépenses rattachées à une entité (legal_entity_id IS NOT NULL)
--   - Dépenses en direct (owner_profile_id = profile courant)
CREATE POLICY "Owners can view own expenses" ON expenses
  FOR SELECT TO authenticated
  USING (
    owner_profile_id = get_current_owner_profile_id()
    OR legal_entity_id IN (
      SELECT le.id FROM legal_entities le
      WHERE le.owner_profile_id = get_current_owner_profile_id()
    )
    OR public.user_role() = 'admin'
  );

CREATE POLICY "Owners can insert own expenses" ON expenses
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_profile_id = get_current_owner_profile_id()
    OR legal_entity_id IN (
      SELECT le.id FROM legal_entities le
      WHERE le.owner_profile_id = get_current_owner_profile_id()
    )
  );

CREATE POLICY "Owners can update own expenses" ON expenses
  FOR UPDATE TO authenticated
  USING (
    owner_profile_id = get_current_owner_profile_id()
    OR legal_entity_id IN (
      SELECT le.id FROM legal_entities le
      WHERE le.owner_profile_id = get_current_owner_profile_id()
    )
  )
  WITH CHECK (
    owner_profile_id = get_current_owner_profile_id()
    OR legal_entity_id IN (
      SELECT le.id FROM legal_entities le
      WHERE le.owner_profile_id = get_current_owner_profile_id()
    )
  );

CREATE POLICY "Owners can delete own expenses" ON expenses
  FOR DELETE TO authenticated
  USING (
    owner_profile_id = get_current_owner_profile_id()
    OR legal_entity_id IN (
      SELECT le.id FROM legal_entities le
      WHERE le.owner_profile_id = get_current_owner_profile_id()
    )
  );

CREATE POLICY "Admins full access on expenses" ON expenses
  FOR ALL TO authenticated
  USING (public.user_role() = 'admin')
  WITH CHECK (public.user_role() = 'admin');

-- ============================================
-- TRIGGER: updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_expenses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_expenses_updated_at();

COMMIT;
-- =====================================================
-- MIGRATION: Réconciliation finale des schémas comptables
-- Date: 2026-04-08
--
-- 1. charge_regularisations (FR) → charge_regularizations (EN)
--    - Migre les données de l'ancienne table vers la nouvelle
--    - Crée une vue de compatibilité charge_regularisations
--
-- 2. accounting_entries inline → accounting_entry_lines
--    - Backfill des anciennes écritures inline (debit/credit)
--    - Vers le nouveau modèle header/lignes (entry_lines)
--
-- Idempotent : chaque opération vérifie l'état avant d'agir.
-- =====================================================

BEGIN;

-- =====================================================
-- PARTIE 1 : charge_regularisations → charge_regularizations
-- =====================================================

-- 1a. S'assurer que charge_regularizations a les colonnes de compatibilité
ALTER TABLE public.charge_regularizations
  ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES public.properties(id),
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS annee INTEGER,
  ADD COLUMN IF NOT EXISTS date_emission DATE,
  ADD COLUMN IF NOT EXISTS date_echeance DATE,
  ADD COLUMN IF NOT EXISTS date_paiement DATE,
  ADD COLUMN IF NOT EXISTS nouvelle_provision DECIMAL(15, 2),
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS detail_charges JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- 1b. Migrer les données de charge_regularisations → charge_regularizations
-- Seulement les lignes qui n'existent pas déjà (idempotent via id)
INSERT INTO public.charge_regularizations (
  id,
  lease_id,
  property_id,
  tenant_id,
  annee,
  period_start,
  period_end,
  provisions_paid_cents,
  actual_recoverable_cents,
  actual_non_recoverable_cents,
  status,
  date_emission,
  date_echeance,
  date_paiement,
  nouvelle_provision,
  notes,
  detail_charges,
  created_by,
  created_at,
  updated_at,
  -- entity_id et exercise_id sont NULL — sera backfillé plus tard
  entity_id
)
SELECT
  cr.id,
  cr.lease_id,
  cr.property_id,
  cr.tenant_id,
  cr.annee,
  cr.date_debut,
  cr.date_fin,
  -- Conversion DECIMAL euros → INTEGER cents
  ROUND(cr.provisions_versees * 100)::INTEGER,
  ROUND(cr.charges_reelles * 100)::INTEGER,
  0, -- actual_non_recoverable_cents inconnu dans l'ancien schéma
  -- Mapping statut FR → EN
  CASE cr.statut
    WHEN 'draft' THEN 'draft'
    WHEN 'sent' THEN 'sent'
    WHEN 'paid' THEN 'paid'
    WHEN 'disputed' THEN 'draft'
    WHEN 'cancelled' THEN 'draft'
    ELSE 'draft'
  END,
  cr.date_emission,
  cr.date_echeance,
  cr.date_paiement,
  cr.nouvelle_provision,
  cr.notes,
  cr.detail_charges,
  cr.created_by,
  cr.created_at,
  cr.updated_at,
  -- Résoudre entity_id via property → properties.legal_entity_id
  (SELECT p.legal_entity_id FROM public.properties p WHERE p.id = cr.property_id LIMIT 1)
FROM public.charge_regularisations cr
WHERE NOT EXISTS (
  SELECT 1 FROM public.charge_regularizations crz WHERE crz.id = cr.id
);

-- 1c. Rattacher entity_id + exercise_id sur les lignes migrées qui n'en ont pas
-- entity_id via property
UPDATE public.charge_regularizations
SET entity_id = (
  SELECT p.legal_entity_id
  FROM public.properties p
  WHERE p.id = charge_regularizations.property_id
  LIMIT 1
)
WHERE entity_id IS NULL AND property_id IS NOT NULL;

-- exercise_id via annee → le premier exercice de cette année
UPDATE public.charge_regularizations
SET exercise_id = (
  SELECT ae.id
  FROM public.accounting_exercises ae
  WHERE EXTRACT(YEAR FROM ae.start_date) = charge_regularizations.annee
  ORDER BY ae.start_date ASC
  LIMIT 1
)
WHERE exercise_id IS NULL AND annee IS NOT NULL;

-- 1d. Renommer l'ancienne table et créer une vue de compatibilité
-- On ne DROP pas l'ancienne table pour éviter de casser du code legacy
-- qui pourrait encore la référencer via des FK ou du code direct
ALTER TABLE public.charge_regularisations RENAME TO charge_regularisations_legacy;

-- Vue de compatibilité : le code qui SELECT depuis charge_regularisations
-- continue de fonctionner, pointant vers la table normalisée
CREATE OR REPLACE VIEW public.charge_regularisations AS
SELECT
  id,
  lease_id,
  property_id,
  tenant_id,
  annee,
  period_start AS date_debut,
  period_end AS date_fin,
  -- Conversion cents → euros pour compatibilité
  (provisions_paid_cents / 100.0)::DECIMAL(15,2) AS provisions_versees,
  (actual_recoverable_cents / 100.0)::DECIMAL(15,2) AS charges_reelles,
  ((actual_recoverable_cents - provisions_paid_cents) / 100.0)::DECIMAL(15,2) AS solde,
  detail_charges,
  status AS statut,
  date_emission,
  date_echeance,
  date_paiement,
  nouvelle_provision,
  NULL::DATE AS date_effet_nouvelle_provision,
  notes,
  created_at,
  updated_at,
  created_by
FROM public.charge_regularizations;

COMMENT ON VIEW public.charge_regularisations IS
  'Vue de compatibilité — pointe vers charge_regularizations. Utiliser la table normalisée pour les nouvelles écritures.';

-- 1e. Triggers INSTEAD OF pour que INSERT/UPDATE/DELETE sur la vue
--     redirigent vers charge_regularizations (compatibilité code legacy)

CREATE OR REPLACE FUNCTION charge_regularisations_insert_redirect()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.charge_regularizations (
    id, lease_id, property_id, tenant_id, annee,
    period_start, period_end,
    provisions_paid_cents, actual_recoverable_cents, actual_non_recoverable_cents,
    status, date_emission, date_echeance, date_paiement,
    nouvelle_provision, notes, detail_charges, created_by,
    entity_id
  ) VALUES (
    COALESCE(NEW.id, gen_random_uuid()),
    NEW.lease_id,
    NEW.property_id,
    NEW.tenant_id,
    NEW.annee,
    NEW.date_debut,
    NEW.date_fin,
    ROUND(COALESCE(NEW.provisions_versees, 0) * 100)::INTEGER,
    ROUND(COALESCE(NEW.charges_reelles, 0) * 100)::INTEGER,
    0,
    COALESCE(NEW.statut, 'draft'),
    NEW.date_emission,
    NEW.date_echeance,
    NEW.date_paiement,
    NEW.nouvelle_provision,
    NEW.notes,
    NEW.detail_charges,
    NEW.created_by,
    (SELECT p.legal_entity_id FROM public.properties p WHERE p.id = NEW.property_id LIMIT 1)
  )
  RETURNING id INTO NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER charge_regularisations_on_insert
  INSTEAD OF INSERT ON public.charge_regularisations
  FOR EACH ROW EXECUTE FUNCTION charge_regularisations_insert_redirect();

CREATE OR REPLACE FUNCTION charge_regularisations_update_redirect()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.charge_regularizations SET
    lease_id = NEW.lease_id,
    property_id = NEW.property_id,
    tenant_id = NEW.tenant_id,
    annee = NEW.annee,
    period_start = COALESCE(NEW.date_debut, period_start),
    period_end = COALESCE(NEW.date_fin, period_end),
    provisions_paid_cents = ROUND(COALESCE(NEW.provisions_versees, 0) * 100)::INTEGER,
    actual_recoverable_cents = ROUND(COALESCE(NEW.charges_reelles, 0) * 100)::INTEGER,
    status = COALESCE(NEW.statut, status),
    date_emission = NEW.date_emission,
    date_echeance = NEW.date_echeance,
    date_paiement = NEW.date_paiement,
    nouvelle_provision = NEW.nouvelle_provision,
    notes = NEW.notes,
    detail_charges = NEW.detail_charges,
    updated_at = NOW()
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER charge_regularisations_on_update
  INSTEAD OF UPDATE ON public.charge_regularisations
  FOR EACH ROW EXECUTE FUNCTION charge_regularisations_update_redirect();

CREATE OR REPLACE FUNCTION charge_regularisations_delete_redirect()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.charge_regularizations WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER charge_regularisations_on_delete
  INSTEAD OF DELETE ON public.charge_regularisations
  FOR EACH ROW EXECUTE FUNCTION charge_regularisations_delete_redirect();

-- =====================================================
-- PARTIE 2 : Backfill accounting_entries → entry_lines
-- =====================================================
-- Les anciennes écritures ont debit/credit inline.
-- Le nouveau modèle utilise accounting_entry_lines.
-- On crée une ligne par écriture ancienne qui a un montant.

-- 2a. Insérer les lignes pour les écritures qui n'ont pas encore de lignes
INSERT INTO public.accounting_entry_lines (
  entry_id,
  account_number,
  label,
  debit_cents,
  credit_cents,
  lettrage,
  piece_ref
)
SELECT
  ae.id,
  ae.compte_num,
  ae.ecriture_lib,
  -- Conversion DECIMAL euros → INTEGER cents
  ROUND(ae.debit * 100)::INTEGER,
  ROUND(ae.credit * 100)::INTEGER,
  ae.ecriture_let,
  ae.piece_ref
FROM public.accounting_entries ae
WHERE
  -- Seulement les écritures qui ont des montants inline
  (ae.debit > 0 OR ae.credit > 0)
  -- Et qui n'ont pas encore de lignes associées
  AND NOT EXISTS (
    SELECT 1 FROM public.accounting_entry_lines ael
    WHERE ael.entry_id = ae.id
  )
  -- Et qui ont le format ancien (compte_num rempli)
  AND ae.compte_num IS NOT NULL;

-- 2b. Marquer les anciennes écritures comme ayant été migrées (via metadata)
-- On utilise la colonne source pour tracer
UPDATE public.accounting_entries
SET source = COALESCE(source, 'legacy_inline_migrated')
WHERE
  source IS NULL
  AND (debit > 0 OR credit > 0)
  AND compte_num IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.accounting_entry_lines ael WHERE ael.entry_id = id
  );

-- =====================================================
-- VÉRIFICATION (commentaire informatif)
-- =====================================================
-- Après exécution, vérifier :
--
-- SELECT 'charge_regularizations' AS table_name, COUNT(*) FROM charge_regularizations
-- UNION ALL
-- SELECT 'charge_regularisations_legacy', COUNT(*) FROM charge_regularisations_legacy
-- UNION ALL
-- SELECT 'entries_with_lines', COUNT(DISTINCT entry_id) FROM accounting_entry_lines
-- UNION ALL
-- SELECT 'entries_without_lines', COUNT(*) FROM accounting_entries
--   WHERE (debit > 0 OR credit > 0) AND NOT EXISTS (
--     SELECT 1 FROM accounting_entry_lines WHERE entry_id = accounting_entries.id
--   );

COMMIT;
-- Sprint 5: Copropriété lots + fund call lines
-- Tables for syndic copropriété module

CREATE TABLE IF NOT EXISTS copro_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  copro_entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  lot_number TEXT NOT NULL,
  lot_type TEXT CHECK (lot_type IN ('habitation','commerce','parking','cave','bureau','autre')) DEFAULT 'habitation',
  owner_name TEXT NOT NULL,
  owner_entity_id UUID REFERENCES legal_entities(id),
  owner_profile_id UUID REFERENCES profiles(id),
  tantiemes_generaux INTEGER NOT NULL CHECK (tantiemes_generaux > 0),
  tantiemes_speciaux JSONB DEFAULT '{}',
  surface_m2 NUMERIC(8,2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(copro_entity_id, lot_number)
);
CREATE INDEX idx_copro_lots_entity ON copro_lots(copro_entity_id);
ALTER TABLE copro_lots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "copro_lots_entity_access" ON copro_lots FOR ALL TO authenticated
  USING (copro_entity_id IN (SELECT entity_id FROM entity_members WHERE user_id = auth.uid()))
  WITH CHECK (copro_entity_id IN (SELECT entity_id FROM entity_members WHERE user_id = auth.uid()));

-- Add missing columns to copro_fund_calls for syndic module
ALTER TABLE copro_fund_calls ADD COLUMN IF NOT EXISTS exercise_id UUID REFERENCES accounting_exercises(id);
ALTER TABLE copro_fund_calls ADD COLUMN IF NOT EXISTS call_number TEXT;
ALTER TABLE copro_fund_calls ADD COLUMN IF NOT EXISTS period_label TEXT;
ALTER TABLE copro_fund_calls ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft' CHECK (status IN ('draft','sent','paid','partial','overdue'));

-- Make lot-level columns nullable (calls now represent periods, lines hold lot details)
ALTER TABLE copro_fund_calls ALTER COLUMN owner_name DROP NOT NULL;
ALTER TABLE copro_fund_calls ALTER COLUMN owner_name SET DEFAULT '';
ALTER TABLE copro_fund_calls ALTER COLUMN tantiemes DROP NOT NULL;
ALTER TABLE copro_fund_calls DROP CONSTRAINT IF EXISTS copro_fund_calls_tantiemes_check;
ALTER TABLE copro_fund_calls ALTER COLUMN tantiemes SET DEFAULT 0;
ALTER TABLE copro_fund_calls ALTER COLUMN total_tantiemes DROP NOT NULL;
ALTER TABLE copro_fund_calls DROP CONSTRAINT IF EXISTS copro_fund_calls_total_tantiemes_check;
ALTER TABLE copro_fund_calls ALTER COLUMN total_tantiemes SET DEFAULT 0;

-- Backfill exercise_id from budget if null
UPDATE copro_fund_calls SET exercise_id = copro_budgets.exercise_id
  FROM copro_budgets WHERE copro_fund_calls.budget_id = copro_budgets.id
  AND copro_fund_calls.exercise_id IS NULL;

-- Add copro_fund_call_lines if not exists
CREATE TABLE IF NOT EXISTS copro_fund_call_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES copro_fund_calls(id) ON DELETE CASCADE,
  lot_id UUID NOT NULL REFERENCES copro_lots(id),
  owner_name TEXT NOT NULL,
  tantiemes INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  paid_cents INTEGER NOT NULL DEFAULT 0 CHECK (paid_cents >= 0),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','partial','paid','overdue')),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE copro_fund_call_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "copro_fund_call_lines_access" ON copro_fund_call_lines FOR ALL TO authenticated
  USING (call_id IN (SELECT id FROM copro_fund_calls WHERE entity_id IN (SELECT entity_id FROM entity_members WHERE user_id = auth.uid())));
-- ============================================================================
-- Sprint 6: Agency Hoguet compliance columns
--
-- Adds Carte G (carte professionnelle gestion immobiliere) and caisse de
-- garantie information to legal_entities for Loi Hoguet compliance.
-- ============================================================================

ALTER TABLE legal_entities ADD COLUMN IF NOT EXISTS carte_g_numero TEXT;
ALTER TABLE legal_entities ADD COLUMN IF NOT EXISTS carte_g_expiry DATE;
ALTER TABLE legal_entities ADD COLUMN IF NOT EXISTS caisse_garantie TEXT;
ALTER TABLE legal_entities ADD COLUMN IF NOT EXISTS caisse_garantie_numero TEXT;

-- Index for quick Hoguet compliance checks
CREATE INDEX IF NOT EXISTS idx_legal_entities_carte_g
  ON legal_entities (carte_g_numero)
  WHERE carte_g_numero IS NOT NULL;

COMMENT ON COLUMN legal_entities.carte_g_numero IS 'Numero de carte professionnelle G (gestion immobiliere) - Loi Hoguet';
COMMENT ON COLUMN legal_entities.carte_g_expiry IS 'Date expiration de la carte G';
COMMENT ON COLUMN legal_entities.caisse_garantie IS 'Nom de la caisse de garantie financiere';
COMMENT ON COLUMN legal_entities.caisse_garantie_numero IS 'Numero adhesion a la caisse de garantie';

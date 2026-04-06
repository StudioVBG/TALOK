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
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
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
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
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
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
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
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
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
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
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
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
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
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
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
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
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
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
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
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
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
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
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
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
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
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
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
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
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
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
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
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
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

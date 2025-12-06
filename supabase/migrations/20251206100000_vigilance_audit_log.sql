-- =====================================================
-- MIGRATION: Log d'audit des vérifications de vigilance
-- Conformité Article L.8222-1 du Code du travail
-- =====================================================

-- =====================================================
-- 1. TABLE: vigilance_audit_log
-- Historique des vérifications de vigilance
-- =====================================================

CREATE TABLE IF NOT EXISTS vigilance_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Acteurs
  owner_profile_id UUID NOT NULL REFERENCES profiles(id),
  provider_profile_id UUID NOT NULL REFERENCES profiles(id),
  
  -- Contexte
  quote_id UUID REFERENCES quotes(id),
  work_order_id UUID REFERENCES work_orders(id),
  
  -- Montants
  amount_ht DECIMAL(10,2) NOT NULL,
  threshold_ht DECIMAL(10,2) NOT NULL DEFAULT 5000,
  yearly_total_ht DECIMAL(10,2), -- Cumul annuel
  
  -- Résultat de la vérification
  is_required BOOLEAN NOT NULL DEFAULT true,
  is_compliant BOOLEAN NOT NULL,
  
  -- Documents
  missing_documents TEXT[] DEFAULT '{}',
  expired_documents TEXT[] DEFAULT '{}',
  valid_documents TEXT[] DEFAULT '{}',
  
  -- Action prise
  action_taken TEXT NOT NULL CHECK (action_taken IN (
    'approved',   -- Accepté (conforme)
    'blocked',    -- Bloqué (non conforme)
    'override'    -- Passé outre (avec justification)
  )),
  override_reason TEXT, -- Obligatoire si action_taken = 'override'
  
  -- Métadonnées
  ip_address INET,
  user_agent TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX idx_vigilance_audit_owner ON vigilance_audit_log(owner_profile_id);
CREATE INDEX idx_vigilance_audit_provider ON vigilance_audit_log(provider_profile_id);
CREATE INDEX idx_vigilance_audit_date ON vigilance_audit_log(created_at);
CREATE INDEX idx_vigilance_audit_action ON vigilance_audit_log(action_taken);

-- =====================================================
-- 2. VUE: Cumul annuel par couple propriétaire/prestataire
-- =====================================================

CREATE OR REPLACE VIEW vigilance_yearly_totals AS
SELECT 
  owner_profile_id,
  provider_profile_id,
  EXTRACT(YEAR FROM created_at) AS year,
  SUM(amount_ht) AS total_amount_ht,
  COUNT(*) AS transaction_count,
  BOOL_OR(NOT is_compliant) AS had_compliance_issues
FROM vigilance_audit_log
WHERE action_taken IN ('approved', 'override')
GROUP BY owner_profile_id, provider_profile_id, EXTRACT(YEAR FROM created_at);

-- =====================================================
-- 3. FONCTION: Vérifier le cumul annuel
-- =====================================================

CREATE OR REPLACE FUNCTION get_vigilance_yearly_total(
  p_owner_id UUID,
  p_provider_id UUID,
  p_year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)
)
RETURNS DECIMAL
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total DECIMAL;
BEGIN
  SELECT COALESCE(SUM(amount_ht), 0) INTO v_total
  FROM vigilance_audit_log
  WHERE owner_profile_id = p_owner_id
    AND provider_profile_id = p_provider_id
    AND EXTRACT(YEAR FROM created_at) = p_year
    AND action_taken IN ('approved', 'override');
  
  RETURN v_total;
END;
$$;

-- =====================================================
-- 4. RLS POLICIES
-- =====================================================

ALTER TABLE vigilance_audit_log ENABLE ROW LEVEL SECURITY;

-- Les propriétaires peuvent voir leurs propres logs
DROP POLICY IF EXISTS "Owners can view own vigilance logs" ON vigilance_audit_log;
CREATE POLICY "Owners can view own vigilance logs"
  ON vigilance_audit_log FOR SELECT
  USING (
    owner_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Les prestataires peuvent voir les logs les concernant
DROP POLICY IF EXISTS "Providers can view own vigilance logs" ON vigilance_audit_log;
CREATE POLICY "Providers can view own vigilance logs"
  ON vigilance_audit_log FOR SELECT
  USING (
    provider_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Les admins peuvent tout voir
DROP POLICY IF EXISTS "Admins can view all vigilance logs" ON vigilance_audit_log;
CREATE POLICY "Admins can view all vigilance logs"
  ON vigilance_audit_log FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Insertion uniquement par le système (service role)
DROP POLICY IF EXISTS "System can insert vigilance logs" ON vigilance_audit_log;
CREATE POLICY "System can insert vigilance logs"
  ON vigilance_audit_log FOR INSERT
  WITH CHECK (true); -- Contrôlé par le backend

-- =====================================================
-- 5. COMMENTAIRES
-- =====================================================

COMMENT ON TABLE vigilance_audit_log IS 'Log d''audit des vérifications de vigilance (Article L.8222-1)';
COMMENT ON FUNCTION get_vigilance_yearly_total IS 'Calcule le cumul annuel des prestations entre un propriétaire et un prestataire';


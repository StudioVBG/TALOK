-- =====================================================
-- MIGRATION: Fix 2 SQL bugs (signature tracking + analytics view)
-- Date: 2026-04-09
-- =====================================================

-- ============================================================
-- BUG 2: "column reference period_month is ambiguous"
-- The RETURNS TABLE column `period_month` clashes with
-- subscription_usage.period_month in PL/pgSQL queries.
-- Fix: prefix all column references with the table name.
-- ============================================================

-- Fix get_signature_usage
CREATE OR REPLACE FUNCTION get_signature_usage(p_subscription_id UUID)
RETURNS TABLE (
  signatures_used INTEGER,
  signatures_limit INTEGER,
  signatures_remaining INTEGER,
  usage_percentage INTEGER,
  period_month TEXT,
  last_signature_at TIMESTAMPTZ
) AS $$
DECLARE
  v_current_month TEXT := TO_CHAR(NOW(), 'YYYY-MM');
  v_used INTEGER;
  v_limit INTEGER;
  v_last_at TIMESTAMPTZ;
BEGIN
  SELECT
    COALESCE(SUM(su.quantity), 0)::INTEGER,
    MAX(su.created_at)
  INTO v_used, v_last_at
  FROM subscription_usage su
  WHERE su.subscription_id = p_subscription_id
    AND su.usage_type = 'signature'
    AND su.period_month = v_current_month;

  SELECT
    COALESCE((sp.features->>'signatures_monthly_quota')::INTEGER, 0)
  INTO v_limit
  FROM subscriptions s
  JOIN subscription_plans sp ON s.plan_id = sp.id
  WHERE s.id = p_subscription_id;

  v_limit := COALESCE(v_limit, 0);
  v_used := COALESCE(v_used, 0);

  RETURN QUERY SELECT
    v_used,
    v_limit,
    CASE WHEN v_limit = -1 THEN 999999 ELSE GREATEST(0, v_limit - v_used) END,
    CASE
      WHEN v_limit = -1 THEN 0
      WHEN v_limit = 0 THEN 100
      ELSE LEAST(100, (v_used * 100) / NULLIF(v_limit, 0))
    END::INTEGER,
    v_current_month,
    v_last_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Fix increment_signature_usage
CREATE OR REPLACE FUNCTION increment_signature_usage(
  p_subscription_id UUID,
  p_quantity INTEGER DEFAULT 1,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS BOOLEAN AS $$
DECLARE
  v_current_month TEXT := TO_CHAR(NOW(), 'YYYY-MM');
  v_used INTEGER;
  v_limit INTEGER;
BEGIN
  SELECT COALESCE(SUM(su.quantity), 0)::INTEGER
  INTO v_used
  FROM subscription_usage su
  WHERE su.subscription_id = p_subscription_id
    AND su.usage_type = 'signature'
    AND su.period_month = v_current_month;

  SELECT
    COALESCE((sp.features->>'signatures_monthly_quota')::INTEGER, 0)
  INTO v_limit
  FROM subscriptions s
  JOIN subscription_plans sp ON s.plan_id = sp.id
  WHERE s.id = p_subscription_id;

  IF v_limit != -1 AND (COALESCE(v_used, 0) + p_quantity) > v_limit THEN
    RETURN false;
  END IF;

  INSERT INTO subscription_usage (
    subscription_id, usage_type, quantity, period_month, metadata
  ) VALUES (
    p_subscription_id, 'signature', p_quantity, v_current_month, p_metadata
  );

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix can_use_signature
CREATE OR REPLACE FUNCTION can_use_signature(p_subscription_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_month TEXT := TO_CHAR(NOW(), 'YYYY-MM');
  v_used INTEGER;
  v_limit INTEGER;
BEGIN
  SELECT COALESCE(SUM(su.quantity), 0)::INTEGER
  INTO v_used
  FROM subscription_usage su
  WHERE su.subscription_id = p_subscription_id
    AND su.usage_type = 'signature'
    AND su.period_month = v_current_month;

  SELECT
    COALESCE((sp.features->>'signatures_monthly_quota')::INTEGER, 0)
  INTO v_limit
  FROM subscriptions s
  JOIN subscription_plans sp ON s.plan_id = sp.id
  WHERE s.id = p_subscription_id;

  IF v_limit = -1 THEN RETURN true; END IF;
  RETURN v_used < v_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;


-- ============================================================
-- BUG 3: "column i.created_at must appear in the GROUP BY clause"
-- The mv_owner_monthly_stats materialized view was created with
-- IF NOT EXISTS, so it may be stale. Drop and recreate.
-- ============================================================

DROP MATERIALIZED VIEW IF EXISTS mv_owner_monthly_stats;

CREATE MATERIALIZED VIEW mv_owner_monthly_stats AS
SELECT
  p.id AS owner_id,
  DATE_TRUNC('month', i.created_at) AS month,
  COUNT(DISTINCT prop.id) AS properties_count,
  COUNT(DISTINCT l.id) AS active_leases_count,
  COUNT(DISTINCT i.id) AS invoices_count,
  COALESCE(SUM(i.montant_total), 0) AS total_invoiced,
  COALESCE(SUM(CASE WHEN i.statut = 'paid' THEN i.montant_total ELSE 0 END), 0) AS total_collected,
  COALESCE(SUM(CASE WHEN i.statut = 'late' THEN i.montant_total ELSE 0 END), 0) AS total_late,
  COUNT(CASE WHEN i.statut = 'paid' THEN 1 END) AS paid_invoices_count,
  COUNT(CASE WHEN i.statut = 'late' THEN 1 END) AS late_invoices_count,
  ROUND(
    CASE
      WHEN COUNT(i.id) > 0
      THEN COUNT(CASE WHEN i.statut = 'paid' THEN 1 END)::DECIMAL / COUNT(i.id) * 100
      ELSE 0
    END, 2
  ) AS collection_rate
FROM profiles p
LEFT JOIN properties prop ON prop.owner_id = p.id
LEFT JOIN leases l ON l.property_id = prop.id AND l.statut = 'active'
LEFT JOIN invoices i ON i.owner_id = p.id
WHERE p.role = 'owner'
GROUP BY p.id, DATE_TRUNC('month', i.created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_owner_monthly_stats
  ON mv_owner_monthly_stats(owner_id, month);


-- Verification
DO $$ BEGIN
  RAISE NOTICE 'Fixed: signature tracking period_month ambiguity + analytics GROUP BY';
END $$;

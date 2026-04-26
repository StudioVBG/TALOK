-- =====================================================
-- ACCOUNTING MATERIALIZED VIEWS
-- =====================================================
-- Pre-computes the balance and grand-livre aggregations from
-- accounting_entry_lines so /api/accounting/balance and the FEC export
-- read from a single indexed source instead of re-aggregating millions
-- of rows on every request.
--
-- Refreshed:
--   1. on demand via fn_refresh_accounting_views(entity_id?)
--   2. nightly via pg_cron (configured separately, see comments)
--   3. at close-exercise time from engine.closeExercise (TS code)
-- =====================================================

SET lock_timeout = '10s';

-- =====================================================
-- 1. mv_accounting_balance
--    One row per (entity_id, exercise_id, account_number) with
--    aggregated debit / credit / solde. Excludes informational
--    entries (micro_foncier mode) so reports stay official.
-- =====================================================

DROP MATERIALIZED VIEW IF EXISTS mv_accounting_balance CASCADE;

CREATE MATERIALIZED VIEW mv_accounting_balance AS
SELECT
  e.entity_id,
  e.exercise_id,
  l.account_number,
  COALESCE(coa.label, l.account_number)                         AS account_label,
  SUM(l.debit_cents)::BIGINT                                    AS total_debit_cents,
  SUM(l.credit_cents)::BIGINT                                   AS total_credit_cents,
  GREATEST(SUM(l.debit_cents) - SUM(l.credit_cents), 0)::BIGINT AS solde_debit_cents,
  GREATEST(SUM(l.credit_cents) - SUM(l.debit_cents), 0)::BIGINT AS solde_credit_cents,
  COUNT(*)::BIGINT                                              AS line_count
FROM accounting_entry_lines l
JOIN accounting_entries     e
  ON e.id = l.entry_id
 AND e.is_validated = true
 AND e.informational = false
LEFT JOIN chart_of_accounts coa
  ON coa.entity_id = e.entity_id
 AND coa.account_number = l.account_number
GROUP BY e.entity_id, e.exercise_id, l.account_number, coa.label;

CREATE UNIQUE INDEX mv_accounting_balance_pk
  ON mv_accounting_balance (entity_id, exercise_id, account_number);

CREATE INDEX mv_accounting_balance_account_prefix
  ON mv_accounting_balance (entity_id, exercise_id, left(account_number, 1));

COMMENT ON MATERIALIZED VIEW mv_accounting_balance IS
  'Pre-aggregated balance per account/exercise. Refreshed nightly + on close.';

-- =====================================================
-- 2. mv_accounting_grand_livre
--    One row per validated line with denormalized entry header info,
--    so the GL view of an account is a single index scan instead of
--    a join + ORDER BY.
-- =====================================================

DROP MATERIALIZED VIEW IF EXISTS mv_accounting_grand_livre CASCADE;

CREATE MATERIALIZED VIEW mv_accounting_grand_livre AS
SELECT
  l.id              AS line_id,
  e.id              AS entry_id,
  e.entity_id,
  e.exercise_id,
  e.journal_code,
  e.entry_number,
  e.entry_date,
  e.label           AS entry_label,
  e.reference,
  l.account_number,
  COALESCE(coa.label, l.account_number) AS account_label,
  l.debit_cents,
  l.credit_cents,
  l.lettrage,
  l.label           AS line_label,
  l.piece_ref,
  e.informational
FROM accounting_entry_lines l
JOIN accounting_entries     e
  ON e.id = l.entry_id
 AND e.is_validated = true
LEFT JOIN chart_of_accounts coa
  ON coa.entity_id = e.entity_id
 AND coa.account_number = l.account_number;

CREATE UNIQUE INDEX mv_accounting_grand_livre_pk
  ON mv_accounting_grand_livre (line_id);

CREATE INDEX mv_accounting_grand_livre_account
  ON mv_accounting_grand_livre (entity_id, exercise_id, account_number, entry_date);

CREATE INDEX mv_accounting_grand_livre_journal
  ON mv_accounting_grand_livre (entity_id, exercise_id, journal_code, entry_date);

COMMENT ON MATERIALIZED VIEW mv_accounting_grand_livre IS
  'Pre-joined GL lines with entry header. Refreshed alongside mv_accounting_balance.';

-- =====================================================
-- 3. Refresh helper
--    fn_refresh_accounting_views() refreshes both views CONCURRENTLY
--    so reads keep working during the refresh. Optional entity_id
--    parameter is reserved for a future per-entity refresh.
-- =====================================================

CREATE OR REPLACE FUNCTION fn_refresh_accounting_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_accounting_balance;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_accounting_grand_livre;
END;
$$;

COMMENT ON FUNCTION fn_refresh_accounting_views() IS
  'Refresh both accounting MVs concurrently. Schedule nightly via pg_cron:
   SELECT cron.schedule(''refresh-accounting-mv'', ''10 3 * * *'',
                        ''SELECT fn_refresh_accounting_views();'');';

-- =====================================================
-- 4. Initial population
-- =====================================================

REFRESH MATERIALIZED VIEW mv_accounting_balance;
REFRESH MATERIALIZED VIEW mv_accounting_grand_livre;

-- =====================================================
-- 5. Read-only RLS-equivalent grants
--    MVs do not support row-level security so we expose them via
--    SECURITY INVOKER helper functions that filter on entity_members.
--    Direct access is denied to authenticated; only service role and
--    helpers can read the underlying materialized data.
-- =====================================================

REVOKE ALL ON mv_accounting_balance FROM PUBLIC, authenticated;
REVOKE ALL ON mv_accounting_grand_livre FROM PUBLIC, authenticated;

CREATE OR REPLACE FUNCTION fn_balance_for_exercise(
  p_entity_id  uuid,
  p_exercise_id uuid
)
RETURNS TABLE (
  account_number      text,
  account_label       text,
  total_debit_cents   bigint,
  total_credit_cents  bigint,
  solde_debit_cents   bigint,
  solde_credit_cents  bigint,
  line_count          bigint
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT account_number, account_label, total_debit_cents, total_credit_cents,
         solde_debit_cents, solde_credit_cents, line_count
  FROM mv_accounting_balance
  WHERE entity_id = p_entity_id
    AND exercise_id = p_exercise_id
    AND p_entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  ORDER BY account_number;
$$;

CREATE OR REPLACE FUNCTION fn_grand_livre_for_exercise(
  p_entity_id  uuid,
  p_exercise_id uuid,
  p_account_prefix text DEFAULT NULL
)
RETURNS TABLE (
  line_id        uuid,
  entry_id       uuid,
  journal_code   text,
  entry_number   text,
  entry_date     date,
  entry_label    text,
  reference      text,
  account_number text,
  account_label  text,
  debit_cents    integer,
  credit_cents   integer,
  lettrage       text,
  line_label     text,
  piece_ref      text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT line_id, entry_id, journal_code, entry_number, entry_date, entry_label,
         reference, account_number, account_label, debit_cents, credit_cents,
         lettrage, line_label, piece_ref
  FROM mv_accounting_grand_livre
  WHERE entity_id = p_entity_id
    AND exercise_id = p_exercise_id
    AND (p_account_prefix IS NULL OR account_number LIKE p_account_prefix || '%')
    AND informational = false
    AND p_entity_id IN (
      SELECT entity_id FROM entity_members WHERE user_id = auth.uid()
    )
  ORDER BY account_number, entry_date, entry_number;
$$;

GRANT EXECUTE ON FUNCTION fn_balance_for_exercise(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_grand_livre_for_exercise(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_refresh_accounting_views() TO service_role;

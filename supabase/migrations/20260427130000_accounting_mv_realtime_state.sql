-- =====================================================
-- ACCOUNTING — MV REAL-TIME STALENESS TRACKING
-- =====================================================
-- The materialized views (mv_accounting_balance,
-- mv_accounting_grand_livre) are refreshed nightly via pg_cron, but a
-- user who validates a new entry on Monday at 9am should not have to
-- wait until Tuesday 03:10 to see fresh totals on the dashboard.
--
-- Pattern: track the last_modified_at and last_refreshed_at of each
-- MV in a tiny state table. A trigger bumps last_modified_at on every
-- write to accounting_entries / accounting_entry_lines; the refresh
-- function bumps last_refreshed_at. The API can then check staleness
-- with a single indexed lookup and refresh on demand without scanning
-- the full pipeline.
-- =====================================================

SET lock_timeout = '10s';

CREATE TABLE IF NOT EXISTS accounting_views_state (
  view_name        TEXT PRIMARY KEY,
  last_modified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_refreshed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO accounting_views_state (view_name)
VALUES ('mv_accounting_balance'),
       ('mv_accounting_grand_livre')
ON CONFLICT (view_name) DO NOTHING;

ALTER TABLE accounting_views_state ENABLE ROW LEVEL SECURITY;

-- Read-only for any authenticated user (the freshness state is not
-- sensitive; insert/update is reserved to triggers + service role).
CREATE POLICY "views_state_select" ON accounting_views_state
  FOR SELECT TO authenticated
  USING (true);

-- =====================================================
-- Trigger function : mark every accounting MV as dirty
-- =====================================================

CREATE OR REPLACE FUNCTION fn_mark_accounting_views_dirty()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE accounting_views_state
     SET last_modified_at = now()
   WHERE view_name IN ('mv_accounting_balance', 'mv_accounting_grand_livre');
  RETURN NULL; -- AFTER trigger, return value ignored
END;
$$;

DROP TRIGGER IF EXISTS trg_entries_mark_views_dirty ON accounting_entries;
CREATE TRIGGER trg_entries_mark_views_dirty
  AFTER INSERT OR UPDATE OR DELETE ON accounting_entries
  FOR EACH STATEMENT
  EXECUTE FUNCTION fn_mark_accounting_views_dirty();

DROP TRIGGER IF EXISTS trg_lines_mark_views_dirty ON accounting_entry_lines;
CREATE TRIGGER trg_lines_mark_views_dirty
  AFTER INSERT OR UPDATE OR DELETE ON accounting_entry_lines
  FOR EACH STATEMENT
  EXECUTE FUNCTION fn_mark_accounting_views_dirty();

-- =====================================================
-- Refresh function — extended to update last_refreshed_at
-- =====================================================

CREATE OR REPLACE FUNCTION fn_refresh_accounting_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_accounting_balance;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_accounting_grand_livre;
  UPDATE accounting_views_state
     SET last_refreshed_at = now()
   WHERE view_name IN ('mv_accounting_balance', 'mv_accounting_grand_livre');
END;
$$;

-- =====================================================
-- Smart refresh — only refreshes if stale
-- =====================================================

CREATE OR REPLACE FUNCTION fn_refresh_accounting_views_if_stale()
RETURNS TABLE (refreshed boolean, was_stale boolean, last_modified_at timestamptz, last_refreshed_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stale boolean := false;
  v_modified timestamptz;
  v_refreshed timestamptz;
BEGIN
  SELECT MAX(s.last_modified_at), MIN(s.last_refreshed_at)
    INTO v_modified, v_refreshed
    FROM accounting_views_state s
   WHERE s.view_name IN ('mv_accounting_balance', 'mv_accounting_grand_livre');

  v_stale := v_modified > v_refreshed;

  IF v_stale THEN
    PERFORM fn_refresh_accounting_views();
    RETURN QUERY SELECT true, true, v_modified, now();
  ELSE
    RETURN QUERY SELECT false, false, v_modified, v_refreshed;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_refresh_accounting_views_if_stale() TO authenticated;

COMMENT ON FUNCTION fn_refresh_accounting_views_if_stale() IS
  'Refreshes the accounting MVs only if they are stale relative to the '
  'last write on accounting_entries / accounting_entry_lines. Idempotent: '
  'cheap when up-to-date, single-pass refresh otherwise.';

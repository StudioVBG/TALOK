-- =====================================================
-- MIGRATION: Cleanup orphan document_analyses
-- Date: 2026-04-10
--
-- Audit P2-7 follow-up. `document_analyses` rows reference a
-- `document_id` that can be deleted from the `documents` table
-- independently (soft delete, user purge, tenant exit, etc.). When
-- that happens, the analysis row stays behind forever.
--
-- This migration adds:
--   1. A SECURITY DEFINER cleanup function that deletes analyses whose
--      parent document no longer exists AND that are older than 7 days
--      (the grace period gives the backfill / retry flows time to
--      re-link a recreated document without losing OCR work).
--   2. A weekly pg_cron schedule at 03:00 every Sunday. pg_cron is
--      already enabled project-wide via
--      supabase/migrations/20260304100000_activate_pg_cron_schedules.sql
--      so we can schedule in the same migration; if it were not, the
--      cron.schedule call would simply no-op and an admin would need to
--      activate pg_cron from the Supabase dashboard before re-running.
--
-- All statements are idempotent (CREATE OR REPLACE / DO-block guards).
-- =====================================================

-- ---------------------------------------------------------------
-- 1. Cleanup function
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_cleanup_orphan_document_analyses()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.document_analyses da
  WHERE da.document_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.documents d WHERE d.id = da.document_id
    )
    AND da.created_at < NOW() - INTERVAL '7 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION fn_cleanup_orphan_document_analyses IS
  'Supprime les lignes document_analyses dont le document parent '
  'n''existe plus depuis au moins 7 jours. Planifié via pg_cron '
  '(cron schedule: cleanup-orphan-analyses).';

-- ---------------------------------------------------------------
-- 2. Weekly schedule via pg_cron
-- ---------------------------------------------------------------
-- Runs every Sunday at 03:00 UTC. Wrapped in a DO block so the
-- migration stays idempotent and doesn't fail if pg_cron hasn't been
-- activated yet on this project — in that case it logs a NOTICE and
-- an admin can run the SELECT manually from the Supabase SQL editor
-- once pg_cron is enabled.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    -- Unschedule any previous version with the same name, then reschedule.
    PERFORM cron.unschedule('cleanup-orphan-analyses')
    WHERE EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'cleanup-orphan-analyses'
    );

    PERFORM cron.schedule(
      'cleanup-orphan-analyses',
      '0 3 * * 0',
      $cron$SELECT public.fn_cleanup_orphan_document_analyses();$cron$
    );
  ELSE
    RAISE NOTICE 'pg_cron extension not installed; skipping schedule. '
      'Enable pg_cron from the Supabase dashboard and run:'
      E'\n  SELECT cron.schedule(''cleanup-orphan-analyses'', ''0 3 * * 0'', '
      E'''SELECT public.fn_cleanup_orphan_document_analyses();'');';
  END IF;
END $$;

-- =============================================================================
-- Migration : Align auth reset template examples with live recovery flow
-- Date      : 2026-03-18
-- Objectif  : Éviter les exemples legacy /auth/reset?token=... qui ne
--             correspondent plus au flux actuel /auth/callback -> /auth/reset-password
-- =============================================================================

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'email_templates') THEN
    UPDATE email_templates
    SET available_variables = REPLACE(
          available_variables::text,
          'https://talok.fr/auth/reset?token=...',
          'https://talok.fr/auth/callback?next=/auth/reset-password&code=...'
        )::jsonb,
        updated_at = NOW()
    WHERE slug = 'auth_reset_password'
      AND available_variables::text LIKE '%https://talok.fr/auth/reset?token=...%';

    RAISE NOTICE 'email_templates auth_reset_password example updated to callback/reset-password flow';
  ELSE
    RAISE NOTICE 'email_templates table does not exist, skipping';
  END IF;
END $$;

COMMIT;

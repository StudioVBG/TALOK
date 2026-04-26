-- ============================================================================
-- Schedule cron : rappels expiration documents compliance prestataire
-- ============================================================================
-- Quotidien a 9h UTC (10h Paris hiver / 11h Paris ete).
-- Cron pg_cron + pg_net + secret recupere depuis Supabase Vault.
--
-- Pre-requis : le secret 'cron_secret' doit exister dans vault.decrypted_secrets.
-- Pour le creer (a faire une seule fois sur la base) :
--
--   SELECT vault.create_secret(
--     encode(gen_random_bytes(32), 'hex'),
--     'cron_secret',
--     'Secret partage entre pg_cron et les routes /api/cron/*'
--   );
--
-- Puis copier la valeur de SELECT decrypted_secret FROM vault.decrypted_secrets
-- WHERE name = 'cron_secret' dans la variable d'env CRON_SECRET de Netlify.
--
-- Idempotence cote application : la cle Resend
-- compliance-reminder/<provider>/<label>/<window> dedupplique sur 24h.
-- ============================================================================

DO $$
DECLARE
  v_secret TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     OR NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE NOTICE 'pg_cron ou pg_net manquant — schedule ignore';
    RETURN;
  END IF;

  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'cron_secret'
  LIMIT 1;

  IF v_secret IS NULL THEN
    RAISE NOTICE 'cron_secret absent du vault — schedule ignore. Lancer SELECT vault.create_secret(...).';
    RETURN;
  END IF;

  -- Drop si deja schedule (idempotent)
  BEGIN
    PERFORM cron.unschedule('provider-compliance-reminders');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  PERFORM cron.schedule(
    'provider-compliance-reminders',
    '0 9 * * *',
    format(
      $cron$
        SELECT net.http_post(
          url := %L,
          headers := jsonb_build_object(
            'Authorization', 'Bearer ' || %L,
            'Content-Type', 'application/json'
          ),
          body := '{}'::jsonb
        )
      $cron$,
      'https://app.talok.fr/api/cron/provider-compliance-reminders',
      v_secret
    )
  );
END$$;

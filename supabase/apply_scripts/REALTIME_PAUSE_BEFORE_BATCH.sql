-- =============================================================================
-- REALTIME PAUSE — A COLLER AVANT UN BATCH DE MIGRATIONS
-- =============================================================================
-- Supabase realtime tient des AccessShareLock en continu sur les tables
-- publiees via supabase_realtime. Quand une migration fait ALTER TABLE sur
-- une de ces tables, un deadlock avec le worker realtime est possible.
--
-- Ce script desabonne temporairement les tables susceptibles d'etre
-- modifiees par les migrations Sprint B2. A executer AVANT le batch.
-- Apres le batch, executer REALTIME_RESUME_AFTER_BATCH.sql pour remettre
-- les tables dans la publication.
--
-- Impact : les clients abonnes en realtime ne recevront plus d'evenements
-- sur ces tables pendant la duree du batch (typiquement 30s - 5min).
-- =============================================================================

DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'properties',
    'leases',
    'tickets',
    'work_orders',
    'invoices',
    'payments',
    'documents',
    'tenant_documents',
    'messages',
    'notifications',
    'profiles',
    'roommates',
    'lease_signers',
    'edl',
    'edl_signatures',
    'subscriptions',
    'entity_profiles',
    'buildings',
    'building_units',
    'stripe_connect_accounts',
    'stripe_payouts',
    'stripe_transfers',
    'sms_messages',
    'audit_log',
    'outbox'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = t AND schemaname = 'public'
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', t);
      RAISE NOTICE 'Removed public.% from supabase_realtime', t;
    END IF;
  END LOOP;
END
$$;

SELECT 'Realtime publication paused. Run the migration batch now, then REALTIME_RESUME_AFTER_BATCH.sql.' AS info;

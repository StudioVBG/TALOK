-- =============================================================================
-- REALTIME RESUME — A COLLER APRES UN BATCH DE MIGRATIONS
-- =============================================================================
-- Remet toutes les tables listees dans REALTIME_PAUSE_BEFORE_BATCH.sql
-- dans la publication supabase_realtime pour reactiver le streaming des
-- evenements vers les clients abonnes.
--
-- Ne rajoute que les tables qui EXISTENT reellement (safe en cas de
-- migration qui aurait supprime une table entre temps).
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
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) AND NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = t AND schemaname = 'public'
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      RAISE NOTICE 'Re-added public.% to supabase_realtime', t;
    END IF;
  END LOOP;
END
$$;

SELECT 'Realtime publication restored.' AS info;

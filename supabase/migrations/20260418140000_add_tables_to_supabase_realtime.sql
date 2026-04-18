-- Add dashboard tables to supabase_realtime publication
--
-- Root cause of the [RealtimeSync] reconnect loop detected during Sprint B3 PASS 6:
-- use-realtime-sync.ts subscribes to postgres_changes on ~7 tables per dashboard
-- (properties, leases, invoices, payments, documents, tickets, profiles), but only
-- `notifications` and the `conversations/messages` family were published.
-- Subscribing to an unpublished table causes the channel to close shortly after
-- SUBSCRIBED, triggering the backoff reconnect loop indefinitely.
--
-- Fix: register the tables actually consumed by useOwnerRealtimeSync /
-- useTenantRealtimeSync / useAdminRealtimeSync with the publication.
-- RLS remains enforced on the Realtime path, so users only receive events for rows
-- they are allowed to SELECT.

DO $$
DECLARE
  t text;
  tables_to_add text[] := ARRAY[
    'properties',
    'leases',
    'invoices',
    'payments',
    'documents',
    'tickets',
    'profiles'
  ];
BEGIN
  FOREACH t IN ARRAY tables_to_add LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      RAISE NOTICE 'Added public.% to supabase_realtime', t;
    ELSE
      RAISE NOTICE 'public.% already in supabase_realtime (skip)', t;
    END IF;
  END LOOP;
END $$;

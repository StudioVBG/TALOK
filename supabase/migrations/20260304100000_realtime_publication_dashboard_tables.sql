-- FIX AUDIT 2026-03-04: Add dashboard tables to Supabase Realtime publication
-- Without this, postgres_changes events are never emitted for these tables.
-- The realtime hooks (use-realtime-tenant.ts, use-realtime-dashboard.ts) subscribe
-- to these tables but never receive events because they're not in the publication.

-- Add tables to the realtime publication (idempotent: IF NOT EXISTS not supported,
-- so we use DO blocks with exception handling)

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE leases;
EXCEPTION WHEN duplicate_object THEN
  NULL; -- Already added
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE invoices;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE documents;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE tickets;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE lease_signers;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE properties;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE edl;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- Set REPLICA IDENTITY FULL so that payload.old contains all columns
-- (not just the primary key). Required for change detection in realtime hooks.
ALTER TABLE leases REPLICA IDENTITY FULL;
ALTER TABLE invoices REPLICA IDENTITY FULL;
ALTER TABLE documents REPLICA IDENTITY FULL;
ALTER TABLE tickets REPLICA IDENTITY FULL;
ALTER TABLE lease_signers REPLICA IDENTITY FULL;
ALTER TABLE properties REPLICA IDENTITY FULL;
ALTER TABLE edl REPLICA IDENTITY FULL;

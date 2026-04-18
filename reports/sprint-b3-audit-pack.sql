-- ====================================================================
-- Sprint B3 — Audit pack post-migration (READ-ONLY)
-- ====================================================================
-- Coller intégralement dans Supabase SQL Editor → Run.
-- Output : 14 result sets, à transmettre dans le chat.
-- Aucune mutation. Tout est SELECT.
-- ====================================================================

-- ====================================================================
-- PASS 1.1 — Tables core présentes
-- ====================================================================
WITH expected (table_name) AS (
  VALUES
    ('profiles'), ('owner_profiles'), ('legal_entities'), ('property_ownership'),
    ('properties'), ('leases'), ('tenants'), ('documents'), ('invoices'),
    ('subscriptions'), ('subscription_addons'), ('sms_messages'), ('sms_usage'),
    ('stripe_connect_accounts'), ('otp_codes'), ('identity_2fa_requests'),
    ('charge_categories'), ('charge_entries'), ('lease_charge_regularizations'),
    ('tax_notices'), ('epci_reference')
)
SELECT
  '1.1_tables_core' AS check_name,
  e.table_name,
  CASE WHEN t.table_name IS NULL THEN 'MISSING' ELSE 'OK' END AS status
FROM expected e
LEFT JOIN information_schema.tables t
  ON t.table_schema = 'public' AND t.table_name = e.table_name AND t.table_type = 'BASE TABLE'
ORDER BY status DESC, e.table_name;

-- ====================================================================
-- PASS 1.2 — Extensions actives
-- ====================================================================
WITH expected (extname) AS (
  VALUES ('pg_cron'), ('pg_net'), ('pgcrypto'), ('vault')
)
SELECT
  '1.2_extensions' AS check_name,
  e.extname,
  COALESCE(p.extversion, 'MISSING') AS extversion,
  CASE WHEN p.extname IS NULL THEN 'MISSING' ELSE 'OK' END AS status
FROM expected e
LEFT JOIN pg_extension p ON p.extname = e.extname
ORDER BY status DESC, e.extname;

-- ====================================================================
-- PASS 1.3 — Colonnes attendues sur tables core
-- ====================================================================
WITH expected (table_name, column_name) AS (
  VALUES
    ('properties', 'legal_entity_id'),
    ('properties', 'adresse_complete'),
    ('properties', 'ville'),
    ('properties', 'surface'),
    ('properties', 'meuble'),
    ('properties', 'parent_property_id'),
    ('leases', 'statut'),
    ('leases', 'building_unit_id'),
    ('subscriptions', 'plan_slug'),
    ('subscriptions', 'owner_id'),
    ('documents', 'building_unit_id'),
    ('sms_messages', 'territory'),
    ('sms_messages', 'verify_sid'),
    ('property_ownership', 'legal_entity_id')
)
SELECT
  '1.3_columns' AS check_name,
  e.table_name || '.' || e.column_name AS column_ref,
  COALESCE(c.data_type, 'MISSING') AS data_type,
  CASE WHEN c.column_name IS NULL THEN 'MISSING' ELSE 'OK' END AS status
FROM expected e
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public'
  AND c.table_name = e.table_name
  AND c.column_name = e.column_name
ORDER BY status DESC, e.table_name, e.column_name;

-- ====================================================================
-- PASS 1.4 — Type properties_type_check (extended values)
-- ====================================================================
SELECT
  '1.4_property_type_check' AS check_name,
  pg_get_constraintdef(oid) AS constraint_definition,
  CASE
    WHEN pg_get_constraintdef(oid) LIKE '%terrain_agricole%'
     AND pg_get_constraintdef(oid) LIKE '%exploitation_agricole%'
     AND pg_get_constraintdef(oid) NOT LIKE '%cave%'
     AND pg_get_constraintdef(oid) NOT LIKE '%garage%'
    THEN 'OK'
    ELSE 'FLAG'
  END AS status
FROM pg_constraint
WHERE conname = 'properties_type_check';

-- ====================================================================
-- PASS 2.1 — RLS policies récursives interdites
-- ====================================================================
SELECT
  '2.1_recursive_policies' AS check_name,
  schemaname || '.' || tablename || '.' || policyname AS policy_ref,
  cmd,
  CASE
    WHEN policyname IN ('profiles_owner_read_tenants', 'subscriptions_owner_select_own')
    THEN 'FLAG_FORBIDDEN_POLICY'
    ELSE 'OK'
  END AS status
FROM pg_policies
WHERE schemaname = 'public'
  AND policyname IN ('profiles_owner_read_tenants', 'subscriptions_owner_select_own');

-- ====================================================================
-- PASS 2.2 — Self-referencing policies on profiles/subscriptions
-- ====================================================================
SELECT
  '2.2_self_ref_policies' AS check_name,
  schemaname || '.' || tablename || '.' || policyname AS policy_ref,
  CASE
    WHEN tablename = 'profiles' AND (qual ILIKE '%FROM profiles%' OR with_check ILIKE '%FROM profiles%')
    THEN 'FLAG_RECURSIVE_PROFILES'
    WHEN tablename = 'subscriptions' AND (qual ILIKE '%FROM subscriptions%' OR with_check ILIKE '%FROM subscriptions%')
    THEN 'FLAG_RECURSIVE_SUBSCRIPTIONS'
    ELSE 'OK'
  END AS status,
  qual AS using_clause
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'subscriptions')
ORDER BY status DESC, tablename, policyname;

-- ====================================================================
-- PASS 2.3 — Total RLS policies count by core table
-- ====================================================================
SELECT
  '2.3_rls_count' AS check_name,
  tablename,
  COUNT(*) AS n_policies
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('profiles','subscriptions','leases','properties','documents','invoices','tenants','tickets','sms_messages')
GROUP BY tablename
ORDER BY tablename;

-- ====================================================================
-- PASS 3.1 — Storage buckets
-- ====================================================================
SELECT
  '3.1_storage_buckets' AS check_name,
  id AS bucket_id,
  public,
  file_size_limit,
  array_to_string(allowed_mime_types, ',') AS mime_types,
  CASE
    WHEN id IN ('documents', 'landing-images') THEN 'OK_EXPECTED'
    ELSE 'OTHER'
  END AS status
FROM storage.buckets
ORDER BY id;

-- ====================================================================
-- PASS 3.2 — Storage policies on storage.objects (filter buckets at policy level)
-- (storage.policies n'existe plus en SQL direct depuis ~mid-2024 — utiliser pg_policies)
-- ====================================================================
SELECT
  '3.2_storage_policies' AS check_name,
  policyname,
  cmd,
  CASE
    WHEN qual ILIKE '%documents%' OR with_check ILIKE '%documents%' THEN 'documents'
    WHEN qual ILIKE '%landing-images%' OR with_check ILIKE '%landing-images%' THEN 'landing-images'
    ELSE 'other_or_unscoped'
  END AS targets_bucket,
  COALESCE(qual, with_check) AS definition
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
  AND (
    qual ILIKE '%documents%' OR with_check ILIKE '%documents%'
    OR qual ILIKE '%landing-images%' OR with_check ILIKE '%landing-images%'
  )
ORDER BY targets_bucket, policyname;

-- ====================================================================
-- PASS 4.1 — Cron jobs actifs
-- ====================================================================
SELECT
  '4.1_cron_jobs' AS check_name,
  jobname,
  schedule,
  active,
  CASE
    WHEN command ILIKE '%vault.decrypted_secrets%' THEN 'VAULT'
    WHEN command ILIKE '%current_setting(''app.settings%' THEN 'CURRENT_SETTING_LEGACY'
    WHEN command NOT ILIKE '%http_%' THEN 'PURE_SQL'
    ELSE 'UNKNOWN'
  END AS auth_pattern
FROM cron.job
ORDER BY auth_pattern, jobname;

-- ====================================================================
-- PASS 4.2 — Historique exécution cron 24h
-- ====================================================================
SELECT
  '4.2_cron_runs_24h' AS check_name,
  j.jobname,
  COUNT(*) AS total_runs,
  COUNT(*) FILTER (WHERE r.status = 'succeeded') AS succeeded,
  COUNT(*) FILTER (WHERE r.status = 'failed') AS failed,
  MAX(r.start_time) AS last_run
FROM cron.job j
LEFT JOIN cron.job_run_details r
  ON r.jobid = j.jobid
  AND r.start_time > now() - interval '24 hours'
GROUP BY j.jobname
ORDER BY (COUNT(*) FILTER (WHERE r.status = 'failed'))::float / NULLIF(COUNT(*), 0) DESC NULLS LAST,
         j.jobname;

-- ====================================================================
-- PASS 4.3 — Cron failures details (last 24h, max 30)
-- ====================================================================
SELECT
  '4.3_cron_failures' AS check_name,
  j.jobname,
  r.start_time,
  r.return_message
FROM cron.job_run_details r
JOIN cron.job j ON j.jobid = r.jobid
WHERE r.start_time > now() - interval '24 hours'
  AND r.status = 'failed'
ORDER BY r.start_time DESC
LIMIT 30;

-- ====================================================================
-- PASS 5.1 — schema_migrations totals + ghost detection
-- ====================================================================
SELECT
  '5.1_schema_migrations_total' AS check_name,
  COUNT(*) AS total_migrations,
  MIN(version) AS oldest_version,
  MAX(version) AS newest_version,
  COUNT(*) FILTER (WHERE version >= '20260208000000') AS post_b2_window,
  COUNT(*) FILTER (WHERE version BETWEEN '20260208024000' AND '20260208099999') AS pre_cutoff_ghosts
FROM supabase_migrations.schema_migrations;

-- ====================================================================
-- PASS 5.2 — Volume tables core (ordres de grandeur)
-- ====================================================================
SELECT
  '5.2_table_sizes' AS check_name,
  c.relname AS table_name,
  c.reltuples::bigint AS estimated_rows,
  pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r'
  AND n.nspname = 'public'
  AND c.relname IN ('profiles','subscriptions','leases','properties','documents','invoices','notifications','sms_messages','tenants','tickets')
ORDER BY c.reltuples DESC;

-- ====================================================================
-- PASS 5.3 — Vault secrets prêts
-- ====================================================================
SELECT
  '5.3_vault_secrets' AS check_name,
  name,
  created_at,
  updated_at,
  CASE WHEN length(decrypted_secret) > 0 THEN 'OK_NON_EMPTY' ELSE 'FLAG_EMPTY' END AS status
FROM vault.decrypted_secrets
WHERE name IN ('app_url', 'cron_secret');

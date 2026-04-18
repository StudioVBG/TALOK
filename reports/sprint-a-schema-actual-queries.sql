-- Sprint A — PASS 6 : requêtes READ-ONLY à exécuter sur prod
-- pour produire le snapshot `reports/sprint-a-schema-actual.json`.
--
-- Aucune MCP Supabase disponible dans cette session → ces requêtes
-- doivent être lancées manuellement (Dashboard → SQL Editor) et le
-- résultat stocké dans le fichier JSON correspondant.
--
-- CRITIQUE : chaque bloc est strictement SELECT. Aucune écriture.

-- ============================================================
-- 1. Colonnes de toutes les tables du schéma public
-- ============================================================
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- ============================================================
-- 2. Toutes les RLS policies
-- ============================================================
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  qual,
  with_check,
  roles
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ============================================================
-- 3. Triggers
-- ============================================================
SELECT
  event_object_table AS table_name,
  trigger_name,
  action_timing,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY table_name, trigger_name;

-- ============================================================
-- 4. Fonctions
-- ============================================================
SELECT
  routine_name,
  routine_type,
  security_type,
  data_type AS return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;

-- ============================================================
-- 5. Indexes
-- ============================================================
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- ============================================================
-- 6. Extensions activées
-- ============================================================
SELECT extname, extversion
FROM pg_extension
ORDER BY extname;

-- ============================================================
-- 7. Volumes approximatifs des tables core
--   (ordre de grandeur pour évaluer les migrations de volume)
-- ============================================================
SELECT
  n.nspname AS schema,
  c.relname AS table_name,
  c.reltuples::bigint AS estimated_rows,
  pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r'
  AND n.nspname = 'public'
  AND c.relname IN ('profiles', 'subscriptions', 'leases', 'properties', 'tenants', 'invoices', 'notifications', 'sms_messages')
ORDER BY c.reltuples DESC;

-- ============================================================
-- 8. Migrations appliquées (Supabase internal)
-- ============================================================
SELECT version, name, statements IS NOT NULL AS has_statements
FROM supabase_migrations.schema_migrations
ORDER BY version DESC
LIMIT 300;

-- ============================================================
-- 9. Contraintes FK sur tables core (détection de risques de migration)
-- ============================================================
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  tc.constraint_name,
  rc.update_rule,
  rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_name;

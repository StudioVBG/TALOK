-- Sprint B1 — PASS 1 : snapshot de `supabase_migrations.schema_migrations`
-- Requête STRICTEMENT READ-ONLY.
--
-- Instructions Thomas :
--   1. Supabase Dashboard → SQL Editor → New Query
--   2. Coller ceci, exécuter
--   3. Export en CSV OU copier-coller le JSON du panneau résultat
--   4. Sauvegarder dans reports/sprint-b1-schema-migrations-prod.json

-- ============================================================
-- Liste complète des migrations "appliquées" selon Supabase
-- ============================================================
SELECT
  version,
  name,
  inserted_at,
  -- statements est un text[] sur les Supabase récents.
  -- On capture un échantillon des 500 premiers caractères du 1er statement
  -- pour pouvoir reconstruire les ghosts (pas tout, trop volumineux).
  CASE
    WHEN statements IS NULL THEN NULL
    WHEN array_length(statements, 1) IS NULL THEN NULL
    ELSE left(statements[1], 500)
  END AS statements_sample,
  array_length(statements, 1) AS statements_count
FROM supabase_migrations.schema_migrations
ORDER BY version;

-- ============================================================
-- Compteur de cohérence
-- ============================================================
SELECT
  count(*) AS total_migrations,
  min(version) AS oldest_version,
  max(version) AS newest_version,
  count(*) FILTER (WHERE statements IS NOT NULL) AS with_statements,
  count(*) FILTER (WHERE statements IS NULL) AS without_statements
FROM supabase_migrations.schema_migrations;

-- ============================================================
-- Vérification spécifique du ghost suspect 20260208024659
-- ============================================================
SELECT version, name, inserted_at, octet_length(array_to_string(statements, E'\n')) AS sql_bytes
FROM supabase_migrations.schema_migrations
WHERE version = '20260208024659';

-- ============================================================
-- Full dump des statements du ghost (si existe)
-- ============================================================
SELECT version, name, statements
FROM supabase_migrations.schema_migrations
WHERE version = '20260208024659';

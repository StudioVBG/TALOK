-- =====================================================
-- AUDIT CHARGES RÉGULARISATION — Queries read-only
-- Date: 2026-04-18
-- Branche: claude/audit-charges-regularization-dHAdt
--
-- Exécution recommandée : Supabase SQL Editor (prod).
-- ❌ Aucune écriture — SELECT uniquement.
-- Thomas : colle les outputs dans reports/audit-charges/02-db-state.md
-- =====================================================

-- =====================================================
-- SECTION A — lease_charge_regularizations
-- =====================================================

-- A.1 — Colonnes complètes (vérifie P0 #1 : regularization_invoice_id)
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'lease_charge_regularizations'
ORDER BY ordinal_position;

-- A.2 — Index (vérifie idx_lcr_regularization_invoice_id)
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'lease_charge_regularizations'
ORDER BY indexname;

-- A.3 — Policies RLS (vérifie P0 #4 : policy contest stricte)
SELECT policyname, cmd, qual AS using_expr, with_check AS with_check_expr
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'lease_charge_regularizations'
ORDER BY policyname;

-- A.4 — Nb de lignes
SELECT COUNT(*) AS total_regularizations,
       COUNT(*) FILTER (WHERE status = 'draft') AS drafts,
       COUNT(*) FILTER (WHERE status = 'sent') AS sent,
       COUNT(*) FILTER (WHERE status = 'contested') AS contested,
       COUNT(*) FILTER (WHERE status = 'settled') AS settled
FROM lease_charge_regularizations;


-- =====================================================
-- SECTION B — tax_notices + epci_reference
-- =====================================================

-- B.1 — Existence des tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('tax_notices', 'epci_reference')
ORDER BY table_name;

-- B.2 — Structure tax_notices
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'tax_notices'
ORDER BY ordinal_position;

-- B.3 — Structure epci_reference
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'epci_reference'
ORDER BY ordinal_position;

-- B.4 — Policies RLS
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('tax_notices', 'epci_reference')
ORDER BY tablename, policyname;

-- B.5 — Nb de rows (attendu epci_reference = 23 après Sprint 0.b)
SELECT 'tax_notices' AS tbl, COUNT(*) AS n FROM tax_notices
UNION ALL
SELECT 'epci_reference', COUNT(*) FROM epci_reference;

-- B.6 — Ventilation epci_reference par département
SELECT code_departement, COUNT(*) AS nb_epci
FROM epci_reference
GROUP BY code_departement
ORDER BY code_departement;


-- =====================================================
-- SECTION C — Comptes PCG (P0 #3)
-- =====================================================

-- C.1 — Existence des 4 comptes (au moins 1 entity)
SELECT DISTINCT account_number, label, account_type
FROM chart_of_accounts
WHERE account_number IN ('419100', '654000', '614100', '708000')
ORDER BY account_number;

-- C.2 — Nb d'entities par compte (doit = nb total d'entities)
SELECT account_number,
       COUNT(DISTINCT entity_id) AS entities_with_this_account
FROM chart_of_accounts
WHERE account_number IN ('419100', '654000', '614100', '708000')
GROUP BY account_number
ORDER BY account_number;

-- C.3 — Nb total d'entities (pour comparaison avec C.2)
SELECT COUNT(*) AS total_entities FROM legal_entities;


-- =====================================================
-- SECTION D — Triggers & functions (P0 #2)
-- =====================================================

-- D.1 — Triggers sur les tables charges
SELECT event_object_table AS table_name,
       trigger_name,
       action_timing,
       event_manipulation,
       action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table IN (
    'lease_charge_regularizations',
    'charge_entries',
    'charge_categories',
    'tax_notices'
  )
ORDER BY event_object_table, trigger_name;

-- D.2 — Functions liées aux charges
SELECT routine_name, routine_type, data_type AS return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND (routine_name ILIKE '%charge%'
       OR routine_name ILIKE '%regulariz%'
       OR routine_name ILIKE '%teom%')
ORDER BY routine_name;


-- =====================================================
-- SECTION E — RED FLAGS (PASS 5)
-- =====================================================

-- E.1 — charge_entries : structure (attendue : pas de regularization_id — cf skill drift)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'charge_entries'
ORDER BY ordinal_position;

-- E.2 — charge_categories : scope property_id (le skill le traite comme référentiel global)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'charge_categories'
ORDER BY ordinal_position;

-- E.3 — Vues legacy associées (charge_regularisations + charge_regularizations)
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'charge_regularisations',            -- vue compat FR
    'charge_regularisations_legacy',     -- ancienne table renommée
    'charge_regularizations',            -- table normalisée EN (legacy EN, distincte de la canonique)
    'lease_charge_regularizations'       -- canonique (décret 87-713)
  )
ORDER BY table_name;

-- E.4 — Vue éventuelle charge_summary / charges_regularization_view
SELECT table_name
FROM information_schema.views
WHERE table_schema = 'public'
  AND (table_name ILIKE '%charge_summary%'
       OR table_name ILIKE '%regulariz%view%'
       OR table_name ILIKE '%charge%view%');

-- E.5 — Colonnes ajoutées tardivement (contested_at, etc)
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'lease_charge_regularizations'
  AND (column_name ILIKE '%contest%' OR column_name ILIKE '%settled%' OR column_name ILIKE '%sent%');

-- E.6 — FK vers invoices depuis lease_charge_regularizations
SELECT conname AS constraint_name,
       pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.lease_charge_regularizations'::regclass
  AND contype = 'f';

-- =====================================================
-- FIN
-- =====================================================

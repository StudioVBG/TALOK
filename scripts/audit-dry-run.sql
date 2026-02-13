-- ============================================================================
-- SCRIPT DRY RUN — Validation avant exécution
-- ============================================================================
-- Ce script est 100% lecture seule (SELECT uniquement).
-- Il affiche exactement ce que chaque opération de nettoyage ferait.
-- À exécuter AVANT toute modification.
-- ============================================================================

\echo '══════════════════════════════════════════════════════════════'
\echo '  DRY RUN — Audit d''intégrité Talok'
\echo '  Date : NOW()'
\echo '══════════════════════════════════════════════════════════════'
\echo ''

-- ============================================================================
-- SECTION 1 : ORPHELINS
-- ============================================================================

\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '  SECTION 1 : ORPHELINS DÉTECTÉS'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

SELECT source_table, fk_column, target_table, orphan_count, severity, description
FROM audit_orphan_records()
WHERE orphan_count > 0
ORDER BY
  CASE severity
    WHEN 'CRITICAL' THEN 1
    WHEN 'HIGH' THEN 2
    WHEN 'MEDIUM' THEN 3
    WHEN 'LOW' THEN 4
  END,
  orphan_count DESC;

-- Total
SELECT
  COUNT(*) AS nb_relations_cassees,
  SUM(orphan_count) AS total_orphelins,
  COUNT(*) FILTER (WHERE severity = 'CRITICAL') AS critical,
  COUNT(*) FILTER (WHERE severity = 'HIGH') AS high,
  COUNT(*) FILTER (WHERE severity = 'MEDIUM') AS medium,
  COUNT(*) FILTER (WHERE severity = 'LOW') AS low
FROM audit_orphan_records()
WHERE orphan_count > 0;


-- ============================================================================
-- SECTION 2 : DOUBLONS — VUE D'ENSEMBLE
-- ============================================================================

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '  SECTION 2 : DOUBLONS DÉTECTÉS (résumé)'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

SELECT * FROM audit_all_duplicates_summary()
ORDER BY
  CASE severity
    WHEN 'CRITICAL' THEN 1
    WHEN 'HIGH' THEN 2
    WHEN 'MEDIUM' THEN 3
    WHEN 'LOW' THEN 4
  END;


-- ============================================================================
-- SECTION 3 : DOUBLONS — DÉTAIL PAR ENTITÉ
-- ============================================================================

\echo ''
\echo '── 3.1 Doublons PROPRIÉTÉS ──'
SELECT duplicate_key, nb_doublons, ids, match_type
FROM audit_duplicate_properties()
ORDER BY nb_doublons DESC
LIMIT 20;

\echo ''
\echo '── 3.2 Doublons PROFILS ──'
SELECT duplicate_key, nb_doublons, ids, emails, roles, match_type
FROM audit_duplicate_profiles()
ORDER BY
  CASE WHEN match_type LIKE '%user_id%' THEN 0 ELSE 1 END,
  nb_doublons DESC
LIMIT 20;

\echo ''
\echo '── 3.3 Doublons BAUX ──'
SELECT duplicate_key, nb_doublons, ids, statuts, match_type
FROM audit_duplicate_leases()
ORDER BY
  CASE WHEN match_type LIKE '%OVERLAP%' THEN 0 ELSE 1 END,
  nb_doublons DESC
LIMIT 20;

\echo ''
\echo '── 3.4 Doublons FACTURES ──'
SELECT duplicate_key, nb_doublons, ids, montants, statuts, match_type
FROM audit_duplicate_invoices()
ORDER BY nb_doublons DESC
LIMIT 20;

\echo ''
\echo '── 3.5 Doublons PAIEMENTS ──'
SELECT duplicate_key, nb_doublons, ids, montants, match_type
FROM audit_duplicate_payments()
ORDER BY nb_doublons DESC
LIMIT 20;

\echo ''
\echo '── 3.6 Doublons DOCUMENTS ──'
SELECT duplicate_key, nb_doublons, ids, match_type
FROM audit_duplicate_documents()
ORDER BY nb_doublons DESC
LIMIT 20;

\echo ''
\echo '── 3.7 Doublons EDL ──'
SELECT duplicate_key, nb_doublons, ids, statuts, match_type
FROM audit_duplicate_edl()
ORDER BY nb_doublons DESC
LIMIT 20;


-- ============================================================================
-- SECTION 4 : FK IMPLICITES MANQUANTES
-- ============================================================================

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '  SECTION 4 : FK IMPLICITES (colonnes *_id sans contrainte)'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

SELECT table_name, column_name, expected_target, recommendation
FROM audit_missing_fk_constraints()
WHERE NOT has_fk
ORDER BY table_name, column_name;


-- ============================================================================
-- SECTION 5 : SIMULATION DU NETTOYAGE (DRY RUN)
-- ============================================================================

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '  SECTION 5 : SIMULATION NETTOYAGE (aucune modification)'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

SELECT * FROM safe_cleanup_orphans(true, 'ALL');


-- ============================================================================
-- SECTION 6 : EXEMPLES DE DONNÉES ORPHELINES (5 premières par catégorie)
-- ============================================================================

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '  SECTION 6 : ÉCHANTILLONS D''ORPHELINS'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

-- lease_signers orphelins
\echo '── lease_signers sans bail ──'
SELECT ls.id, ls.lease_id, ls.profile_id, ls.role, ls.signature_status, ls.created_at
FROM lease_signers ls
LEFT JOIN leases l ON ls.lease_id = l.id
WHERE l.id IS NULL
LIMIT 5;

-- invoices orphelines
\echo '── invoices sans bail ──'
SELECT i.id, i.lease_id, i.owner_id, i.tenant_id, i.periode, i.montant_total, i.statut, i.created_at
FROM invoices i
LEFT JOIN leases l ON i.lease_id = l.id
WHERE l.id IS NULL
LIMIT 5;

-- documents orphelins (lease_id invalide)
\echo '── documents avec lease_id invalide ──'
SELECT d.id, d.type, d.nom, d.lease_id, d.property_id, d.created_at
FROM documents d
LEFT JOIN leases l ON d.lease_id = l.id
WHERE d.lease_id IS NOT NULL AND l.id IS NULL
LIMIT 5;

-- baux sans signataire
\echo '── baux actifs sans signataire ──'
SELECT l.id, l.property_id, l.type_bail, l.statut, l.date_debut, l.created_at
FROM leases l
WHERE l.statut NOT IN ('draft', 'cancelled', 'archived', 'terminated')
  AND NOT EXISTS (SELECT 1 FROM lease_signers ls WHERE ls.lease_id = l.id)
LIMIT 5;

-- documents flottants
\echo '── documents sans aucun rattachement ──'
SELECT d.id, d.type, d.nom, d.created_at
FROM documents d
WHERE d.owner_id IS NULL AND d.tenant_id IS NULL
  AND d.property_id IS NULL AND d.lease_id IS NULL AND d.profile_id IS NULL
LIMIT 5;


-- ============================================================================
\echo ''
\echo '══════════════════════════════════════════════════════════════'
\echo '  DRY RUN TERMINÉ — Aucune donnée n''a été modifiée'
\echo '══════════════════════════════════════════════════════════════'
\echo '  Pour exécuter le nettoyage :'
\echo '    BEGIN;'
\echo '    SELECT * FROM safe_cleanup_orphans(false);'
\echo '    -- Vérifier, puis COMMIT; ou ROLLBACK;'
\echo '══════════════════════════════════════════════════════════════'

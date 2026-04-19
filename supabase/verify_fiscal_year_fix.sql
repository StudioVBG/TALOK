-- =====================================================
-- SCRIPT DE VÉRIFICATION — fix dates d'exercice fiscal
-- À lancer APRÈS la migration 20260418170000 en preprod puis prod.
--
-- Résultat attendu sur chaque query :
--   - Les 3 premières : 0 ligne.
--   - La 4ème : 1 ligne par entité active.
--   - La 5ème : 0 ligne.
--   - La 6ème (ATOMGISTE) : 1 ligne avec les 3 champs remplis.
-- =====================================================

\echo '==================================================='
\echo '1. Entités avec des dates fiscales NULL (attendu: 0)'
\echo '==================================================='
SELECT id, nom, entity_type, regime_fiscal, date_creation,
       premier_exercice_debut, premier_exercice_fin, date_cloture_exercice
FROM legal_entities
WHERE premier_exercice_debut IS NULL
   OR premier_exercice_fin IS NULL
   OR date_cloture_exercice IS NULL;

\echo ''
\echo '==================================================='
\echo '2. Entités sans exercise associé (attendu: 0)'
\echo '==================================================='
SELECT le.id, le.nom, le.entity_type, le.is_active
FROM legal_entities le
LEFT JOIN accounting_exercises ae ON ae.entity_id = le.id
WHERE ae.id IS NULL;

\echo ''
\echo '==================================================='
\echo '3. Entités sans exercise OUVERT (attendu: 0)'
\echo '==================================================='
SELECT le.id, le.nom, le.entity_type
FROM legal_entities le
WHERE NOT EXISTS (
  SELECT 1 FROM accounting_exercises ae
  WHERE ae.entity_id = le.id AND ae.status = 'open'
)
  AND le.is_active = true;

\echo ''
\echo '==================================================='
\echo '4. Compte global (entités actives vs exercises)'
\echo '==================================================='
SELECT
  (SELECT COUNT(*) FROM legal_entities WHERE is_active = true)
    AS entites_actives,
  (SELECT COUNT(DISTINCT entity_id) FROM accounting_exercises)
    AS entites_avec_exercise,
  (SELECT COUNT(*) FROM accounting_exercises WHERE status = 'open')
    AS exercises_ouverts;

\echo ''
\echo '==================================================='
\echo '5. Incohérences date_cloture_exercice vs premier_exercice_fin'
\echo '    (attendu: 0 — date_cloture doit matcher MM-DD de fin)'
\echo '==================================================='
SELECT id, nom, premier_exercice_fin, date_cloture_exercice,
       to_char(premier_exercice_fin, 'MM-DD') AS attendu
FROM legal_entities
WHERE to_char(premier_exercice_fin, 'MM-DD') <> date_cloture_exercice;

\echo ''
\echo '==================================================='
\echo '6. Vérification ATOMGISTE (bug initial)'
\echo '==================================================='
SELECT
  le.id,
  le.nom,
  le.regime_fiscal,
  le.date_creation,
  le.premier_exercice_debut,
  le.premier_exercice_fin,
  le.date_cloture_exercice,
  (SELECT COUNT(*) FROM accounting_exercises
   WHERE entity_id = le.id) AS nb_exercises,
  (SELECT COUNT(*) FROM accounting_exercises
   WHERE entity_id = le.id AND status = 'open') AS nb_ouverts
FROM legal_entities le
WHERE le.id = 'a872ccf3-9cdd-43e0-b841-f13e534efb84';

\echo ''
\echo '==================================================='
\echo '7. Triggers installés (attendu: 2 lignes)'
\echo '==================================================='
SELECT tgname, tgenabled, pg_get_triggerdef(oid)
FROM pg_trigger
WHERE tgrelid = 'legal_entities'::regclass
  AND tgname IN (
    'trg_legal_entities_default_fiscal_year',
    'trg_legal_entities_bootstrap_exercise'
  );

\echo ''
\echo '==================================================='
\echo '8. Contraintes installées (attendu: 2 lignes + NOT NULL)'
\echo '==================================================='
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'legal_entities'::regclass
  AND conname IN (
    'legal_entities_fiscal_year_range',
    'legal_entities_date_cloture_format'
  );

SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_name = 'legal_entities'
  AND column_name IN (
    'premier_exercice_debut',
    'premier_exercice_fin',
    'date_cloture_exercice'
  );

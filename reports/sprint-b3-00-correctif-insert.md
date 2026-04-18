# Sprint B3 — PASS 0 : Correctif INSERT `schema_migrations`

## Contexte

Sprint B2 a appliqué 222 migrations mais **221 ont été trackées** dans `supabase_migrations.schema_migrations`. La migration manquante est `20260331100000_add_agricultural_property_types` (batch 6, Phase 1 SAFE).

L'effet métier (CHECK constraint `properties_type_check` étendu aux types agricoles) **a été appliqué** lors de l'exécution du batch 6 — seul le tracking dans la table de versions n'a pas été inséré (probablement avalé par une EXCEPTION silencieuse du constraint patcher).

## SQL à exécuter

À coller dans Supabase SQL Editor (production) :

```sql
-- 1) Insérer la ligne de tracking manquante (idempotent)
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '20260331100000',
  'add_agricultural_property_types',
  ARRAY[
    $stmt$ALTER TABLE properties DROP CONSTRAINT IF EXISTS properties_type_check;$stmt$,
    $stmt$ALTER TABLE properties ADD CONSTRAINT properties_type_check CHECK (type IN ('appartement','maison','studio','colocation','saisonnier','parking','box','local_commercial','bureaux','entrepot','fonds_de_commerce','immeuble','terrain_agricole','exploitation_agricole'));$stmt$
  ]
)
ON CONFLICT (version) DO NOTHING;

-- 2) Vérifier la présence
SELECT version, name, inserted_at, array_length(statements, 1) AS n_stmts
FROM supabase_migrations.schema_migrations
WHERE version = '20260331100000';

-- 3) Vérifier le compte global (doit passer de 221 à 222 sur la fenêtre Sprint B2)
SELECT COUNT(*) AS total_post_b2
FROM supabase_migrations.schema_migrations
WHERE version >= '20260208000000';

-- 4) Confirmer que le CHECK constraint contient bien les types agricoles
SELECT pg_get_constraintdef(oid) AS constraint_def
FROM pg_constraint
WHERE conname = 'properties_type_check';
```

## Résultat attendu

| Requête | Attendu |
|---|---|
| INSERT | 1 row inserted (ou 0 si déjà fait — ON CONFLICT DO NOTHING) |
| SELECT version='20260331100000' | 1 ligne avec `n_stmts = 2` |
| COUNT | **222** |
| pg_get_constraintdef | doit contenir `'terrain_agricole'` ET `'exploitation_agricole'` |

## Si le COUNT n'est toujours pas 222

Re-exécuter la requête de PASS 5 (réconciliation finale) pour identifier toute autre divergence. Voir `sprint-b3-05-reconciliation-final.md`.

## Action utilisateur

- [ ] Exécuter le bloc SQL ci-dessus dans SQL Editor prod
- [ ] Coller les 4 résultats dans le chat (ou les 4 lignes clés)
- [ ] Confirmer COUNT = 222 et constraint contient les types agricoles

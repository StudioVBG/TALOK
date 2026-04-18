# Sprint B1 — PASS 1 : Accès `supabase_migrations.schema_migrations`

## Verdict

🚨 **Blocage d'accès** : aucune connexion DB prod disponible dans cette session.

## Détails

- Aucun tool MCP Supabase exposé (`mcp__supabase__*` ou équivalent)
- Aucune credential prod (`SUPABASE_SERVICE_ROLE_KEY`) chargée dans l'environnement de la session
- Aucun accès `psql` configuré vers `db.<project-ref>.supabase.co`
- Les tools `Bash` / `Grep` / `Read` disponibles ne peuvent pas atteindre la DB prod

Conformément aux consignes Sprint B1 (« Si PASS 1 impossible → rapport d'access-errors + stop/continue avec alternatives »), PASS 1 est documenté ici et les autres PASS sont exécutés avec des assumptions claires.

## Options pour débloquer PASS 1

### Option A — Exécution manuelle Thomas (1 minute)
1. Ouvrir Supabase Dashboard → SQL Editor → New Query
2. Coller le contenu de `reports/sprint-b1-schema-migrations-query.sql`
3. Exporter le résultat en JSON (bouton « Download CSV » → convertir, ou copier-coller)
4. Sauvegarder dans `reports/sprint-b1-schema-migrations-prod.json`
5. Re-exécuter les PASS 3 + 4 (les scripts liront ce fichier)

### Option B — CLI avec SERVICE_ROLE_KEY
Si Thomas a accès à un shell avec les env vars prod :

```bash
export SUPABASE_URL="https://<ref>.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="<service_role>"

# Via PostgREST (plus simple)
curl -s "$SUPABASE_URL/rest/v1/rpc/<fn>" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
# (Note: supabase_migrations.schema_migrations n'est PAS exposée via PostgREST
#  par défaut — il faut passer par psql)

# Via psql
PGPASSWORD=<db_password> psql -h db.<ref>.supabase.co -p 5432 -U postgres -d postgres \
  -c "SELECT version, name, inserted_at FROM supabase_migrations.schema_migrations ORDER BY version;" \
  --csv > reports/sprint-b1-schema-migrations-prod.csv
```

### Option C — `supabase migration list --linked`
```bash
supabase login
supabase link --project-ref <ref>
supabase migration list --linked > reports/sprint-b1-migration-list.txt
```

Note : `supabase migration list` ne donne PAS le `statements` / contenu SQL — seulement la liste des versions. Pour la reconstruction des ghosts (PASS 4), seule l'Option B (psql) le permet.

## Ce que PASS 1 aurait dû produire

- `reports/sprint-b1-schema-migrations-prod.json` : tableau de `{ version, name, inserted_at, statements_sample }` pour chaque migration appliquée.

Sans ce fichier :
- **PASS 3 (matrice)** : ne peut pas distinguer GHOST APPLIED de MATCHED. Sera exécuté en « mode dégradé » avec l'hypothèse du Sprint A (cutoff `20260208024659` → tout ≤ appliqué, tout > pending), clairement marquée comme hypothèse.
- **PASS 4 (ghosts)** : le ghost supposé `20260208024659` sera investigué via `git log` uniquement (pas de reconstruction depuis `statements`).
- **PASS 8 (smoke)** : les anomalies `inserted_at` ne peuvent pas être détectées (colonne inaccessible).

## Requête prête (alternative B/psql)

Le fichier `reports/sprint-b1-schema-migrations-query.sql` contient la requête READ-ONLY à exécuter.

## Recommandation

**Bloquer Sprint B2 tant que PASS 1 n'est pas réellement exécuté.**

La matrice de réconciliation (PASS 3) produite sans le snapshot prod est **une estimation**, pas une vérité. Appliquer les 223 migrations "pending" suggérées sans confirmer que la prod pense effectivement qu'elles sont pending risque d'ouvrir les scénarios suivants :

1. **Re-apply** d'une migration déjà exécutée (si la prod dit appliquée mais notre cutoff dit pending) → échec idempotent ou duplicate constraint violation
2. **Miss** d'une migration fs qui a été re-introduite (si la prod dit appliquée et le fichier a été supprimé puis re-créé avec le même timestamp)
3. **Silent skip** d'un ghost (si la prod a une entrée pour un fichier qui n'existe nulle part)

## Action immédiate requise de Thomas

- [ ] Exécuter Option A (SQL Editor) ou Option B (psql) et fournir le fichier JSON
- [ ] **OU** confirmer que l'Option C (CLI list uniquement) suffit et qu'on se passe du contenu SQL des ghosts

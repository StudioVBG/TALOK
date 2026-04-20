# Apply Sprint B2 — 3 batches prêts à coller (IDEMPOTENTS v2)

Scripts générés depuis `reports/sprint-b2-migrations-to-apply.json` (commit `28fe418`).

**Idempotence** : chaque `CREATE POLICY` est précédé d'un `DROP POLICY IF EXISTS`,
chaque `CREATE TRIGGER` d'un `DROP TRIGGER IF EXISTS`. Les batches sont donc
**ré-exécutables** même si une migration a été partiellement appliquée avant.

## Fichiers

| Fichier | Migrations | Plage | SAFE / MODERE / DANGEREUX / CRITIQUE |
|---|---:|---|---|
| `APPLY_SPRINT_B2_01_FEB2026.sql` | 61 | 20260208 → 20260229 | 11 / 19 / 6 / 25 |
| `APPLY_SPRINT_B2_02_MAR2026.sql` | 62 | 20260301 → 20260331 | 17 / 21 / 16 / 8 |
| `APPLY_SPRINT_B2_03_APR2026.sql` | 71 | 20260401 → 20260417 | 17 / 26 / 16 / 12 |

Total : 194 migrations (action `apply` uniquement).

## Ce qui N'est PAS inclus

- **28 migrations `rename-then-apply`** : nécessitent la branche `dedup` mergée d'abord. Détail dans `reports/sprint-b2-migrations-to-apply.md`.

## Procédure

1. **BACKUP prod obligatoire** : `pg_dump` + point de restauration Supabase PITR.
2. Choisir un créneau de maintenance (certaines migrations sont CRITIQUE sur profiles/RLS).
3. **Avant chaque batch : coller `REALTIME_PAUSE_BEFORE_BATCH.sql`** pour désabonner
   les tables de la publication supabase_realtime. Sinon, deadlocks quasi-certains
   sur les tables actives (properties, leases, etc.) avec le worker realtime.
4. Appliquer les batches **dans l'ordre** : `01_FEB` → `02_MAR` → `03_APR`.
5. Pour chaque batch :
   - Ouvrir Supabase Dashboard → SQL Editor → New Query
   - Coller le fichier intégralement, cliquer Run
   - Vérifier les NOTICES dans l'onglet Messages (affiche la migration en cours)
6. **Après tous les batches : coller `REALTIME_RESUME_AFTER_BATCH.sql`** pour
   restaurer la publication realtime.
7. **Coller `REGISTER_SPRINT_B2_APPLIED.sql`** pour enregistrer les 194 migrations
   dans `supabase_migrations.schema_migrations`. Sans cette étape, un futur
   `supabase db push` retenterait de les appliquer et échouerait. Idempotent
   (`ON CONFLICT DO NOTHING`).
8. Chaque migration est encapsulée dans son propre `BEGIN/COMMIT` : rollback ciblé.
9. Les batches sont idempotents : recoller en cas d'échec ne crée pas de doublon.

## Ordre

**Chronologique strict.** Les migrations RLS/triggers/profiles dépendent les unes des autres. Ne pas réordonner, ne pas sauter.

## Risques

Sur les 194 `apply` :
- CRITIQUE = 50 (RLS cycles, profiles sync, auth triggers, intégrité)
- DANGEREUX = 51 (UPDATE sans WHERE, DROP TABLE potentiels)
- MODERE = 75 (ALTER colonne, renommages safe)
- SAFE = 46 (index, seeds, comments)

À auditer manuellement avant run prod si possible.

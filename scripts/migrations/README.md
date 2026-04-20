# scripts/migrations/

Outillage pour appliquer un backlog de migrations Supabase non déployées en
rendant chaque migration idempotente et en les regroupant par mois.

Né du Sprint B2 (2026-04) où 194 migrations étaient en attente sur prod après
70 jours de backlog, avec 11 bugs différents qui bloquaient l'application
directe en Supabase SQL Editor.

## Fichiers

- `make-idempotent.py` — transformation Python stdin → stdout qui, sur le
  contenu d'une migration SQL, rend idempotents :
  - `CREATE POLICY` (inline et via `EXECUTE '...'`) → prepend `DROP POLICY IF EXISTS`
  - `CREATE TRIGGER` → prepend `DROP TRIGGER IF EXISTS` si absent
  - `CREATE [UNIQUE] INDEX` → insère `IF NOT EXISTS`
  - `ALTER TABLE ADD CONSTRAINT` → prepend `DROP CONSTRAINT IF EXISTS`
  - Bugs ciblés (trigger fantôme, UUID invalide, COMMENT ON SCHEMA cron, etc.)

- `build-batches.sh` — wrapper bash qui lit un manifest JSON
  (`reports/sprint-*-migrations-to-apply.json`), regroupe les migrations par
  mois chronologique et génère un fichier `APPLY_<PREFIX>_<NN>_<MONTH><YEAR>.sql`
  par mois avec chaque migration wrappée dans :
  - `BEGIN; ... COMMIT;`
  - `SET LOCAL lock_timeout = '3s'`
  - `SET LOCAL statement_timeout = '10min'`
  - `RAISE NOTICE 'Applying N/M (RISK) file.sql'` pour visibilité de progression

## Usage

```bash
bash scripts/migrations/build-batches.sh reports/sprint-c-migrations-to-apply.json SPRINT_C
```

Génère `supabase/apply_scripts/APPLY_SPRINT_C_<NN>_<MONTH><YEAR>.sql`.

## Format du manifest JSON attendu

```json
{
  "migrations": [
    {
      "file": "20260208100000_fix_data_storage_audit.sql",
      "effective_ts": "20260208100000",
      "action": "apply",
      "risk": "MODERE",
      "risk_why": "ALTER column (type/constraint)"
    }
  ]
}
```

Seules les entrées `action: "apply"` sont incluses. Les `action: "rename-then-apply"`
sont ignorées (elles nécessitent une branche de dédup mergée d'abord).

## Procédure d'application

1. BACKUP prod obligatoire (`pg_dump` + Supabase PITR).
2. Coller `supabase/apply_scripts/REALTIME_PAUSE_BEFORE_BATCH.sql` dans le SQL
   Editor pour éviter les deadlocks avec le worker realtime.
3. Coller chaque batch dans l'ordre chronologique, regarder l'onglet Messages
   pour les `NOTICE` de progression.
4. Si une erreur `42710`/`42P07`/`42501`/autre survient, identifier la migration
   via la dernière NOTICE, patcher `make-idempotent.py` avec un fix ciblé,
   régénérer, recoller (les migrations déjà passées sont no-op grâce à
   l'idempotence).
5. Coller `supabase/apply_scripts/REALTIME_RESUME_AFTER_BATCH.sql` en fin de
   sprint pour ré-abonner les tables au realtime.

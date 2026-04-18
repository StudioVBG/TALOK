# PASS 0.3 — Snapshots AVANT application

Exécutés dans Supabase SQL Editor prod le **2026-04-18**.

---

## Snapshot 1 — RLS policies actuelles

```sql
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'lease_charge_regularizations'
ORDER BY policyname;
```

**Output prod** :

| policyname | cmd | with_check (synthèse) |
|---|---|---|
| `lease_charge_reg_owner_access` | ALL | owner via `properties.owner_id` — inchangé |
| **`lease_charge_reg_tenant_contest`** | UPDATE | **`status = 'sent'`** ← bug P0 #4 ORIGINAL |
| `lease_charge_reg_tenant_read` | SELECT | null (read, pas de WITH CHECK) |

**Diagnostic** : le WITH CHECK = `'sent'` bloque toute transition vers `contested` — la migration 090300 n'a **jamais tourné en prod**. Le `qual` (USING) ne filtre même pas sur `status`, donc la policy originale était non seulement buggée côté `with_check` mais aussi trop permissive côté USING. La migration Sprint 0.c corrige les deux en une seule opération.

---

## Snapshot 2 — Comptes PCG

```sql
SELECT account_number, label, account_type,
       COUNT(DISTINCT entity_id) AS entity_count
FROM chart_of_accounts
WHERE account_number IN ('419100', '654000', '614100', '708000')
GROUP BY account_number, label, account_type
ORDER BY account_number;

SELECT COUNT(*) AS total_entities FROM legal_entities;
```

**Output prod** :

| account_number | label | account_type | entity_count |
|---|---|---|---|
| 419100 | Provisions de charges recues | liability | 3 |
| 654000 | Charges recuperables non recuperees | expense | 3 |

`total_entities = 3`.

**Diagnostic** :
- Sprint 0.b migration 090400 **a tourné** (419100 + 654000 seedés sur les 3 entities).
- **614100 et 708000 absents** sur les 3 entities — la migration Sprint 0.c injectera 6 rows (3 × 2).

---

## Snapshot 3 — `schema_migrations` state

```sql
SELECT COUNT(*) AS total_migrations
FROM supabase_migrations.schema_migrations;

SELECT version, name
FROM supabase_migrations.schema_migrations
WHERE version IN ('20260418150000', '20260418150100')
ORDER BY version;
```

**Output prod** :

- `total_migrations` : **393**
- Versions Sprint 0.c : **0 rows** (absentes — attendu)

---

## Checklist GO PASS 1

- [x] Snapshot 1 collé — policy `lease_charge_reg_tenant_contest` existe, bug confirmé
- [x] Snapshot 2 collé — 419100 + 654000 OK, 614100 + 708000 à backfiller
- [x] Snapshot 3 collé — versions 20260418150000 / 20260418150100 absentes
- [x] `rollback.sql` relu
- [x] Projet Supabase confirmé = **PROD**
- [x] Pas d'autre déploiement en cours

✅ **GO PASS 1**

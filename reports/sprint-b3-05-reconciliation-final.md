# Sprint B3 — PASS 5 : Réconciliation finale schema_migrations

## Statut

⏳ **En attente d'exécution utilisateur** — sections 5.1, 5.2, 5.3 du `sprint-b3-audit-pack.sql`.

## Critères de validation

### 5.1 — Totaux schema_migrations

| Métrique | Attendu après PASS 0 |
|---|---|
| `total_migrations` | ~440-480 (toutes les migrations historiques + Sprint B2) |
| `oldest_version` | `20240100099999` (premier fichier du repo) |
| `newest_version` | `20260417110000` (notre Sprint 1) |
| `post_b2_window` | **222** (post PASS 0, avant PASS 0 = 221) |
| `pre_cutoff_ghosts` | `4` (les fameux 20260208024518/40/615/659 — documentés) |

Toute valeur différente nécessite investigation.

### 5.2 — Volumes tables core

Tableaux indicatifs des ordres de grandeur en prod (à comparer avec le résultat) :

| Table | Ordre approximatif |
|---|---|
| `profiles` | 100-500 (~ tous les users + tenants invités) |
| `properties` | 50-200 |
| `leases` | 50-300 |
| `documents` | 500-2000 |
| `invoices` | 200-1000 |
| `subscriptions` | 50-150 |
| `notifications` | 1000-10000 |
| `sms_messages` | 50-500 (faible si Twilio peu utilisé) |
| `tenants` | 100-300 |
| `tickets` | 50-300 |

Si une table core est **vide** alors qu'attendue non-vide → 🔴 régression possible (perte de données).

Si une table core a un volume **anormalement élevé** (ex: notifications > 100k) → ⚠️ planifier un cleanup.

### 5.3 — Vault secrets

Doivent retourner 2 lignes :
- `app_url` avec `status = OK_NON_EMPTY` et valeur `https://talok.fr`
- `cron_secret` avec `status = OK_NON_EMPTY` et valeur `[non vérifiée — chiffrée]`

Si `FLAG_EMPTY` → re-update via `vault.update_secret`.
Si missing → re-créer via `vault.create_secret`.

## Output utilisateur attendu

3 résultats à coller (5.1, 5.2, 5.3) + verdict GO/NO-GO sur cohérence finale.

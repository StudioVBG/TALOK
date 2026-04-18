# Sprint B3 — PASS 4 : Crons actifs et fonctionnels

## Statut

⏳ **En attente d'exécution utilisateur** — sections 4.1, 4.2, 4.3 du `sprint-b3-audit-pack.sql`.

## Validation des 21 crons

### 4.1 — Pattern d'authentification

Tous les jobs doivent avoir `auth_pattern IN ('VAULT', 'PURE_SQL')` après le fix post-B2.

- **VAULT** = utilise `(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = ...)` ✅
- **PURE_SQL** = appelle directement une fonction PG (ex: `cleanup_expired_identity_2fa()`) ✅
- **CURRENT_SETTING_LEGACY** = utilise `current_setting('app.settings.cron_secret')` 🔴 — ne fonctionne pas (`ALTER DATABASE` interdit sur Supabase managed)
- **UNKNOWN** = format inconnu ⚠️

Si tu vois `CURRENT_SETTING_LEGACY` dans la sortie → un cron a échappé au reconfigure. Re-exécute le bloc de reconfiguration des 7 crons (cf. session précédente) en l'adaptant au jobname concerné.

### 4.2 — Historique d'exécution sur 24h

Référence (pour 24h glissantes) :

| Cron | Schedule | Runs/24h attendus |
|---|---|---|
| `process-outbox` | `*/5 * * * *` | ~288 |
| `process-webhooks` | `2-59/5 * * * *` | ~288 |
| `visit-reminders` | `*/30 * * * *` | ~48 |
| `onboarding-reminders` | `0 * * * *` | 24 |
| `payment-reminders` | `0 8 * * *` | 1 |
| `check-cni-expiry` | `0 10 * * *` | 1 |
| `cleanup-*` | `0 3 * * *` | 1 |
| `subscription-alerts` | `0 10 * * *` | 1 |
| `mark-overdue-invoices` | `5 0 * * *` | 1 |
| `overdue-check` | `0 9 * * *` | 1 |
| `copro-*` (5) | varied | 1 chacun |
| `generate-invoices` | `0 6 1 * *` | 0 (mensuel) |
| `irl-indexation` | `0 7 1 * *` | 0 (mensuel) |
| `lease-expiry-alerts` | `0 8 * * 1` | 0-1 (Lundi seulement) |
| `cleanup-orphan-analyses` | `0 3 * * 0` | 0-1 (Dimanche seulement) |
| `cleanup-identity-2fa-expired` | `0 3 * * *` | 1 |

**Critères OK** :
- `total_runs` non-nul pour les jobs avec schedule fréquent (process-*)
- `failed = 0` ou `failed / total < 10%`
- `last_run` récent (< 1 cycle)

**Critères FLAG** :
- `total_runs = 0` pour un cron `*/5` ou `0 * * * *` → cron inactif (pb pg_cron ?)
- `failed > 50%` → cron casse systématiquement → vérifier vault + endpoint

### 4.3 — Détails des échecs

Si la section 4.3 retourne des lignes :
- Examiner `return_message` pour identifier l'erreur
- Erreurs courantes :
  - `connection refused` → `app_url` mal configuré dans Vault
  - `401 Unauthorized` → `cron_secret` mal configuré
  - `404 Not Found` → endpoint API supprimé/renommé
  - `500 Internal` → bug applicatif côté Netlify

## Test actif (optionnel)

Si `process-outbox` montre 0 runs ou que des doutes subsistent, déclencher manuellement :

```bash
curl -i -X POST https://talok.fr/api/cron/process-outbox \
  -H "Authorization: Bearer <CRON_SECRET>"
```

Attendu : `HTTP/2 200` + log dans Netlify Functions. Si 401 → CRON_SECRET incorrect côté Netlify.

## Output utilisateur attendu

3 résultats à coller (4.1, 4.2, 4.3) + verdict GO/NO-GO sur fonctionnement crons.

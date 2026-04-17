# Sprint A — Résumé exécutif (audit 168 migrations pending)

**Date** : 2026-04-17
**Branche** : `audit/migrations-168-pending`
**Nature** : audit 100 % read-only (aucune DB modifiée, aucune migration appliquée).

---

## Chiffres clés

| Métrique | Valeur |
|---|---|
| Migrations dans le repo | **442** |
| Migrations appliquées (cutoff `20260208024659`) | **219** |
| Migrations **pending** | **223** (pas 168 ⚠️) |
| Écart vs annoncé | +55 |
| Timestamps dupliqués | **13 paires** |
| Fichiers hors .sql dans `migrations/` | 0 |

Le timestamp annoncé `20260208024659` ne correspond à **aucun fichier** dans le repo. La première migration post-cutoff est `20260208100000_fix_data_storage_audit.sql`.

## Répartition par risque (sur les 223 pending)

| Niveau | Nombre | % |
|---|---:|---:|
| 🟢 SAFE | 46 | 20.6 % |
| 🟡 MODÉRÉ | 76 | 34.1 % |
| 🔴 DANGEREUX | 51 | 22.9 % |
| 🚨 CRITIQUE | 50 | 22.4 % |

## Red flags majeurs

1. 🚨 **Comptage désaligné** : 223 pending vs 168 annoncés, cutoff fourni inexistant en fichier.
2. 🚨 **29 migrations touchent `auth.*`** (schéma Supabase interne) — risque haut si mal écrites.
3. 🟠 **13 timestamps dupliqués** → ordre d'application ambigu.
4. 🟠 **3 extensions référencées** (`pg_cron`, `pg_net`, `pgcrypto`) — doivent être pré-activées en prod.
5. 🟡 **4 migrations avec TODO/FIXME** dans le SQL.
6. 🟡 **11 migrations citent Claude/GPT/Copilot** dans leurs commentaires (contenu à relire avant exécution).

## 5 phase files

Localisés dans `supabase/apply_scripts/` :
- `APPLY_PENDING_PART1_FEB16_21.sql` (~12 migrations)
- `APPLY_PENDING_PART2_FEB21_23.sql` (~8)
- `APPLY_PENDING_PART3_FEB23_28.sql` (~7)
- `APPLY_ALL_PENDING_FEB23.sql` (32, consolidé des PART1-2-3)
- `APPLY_PENDING_MARCH_2026.sql` (15)

Ce sont des scripts consolidés **obsolètes** — source de vérité = `supabase/migrations/*.sql`.

## Staging

⚠️ **Aucun staging dédié détecté** dans le repo. Le `supabase/config.toml` ne déclare qu'un seul `project_id` local. Le `netlify.toml` n'a pas de contexte `deploy-preview` / `branch-deploy` qui pointerait vers une DB différente.

**Options pour Sprint B** :
- **A (recommandé)** : créer un projet Supabase staging (~25 $/mois + 1h setup).
- **B** : shadow DB locale via `supabase start` (gratuit, moins fidèle).
- **C** : direct prod avec backup (déconseillé sauf feu vert explicite).

## Estimation Sprint B

| Scénario | Temps | Risque |
|---|---|---|
| Option A stricte (staging + 4 phases en prod) | ~2-3 j/h effectifs | Faible |
| Option B pragmatique (shadow + phase 1 direct + staging pour 2-4) | ~1-2 j/h | Modéré |
| Option C urgente (prod direct, backup) | ~4 h | Élevé |

## Recommandation go/no-go

🟡 **NO-GO sur l'application tant que les points suivants ne sont pas tranchés** :

1. Confirmer le vrai cutoff via `supabase migration list --linked`.
2. Décider de l'option staging (A/B/C).
3. Re-review manuellement les 50 CRITIQUE et 51 DANGEREUX (liste dans `sprint-a-migrations-by-risk.md`).
4. Décider du sort des 13 timestamps dupliqués.

🟢 **GO pour préparer Sprint B** une fois les 4 décisions prises.

---

## Livrables produits

| Fichier | Rôle |
|---|---|
| `reports/sprint-a-migrations-inventory.csv` | Inventaire complet des 442 migrations (risque + ops détectés) |
| `reports/sprint-a-migrations-by-risk.md` | Tableau détaillé par niveau de risque (223 pending) |
| `reports/sprint-a-conflicts-report.md` | Oscillations internes + Sprint 0+1 + patterns Talok |
| `reports/sprint-a-schema-actual-queries.sql` | Requêtes READ-ONLY à lancer sur prod (PASS 6 stub) |
| `reports/sprint-a-schema-actual.json` | Placeholder JSON pour snapshot prod (stub) |
| `reports/sprint-a-application-plan.md` | Plan 4-phasé + candidats squash |
| `reports/sprint-a-red-flags.md` | Points critiques à valider |
| `reports/sprint-a-staging-detection.md` | Verdict staging + 3 options |
| `reports/sprint-a-phase-files.md` | Localisation des 5 phase files |
| `reports/sprint-a-summary.md` | Ce document |

### Scripts (READ-ONLY) utilisés

| Script | Rôle |
|---|---|
| `scripts/audit/build-inventory.mjs` | Parse les 442 .sql → CSV |
| `scripts/audit/categorize-risk.mjs` | Classif par risque raffinée |
| `scripts/audit/detect-conflicts.mjs` | Oscillations, Sprint 0+1, patterns Talok |
| `scripts/audit/build-application-plan.mjs` | Plan phasé |
| `scripts/audit/build-red-flags.mjs` | Scan red flags |

Tous sont re-lançables à l'identique (idempotents, zéro effet de bord).

---

## Questions ouvertes adressées

- **Y a-t-il des migrations de test jamais commit ?** → Pas de fichier hors-.sql dans `migrations/`, mais 4 fichiers avec TODO/FIXME et 11 avec commentaires AI suggèrent des migrations générées sans relecture finale.
- **Versioning dérivé entre dev/prod ?** → Probable : 223 pending sur 2 mois (~3.7/jour), et l'écart avec le comptage annoncé de 168 suggère une désynchronisation.
- **`schema_migrations` désynchronisé ?** → Non vérifiable sans MCP, requête fournie dans le stub PASS 6.
- **Combien de mois de travail ?** → Du 08/02/2026 (premier pending) au 17/04/2026 (dernier) = **~10 semaines** de travail non appliqué en prod.

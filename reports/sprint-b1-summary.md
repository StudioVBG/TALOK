# Sprint B1 — Résumé exécutif

**Date** : 2026-04-18
**Branche** : `audit/migrations-168-pending` (continuation Sprint A)
**Nature** : audit 100 % read-only. Aucune DB modifiée. Aucun fichier renommé. Aucun rollback. Aucun PR créée.

---

## État réconcilié

### Chiffres clés

| Métrique | Valeur | Source |
|---|---:|---|
| Migrations fs totales | **442** | PASS 2 |
| Uniques après dédup | **414** timestamps | PASS 2 |
| MATCHED (≤ cutoff) | **218** | PASS 3 (mode dégradé) |
| GHOST APPLIED | **1** | PASS 3 (supposé) |
| PENDING unique | **181** | PASS 3 |
| HASH MISMATCH | **0** | PASS 3 (non-détectable sans PASS 1) |
| DUPLICATE TS | **41 fichiers / 13 groupes** | PASS 2/5 |
| Total à appliquer Sprint B2 | **194 migrations uniques** (181 + 13 keep-only) | PASS 7 v2 |

### Explication du +55 vs l'annonce 168

Résolu : le doc `docs/audits/pending-migrations.md` date du 2026-04-09 avec 168 pending. Sprint A a compté 223 le 2026-04-17 → **55 migrations ajoutées en 8 jours** (velocity normale, aucun mystère). Confirmé en PASS 8 par le comptage de fichiers avec timestamp ≥ `20260409` (= 55).

---

## Réparabilité des ghosts

| Ghost | État | Reconstructible ? |
|---|---|---|
| `20260208024659` | Cité dans un doc du 2026-04-09, jamais sous forme de fichier .sql visible | ⚠️ **PASS 1 requis** pour statuer. Si `statements` non NULL → oui. Sinon, placeholder ou doc-only correction |

**1 ghost total.** Reconstructible si PASS 1 exécuté et si la colonne `statements` est peuplée en prod.

## Doublons de timestamps

| Type | Nombre |
|---|---:|
| Groupes | 13 |
| Fichiers impliqués | 41 |
| Fichiers **identiques** (hash match, à supprimer) | **0** |
| Fichiers **différents** (hash divergent, à renommer) | 41 |

**Aucune suppression, que des renames.** Plus gros groupe : `20260408130000` avec **12 files** → à décaler en +0s, +1s, …, +11s. Deuxième : `20260408120000` avec 7 files (0…+6s). Les 11 autres groupes sont des paires.

---

## Décisions bloquantes à valider par Thomas

### 🔴 Avant toute tentative Sprint B2

1. **Exécuter PASS 1 réel** (SQL Editor / psql / supabase migration list) pour sortir du mode dégradé.
   - Cf. `reports/sprint-b1-schema-migrations-query.sql`
   - Cf. `reports/sprint-b1-access-errors.md` (options A/B/C)

2. **Décider du sort du ghost `20260208024659`** parmi A1/A2/A3 (cf. `sprint-b1-reconciliation-sql.sql`).

3. **Choisir la stratégie staging** (Sprint A PASS 2 : Option A projet dédié / B shadow locale / C direct prod).

4. **Valider le plan de dédup** `sprint-b1-dedup-plan.md` ou apporter un choix d'ordre alternatif pour les groupes de 7 et 12 files.

### 🟡 À trancher idéalement (pas bloquant mais recommandé)

5. Normaliser les **32 timestamps 12-digit** en 14-digit (opération cosmétique).
6. Corriger les **2 timestamps non-parseable** (letter / 8-digit).
7. Renommer les **3 slugs dupliqués** pour éviter la confusion.

---

## Recommandation Go/No-Go Sprint B2

🔴 **NO-GO tant que** :

1. PASS 1 n'est pas exécuté réellement
2. Le ghost `20260208024659` n'a pas été statué
3. Le mode d'application staging n'a pas été choisi

🟢 **GO après** ces 3 points validés. Le reste (dedup renames, application par phases) devient mécanique.

---

## Livrables Sprint B1

Tous dans `reports/` (commits atomiques sur `audit/migrations-168-pending`) :

| Fichier | Rôle |
|---|---|
| `sprint-b1-summary.md` | Ce résumé |
| `sprint-b1-access-errors.md` | Blocage PASS 1 + 3 options de déblocage |
| `sprint-b1-schema-migrations-query.sql` | Requête SELECT prête pour PASS 1 |
| `sprint-b1-schema-migrations-prod.json` | Stub (à peupler avec snapshot réel) |
| `sprint-b1-filesystem-migrations.json` | Snapshot fs avec sha256 (442 files) |
| `sprint-b1-reconciliation-matrix.md` | Matrice 5 catégories (mode dégradé) |
| `sprint-b1-reconciliation-matrix.json` | Matrice machine-readable |
| `sprint-b1-ghost-migrations.md` | Investigation du ghost `20260208024659` |
| `sprint-b1-dedup-plan.md` | Plan de renommage des 13 groupes |
| `sprint-b1-dedup-plan.json` | Plan machine-readable |
| `sprint-b1-reconciliation-sql.sql` | SQL **commenté** NON-exécuté |
| `sprint-b1-smoke-findings.md` | Anomalies filesystem détectables |
| `sprint-b1-smoke-findings.json` | Anomalies machine-readable |

Et la mise à jour :
- `reports/sprint-a-application-plan.md` → **v2** (prépend Sprint B1 prologue)

**Scripts** dans `scripts/audit/` (tous idempotents, re-lançables sans effet de bord) :
- `snapshot-filesystem.mjs`
- `build-reconciliation-matrix.mjs` (sensible au stub PASS 1 — retournera du contenu complet si le stub est remplacé)
- `plan-dedup.mjs`
- `update-application-plan-v2.mjs`
- `smoke-findings.mjs`

**Shell (non-exécutable)** :
- `scripts/audit/apply-dedup-renames.sh` (chmod 0644, commentes `git mv`)

---

## Questions ouvertes tranchées

- ✅ **`20260208024659` a-t-il existé ?** → Jamais comme fichier .sql dans l'historique git visible (183 commits, post 2026-04-10). Plus ancien historique inaccessible (shallow clone). Probablement exécuté via SQL Editor prod sans fichier.
- ✅ **Écart +55 vs annonce initiale ?** → 55 migrations ajoutées entre 2026-04-09 (doc) et 2026-04-17 (Sprint A). Normal.
- ⏳ **Les 50 CRITIQUES incluent-elles des ghost-applied ?** → Non détectable sans PASS 1 réel.
- ⏳ **Prod modifiée hors migrations (SQL Editor direct) ?** → Probable (hypothèse du ghost 1), impossible à confirmer sans PASS 1.

---

## Récapitulatif des commits (8 atomiques)

```
51d2698 docs(sprint-b1): PASS 8 — smoke findings
5d77d72 docs(sprint-b1): PASS 7 — application plan v2 (post Sprint B1)
ba1c497 docs(sprint-b1): PASS 6 — reconciliation SQL template (commented only)
e89d6d4 docs(sprint-b1): PASS 5 — dedup plan for 13 duplicate-timestamp groups
5fa0e3e docs(sprint-b1): PASS 4 — ghost migration 20260208024659 investigation
cf12fab docs(sprint-b1): PASS 3 — reconciliation matrix (degraded mode)
467673d docs(sprint-b1): PASS 2 — filesystem snapshot with sha256 + timestamp parsing
ae73920 docs(sprint-b1): PASS 1 — schema_migrations snapshot blocked, queries ready
```

Branche `audit/migrations-168-pending` prête à push.

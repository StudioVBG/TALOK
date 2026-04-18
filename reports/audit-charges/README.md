# Audit — État réel chantier Charges Régularisation

**Date** : 2026-04-18
**Branche audit** : `claude/audit-charges-regularization-dHAdt` (branche système imposée à la place de `audit/charges-regularization-state` demandée dans l'énoncé)
**Mode** : read-only — aucune migration, aucune écriture DB, aucune modification de skill, aucune PR.

---

## Résumé 1 page

Les Sprints 0.a, 0.b et 1 du module Régularisation des Charges sont **tous DONE** sur `main` depuis la PR #432 (17/04/2026). Les preuves sont triple :

1. **DB (inféré migrations)** — 6 migrations Sprint 0 mergées : `20260417090000` (invoice link), `090100` (tax_notices), `090200` (epci_reference), `090300` (RLS fix), `090400` (PCG backfill), `090500` (seed 23 EPCI DROM-COM).
2. **Code** — `lib/charges/{engine,types,constants,index}.ts` + `tests/unit/charges/engine.test.ts` (~1 125 lignes totales). `lib/accounting/chart-amort-ocr.ts` enrichi avec `419100` et `654000`.
3. **Skill** — `.claude/skills/talok-charges-regularization/SKILL.md` (559 lignes) à jour : substitutions PCG documentées (l.355-377), statuts P0 ✅ lignes 518-530, seul P0 #2 marqué ⏳ Sprint 2.

**Seul gap restant** : **P0 #2** — génération d'écriture comptable auto au `settle`. C'est exactement le périmètre du Sprint 2 prévu.

**Aucune régression** détectée après le merge Sprint B2 (222 migrations) des 17/18 avril — les 2 commits fix-up (`66d5a71`, `a6c9b96`) sont des ajustements de wrapper de batch, neutres côté schéma.

**Verdict** : Option A — passer au Sprint 2 après validation DB prod (read-only) via `scripts/audit-charges/queries.sql`.

---

## Index des rapports

| # | Fichier | Contenu |
|---|---|---|
| 1 | [`01-git-history.md`](./01-git-history.md) | Branches, commits liés au module, fichiers modifiés par commit |
| 2 | [`02-db-state.md`](./02-db-state.md) | État DB inféré + bloc pour coller outputs prod |
| 3 | [`03-code-state.md`](./03-code-state.md) | Fichiers code, migrations locales, état skill |
| 4 | [`04-progress-matrix.md`](./04-progress-matrix.md) | Matrice DB / Code / Skill par sprint |
| 5 | [`05-red-flags.md`](./05-red-flags.md) | 9 points de vigilance (drift skill, settle columns, etc.) |
| 6 | [`06-next-steps.md`](./06-next-steps.md) | Recommandation + squelette prompt Sprint 2 |

Scripts associés :

| Fichier | Usage |
|---|---|
| [`scripts/audit-charges/queries.sql`](../../scripts/audit-charges/queries.sql) | SELECT read-only prod (sections A-E) — à exécuter par Thomas dans Supabase SQL Editor |

---

## Matrice globale (1 tableau)

| Sprint | Livrables | Verdict |
|---|---|---|
| 0.a | Colonne `regularization_invoice_id`, tables `tax_notices` + `epci_reference`, RLS `sent→contested` | ✅ **DONE** |
| 0.b | `PCG_OWNER_ACCOUNTS` +419100/+654000, backfill entities, seed 23 EPCI, skill sync | ✅ **DONE** |
| 1 | Engine pur + types + constants + tests (P0 ancré côté code) | ✅ **DONE** |
| 2 | Migration settle cols + route `/apply` canonique + écriture comptable auto | ❌ **MISSING** — à démarrer |
| 3 | UI owner re-câblée sur engine Sprint 1 | ❌ MISSING (non démarré) |
| 4 | Template PDF décompte (pdf-lib) | ❌ MISSING |
| 5 | Feature gating + Stripe metadata | ❌ MISSING |
| 6 | OCR taxe foncière (prompt GPT-4o-mini) | ❌ MISSING |
| 7 | Crons / rappels (import TF, prescription 3 ans) | ❌ MISSING |

---

## Red flags à retenir avant Sprint 2

1. **RF-9** — Les colonnes `settlement_method`, `installment_count`, `settled_at` **ne sont pas en DB** (types TS prêts). Prévoir migration dans Sprint 2.
2. **RF-8** — L'engine expose deux shapes (DB-compatible `calculateRegularization` + pur camelCase `computeRegularization`). Sprint 2 devra choisir — recommandé : shape DB.
3. **Skill drift** (RF-2, RF-3, RF-4) — le skill documente un schéma "théorique" qui diffère du prod (ex: `charge_entries` sans `regularization_id`, `charge_categories` scopées par bien, vue FR legacy qui pointe vers `charge_regularizations` pas vers la canonique). **Non bloquant**, à corriger lorsqu'on retouche le skill.

Aucun de ces points n'est bloquant pour Sprint 2.

---

## Actions immédiates

1. **Thomas** : exécute `scripts/audit-charges/queries.sql` dans Supabase SQL Editor (prod) et colle les outputs dans `02-db-state.md`.
2. Si tout match les "attendus" (probable car PR #432 est mergée) → **prompt Sprint 2** selon squelette dans `06-next-steps.md`.
3. Si écart détecté → ouvrir `05-red-flags.md` et décider.

---

## Contraintes respectées

- ✅ Aucun `INSERT/UPDATE/DELETE/ALTER/CREATE/DROP` sur prod
- ✅ Skill `SKILL.md` non modifié
- ✅ Aucune PR créée
- ✅ Aucune migration créée ni appliquée
- ✅ Écriture uniquement dans `reports/audit-charges/` et `scripts/audit-charges/`
- ✅ Branche audit read-only

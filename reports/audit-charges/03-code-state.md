# PASS 3 — État du code

---

## Fichiers du module (canonique)

### `lib/charges/`

| Fichier | Lignes | Rôle |
|---|---|---|
| `lib/charges/engine.ts` | ~338 | Moteur pur : `calculateRegularization` (DB-shape) + Sprint 1 `computeRegularization` (camelCase pur), `diffDays`, `prorataCentimes`, `computeTeomNet`, `computeProvisionsVersees` |
| `lib/charges/types.ts` | ~204 | `ChargeCategoryCode`, `ChargeCategory`, `ChargeEntry`, `LeaseChargeRegularization`, `RegularizationInput/Result`, `RegularizationStatus`, `SettlementMethod`, `TaxNoticeExtraction` |
| `lib/charges/constants.ts` | ~190 | `CHARGE_CATEGORIES` (6 codes décret 87-713), labels/colors status, seuils (`FRAIS_GESTION_TEOM_PCT_DEFAULT=8`, `PRESCRIPTION_YEARS=3`, `ECHELEMENT_MONTHS=12`), `PCG_ACCOUNTS` (419100/614100/654000/708000/411000/512100/635200) |
| `lib/charges/index.ts` | 53 | Barrel export |

### `app/api/charges/` (routes canoniques — module)

| Route | Lignes | Status |
|---|---|---|
| `GET/POST /api/charges` | — | Pre-Sprint 0 |
| `GET/PATCH /api/charges/[id]` | 83 | Pre-Sprint 0 |
| `GET/POST /api/charges/categories` | 112 | Pre-Sprint 0 |
| `GET/PATCH /api/charges/categories/[id]` | ? | Pre-Sprint 0 |
| `GET/POST /api/charges/entries` | 110 | Pre-Sprint 0 |
| `GET/PATCH /api/charges/entries/[id]` | ? | Pre-Sprint 0 |
| `GET/POST /api/charges/reconciliation` | 216 | Pre-Sprint 0 |
| `GET/POST /api/charges/regularization` | 188 | Pre-Sprint 0 |
| `GET/PATCH /api/charges/regularization/[id]` | 33 | Pre-Sprint 0 |
| `POST /api/charges/regularization/[id]/contest` | 103 | Pre-Sprint 0 |
| `POST /api/charges/regularization/[id]/send` | 86 | Pre-Sprint 0 |
| **❌ absent** `/api/charges/regularization/[id]/apply` | — | **À créer Sprint 2 (P0 #2)** |
| `GET/POST /api/leases/[id]/regularization` | — | Pre-Sprint 0 |

### `app/api/accounting/charges/regularisation/` (legacy FR — ne pas étendre)

| Route | Lignes | Notes |
|---|---|---|
| `GET/POST /api/accounting/charges/regularisation` | — | Legacy — vue compat |
| `[id]`, `[id]/apply` | 89 (apply) | Legacy — s'appuie sur `ChargeRegularizationService` de `features/accounting/`, pas la canonique |

**Règle skill** : toutes les nouvelles routes vont dans `/api/charges/*`, jamais dans `/api/accounting/charges/regularisation/*`.

### Composants UI

| Fichier | Lignes | Notes |
|---|---|---|
| `app/owner/properties/[id]/charges/page.tsx` | 777 | Liste charges / catégories / entries (pre-Sprint 0) |
| `app/owner/properties/[id]/charges/regularization/page.tsx` | 594 | Calcul + envoi régul — UI pre-Sprint 0 (à re-câbler avec engine.ts Sprint 2) |
| `app/tenant/charges/page.tsx` | 416 | Consultation tenant (pre-Sprint 0) |
| `app/owner/copro/charges`, `app/copro/charges` | — | Bridge copro — non Sprint 0 |
| `features/accounting/components/charge-regularisation-card.tsx` | — | Legacy — ne pas étendre |
| `features/accounting/services/charge-regularization.service.ts` | — | Legacy — ne pas étendre |

### Tests

| Fichier | Lignes | Status |
|---|---|---|
| `tests/unit/charges/engine.test.ts` | ~352 | ✅ Sprint 1 — couvre `diffDays`, `prorataCentimes`, `computeTeomNet`, `computeRegularization` |

### Accounting chart

| Fichier | Notes |
|---|---|
| `lib/accounting/chart-amort-ocr.ts` | `PCG_OWNER_ACCOUNTS` — Sprint 0.b a ajouté `419100` (ligne 28) et `654000` (ligne 53). `614100`, `708000`, `635200` déjà présents. ✅ |

---

## Migrations dans le repo (chronologique)

| Migration | Sprint | Finalité |
|---|---|---|
| `20260408044152_reconcile_charge_regularisations_and_backfill_entry_lines.sql` | Pre-Sprint 0 | Reconciliation FR→EN + vue compat `charge_regularisations` + renommage `charge_regularisations_legacy` + triggers INSTEAD OF |
| `20260408130000_charges_locatives_module.sql` | Pre-Sprint 0 | Création canonique `charge_categories`, `charge_entries`, `lease_charge_regularizations` + RLS + policy tenant_contest (buggée — fixée en 090300) |
| `20260417090000_charges_reg_invoice_link.sql` | 0.a ✅ | P0 #1 — colonne `regularization_invoice_id` |
| `20260417090100_tax_notices_table.sql` | 0.a ✅ | Table `tax_notices` + RLS owner |
| `20260417090200_epci_reference_table.sql` | 0.a ✅ | Table `epci_reference` + RLS read public |
| `20260417090300_fix_tenant_contest_rls.sql` | 0.a ✅ | P0 #4 — policy `sent → contested` stricte |
| `20260417090400_charges_pcg_accounts_backfill.sql` | 0.b ✅ | P0 #3 — backfill 419100 + 654000 sur toutes les entities |
| `20260417090500_epci_reference_seed_drom.sql` | 0.b ✅ | Seed 23 EPCI DROM-COM |

---

## Skill `talok-charges-regularization/SKILL.md`

| Métadonnée | Valeur |
|---|---|
| Path | `.claude/skills/talok-charges-regularization/SKILL.md` |
| Lignes | 559 |
| Dernière modif | 2026-04-18 06:14 |

### Mentions substitutions PCG (décidées Sprint 0.b)

Lignes 355-377 : section "Mapping PCG Talok" présente — documente les substitutions `4191→419100`, `614→614100`, `654→654000`, `708300→708000`.

### Mentions "P0 résolu"

Lignes 518-530 : section "Gaps critiques (P0)" — 3/4 gaps marqués ✅ RÉSOLU :
- P0 #1 ✅ Sprint 0.a
- P0 #2 ⏳ **À TRAITER Sprint 2**
- P0 #3 ✅ Sprint 0.b
- P0 #4 ✅ Sprint 0.a

Gap P1 #5 (tax_notices) ✅ Sprint 0.a. P1 #6 (epci_reference) ✅ Sprint 0.b.

**Le skill est bien aligné avec l'état post-Sprint 0.a+0.b merge.**

---

## Observation critique — skill drift vs schéma réel

Le skill documente le canonique `lease_charge_regularizations` avec un schéma **théorique** qui diffère du schéma **réel** (cf migration 20260408130000) :

| Colonne dans skill | Colonne en prod |
|---|---|
| `period_start`, `period_end` | **absent** — remplacé par `fiscal_year` (int) |
| `occupation_days`, `exercise_days` | **absent** — prorata calculé côté engine seulement |
| `total_provisions` (sans suffixe) | `total_provisions_cents` |
| `total_real_charges` | `total_actual_cents` |
| `balance` | `balance_cents` GENERATED STORED |
| `settlement_method`, `installment_count` | **absent** — `SettlementMethod` existe uniquement côté types TS (cf `types.ts` commentaire : "Not backed by a DB enum yet (Sprint 2 will add a column)") |
| status = 5 valeurs | status = **6 valeurs** (`draft,calculated,sent,acknowledged,contested,settled`) |
| — | `contested` BOOLEAN + `contest_reason`, `contest_date` (champs additionnels) |

Même divergence pour `charge_categories` (le skill présente un référentiel global `code/label/legal_ref`, la réalité scope par `property_id` avec un CHECK sur 6 codes) et `charge_entries` (le skill a `regularization_id`, la réalité lie via `property_id + fiscal_year`).

**Conséquence** : le moteur `engine.ts` (Sprint 1) a été écrit pour matcher le schéma RÉEL (voir `calculateRegularization`), et les types TS dans `types.ts` sont alignés sur la DB. Le skill reste utilisé pour la **sémantique légale** et la **cartographie DROM-COM** — pas comme source de vérité schéma.

---

## Conclusion PASS 3

**Sprint 0.a + 0.b + 1 sont tous DONE côté code.**
- Moteur de calcul pur : ✅ (engine.ts + 352 tests)
- Types & constants : ✅ (aligned schéma réel)
- PCG_OWNER_ACCOUNTS : ✅ (419100 + 654000)
- Skill à jour : ✅ (substitutions PCG documentées, statuts P0 renseignés)

**Sprint 2 pas encore démarré.** Le canonique `/api/charges/regularization/[id]/apply` n'existe pas ; aucune logique de génération d'écriture comptable n'est branchée sur un `settle`. Toutes les UI et routes existantes sont **pre-Sprint 0** (antérieures à la refonte P0) et doivent être re-câblées au moteur Sprint 1 dans les sprints suivants.

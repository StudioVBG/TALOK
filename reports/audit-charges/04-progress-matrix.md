# PASS 4 — Matrice progression réelle vs plan

Légende : ✅ DONE · ⚠️ PARTIAL · ❌ MISSING · N/A

---

## Sprint 0.a — Structure DB

| # | Livrable | DB (inféré migrations) | Code | Skill | Verdict |
|---|---|---|---|---|---|
| 0.a #1 | Colonne `regularization_invoice_id` + index + FK ON DELETE SET NULL | ✅ migration 090000 | N/A | ✅ l.518 | **✅ DONE** |
| 0.a #2 | Table `tax_notices` (+ RLS owner, UNIQUE property+year, CHECKs) | ✅ migration 090100 | N/A | ✅ l.529 | **✅ DONE** |
| 0.a #3 | Table `epci_reference` (+ RLS read public, CHECK waste_tax_type) | ✅ migration 090200 | N/A | ✅ l.530 | **✅ DONE** |
| 0.a #4 | Policy `lease_charge_reg_tenant_contest` fix `sent→contested` | ✅ migration 090300 | N/A | ✅ l.525 | **✅ DONE** |

---

## Sprint 0.b — Seeds + skill sync

| # | Livrable | DB | Code | Skill | Verdict |
|---|---|---|---|---|---|
| 0.b #1 | `PCG_OWNER_ACCOUNTS` enrichi (+419100, +654000) | N/A | ✅ `chart-amort-ocr.ts:28,53` | ✅ l.520-523 | **✅ DONE** |
| 0.b #2 | Migration backfill comptes 419100 + 654000 sur toutes entities | ✅ migration 090400 | N/A | ✅ l.520-523 | **✅ DONE** |
| 0.b #3 | Seed 23 EPCI DROM-COM (3+6+5+4+5) | ✅ migration 090500 | N/A | ✅ l.530 | **✅ DONE** |
| 0.b #4 | Skill mis à jour (substitutions PCG + statuts résolus) | N/A | N/A | ✅ lines 355-377, 518-530 | **✅ DONE** |

---

## Sprint 1 — Moteur de calcul

| # | Livrable | DB | Code | Skill | Verdict |
|---|---|---|---|---|---|
| 1 #1 | Types TS alignés DB réelle (`RegularizationInput/Result`, `SettlementMethod`, `TaxNoticeExtraction`) | N/A | ✅ `lib/charges/types.ts` (+111) | N/A | **✅ DONE** |
| 1 #2 | Constants : `PCG_ACCOUNTS`, seuils (prescription 3 ans, échelonnement 12 mois, frais TEOM 8%) | N/A | ✅ `lib/charges/constants.ts` (+64) | ✅ l.355-377 | **✅ DONE** |
| 1 #3 | Engine pur : `diffDays`, `prorataCentimes`, `computeTeomNet`, `computeProvisionsVersees`, `computeRegularization` | N/A | ✅ `lib/charges/engine.ts` (+220) | N/A | **✅ DONE** |
| 1 #4 | Tests unitaires moteur | N/A | ✅ `tests/unit/charges/engine.test.ts` (+352) | N/A | **✅ DONE** |

---

## Sprint 2 — API `/apply` + écritures comptables auto (P0 #2 restant)

| # | Livrable | DB | Code | Skill | Verdict |
|---|---|---|---|---|---|
| 2 #1 | Colonnes `settlement_method`, `installment_count`, `settled_at` sur `lease_charge_regularizations` | ❌ pas de migration | ❌ | N/A | **❌ MISSING** |
| 2 #2 | Route `POST /api/charges/regularization/[id]/apply` (canonique) | N/A | ❌ absent | Mention ligne 519 "⏳ À TRAITER Sprint 2" | **❌ MISSING** |
| 2 #3 | Génération écriture comptable au settle (scénarios A/B/C/D/E skill section 6) | ❌ pas de trigger | ❌ pas de helper | ✅ spécifié l.380-455 | **❌ MISSING** |
| 2 #4 | Liaison `regularization_invoice_id` renseignée au settle | N/A | ❌ | ✅ colonne prête (0.a) | **❌ MISSING** |

---

## Sprints 3-7 — Non démarrés

| Sprint | Thème | Status |
|---|---|---|
| 3 | UI owner re-câblage sur engine.ts + page calcul/envoi moderne | ❌ MISSING (UI existante `owner/properties/[id]/charges/regularization/page.tsx` est pre-Sprint 0) |
| 4 | Template PDF décompte (pdf-lib) | ❌ MISSING (pas de lib/charges/pdf.ts) |
| 5 | Feature gating + Stripe metadata régul (`type: 'charge_regularization'`) | ❌ MISSING |
| 6 | OCR avis TF (Tesseract.js + GPT-4o-mini) → `tax_notices` | ❌ MISSING (pipeline générique existe, prompt spécifique TF à créer) |
| 7 | Crons/rappels (import TF septembre, prescription 3 ans, etc.) | ❌ MISSING |

---

## Synthèse par phase

### Phase fondations (Sprint 0 + Sprint 1)

**8 items 0.a/0.b + 4 items Sprint 1 = 12/12 ✅ DONE.**

- Toutes les migrations sont présentes dans le repo et mergées dans `main` via PR #432.
- `PCG_OWNER_ACCOUNTS` contient les 2 nouveaux comptes.
- Le skill est à jour (substitutions PCG documentées, statuts P0 marqués).
- Le moteur pur est testé et exporté.

### Phase applicative (Sprint 2)

**0/4 items DONE.** Tout reste à faire :
- Migration ajout 3 colonnes sur `lease_charge_regularizations`
- Route canonique `/apply`
- Génération des 5 scénarios d'écriture comptable
- Écrire `regularization_invoice_id` au settle

### Phases suivantes

Non démarrées — conforme au plan. Pas d'anomalie.

---

## Paragraphe "Sprint X : fait ou à refaire ?"

**Sprint 0.a** — FAIT. Les 4 migrations (090000/090100/090200/090300) sont mergées et correctement rédigées (idempotentes, RLS, CHECKs). Rien à refaire.

**Sprint 0.b** — FAIT. Les 2 migrations (090400 backfill PCG, 090500 seed 23 EPCI) sont mergées. `PCG_OWNER_ACCOUNTS` contient bien `419100` + `654000` (vérifié dans `chart-amort-ocr.ts:28,53`). Skill mis à jour. Rien à refaire.

**Sprint 1** — FAIT. Le moteur pur (`computeRegularization` et fonctions helper) est présent, typé, testé. Les types DB (`LeaseChargeRegularization`, `ChargeEntry`, `ChargeCategory`) sont alignés avec le schéma réel. Les constants (prescription, échelonnement, frais TEOM, PCG_ACCOUNTS) sont centralisées. Rien à refaire.

**Sprint 2** — À FAIRE, rien de démarré. Prérequis : décider si `/apply` consomme `calculateRegularization` (shape DB) ou `computeRegularization` (pur camelCase) — voir `05-red-flags.md` RF-8. Décider aussi d'ajouter les colonnes `settlement_method/installment_count/settled_at` (RF-9).

**Sprints 3-7** — Non démarrés, conforme plan.

---

## Conclusion PASS 4

Les fondations DB + code sont solides. **Aucune régression détectée**. Le prochain prompt doit cibler le Sprint 2.

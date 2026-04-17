---
name: talok-accounting
description: >
  Architecture SOTA complète du module comptabilité Talok — CONSTRUITE. Contient :
  15 tables SQL avec RLS/triggers, engine double-entry, générateur FEC 18 champs,
  rapprochement bancaire auto, plan comptable PCG+copro, amortissements, OCR+IA pipeline.
  Utilise ce skill pour TOUT travail lié à comptabilité, écriture, journal, balance,
  grand livre, bilan, FEC, rapprochement, réconciliation, banque, OCR justificatif,
  charge déductible, revenu foncier, BIC, micro-foncier, amortissement, déficit,
  régularisation charges, plan comptable, copropriété budget, appel de fonds, clôture
  exercice, CRG mandant, export comptable, déclaration 2044/2072/2065, agent TALO,
  portail EC, connexion bancaire Open Banking.
---

# Talok — Module Comptabilité : Référence COMPLÈTE

## 1. Inventaire du code produit

| Fichier | Lignes | Contenu |
|---------|--------|---------|
| `supabase/migrations/20260406210000_accounting_complete.sql` | ~570 | 15 tables, 16 index, RLS, triggers, fonctions SQL |
| `lib/accounting/engine.ts` | ~571 | Double-entry engine, CRUD, validation, auto-entries (14 événements) |
| `lib/accounting/fec.ts` | ~267 | Générateur FEC conforme (18 champs, .txt UTF-8), validation |
| `lib/accounting/reconciliation.ts` | ~325 | Rapprochement bancaire auto (matching, scoring, transferts internes) |
| `lib/accounting/chart-amort-ocr.ts` | ~278 | Plan comptable PCG+copro, amortissement par composant, prompt OCR GPT-4 |
| `lib/accounting/index.ts` | ~65 | Barrel export |
| **Total** | **~2 076** | Code prêt à intégrer dans le codebase Talok |

---

## 2. Tables SQL (15 tables + audit_log + triggers + RLS)

| Table | Colonnes clés |
|-------|---------------|
| `accounting_exercises` | entity_id, start/end_date, status (open/closing/closed), closed_by |
| `chart_of_accounts` | account_number, label, account_type, plan_type (pcg/copro/custom), account_class (generated) |
| `accounting_journals` | code (ACH/VE/BQ/OD/AN/CL), journal_type |
| `accounting_entries` | exercise_id, journal_code, entry_number, entry_date, label, source, is_locked, reversal_of |
| `accounting_entry_lines` | account_number, debit_cents, credit_cents, lettrage, CHECK(single_side) |
| `bank_connections` | provider (nordigen/bridge/manual), iban_hash (UNIQUE), sync_status, consent_expires_at |
| `bank_transactions` | amount_cents, reconciliation_status, match_score, suggestion (JSONB), is_internal_transfer |
| `document_analyses` | extracted_data (JSONB), confidence_score, suggested_account, siret_verified, tva_coherent |
| `amortization_schedules` | component, duration_years, depreciable_amount_cents (generated), amortization_method |
| `amortization_lines` | exercise_year, annual_amount_cents, net_book_value_cents |
| `deficit_tracking` | deficit_type (foncier/bic_meuble), remaining_amount_cents (generated), expires_year |
| `charge_regularizations` | provisions_paid vs actual_recoverable vs actual_non_recoverable, balance (generated) |
| `ec_access` + `ec_annotations` | access_level (read/annotate/validate), annotation_type |
| `copro_budgets` + `copro_fund_calls` | budget_lines (JSONB), tantiemes, call periods, payment status |
| `mandant_accounts` + `crg_reports` | commission_rate, CRG periods, totals |
| `accounting_audit_log` | actor_type, action, target_type, details (JSONB), ip_address |

**Triggers :** `trg_entry_balance` (vérifie sum=0 avant validation), `trg_locked_entry` (intangibilité), `trg_audit_entries` (audit auto)

---

## 3. Engine double-entry — API

| Fonction | Entrée | Sortie |
|----------|--------|--------|
| `createEntry(supabase, params)` | lines[], journalCode, date, label, source | AccountingEntry (vérifié, numéroté) |
| `validateEntry(supabase, entryId, userId)` | — | void (trigger vérifie balance, verrouille) |
| `reverseEntry(supabase, entryId, userId, reason)` | — | AccountingEntry (swap D/C, journal OD) |
| `getBalance(supabase, entityId, exerciseId)` | — | BalanceItem[] (solde D/C par compte) |
| `getGrandLivre(supabase, entityId, exerciseId)` | accountFilter? | GrandLivreItem[] (écritures par compte) |
| `createAutoEntry(supabase, event, context)` | AutoEntryEvent + contexte | AccountingEntry (auto-comptabilisée) |
| `createExercise(supabase, entityId, start, end)` | — | { id } |
| `closeExercise(supabase, exerciseId, userId)` | — | void (vérifie toutes écritures validées) |
| `initializeJournals(supabase, entityId)` | — | void (6 journaux par défaut) |
| `applyLettrage(supabase, lineIds, code)` | — | void (vérifie balance avant lettrage) |

### 14 écritures automatiques (AUTO_ENTRIES)

| Événement | D | C |
|-----------|---|---|
| Loyer encaissé | 512100 Banque | 706000 Loyers |
| Facture prestataire | 615100 Travaux | 401000 Fournisseur |
| Paiement fournisseur | 401000 Fournisseur | 512100 Banque |
| Dépôt garantie reçu | 512300 Banque DG | 165000 Dépôts |
| Restitution DG | 165000 Dépôts | 512300 Banque ± 791000 Retenues |
| Transfert interne SCI | 581000 Virements ↔ 512xxx | 512xxx ↔ 581000 |
| Appel fonds copro | 450000 Copropriétaire | 701000 Provisions |
| Honoraires agence | 467000 Mandant | 706100 Honoraires |
| SEPA rejeté | Contre-passation loyer | + Créance 411000 |
| Révision IRL | MAJ bail | Historisation montant |
| Cotisation fonds travaux | 450 Copro | 105 Fonds ALUR |
| Clôture copro | Solde 6xx/7xx | Répartition 450xxx |
| TEOM récupérée | 635200 TEOM | 708000 Charges récupérées |
| Régularisation charges | 614100 Réelles | 613000 Provisions ± solde |

---

## 4. FEC (18 champs art. A47 A-1 LPF)

Format `.txt`, UTF-8 avec BOM, tabulation. Montants en `1234,56` (virgule FR). Séquentiel sans rupture. Trié par ValidDate croissante.

- `generateFEC(supabase, entityId, exerciseId, siren)` → FECResult { content, filename, lineCount, errors }
- `validateFECContent(content)` → FECValidationResult { valid, errors, warnings, lineCount }
- `exportFEC(...)` → blob UTF-8 + BOM, filename `{SIREN}FEC{YYYYMMDD}.txt`, mimeType

---

## 5. Rapprochement bancaire

Score = 50 (montant match) + dateProximity×0.3 + labelSimilarity×0.2 (Jaccard)

| Score | Action |
|-------|--------|
| >= 95 | `matched_auto` (validation immédiate + lettrage) |
| 70-94 | `suggested` (proposition utilisateur) |
| < 70 | `orphan` (catégorisation manuelle) |

Détection transferts internes : même montant, sens inversé, connexions différentes, même jour ±1.

API : `reconcileTransactions`, `manualMatch`, `acceptSuggestion`, `ignoreTransaction`, `getReconciliationStats`

---

## 6. Plan comptable

- **PCG owner** : 35 comptes (164-791), dans `PCG_OWNER_ACCOUNTS`
- **Copro décret 2005** : 30 comptes (102-718), dans `COPRO_ACCOUNTS`
- **Journaux** : ACH, VE, BQ, OD, AN, CL
- `initializeChartOfAccounts(supabase, entityId, 'pcg' | 'copro' | 'both')`
- `addCustomAccount(supabase, entityId, accountNumber, label, accountType)`

---

## 7. Amortissements

Décomposition par composant (terrain 15% non amortissable par défaut). Linéaire. Prorata temporis année 1.

- `decomposeProperty(totalCents, terrainPct)` → PropertyComponent[]
- `computeLinearAmortization(depreciableCents, years, acqDate)` → AmortizationLineResult[]
- `saveAmortizationSchedule(supabase, ...)` → { scheduleId, lineCount }

Composants standard : terrain (15%), gros_oeuvre (40%/50ans), facade (10%/25ans), installations (15%/25ans), agencements (10%/15ans), equipements (10%/10ans)

---

## 8. OCR Pipeline

Prompt système dans `OCR_EXTRACTION_SYSTEM_PROMPT` : retourne JSON strict avec document_type, montants en centimes, suggested_account, alerts.

Validation TVA : `validateTVACoherence(detectedRate, territory)` — 5 territoires DROM-COM.
Validation montants : `validateOCRAmounts(extracted)` — cohérence HT + TVA = TTC.

**Important :** Le document physique est géré par `talok-documents-sota` (upload, storage, bucket).
L'analyse OCR/IA et la liaison comptable sont gérées ICI via `document_analyses`.

### 8.1 Auto-trigger à l'upload

Depuis QW3, l'OCR comptable est **déclenché automatiquement** à l'upload pour les 6 types de pièces comptables :

| `documents.type` | Déclenche OCR auto ? |
|------------------|:---:|
| `facture` | ✅ |
| `devis` | ✅ |
| `avis_imposition` | ✅ |
| `taxe_fonciere` | ✅ |
| `assurance_pno` | ✅ |
| `appel_fonds` | ✅ |

**Point d'entrée :** `app/api/documents/upload/route.ts` appelle `triggerAccountingOcr()` (`lib/accounting/auto-ocr.ts`) en fire-and-forget après l'insert `documents`.

**Comportement quota :**
- Plan `gratuit` ou indéfini → skip + `metadata.ocr_skipped_reason = 'plan_not_eligible'`
- Plan `confort` quota 30/mois atteint → skip + `metadata.ocr_skipped_reason = 'quota_exceeded'`
- Plans `pro` / `enterprise_*` → illimité, jamais skippé

**Garde-fous :**
- Re-check existence du document (race avec delete)
- Skip si `entity_id` du document ≠ entity attendu
- Skip si une analyse existe déjà pour ce document
- Jamais `throw` — toutes les erreurs sont loggées

**L'OCR auto n'auto-valide PAS l'écriture.** L'extraction atterrit dans `document_analyses.extracted_data` avec `processing_status='completed'`. La création de l'écriture reste déclenchée manuellement par l'utilisateur via `POST /api/accounting/documents/[id]/validate` (revue humaine obligatoire).

**Extension de la liste :** pour ajouter un type au trigger auto, éditer `OCR_ACCOUNTING_DOCUMENT_TYPES` dans `lib/accounting/auto-ocr.ts` et documenter ici.

---

## 9. Feature gating comptabilité

| Fonctionnalité | Gratuit | Confort | Pro | Enterprise |
|----------------|---------|---------|-----|------------|
| OCR justificatifs | - | 30/mois | Illimité | Illimité |
| Connexion bancaire | - | 3 comptes | 10 | Illimité |
| FEC + exports | - | Oui | Oui | Oui |
| Amortissements | - | - | Oui | Oui |
| Agent TALO | - | - | Oui | Oui |
| Multi-entités | - | 1 SCI | 5 | Illimité |
| API REST | - | - | Oui | Oui |
| Portail EC | - | 1 EC | Illimité | Illimité |

---

## 10. Règles absolues

1. JAMAIS calcul financier frontend
2. TOUJOURS centimes INTEGER
3. TOUJOURS sum(D)=sum(C)
4. JAMAIS modifier écriture validée → contre-passer
5. JAMAIS FEC sans validation
6. TOUJOURS vérifier plan avant action
7. JAMAIS écriture OCR sans validation humaine
8. TOUJOURS SHA-256 sur docs archivés (→ voir talok-documents-sota)
9. JAMAIS supprimer doc < 10 ans
10. TOUJOURS séparer comptes mandants (Hoguet)
11. TOUJOURS plan copro décret 2005 pour syndic
12. JAMAIS hardcoder TVA (5 taux DROM-COM dans TVA_RATES)
13. TOUJOURS lettrer après rapprochement
14. TOUJOURS audit log sur écritures

---

## 11. Frontières avec les autres skills

| Sujet | Source unique | Renvoi |
|-------|-------------|--------|
| Upload / storage / bucket documents | `talok-documents-sota` | Ici : seulement `document_analyses` |
| Quittances : template + PDF + envoi | `talok-documents-sota` (receipt-generator) | Ici : écriture auto `rent_received` |
| SHA-256, coffre-fort, archivage | `talok-documents-sota` | Ici : durée conservation 10 ans |
| Grille tarifaire / PLAN_LIMITS | `talok-context` section 6 | Ici : matrice feature gating compta |
| TVA pricing Talok (facturation) | - | Ici : TVA_RATES = validation OCR justificatifs utilisateurs |
| Webhook Stripe `payment_intent.succeeded` | webhook Stripe | Ici : déclencheur `createAutoEntry('rent_received')` |

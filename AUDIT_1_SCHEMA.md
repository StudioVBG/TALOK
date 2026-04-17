# Audit 1/3 — Schéma Comptabilité & Ponts Documents

Date : 17/04/2026
Branche : claude/audit-documents-compta-1

## 1. Résumé exécutif
*(À remplir en dernier)*

## 2. Inventaire tables comptables

Sources : migrations `supabase/migrations/20260406210000_accounting_complete.sql` (arch SOTA), `20260408042218_create_expenses_table.sql`, `20260408130000_charges_locatives_module.sql`, `20260407130000_ocr_category_rules.sql`, `20260417090100_tax_notices_table.sql`, `20260305000001_invoice_engine_fields.sql`, `20240101000000_initial_schema.sql`, `20260412000000_fix_cash_receipt_rpc_sota.sql`.

**Légende FK `documents`** :
- ✅ = colonne avec `REFERENCES documents(id)` déclarée
- ⚠️ = colonne UUID nommée `*_document_id` / `document_id` SANS REFERENCES (FK conventionnelle uniquement)
- — = pas de lien explicite

> **Nb lignes prod** non inclus : accès lecture DB prod non autorisé dans cet audit (lecture seule sur migrations + code). Colonne `Volume prod` laissée en `?` — à remplir via `SELECT count(*)` sur prod lors d'un run ultérieur.

### 2.1 — Coeur double-entry (SOTA Sprint 1)

| Table | Colonnes clés | FK → documents | Volume prod |
|-------|---------------|:---:|:---:|
| `accounting_exercises` | `entity_id`, `start_date`, `end_date`, `status` (open/closing/closed), `closed_by`, `closed_at` | — | ? |
| `chart_of_accounts` | `entity_id`, `account_number`, `label`, `account_type` (asset/liability/equity/income/expense), `plan_type` (pcg/copro/custom), `account_class` (GENERATED) | — | ? |
| `accounting_journals` | `entity_id`, `code` CHECK IN (ACH, VE, BQ, OD, AN, CL), `journal_type`, `label` | — | ? |
| `accounting_entries` | `entity_id`, `exercise_id`, `journal_code`, `entry_number`, `entry_date`, `label`, `source`, `reference`, `is_validated`, `is_locked`, `reversal_of` | — | ? |
| `accounting_entry_lines` | `entry_id` (CASCADE), `account_number`, `debit_cents`, `credit_cents` (CHECK single_side), `lettrage`, `piece_ref` | — | ? |
| `accounting_audit_log` | `entity_id`, `actor_id`, `actor_type`, `action`, `target_type`, `target_id`, `details JSONB` | — | ? |

**Observation** : ni `accounting_entries` ni `accounting_entry_lines` n'ont de colonne `document_id` ou `source_document_id`. Le lien document ↔ écriture transite par `accounting_entries.reference` (texte libre, pas FK) + `accounting_entry_lines.piece_ref` (texte libre) **ou** par `document_analyses.entry_id` (FK à `accounting_entries`).

### 2.2 — OCR / Analyse IA

| Table | Colonnes clés | FK → documents | Volume prod |
|-------|---------------|:---:|:---:|
| `document_analyses` | `document_id UUID NOT NULL` **sans REFERENCES**, `entity_id` (FK legal_entities CASCADE), `extracted_data JSONB`, `confidence_score`, `suggested_account`, `suggested_journal`, `document_type`, `processing_status` (pending/processing/completed/failed/validated/rejected), `entry_id` (FK accounting_entries), `raw_ocr_text`, `processing_time_ms`, `suggested_entry JSONB`, `siret_verified`, `tva_coherent`, `validated_by`, `validated_at` | ⚠️ | ? |
| `ocr_category_rules` | `entity_id`, `match_type` (supplier_name/supplier_siret/keyword), `match_value`, `target_account`, `target_journal`, `confidence_boost`, `hit_count` | — | ? |

**Finding 🔴 majeur** : `document_analyses.document_id` n'a pas de FK vers `documents(id)`. Déclaration ligne 300 de `20260406210000_accounting_complete.sql`. Aucune `ALTER TABLE document_analyses ... FOREIGN KEY ... REFERENCES documents` ajoutée ultérieurement (confirmé par grep exhaustif).

### 2.3 — Dépenses / charges / factures fournisseurs

| Table | Colonnes clés | FK → documents | Volume prod |
|-------|---------------|:---:|:---:|
| `expenses` | `legal_entity_id`, `owner_profile_id`, `property_id`, `lease_id`, `category` (travaux/entretien/assurance/taxe_fonciere/charges_copro/frais_gestion/frais_bancaires/diagnostic/mobilier/honoraires/autre), `montant`, `tva_*`, `montant_ttc` (GENERATED), `deductible`, `document_id UUID REFERENCES documents(id) ON DELETE SET NULL`, `receipt_storage_path` | ✅ | ? |
| `charge_categories` | `property_id`, `category` CHECK IN (ascenseurs/eau_chauffage/installations_individuelles/parties_communes/espaces_exterieurs/taxes_redevances), `label`, `is_recoverable`, `annual_budget_cents` | — | ? |
| `charge_entries` | `property_id`, `category_id` (FK charge_categories CASCADE), `label`, `amount_cents`, `date`, `is_recoverable`, `justificatif_document_id UUID` **sans REFERENCES**, `accounting_entry_id UUID` **sans REFERENCES**, `fiscal_year` | ⚠️ | ? |

**Finding 🟡** : `charge_entries.justificatif_document_id` et `charge_entries.accounting_entry_id` sont des UUID sans FK. Pas de `ON DELETE` donc rows orphelines possibles si document ou entry supprimés.

### 2.4 — Bancaire / réconciliation

| Table | Colonnes clés | FK → documents | Volume prod |
|-------|---------------|:---:|:---:|
| `bank_connections` | `entity_id`, `provider` (nordigen/bridge/manual), `provider_connection_id`, `iban_hash` UNIQUE, `sync_status`, `last_sync_at`, `consent_expires_at` | — | ? |
| `bank_transactions` | `connection_id` (CASCADE), `transaction_date`, `amount_cents`, `label`, `raw_label`, `counterpart_name`, `counterpart_iban`, `reconciliation_status` (pending/matched_auto/matched_manual/suggested/orphan/ignored), `matched_entry_id` (FK accounting_entries), `match_score`, `suggestion JSONB`, `is_internal_transfer` | — | ? |
| `bank_reconciliations` | table legacy 20260110000001 (superseded par bank_transactions.reconciliation_status) | — | ? |

**Note** : `bank_transactions` pointe vers `accounting_entries` (not `documents`). Le pipeline Bridge fait un match transaction↔écriture, pas transaction↔document.

### 2.5 — Amortissements / déficit / régul charges

| Table | Colonnes clés | FK → documents | Volume prod |
|-------|---------------|:---:|:---:|
| `amortization_schedules` | `entity_id`, `property_id`, `component`, `acquisition_date`, `total_amount_cents`, `terrain_percent`, `depreciable_amount_cents` (GENERATED), `duration_years`, `amortization_method` (linear/degressive), `is_active` | — | ? |
| `amortization_lines` | `schedule_id` (CASCADE), `exercise_year`, `annual_amount_cents`, `cumulated_amount_cents`, `net_book_value_cents`, `is_prorata`, UNIQUE (schedule_id, exercise_year) | — | ? |
| `deficit_tracking` | `entity_id`, `exercise_id`, `deficit_type` (foncier/bic_meuble), `origin_year`, `initial_amount_cents`, `used_amount_cents`, `remaining_amount_cents` (GENERATED), `expires_year` | — | ? |
| `charge_regularizations` | `entity_id`, `exercise_id`, `lease_id`, `period_start`, `period_end`, `provisions_paid_cents`, `actual_recoverable_cents`, `actual_non_recoverable_cents`, `balance_cents` (GENERATED), `status` (draft/calculated/sent/paid) — **canonique Sprint 1 accounting** | — | ? |
| `lease_charge_regularizations` | `lease_id` (CASCADE), `property_id` (CASCADE), `fiscal_year`, `total_provisions_cents`, `total_actual_cents`, `balance_cents` (GENERATED), `detail_per_category JSONB`, `document_id UUID` **sans REFERENCES** (PDF décompte), `sent_at`, `contested`, `contest_reason`, `status` (draft/calculated/sent/acknowledged/contested/settled), UNIQUE (lease_id, fiscal_year) | ⚠️ | ? |
| `tax_notices` | `property_id` (CASCADE), `entity_id` (FK SET NULL), `year`, `document_id UUID REFERENCES documents(id) ON DELETE SET NULL`, `teom_brut`, `frais_gestion`, `teom_net`, `reom_applicable`, `extraction_method` (manual/ocr), `validated`, UNIQUE (property_id, year) | ✅ | ? |

**Note** : 2 tables régul charges coexistent — `charge_regularizations` (créée par accounting_complete pour le Sprint 1 comptable) et `lease_charge_regularizations` (créée par charges_locatives_module pour le module locatif décret 87-713). Cf. migration 🔴 `20260408044152_reconcile_charge_regularisations_and_backfill_entry_lines.sql` qui migre la table FR `charge_regularisations` (avec "s") vers `charge_regularizations` et crée une vue de compat.

### 2.6 — Copropriété / syndic / mandant

| Table | Colonnes clés | FK → documents | Volume prod |
|-------|---------------|:---:|:---:|
| `copro_budgets` | `entity_id`, `exercise_id`, `budget_name`, `budget_lines JSONB`, `total_budget_cents`, `status` (draft/voted/executed), `voted_at` | — | ? |
| `copro_fund_calls` | `entity_id`, `budget_id` (CASCADE), `copro_lot_id`, `owner_name`, `tantiemes`, `total_tantiemes`, `call_amount_cents`, `call_date`, `due_date`, `payment_status` (pending/partial/paid/overdue), `paid_amount_cents` | — | ? |
| `mandant_accounts` | `entity_id`, `mandant_name`, `mandant_user_id`, `commission_rate` | — | ? |
| `crg_reports` | `entity_id`, `mandant_id` (CASCADE), `exercise_id`, `period_start/end`, `total_income_cents`, `total_expenses_cents`, `commission_cents`, `net_owner_cents`, `report_data JSONB`, `status` (draft/generated/sent/validated), `generated_at`, `sent_at` | — | ? |
| `ec_access` | `entity_id`, `ec_user_id` (FK auth.users), `ec_name`, `ec_email`, `access_level` (read/annotate/validate), `granted_by`, `revoked_at`, `is_active` | — | ? |
| `ec_annotations` | `entity_id`, `entry_id` (FK accounting_entries), `ec_user_id`, `annotation_type` (comment/question/correction/validation), `content`, `is_resolved` | — | ? |

### 2.7 — Loyers / paiements / quittances (flux Talok côté locatif)

| Table | Colonnes clés | FK → documents | Volume prod |
|-------|---------------|:---:|:---:|
| `invoices` | `lease_id` (CASCADE), `owner_id`, `tenant_id`, `periode` YYYY-MM, `montant`, ... + ajouts sprint : `receipt_document_id UUID REFERENCES documents(id)` (via 20260408220000), `receipt_generated_at` | ✅ (receipt_document_id) | ? |
| `payments` | `invoice_id` (CASCADE), `montant`, `moyen` (cb/virement/prelevement), `provider_ref`, `cheque_photo_path TEXT` (bucket `payment-proofs`, via 20260415124844) | — (chemin storage brut) | ? |
| `receipts` | `payment_id`, `lease_id` (CASCADE), `invoice_id`, `tenant_id` (CASCADE), `owner_id` (CASCADE), `period`, `montant_loyer`, `montant_charges`, `montant_total`, `pdf_url`, `pdf_storage_path`, `generated_at`, `sent_at` | — | ? |
| `cash_receipts` | `invoice_id` (CASCADE), `payment_id`, `owner_id`, `tenant_id`, `property_id`, `amount`, `amount_words`, `owner_signature`, `tenant_signature`, `owner_signed_at`, `tenant_signed_at`, `latitude`, `longitude`, `address_reverse` | — | ? |

**Observations** :
- `payments.cheque_photo_path` utilise un chemin Storage brut (bucket `payment-proofs`), **pas** de FK `documents`.
- `cash_receipts.owner_signature` / `tenant_signature` en base64 dans la colonne (pas dans `documents`). Cf. Sprint P1-3 : `lease_signers.signature_image` a été renommé `_signature_image_deprecated` (migration 20260215100000) mais `cash_receipts` n'a pas suivi la même normalisation Storage.
- `receipts.pdf_storage_path` chemin Storage brut, pas FK.

### 2.8 — Synthèse FK → documents

Sur les ~30 tables comptables/paiements inventoriées :
- **2 tables avec FK REFERENCES documents(id) réelle** : `expenses.document_id`, `tax_notices.document_id` (+ `invoices.receipt_document_id`).
- **4 tables avec colonne UUID conventionnelle sans FK** : `document_analyses.document_id`, `charge_entries.justificatif_document_id`, `charge_entries.accounting_entry_id`, `lease_charge_regularizations.document_id`.
- **Le reste** : pas de lien direct. Lien implicite via `accounting_entries.reference` / `.piece_ref` (texte libre) ou via `document_analyses.entry_id`.



## 3. Pont documents.ged_ai_data
*(Pending)*

## 4. Types de documents "pièces comptables"
*(Pending)*

## 5. Triggers et RPCs
*(Pending)*

## 6. Route /api/accounting/documents/
*(Pending)*

## 7. Statut document_analyses
*(Pending)*

## 8. Questions ouvertes
*(À remplir en dernier)*

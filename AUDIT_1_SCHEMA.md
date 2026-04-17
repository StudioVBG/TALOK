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

### 3.1 — Déclaration

Migration `supabase/migrations/20260201000000_ged_system.sql:148` :
```sql
ALTER TABLE documents ADD COLUMN IF NOT EXISTS ged_ai_data JSONB;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS ged_ai_processed_at TIMESTAMPTZ;
```

Commentaire migration : `-- Données extraites par IA GED`.

### 3.2 — Structure

**Aucun schéma déclaré.** Type `JSONB` libre, pas de CHECK constraint, pas de COMMENT ON COLUMN, pas de trigger de validation.

Le seul document décrivant la forme attendue est le skill `.claude/skills/talok-documents-sota/SKILL.md:76` qui note simplement :
> `ged_ai_data JSONB     -- OCR, classification IA`

### 3.3 — Writers

`grep -rn "ged_ai_data" app/ lib/ features/ supabase/functions/` → **aucune opération d'écriture** (INSERT / UPDATE / upsert).

Les seuls usages détectés sont des **lectures** :

| Fichier | Usage |
|---------|-------|
| `lib/hooks/use-ged-documents.ts:114` | `select("..., ged_ai_data, ged_ai_processed_at, ...")` |
| `lib/hooks/use-ged-documents.ts:200` | idem (second appel) |
| `lib/hooks/use-ged-documents.ts:393` | `ged_ai_data: (doc.ged_ai_data as Record<string, unknown>) \|\| null` (mapping vers type TS) |
| `lib/types/ged.ts:161` | `ged_ai_data: Record<string, unknown> \| null;` (déclaration type) |

Les batch files `supabase/apply_scripts/batch_05.sql` et `supabase/fixes/APPLY_ALL_MIGRATIONS.sql` contiennent juste le `ALTER TABLE` — pas d'INSERT non plus.

### 3.4 — Échantillons réels

**Impossible à produire** : aucun accès lecture DB prod autorisé dans cet audit. La colonne étant vide côté writers, les 3-5 échantillons demandés n'existent probablement pas.

Pour obtenir des échantillons réels :
```sql
-- À exécuter côté prod uniquement (lecture seule)
SELECT id, type, ged_ai_data, ged_ai_processed_at
FROM documents
WHERE ged_ai_data IS NOT NULL
LIMIT 5;
```

Si ce SELECT retourne 0 ligne → **confirme l'hypothèse "colonne fantôme"**.

Si ce SELECT retourne des lignes → révèle un writer non-détecté (à enquêter Sprint 2 — candidats : migrations de backfill, scripts admin, fonction Supabase tiers non-versionnée).

### 3.5 — Hypothèse

La colonne `ged_ai_data` a été **prévue** lors du Sprint GED 2026-02 pour accueillir une classification IA généraliste (détection auto du type de document, tags auto). Elle n'a pas été branchée car le pipeline OCR comptable a utilisé sa propre table `document_analyses` (créée 2 mois plus tard en `20260406210000`).

**Verdict** : colonne **morte / dead code**. Le pont document ↔ compta passe **intégralement** par `document_analyses`, pas par `documents.ged_ai_data`.



## 4. Types de documents "pièces comptables"

### 4.1 — Contrainte CHECK actuelle

Dernière définition trouvée : `supabase/migrations/20251228000000_documents_sota.sql` (migration `documents_type_check`, superseding `20251204230000_fix_missing_columns.sql`).

```sql
ALTER TABLE documents ADD CONSTRAINT documents_type_check CHECK (
  type IN (
    -- Contrats
    'bail', 'avenant', 'engagement_garant', 'bail_signe_locataire', 'bail_signe_proprietaire',
    -- Identité
    'piece_identite', 'cni_recto', 'cni_verso', 'passeport', 'titre_sejour',
    -- Finance
    'quittance', 'facture', 'rib', 'avis_imposition', 'bulletin_paie', 'attestation_loyer',
    -- Assurance
    'attestation_assurance', 'assurance_pno',
    -- Diagnostics
    'diagnostic', 'dpe', 'diagnostic_gaz', 'diagnostic_electricite',
    'diagnostic_plomb', 'diagnostic_amiante', 'diagnostic_termites', 'erp',
    -- États des lieux
    'EDL_entree', 'EDL_sortie', 'inventaire',
    -- Candidature
    'candidature_identite', 'candidature_revenus', 'candidature_domicile', 'candidature_garantie',
    -- Garant
    'garant_identite', 'garant_revenus', 'garant_domicile', 'garant_engagement',
    -- Prestataire
    'devis', 'ordre_mission', 'rapport_intervention',
    -- Copropriété
    'taxe_fonciere', 'taxe_sejour', 'copropriete', 'proces_verbal', 'appel_fonds',
    -- Divers
    'consentement', 'courrier', 'photo', 'justificatif_revenus', 'autre'
  )
);
```

### 4.2 — Sous-ensemble "pièces comptables" (= candidates à traitement OCR/écriture)

| Type `documents.type` | Nature métier | Écriture attendue (journal) | Candidate OCR ? |
|-----------------------|---------------|-----------------------------|:---:|
| `facture` | Facture fournisseur générique | ACH (achats) | ✅ |
| `devis` | Devis prestataire (avant facture) | — (pré-comptable) | ✅ (extraction montant prévisionnel) |
| `ordre_mission` | Ordre de travaux prestataire | — | ❌ (contractuel) |
| `rapport_intervention` | Compte-rendu prestataire | — | ❌ |
| `quittance` | Quittance de loyer émise | VE (ventes) | ❌ (générée par Talok, pas OCR) |
| `attestation_loyer` | Attestation loyers encaissés | — (doc fiscal émis) | ❌ |
| `avis_imposition` | Avis TF / TH / autre | ACH ou OD | ✅ |
| `taxe_fonciere` | Avis TF (stockage spécialisé via `tax_notices`) | ACH (compte 635100) + extraction TEOM | ✅ |
| `taxe_sejour` | Avis taxe de séjour | ACH | ✅ |
| `attestation_assurance` | Attestation assurance habitation | — (doc d'attestation) | ❌ |
| `assurance_pno` | Facture assurance PNO propriétaire | ACH (6161 assurances) | ✅ |
| `rib` | RIB (bancaire) | — (doc référentiel) | ❌ |
| `bulletin_paie` | Bulletin de salaire (locataire candidature) | — (doc candidature) | ❌ |
| `appel_fonds` | Appel de fonds syndic | ACH copro ou lié `copro_fund_calls` | ✅ |
| `proces_verbal` | PV AG copro | — (contractuel) | ❌ |
| `copropriete` | Doc copro divers | variable | éventuellement |

**Pièces comptables strictes à OCR** (colonne ✅ ci-dessus) : `facture`, `devis`, `avis_imposition`, `taxe_fonciere`, `taxe_sejour`, `assurance_pno`, `appel_fonds` — plus éventuellement `copropriete` et la quittance locataire (mais côté tenant, pas owner).

### 4.3 — Correspondance avec `OCR_SYSTEM_PROMPT`

Le prompt GPT dans `supabase/functions/ocr-analyze-document/index.ts:15` attend en sortie :
```
"document_type": "facture|quittance|releve_bancaire|avis_impot|contrat|autre"
```

**Incohérence** : le prompt utilise `avis_impot` (pas `avis_imposition` ou `taxe_fonciere`) et `releve_bancaire` (n'existe pas dans `documents.type`). Les valeurs `document_type` dans `document_analyses` peuvent donc diverger de `documents.type` — c'est un champ de classification **parallèle**, pas contraint à matcher.

### 4.4 — Colonnes de pont côté `documents`

Fichiers migrations : `20260201000000_ged_system.sql` (GED) + ajouts ultérieurs.

| Colonne | Source | Rôle |
|---------|--------|------|
| `lease_id` (initial) | Initial schema | Attache doc à un bail |
| `property_id` (initial) | Initial schema | Attache doc à un bien |
| `owner_id` / `tenant_id` (initial) | Initial schema | Attribution utilisateurs |
| `entity_id UUID REFERENCES legal_entities` | 20260201000000 | **Attache à une entité juridique — pré-requis pour RLS compta** |
| `ged_ai_data JSONB` | 20260201000000 | Colonne fantôme (cf. §3) |
| `ged_ai_processed_at` | 20260201000000 | idem |
| `valid_from`, `valid_until` | 20260201000000 | Validité temporelle (diags, assurance) |
| `tags TEXT[]` | 20260201000000 | Tags libres pour recherche |
| `category TEXT` | 20251228000000 | Catégorie de filtrage UI |
| `sha256 TEXT` | 20251228000000 | Hash déduplication (utilisé par analyze §6.2 pré-check #7) |
| `parent_document_id UUID REFERENCES documents(id)` | 20260201000000 | Versioning |
| `application_id UUID REFERENCES tenant_applications` | 20251228000000 | Doc de candidature |
| `guarantor_profile_id UUID REFERENCES profiles` | 20251228000000 | Doc de garant |
| `original_filename`, `file_size`, `mime` | 20251228000000 | Métadonnées fichier |

**Aucune colonne** `invoice_id`, `expense_id`, `transaction_id` sur `documents` : le lien inverse (compta → document) est porté par les tables comptables (`expenses.document_id`, `tax_notices.document_id`, `invoices.receipt_document_id`).

Le lien **document → compta** n'est porté **que** par `document_analyses.document_id` (sans FK) + `document_analyses.entry_id` (FK).



## 5. Triggers et RPCs

### 5.1 — Triggers sur `documents`

| Trigger | Événement | Fonction | Crée une entrée compta ? |
|---------|-----------|----------|:---:|
| `update_documents_updated_at` | BEFORE UPDATE | `update_updated_at_column()` (générique) | ❌ |
| `trg_documents_set_default_position` | (INSERT gallery) | `documents_set_default_position()` | ❌ |
| `trigger_update_document_ged_status` | BEFORE UPDATE WHEN (valid_until OR ged_status change) | `update_document_ged_status()` — bascule `ged_status → 'expired'` si valid_until passée | ❌ |
| `trg_documents_search_vector` | (INSERT/UPDATE) | `documents_search_vector_update()` — maintient index full-text | ❌ |
| `trigger_auto_fill_document_fk` | BEFORE INSERT OR UPDATE | `auto_fill_document_fk()` (migration `20260223000001`) — auto-remplit `property_id` depuis `lease_id`, `owner_id` depuis `property_id`, `tenant_id` depuis `lease_signers`. `SECURITY DEFINER`, exception handler non-bloquant. | ❌ |
| `trigger_notify_owner_on_tenant_document` | (INSERT) | notifie proprio upload locataire | ❌ |
| `trg_notify_tenant_document_center` | (INSERT/UPDATE) | notifie locataire | ❌ |

**Verdict section 5.1** : **aucun trigger DB ne crée d'entrée comptable à partir d'un événement sur `documents`.** La création d'écriture reste exclusivement pilotée côté application (API `/validate` § 6.4 + webhooks Stripe § 5.4).

### 5.2 — Triggers sur tables comptables

Source : `supabase/migrations/20260406210000_accounting_complete.sql` lignes 748–850.

| Trigger | Table | Événement | Fonction | Rôle |
|---------|-------|-----------|----------|------|
| `trg_entry_balance` | `accounting_entries` | BEFORE UPDATE | `fn_check_entry_balance()` | Vérifie `sum(debit)=sum(credit)` au moment de `is_validated=true`, puis set `is_locked=true` et `validated_at=now()` |
| `trg_locked_entry` | `accounting_entries` | BEFORE UPDATE | `fn_locked_entry_guard()` | Empêche toute modification d'une écriture verrouillée — `RAISE EXCEPTION 'Cannot modify a locked/validated entry. Use reversal (contre-passation) instead.'` (intangibilité art. A47 LPF) |
| `trg_audit_entries` | `accounting_entries` | AFTER INSERT OR UPDATE | `fn_audit_entry_changes()` | INSERT dans `accounting_audit_log` pour `create_entry` et `validate_entry` |
| `trg_*_updated_at` (×12) | `chart_of_accounts`, `accounting_exercises`, `accounting_journals`, `bank_connections`, `bank_transactions`, `document_analyses`, `amortization_schedules`, `amortization_lines`, `deficit_tracking`, `charge_regularizations`, `copro_budgets`, `crg_reports` | BEFORE UPDATE | `fn_accounting_updated_at()` | maintient `updated_at` |
| `trg_charge_categories_updated`, `trg_charge_entries_updated`, `trg_lease_charge_reg_updated` | charges locatives | BEFORE UPDATE | update_at | — |
| `update_expenses_updated_at` | `expenses` | BEFORE UPDATE | update_at | — |
| `trg_tax_notices_updated` | `tax_notices` | BEFORE UPDATE | update_at | — |

**Verdict section 5.2** : les triggers comptables sont **exclusivement** des gardes d'intégrité (équilibre D/C, intangibilité) et d'audit (log) — **aucun** ne crée d'entrée en cascade depuis un autre événement.

### 5.3 — RPC / fonctions SQL pertinentes

| Nom | Déclaré dans | Rôle | Lie document ↔ compta ? |
|-----|--------------|------|:---:|
| `auto_fill_document_fk()` | `20260223000001_auto_fill_document_fk.sql` | Auto-remplit FK `documents` (property/owner/tenant) — trigger | ❌ (ne touche pas compta) |
| `create_cash_receipt(...)` | `20241129000002_cash_payments.sql:321` (legacy) + `20260412000000_fix_cash_receipt_rpc_sota.sql` | Crée une quittance de caisse signée ; schéma cache RPC | ❌ (crée `cash_receipts`, pas d'entrée compta directe — l'écriture `rent_received` est faite côté code) |
| `generate_receipt_number()` / `set_receipt_number()` | `20241129000002_cash_payments.sql:107,122` | Génère un numéro de quittance via trigger | ❌ |
| `fn_check_entry_balance()` | `20260406210000_accounting_complete.sql:748` | Garde double-entry | ❌ |
| `fn_locked_entry_guard()` | idem | Intangibilité | ❌ |
| `fn_audit_entry_changes()` | idem | Audit log | ❌ |
| `get_tenant_profile_full()` | `20241130000002` | Récupère profil complet avec docs | ❌ |
| `get_provider_missing_documents()` | `20251205200000` | Lister docs manquants prestataires | ❌ |
| `get_expiring_provider_documents()` | idem | Docs qui expirent | ❌ |
| `get_or_mark_document_creation()` | `20251221000000_document_caching.sql` | Pattern idempotence création doc | ❌ |
| `cleanup_expired_previews()` / `cleanup_old_previews_on_insert()` | idem | GC des previews | ❌ |
| `update_preview_cache_hit()` | idem | Stats cache | ❌ |
| `search_documents()` | `20251228000000_documents_sota.sql:298` | Full-text search owner | ❌ |
| `tenant_document_center()` / `tenant_documents_search()` | mêmes migrations GED | Centres docs locataire | ❌ |

**Aucune RPC SQL ne crée d'écriture comptable à partir d'un document.** Le pont document → écriture est **entièrement orchestré côté TypeScript** via `createEntry()` de `lib/accounting/engine.ts`.

### 5.4 — Orchestration applicative (côté code, pas trigger)

`lib/accounting/engine.ts` expose `createAutoEntry(event, context)` avec les 14 événements métier :
```ts
AutoEntryEvent =
  | 'rent_received' | 'supplier_invoice' | 'supplier_payment'
  | 'deposit_received' | 'deposit_returned'
  | 'internal_transfer' | 'copro_fund_call' | 'agency_fee'
  | 'sepa_rejected' | 'irl_revision'
  | 'copro_works_fund' | 'copro_closing'
  | 'teom_recovered' | 'charge_regularization';
```

Appelé depuis :
- `app/api/webhooks/stripe/route.ts:999` → `rent_received` sur `payment_intent.succeeded`
- `app/api/webhooks/stripe/route.ts:1098` → `sepa_rejected` sur `payment_intent.payment_failed`
- `lib/accounting/receipt-entry.ts:153` → `rent_received` pour paiements off-Stripe (code partagé avec `app/api/payments/confirm/route.ts`, `app/api/invoices/[id]/mark-paid/route.ts`, `app/api/leases/[id]/generate-receipt/route.ts`)
- `app/api/accounting/documents/[id]/validate/route.ts` → `createEntry()` direct (pas via `createAutoEntry`) pour OCR `supplier_invoice`

**Synthèse** : tous les ponts "événement métier → écriture comptable" passent par ces deux fonctions TypeScript. Rien en SQL pur.



## 6. Route /api/accounting/documents/

### 6.1 — Structure

```
app/api/accounting/documents/
├── analyze/route.ts           (POST)
└── [id]/
    ├── analysis/route.ts      (GET)
    └── validate/route.ts      (POST)
```

**Pas de `route.ts` racine** — il n'y a pas de GET `/api/accounting/documents` listant les analyses. Les 3 endpoints ci-dessous forment un pipeline séquentiel.

### 6.2 — POST `/api/accounting/documents/analyze`

**Fichier** : `app/api/accounting/documents/analyze/route.ts`

**Input** :
```ts
{ documentId: z.string().uuid() }
```

**Pré-checks** (dans l'ordre) :
1. `supabase.auth.getUser()` → sinon 401
2. Profil existe (`profiles.user_id = auth.user.id`) → sinon 403
3. Feature gate : `requireAccountingAccess(profile.id, "entries")` (via `lib/accounting/feature-gates.ts`)
4. Membership : `entity_members.entity_id WHERE user_id = auth.user.id LIMIT 1` (prend la première entity → **limite** : multi-entity non supporté sur cet endpoint)
5. Quota OCR mensuel selon plan : `OCR_QUOTAS = { confort: 30, pro: Infinity, enterprise_*: Infinity }`. Free/gratuit = 0 → 403. Comptage : `count(document_analyses WHERE entity_id=X AND created_at >= monthStart)`
6. Document existe + `entity_id` égal à l'entity du user → sinon 404/403
7. Détection doublon via SHA-256 : autre `documents.sha256 = X AND entity_id = Y AND id != documentId` → 409 avec `existingDocumentId`
8. Pas d'analyse en cours : `document_analyses WHERE document_id=X AND processing_status IN ('pending','processing')` → 409
9. Alerte exercices clôturés : si `accounting_exercises WHERE status='closed'` non vide → push alerte non bloquante

**Effet en base** :
- **INSERT** `document_analyses` : `{ document_id, entity_id, processing_status: 'pending', extracted_data: {} }` → récupère `analysis.id`
- Lit `legal_entities.territory` (`metropole` par défaut) pour déterminer les taux TVA attendus
- **Appel edge function** `supabase.functions.invoke("ocr-analyze-document", { body: { documentId, entityId, territory, analysisId } })`
- Si edge function échoue : **UPDATE** `document_analyses SET processing_status='failed'` → 502

**Output 202** :
```json
{ "success": true, "data": { "analysisId": "<uuid>", "status": "analyzing", "alerts": [...] } }
```

### 6.3 — GET `/api/accounting/documents/[id]/analysis`

**Fichier** : `app/api/accounting/documents/[id]/analysis/route.ts`

**Logique** : polling. Charge la ligne la plus récente :
```ts
.from("document_analyses").select("*").eq("document_id", id).order("created_at", desc).limit(1).single()
```

**Sécurité** : auth check mais **pas** de vérification explicite de l'ownership du `document_id` → repose sur RLS `doc_analyses_entity_access` (filtre par `entity_id IN entity_members`).

**Output** : `{ success: true, data: <document_analyses row complète> }` ou 404 si aucune analyse.

### 6.4 — POST `/api/accounting/documents/[id]/validate`

**Fichier** : `app/api/accounting/documents/[id]/validate/route.ts`

**Input** (tous optionnels — fallback sur `extracted_data` de l'analyse) :
```ts
{
  journalCode?, accountNumber?, accountLabel?, amount?, entryLabel?,
  propertyId?, entryDate?, autoValidate?: boolean = true
}
```

**Logique** :
1. Auth + feature gate + profile
2. Charge dernière analyse : `document_analyses WHERE document_id=X ORDER BY created_at DESC LIMIT 1`
3. Vérifications :
   - `processing_status === 'completed'` → sinon 400
   - `entry_id IS NULL` → sinon 400 "déjà validé"
4. Merge overrides > extracted :
   - journal : `overrides.journalCode ?? extracted.suggested_journal ?? 'ACH'`
   - compte : `overrides.accountNumber ?? extracted.suggested_account ?? '615100'`
   - montant : `overrides.amount ?? extracted.montant_ttc_cents ?? 0`
   - date : `overrides.entryDate ?? extracted.date_document ?? today`
5. `getOrCreateCurrentExercise(supabase, entityId)` (`lib/accounting/auto-exercise.ts`)
6. **Création écriture** via `createEntry()` (`lib/accounting/engine.ts`) :
   - Journal choisi, date, label, `source: 'ocr'`, `reference: analysis.id`
   - 2 lignes : débit compte choisi (charge) / crédit `401000` (fournisseur générique)
7. Si `autoValidate=true` → `validateEntry(supabase, entry.id, user.id)`
8. **UPDATE** `document_analyses SET entry_id=<entry>, validated_by=<user>, validated_at=now, processing_status='validated'`
9. **Apprentissage** : si `overrides.accountNumber !== extracted.suggested_account` ET `extracted.emetteur.nom` présent → `upsert ocr_category_rules { entity_id, match_type:'supplier_name', match_value: nom.toLowerCase().trim(), target_account, target_journal, hit_count:1 }` sur conflit `(entity_id, match_type, match_value)`

**Output** : `{ success: true, data: { entry, validated } }`

### 6.5 — Edge function `ocr-analyze-document`

**Fichier** : `supabase/functions/ocr-analyze-document/index.ts`

**Pipeline** :
1. Télécharge le PDF depuis le bucket documents
2. Appelle GPT-4o-mini avec `OCR_SYSTEM_PROMPT` strict : sortie JSON `{ document_type, emetteur, destinataire, date_document, montant_ht/tva/ttc_cents, taux_tva_percent, lignes[], suggested_account, suggested_journal, suggested_label, alerts[], confidence }`
3. Validation TVA (cohérence HT+TVA=TTC, taux par territoire : métropole 20/10/5.5/2.1, DROM 8.5/2.1, Guyane/Mayotte 0)
4. Validation SIRET : regex `^\d{14}$`
5. Lookup `ocr_category_rules WHERE entity_id=X AND emetteur_pattern ILIKE '%<emetteur.nom>%' LIMIT 1` — **remplace** `suggested_account` / `suggested_journal` si règle trouvée
6. **UPDATE** `document_analyses SET processing_status='completed', extracted_data=<gptResult>, confidence_score, suggested_account, suggested_journal, document_type, siret_verified, tva_coherent`
7. Sur erreur : UPDATE `processing_status='failed', extracted_data={error: <message>}`

### 6.6 — Appelants frontend

**Fichier hook** : `lib/hooks/use-document-analysis.ts`

```
ligne 113  GET  /accounting/documents/${docId}/analysis
ligne 178  POST /accounting/documents/analyze
ligne 202  POST /accounting/documents/${documentId}/validate
```

C'est le **seul** hook qui consomme ce pipeline. Aucune autre route / composant ne grep `accounting/documents`.

### 6.7 — Effet global sur la compta

Le pipeline `analyze → analysis (polling) → validate` :
- **Crée** une ligne `document_analyses` (pipeline status)
- **Crée** une écriture `accounting_entries` + 2 lignes `accounting_entry_lines` (via `createEntry`) au moment du `validate`
- **Lie** `document_analyses.entry_id = <nouvelle entry>` — c'est le **seul pont déclaré** entre un document et une écriture comptable
- **Ne touche pas** à `documents.ged_ai_data` (cf. §3)
- **Peut apprendre** une règle `ocr_category_rules` pour futures analyses similaires

**Le lien document ↔ écriture** repose entièrement sur `document_analyses.document_id` (UUID sans FK, cf. §2.2 et §7) et `document_analyses.entry_id` (FK à accounting_entries). Aucune colonne de `accounting_entries` ne pointe directement vers `documents`.



## 7. Statut document_analyses

### 7.1 — Schéma déclaré (migration `20260406210000_accounting_complete.sql` lignes 296–319, étendue par `20260407130000_ocr_category_rules.sql`)

```sql
CREATE TABLE IF NOT EXISTS document_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL,                                        -- ⚠️ pas de REFERENCES
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  extracted_data JSONB NOT NULL DEFAULT '{}',
  confidence_score NUMERIC(5,4),
  suggested_account TEXT,
  suggested_journal TEXT,
  document_type TEXT,
  siret_verified BOOLEAN DEFAULT false,
  tva_coherent BOOLEAN DEFAULT false,
  processing_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (processing_status IN ('pending','processing','completed','failed','validated','rejected')),
  validated_by UUID REFERENCES auth.users(id),
  validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Ajouts par 20260407130000 :
ALTER TABLE document_analyses ADD COLUMN IF NOT EXISTS entry_id UUID REFERENCES accounting_entries(id);
ALTER TABLE document_analyses ADD COLUMN IF NOT EXISTS raw_ocr_text TEXT;
ALTER TABLE document_analyses ADD COLUMN IF NOT EXISTS processing_time_ms INTEGER;
ALTER TABLE document_analyses ADD COLUMN IF NOT EXISTS suggested_entry JSONB;
```

**Vérification exhaustive** : `grep "ALTER TABLE document_analyses.*FOREIGN\|document_analyses.*REFERENCES documents"` sur toutes les migrations → **0 match**. La FK vers `documents(id)` n'a jamais été posée.

### 7.2 — RLS

```sql
CREATE POLICY "doc_analyses_entity_access" ON document_analyses
  FOR ALL TO authenticated
  USING (entity_id IN (SELECT entity_id FROM entity_members WHERE user_id = auth.uid()))
  WITH CHECK (entity_id IN (SELECT entity_id FROM entity_members WHERE user_id = auth.uid()));
```

Accès filtré par `entity_id` (sûr). Mais comme il n'y a pas de check sur `document_id`, un utilisateur peut techniquement INSERT `{ document_id: '<uuid quelconque>', entity_id: <sa propre entity> }` et contourner le check d'appartenance du document à l'entity. Le guard fonctionnel est appliqué **côté API** (analyze/route.ts §6.2 pré-check #6), pas côté DB.

### 7.3 — Qui écrit ? (4 chemins distincts)

| Fichier | Opération | Contexte |
|---------|-----------|----------|
| `app/api/accounting/documents/analyze/route.ts:145` | INSERT `{ document_id, entity_id, processing_status: 'pending', extracted_data: {} }` | Démarrage pipeline OCR |
| `app/api/accounting/documents/analyze/route.ts:217` | UPDATE `processing_status='failed'` | Si edge function invoke échoue |
| `app/api/accounting/documents/[id]/validate/route.ts:126` | UPDATE `entry_id, validated_by, validated_at, processing_status='validated'` | Après création écriture |
| `supabase/functions/ocr-analyze-document/index.ts:216` | UPDATE `processing_status='completed', extracted_data, confidence_score, suggested_account, suggested_journal, document_type, siret_verified, tva_coherent` | Fin OCR normale |
| `supabase/functions/ocr-analyze-document/index.ts:256` | UPDATE `processing_status='failed', extracted_data={error: ...}` | Fin OCR en erreur |
| `lib/accounting/chart-amort-ocr.ts:639` | INSERT `{ document_id, entity_id, extracted_data, confidence_score, suggested_*, document_type, siret_verified, tva_coherent, processing_status: 'completed' }` | **Chemin parallèle** : insertion directe sans passer par le pipeline analyze (appelé par ?) |

**Finding 🟡** : deux chemins d'INSERT distincts :
- `/api/accounting/documents/analyze` insère `pending` puis laisse l'edge function compléter.
- `lib/accounting/chart-amort-ocr.ts:saveAnalysis()` insère directement en `completed`.

### 7.4 — Qui lit ?

| Fichier | Opération |
|---------|-----------|
| `app/api/accounting/documents/[id]/analysis/route.ts:24` | SELECT le plus récent WHERE document_id=X (polling UI) |
| `app/api/accounting/documents/[id]/validate/route.ts:54` | SELECT le plus récent WHERE document_id=X (chargement avant validation) |
| `app/api/accounting/documents/analyze/route.ts:86` | SELECT count(*) WHERE entity_id=X AND created_at >= monthStart (quota OCR) |
| `app/api/accounting/documents/analyze/route.ts:177` | SELECT WHERE document_id=X AND processing_status IN ('pending','processing') (anti-doublon) |
| `supabase/functions/weekly-missing-documents/index.ts:54` | SELECT pour détecter écritures sans document_analyses lié (cron alertes) |
| `lib/hooks/use-document-analysis.ts` | Consomme les 3 endpoints API (pas d'accès direct à la table) |

### 7.5 — Conséquences de l'absence de FK

**Scénarios problématiques** :

1. **Document supprimé** (`DELETE FROM documents WHERE id=X`) :
   - `document_analyses.document_id = X` devient orphelin silencieusement.
   - Aucune cascade, aucun check. GET `/api/accounting/documents/X/analysis` retourne quand même la ligne.
   - Impact : UI peut afficher une analyse orpheline pointant vers un document inexistant.

2. **document_id fantôme à l'INSERT** :
   - `INSERT document_analyses { document_id: '<uuid qui n'existe pas>' }` passe sans erreur DB.
   - Seule protection : le pré-check API dans `analyze/route.ts:104` (`SELECT documents WHERE id=X`). Si on bypass l'API (ex. script, migration), rien n'empêche l'insertion.

3. **Entity mismatch** :
   - Le `document_id` et `entity_id` ne sont pas corrélés en base. L'intégrité repose sur le code API.

**Pas de conséquence immédiate** en prod si les invariants sont respectés par le code, mais **robustesse faible** : un bug ou un accès direct à la DB peut créer des orphelins.

### 7.6 — `document_analyses` vs `documents.ged_ai_data`

| Aspect | `document_analyses` | `documents.ged_ai_data` |
|--------|---------------------|--------------------------|
| Déclaré dans | `20260406210000_accounting_complete.sql` | `20260201000000_ged_system.sql:148` |
| Finalité annoncée | Pipeline OCR comptable + lien vers `accounting_entries` | "Données extraites par IA GED" (comment migration) |
| Writers | 4 chemins (analyze/validate/edge fn/chart-amort-ocr) | **0 writer détecté** dans `app/`, `lib/`, `features/`, `supabase/functions/` |
| Readers | 5+ chemins API + cron | `lib/hooks/use-ged-documents.ts:114,200,393` (SELECT uniquement, fallback `|| null`) + `lib/types/ged.ts:161` (type) |
| Structure | Colonnes typées + `extracted_data JSONB` selon prompt GPT | `JSONB` libre — aucun schéma déclaré |
| État | **Actif** | **Déclaré mais non peuplé** — colonne vide en prod |

**Verdict** : `documents.ged_ai_data` est une colonne **fantôme** — prévue pour une classification IA "GED" (non-comptable) qui n'a jamais été branchée. Tous les writes OCR actuels vont dans `document_analyses.extracted_data`. La colonne peut être considérée comme *dead code* (à confirmer avec Sprint 2).



## 8. Questions ouvertes
*(À remplir en dernier)*

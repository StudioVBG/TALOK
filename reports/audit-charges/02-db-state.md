# PASS 2 — État DB (à exécuter côté prod)

> ⚠️ L'audit n'a pas d'accès MCP Supabase en écriture ni en lecture directe sur prod dans cette session. Les requêtes read-only ci-dessous sont packagées dans `scripts/audit-charges/queries.sql`. Thomas les exécute dans le SQL Editor Supabase et colle les résultats ici.

> 🗒️ À défaut d'accès prod, **l'inférence via migrations + code** permet de produire un statut "attendu" pour chaque gap P0. C'est cette inférence qui sert à construire la matrice PASS 4.

---

## Status P0 (inféré depuis les migrations mergées)

| Gap P0 | Migration | Statut attendu |
|---|---|---|
| #1 `regularization_invoice_id` | `20260417090000_charges_reg_invoice_link.sql` | ✅ DONE (colonne + index + FK ON DELETE SET NULL) |
| #2 Trigger/API écriture comptable auto au settle | — | ❌ MISSING (confirmé côté code : aucune route `/apply` canonique, voir `03-code-state.md`) |
| #3 Comptes PCG 419100 + 654000 backfillés | `20260417090400_charges_pcg_accounts_backfill.sql` | ✅ DONE (INSERT … FROM legal_entities ON CONFLICT DO NOTHING) |
| #4 RLS locataire `sent → contested` | `20260417090300_fix_tenant_contest_rls.sql` | ✅ DONE (policy réécrite, USING status='sent' + WITH CHECK status='contested') |

---

## SECTION A — `lease_charge_regularizations`

### A.1 — Colonnes (attendues depuis migrations)

Depuis `20260408130000_charges_locatives_module.sql` + `20260417090000_charges_reg_invoice_link.sql` :

| Colonne | Type | Null | Source |
|---|---|---|---|
| id | uuid | NO | base |
| lease_id | uuid | NO | base |
| property_id | uuid | NO | base |
| fiscal_year | int | NO | base |
| total_provisions_cents | int | NO | base |
| total_actual_cents | int | NO | base |
| balance_cents | int | GENERATED STORED | base (= actual − provisions) |
| detail_per_category | jsonb | NO | base |
| document_id | uuid | YES | base |
| sent_at | timestamptz | YES | base |
| contested | bool | NO | base |
| contest_reason | text | YES | base |
| contest_date | timestamptz | YES | base |
| status | text | NO | base CHECK ('draft','calculated','sent','acknowledged','contested','settled') |
| created_at | timestamptz | NO | base |
| updated_at | timestamptz | NO | base |
| **regularization_invoice_id** | **uuid** | **YES** | **Sprint 0.a — migration 090000** ✅ |

> Output prod (colle ici après exécution du bloc A.1) :
>
> ```
> (attendu ~16 lignes dont regularization_invoice_id)
> ```

### A.2 — Index

Attendus :
- `lease_charge_regularizations_pkey` (id)
- `idx_lease_charge_reg_lease` (lease_id)
- `idx_lease_charge_reg_property` (property_id)
- `idx_lease_charge_reg_year` (fiscal_year)
- `idx_lease_charge_reg_status` (status)
- **`idx_lcr_regularization_invoice_id`** (regularization_invoice_id WHERE NOT NULL) — Sprint 0.a ✅
- Unique index sur `(lease_id, fiscal_year)`

> Output prod :
>
> ```
> (à coller)
> ```

### A.3 — Policies RLS

Attendues après Sprint 0.a :

| policyname | cmd | USING | WITH CHECK |
|---|---|---|---|
| `lease_charge_reg_owner_access` | ALL | owner via properties.owner_id | idem |
| `lease_charge_reg_tenant_read` | SELECT | tenant via lease_signers | — |
| **`lease_charge_reg_tenant_contest`** | UPDATE | `status = 'sent'` + tenant | `status = 'contested'` + tenant (migration 090300) ✅ |

> Output prod :
>
> ```
> (à coller)
> ```

---

## SECTION B — `tax_notices` + `epci_reference`

### B.1 — Existence

Les 2 tables doivent apparaître (créées en Sprint 0.a par les migrations 090100 et 090200).

### B.2 — `tax_notices` structure attendue

| Colonne | Type | Null |
|---|---|---|
| id | uuid | NO |
| property_id | uuid | NO |
| entity_id | uuid | YES |
| year | int (CHECK 2000-2100) | NO |
| document_id | uuid | YES |
| teom_brut | int (CHECK >=0) | YES |
| frais_gestion | int (CHECK >=0) | YES |
| teom_net | int (CHECK >=0) | YES |
| reom_applicable | bool DEFAULT false | NO |
| extraction_method | text ('manual'\|'ocr') | NO |
| validated | bool DEFAULT false | NO |
| created_at, updated_at | timestamptz | NO |

Contraintes : UNIQUE `(property_id, year)`.

### B.3 — `epci_reference` structure attendue

| Colonne | Type | Null |
|---|---|---|
| id | uuid | NO |
| code_departement | text | NO |
| code_postal_pattern | text | YES |
| epci_name | text | NO |
| syndicat_traitement | text | YES |
| waste_tax_type | text ('teom'\|'reom'\|'none') DEFAULT 'teom' | NO |
| teom_rate_pct | numeric(5,2) | YES |
| teom_rate_year | int | YES |
| notes | text | YES |
| created_at | timestamptz | NO |

Contrainte : UNIQUE `(code_departement, epci_name)`.

### B.4 — Policies RLS

- `tax_notices_owner_access` (ALL, owner scope via properties)
- `epci_reference_public_read` (SELECT, authenticated + anon)

### B.5 — Nombre de rows attendus

| Table | Attendu |
|---|---|
| `tax_notices` | 0 (aucun seed, populé par usage) |
| `epci_reference` | **23** (3 Martinique + 6 Guadeloupe + 5 Réunion + 4 Guyane + 5 Mayotte) |

> Output prod :
>
> ```
> (à coller — vérifier especially epci_reference = 23)
> ```

---

## SECTION C — Comptes PCG (P0 #3)

### C.1 + C.2 — Comptes attendus présents sur toutes les entities

| account_number | label | account_type | Source |
|---|---|---|---|
| 411000 | Locataires — creances | asset | PCG_OWNER_ACCOUNTS (antérieur) |
| **419100** | Provisions de charges recues | liability | **Sprint 0.b** ✅ (ajout lib + migration backfill) |
| 614100 | Charges reelles recuperables | expense | PCG_OWNER_ACCOUNTS (antérieur) |
| 635200 | TEOM | expense | PCG_OWNER_ACCOUNTS (antérieur) |
| **654000** | Charges recuperables non recuperees | expense | **Sprint 0.b** ✅ (ajout lib + migration backfill) |
| 706000 | Loyers | income | PCG_OWNER_ACCOUNTS (antérieur) |
| 708000 | Charges recuperees / TEOM | income | PCG_OWNER_ACCOUNTS (antérieur) |

**Règle de validation prod** : pour chaque `account_number ∈ {419100, 654000}`, `entities_with_this_account` doit == `COUNT(*) FROM legal_entities`.

> Output prod :
>
> ```
> (à coller)
> ```

---

## SECTION D — Triggers & functions (P0 #2)

### D.1 — Triggers attendus

Depuis migration 20260408130000 + Sprint 0.a :
- `trg_charge_categories_updated` (BEFORE UPDATE → update_charges_updated_at)
- `trg_charge_entries_updated` (idem)
- `trg_lease_charge_reg_updated` (idem)
- `trg_tax_notices_updated` (idem, Sprint 0.a)

**❌ AUCUN trigger de génération d'écriture comptable au settle** — c'est le gap P0 #2 restant (confirmé côté code, section `03-code-state.md`).

### D.2 — Functions attendues

- `update_charges_updated_at()` — utilitaire mise à jour updated_at
- `charge_regularisations_insert_redirect()` — redirect vue legacy FR
- `charge_regularisations_update_redirect()` — idem
- `charge_regularisations_delete_redirect()` — idem

---

## SECTION E — RED FLAGS (voir aussi `05-red-flags.md`)

Les requêtes E.1 à E.6 valident les points soulevés dans le rapport red flags. Résumé inféré :

| Check | Attendu |
|---|---|
| `charge_entries` colonnes | **PAS de `regularization_id`** — liaison via `property_id + fiscal_year` (cf migration 20260408130000) |
| `charge_categories.property_id` | présent — catégories sont SCOPÉES PAR BIEN (pas un référentiel global comme le skill le décrit) |
| Vues legacy | 3 entités coexistent : `charge_regularisations` (vue FR), `charge_regularisations_legacy` (ancienne table renommée), `charge_regularizations` (table EN normalisée), plus la canonique `lease_charge_regularizations` |
| Vue `charge_summary` | **ABSENTE** (aucune migration ne la crée) |
| FK vers invoices | `regularization_invoice_id → invoices(id) ON DELETE SET NULL` présente (Sprint 0.a) |

---

## Comment compléter ce rapport

1. Lancer `scripts/audit-charges/queries.sql` dans Supabase SQL Editor prod
2. Copier les outputs sous chaque bloc (remplacer les `(à coller)`)
3. Vérifier qu'aucun écart avec le "attendu" ci-dessus — si écart, créer une entrée dans `05-red-flags.md`

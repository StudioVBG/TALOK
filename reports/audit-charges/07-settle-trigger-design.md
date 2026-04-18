# Sprint 0.c — Commit 3 (P0 #2 trigger settle) — design report

**Date** : 2026-04-18
**Statut** : ⏸️ STOP — en attente de validation Thomas avant implémentation.

---

## Schéma comptable prod (vérifié)

### Tables (migration `20260406210000_accounting_complete.sql`)

Modèle **header + lignes** (double-entry normalisé, pas d'inline).

#### `accounting_entries` (header)

| Colonne | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid | NO | PK |
| `entity_id` | uuid | NO | FK legal_entities |
| **`exercise_id`** | **uuid** | **NO** | **FK accounting_exercises — à résoudre à partir de la date de settle** |
| **`journal_code`** | **text** | **NO** | **Choix : 'OD' (opérations diverses) ou autre ?** |
| **`entry_number`** | **text** | **NO** | **Généré via `fn_next_entry_number(entity_id, exercise_id, journal_code)` (migration 20260406210000:850)** |
| `entry_date` | date | NO | date de settle |
| `label` | text | NO | ex: "Régularisation charges 2024 — bail X" |
| `source` | text | YES | proposé : `'charge_regularization_settle'` |
| `reference` | text | YES | proposé : `regularization.id` |
| `is_validated` | bool | NO DEFAULT false | passe à true après SUM(D)=SUM(C) |
| `is_locked` | bool | NO DEFAULT false | — |
| **`created_by`** | **uuid** | **NO** | **FK auth.users — bloquant pour un trigger DB** |
| `created_at`, `updated_at` | tstz | NO | — |

Contrainte : UNIQUE `(entity_id, exercise_id, entry_number)`.

#### `accounting_entry_lines`

| Colonne | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid | NO | PK |
| `entry_id` | uuid | NO | FK cascade |
| **`account_number`** | **text** | **NO** | **texte libre (pas FK)** — join applicatif sur `chart_of_accounts` |
| `label` | text | YES | — |
| `debit_cents` | int | NO DEFAULT 0 | CHECK >= 0 |
| `credit_cents` | int | NO DEFAULT 0 | CHECK >= 0 |
| `lettrage`, `piece_ref` | text | YES | — |

Contrainte CHECK `single_side` : `(debit > 0 AND credit = 0) OR (debit = 0 AND credit > 0)`.

**Pas de CHECK d'équilibre au niveau header** : c'est le trigger `trg_entry_balance` qui vérifie `SUM(debit) = SUM(credit)` au moment de la validation (`is_validated = true`).

### Helpers déjà prêts

- **SQL** : `fn_next_entry_number(entity_id, exercise_id, journal_code)` — numérotation séquentielle par exercice et journal, format `OD-2025-000042`
- **TS** : `createEntry()` dans `lib/accounting/engine.ts:150` — prend `{entityId, exerciseId, journalCode, entryDate, label, source, reference, userId, lines[]}`, gère le numéro + header + lignes en 3 INSERTs atomiques ; `validateEntry()` pour poser `is_validated=true` (le trigger `trg_entry_balance` vérifie l'équilibre ici).

---

## Questions design bloquantes

### Q1 — Trigger DB ou route API ?

**Réponse recommandée** : **route API `POST /api/charges/regularization/[id]/apply` (Sprint 2)**, pas trigger DB.

Raisons :
- `created_by UUID NOT NULL REFERENCES auth.users` — dans un trigger, `auth.uid()` peut être NULL (service role). Un trigger devrait soit utiliser un NULL-hack, soit stocker l'identité du caller dans une table annexe.
- `entry_number` nécessite un appel à `fn_next_entry_number` — faisable dans un trigger mais multiplie les accès disque par régul.
- Sprint 2 doit aussi créer une `invoice` (cas Stripe), initier un PaymentIntent, choisir le `settlement_method` — toute cette logique vit au niveau applicatif, pas en trigger.
- `lib/accounting/engine.ts` expose déjà `createEntry()` côté TS — c'est l'API métier que tout le reste du module comptable consomme.

Un trigger DB a du sens pour des side-effects **idempotents et sans I/O externe** (updated_at, dénormalisations) — pas pour générer des écritures comptables avec auth + numérotation + Stripe.

### Q2 — Quel journal_code ?

3 options valides :
- **'OD'** (Opérations diverses) — simple, par défaut pour tout ce qui n'est ni achat, ni vente, ni banque
- **'VE'** (Ventes) — si on considère que la refacturation TEOM au locataire est une vente
- **Nouveau code** (ex: 'REG') — nécessite ajout au CHECK sur `accounting_journals.code` (actuellement `IN ('ACH','VE','BQ','OD','AN','CL')`)

**Réponse recommandée** : **'OD'** pour le scénario simple. À affiner si le FEC révèle un besoin de catégoriser.

### Q3 — Quel pattern d'écritures ? (skill section 6)

Le prompt Sprint 0.c propose une version simplifiée (DB 411/CR 708 si balance > 0). Cette version **ne solde pas les provisions 419100** — incohérence comptable.

Le skill (section 6, scénario B) impose **2 écritures distinctes** par settle complément :

```
Écriture A — solde des provisions accumulées :
  Débit 419100 (Provisions)            total_provisions_cents
  Crédit 614100 (Charges récupérables) total_actual_cents
  (déséquilibre = balance, compensé par écriture B)

Écriture B — créance du complément :
  Débit 411000 (Locataires)            balance_cents
  Crédit 708000 (Charges refacturées)  balance_cents
```

Variante alternative **en 1 seule écriture équilibrée** :
```
Débit 419100  total_provisions_cents
Débit 411000  balance_cents
Crédit 614100 total_actual_cents
Crédit 708000 balance_cents
```

Deux lignes Débit + deux lignes Crédit, `SUM(D) = SUM(C) = total_actual_cents + balance_cents`. Plus simple, cohérent avec le modèle entry_lines.

**Réponse recommandée** : **1 seule écriture à 4 lignes** (pattern variante). L'écriture A seule (solder provisions) + écriture B seule (créance) est plus lisible mais double la charge de génération.

### Q4 — Résolution `exercise_id`

L'exercice ouvert pour l'entity à la date de settle. Nécessite un SELECT avant insertion.

```sql
SELECT id FROM accounting_exercises
WHERE entity_id = :entity AND status = 'open'
  AND :settle_date BETWEEN start_date AND end_date
LIMIT 1;
```

Si aucun exercice ouvert couvre la date (fin d'année non ouverte) → erreur applicative, refuser le settle.

---

## 5 scénarios du skill à implémenter

| Scénario | Trigger côté régul | Écritures |
|---|---|---|
| **B** — complément (balance > 0) | `settlement_method ∈ {stripe, next_rent}` + `settled_at` + invoice | DB 419100 + DB 411000 / CR 614100 + CR 708000 |
| **C** — trop-perçu (balance < 0) | `settlement_method ∈ {deduction, stripe remboursement}` + `settled_at` | DB 419100 (total_prov) / CR 614100 (actual) + CR 419100 (|balance|) — reste à rembourser |
| **D** — waived (renonciation) | `settlement_method = 'waived'` + `settled_at` | DB 654000 (balance) + DB 419100 (total_prov) / CR 614100 (actual) |
| **E** — échelonnement 12 mois | `settlement_method = 'installments_12'` + `installment_count = 12` | Écriture B unique + 12 schedule lines (sprint 2 détail) |
| **Stripe** | idem B/C + `regularization_invoice_id` | idem B/C |

---

## Pré-requis migration avant le trigger/API

Colonnes à ajouter sur `lease_charge_regularizations` (red flag RF-9 de l'audit) :
```sql
ALTER TABLE lease_charge_regularizations
  ADD COLUMN IF NOT EXISTS settlement_method TEXT CHECK (settlement_method IN
    ('stripe','next_rent','installments_12','deduction','waived')),
  ADD COLUMN IF NOT EXISTS installment_count INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ;
```

Le type TS `SettlementMethod` dans `lib/charges/types.ts:118` est déjà aligné sur ces 5 valeurs.

---

## Proposition d'action

Option ①  — **Trigger DB minimal, juste l'écriture** (ce que le prompt Sprint 0.c demande). Accepte les limites (created_by NULL ou passé via GUC session variable, journal_code='OD' figé). Code rapide (~100 lignes plpgsql). Ne gère pas Stripe / invoice / échelonnement.

Option ②  — **Reporter à Sprint 0.d / Sprint 2** l'implémentation en route API `/apply`. Gère tous les scénarios, réutilise `createEntry()` existant, propre à maintenir. Nécessite d'abord la migration `ALTER TABLE` pour les colonnes `settlement_method / installment_count / settled_at`.

**Recommandation auteur** : **Option ②**. Le prompt Sprint 0.c prévoit explicitement que le commit 3 peut être reporté (`"Commit 3 (trigger) peut être reporté à Sprint 0.d si design complexe"`).

---

## Ce qui est fait au 18/04 sur la branche `feat/charges-regul-sprint-0c-rescue`

- ✅ Commit 1 `7aac8ed` — fix RLS tenant contested (WITH CHECK status IN ('sent','contested'))
- ✅ Commit 2 `56ef301` — backfill PCG 614100 + 708000 (avec déviations labels/account_type documentées)
- ⏸️ Commit 3 — STOP : ce document, en attente de décision Thomas
- ⏸️ Commit 4 — skill update : dépend du choix sur commit 3

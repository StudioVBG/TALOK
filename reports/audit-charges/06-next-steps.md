# PASS 6 — Recommandation

---

## Verdict

**Option A — Sprint 0 COMPLET + Sprint 1 COMPLET. Passer au Sprint 2.**

---

## Justification factuelle

### Preuves DB (inférées depuis migrations mergées sur `main`)

| Gap | Migration dans le repo | Verrouillé par tests d'idempotence |
|---|---|---|
| P0 #1 `regularization_invoice_id` | `20260417090000_charges_reg_invoice_link.sql` | `ADD COLUMN IF NOT EXISTS` |
| P0 #3 backfill 419100 + 654000 | `20260417090400_charges_pcg_accounts_backfill.sql` | `ON CONFLICT (entity_id, account_number) DO NOTHING` |
| P0 #4 RLS tenant contest | `20260417090300_fix_tenant_contest_rls.sql` | `DROP POLICY IF EXISTS` + `CREATE POLICY` |
| P1 #5 `tax_notices` | `20260417090100_tax_notices_table.sql` | `CREATE TABLE IF NOT EXISTS` |
| P1 #6 `epci_reference` + seed 23 | `20260417090200` + `20260417090500` | `CREATE TABLE IF NOT EXISTS` + `ON CONFLICT DO NOTHING` |

**Seul gap P0 #2 reste ouvert** (génération écriture comptable auto au settle) — le skill le mentionne explicitement comme "⏳ À TRAITER Sprint 2" (ligne 519).

### Preuves code

- `lib/accounting/chart-amort-ocr.ts` contient `419100` (l.28) et `654000` (l.53) dans `PCG_OWNER_ACCOUNTS` — accompagnés de `614100` (l.43) et `708000` (l.60) déjà présents. Les 4 comptes du mapping PCG Talok sont donc bien seedés pour toute nouvelle entity.
- `lib/charges/engine.ts` expose `computeRegularization` (Sprint 1) + helpers (`diffDays`, `prorataCentimes`, `computeTeomNet`).
- `lib/charges/types.ts` expose `RegularizationInput/Result`, `SettlementMethod`, `TaxNoticeExtraction`.
- `lib/charges/constants.ts` expose `PCG_ACCOUNTS` + seuils légaux (`PRESCRIPTION_YEARS=3`, `ECHELEMENT_MONTHS=12`, `FRAIS_GESTION_TEOM_PCT_DEFAULT=8`).
- `tests/unit/charges/engine.test.ts` fait 352 lignes (tests Sprint 1).

### Preuves skill

- Lignes 355-377 — section "Mapping PCG Talok" documente les 4 substitutions `4191→419100`, `614→614100`, `654→654000`, `708300→708000`.
- Lignes 518-530 — gaps P0 marqués ✅ pour #1, #3, #4 ; ⏳ pour #2. Gaps P1 #5, #6 ✅.

**Aucun écart entre ce qui est documenté ✅ et la réalité du repo.** Le skill reflète fidèlement l'état du code mergé.

---

## À réserver avant de lancer le prompt Sprint 2

### Décisions légères (coût ~0, à acter en entête de prompt)

1. **RF-9** — Prévoir dans la migration Sprint 2 l'ajout des colonnes :
   ```sql
   ALTER TABLE lease_charge_regularizations
     ADD COLUMN IF NOT EXISTS settlement_method TEXT CHECK (settlement_method IN
       ('stripe','next_rent','installments_12','deduction','waived')),
     ADD COLUMN IF NOT EXISTS installment_count INTEGER DEFAULT 1,
     ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ;
   ```
   Le type TS `SettlementMethod` est déjà aligné sur ces 5 valeurs.

2. **RF-8** — Choisir entre deux stratégies pour `/apply` :
   - **(a)** Consommer `calculateRegularization` (shape DB directe) — plus simple, réutilise le fiscal_year et `detail_per_category`.
   - **(b)** Consommer `computeRegularization` (pur camelCase) — nécessite mapping fiscal_year → periodStart/periodEnd.
   Recommandation : **(a)** pour Sprint 2, garder `computeRegularization` pour le Sprint 3 (UI calcul avancé avec prorata personnalisé).

3. **RF-1** — Au passage, décider du sort du booléen `contested` (doublon de `status='contested'`) : probablement le retirer en Sprint 2 via migration `DROP COLUMN` — mais uniquement si la feature gating n'en dépend pas (à vérifier).

### Décisions DB (recommandé avant Sprint 2)

**Option conseillée** : exécuter `scripts/audit-charges/queries.sql` en prod pour valider que l'état réel DB match l'inférence des migrations. Si tout match (ce qui est attendu car PR #432 a été mergée), les rapports 01/02/03 deviennent "verrouillés" et on démarre Sprint 2 en confiance.

---

## Action immédiate recommandée

1. **Thomas lance `scripts/audit-charges/queries.sql`** dans Supabase SQL Editor prod
2. **Colle les outputs dans `reports/audit-charges/02-db-state.md`** (sous chaque bloc `(à coller)`)
3. Si tout ✅ (attendu) → **prompt Sprint 2 tel que planifié dans le skill talok-charges-regularization**
4. Si ❌ quelque part → ouvrir `05-red-flags.md`, décider

---

## Prompt Sprint 2 (squelette, à garder pour plus tard)

> Objectif Sprint 2 : livrer la route `POST /api/charges/regularization/[id]/apply` qui :
> 1. Ajoute les colonnes `settlement_method`, `installment_count`, `settled_at` (migration idempotente).
> 2. Valide que la régul est en status `sent` ou `acknowledged` (transition vers `settled` autorisée).
> 3. Selon `settlement_method` :
>    - `stripe` → crée `invoices` + PaymentIntent metadata `type: 'charge_regularization'` + écriture scénario B
>    - `next_rent` → ajoute ligne à la prochaine quittance + écriture scénario B
>    - `installments_12` → crée 12 lignes échelonnées + écriture scénario E
>    - `deduction` → écriture scénario C (trop-perçu)
>    - `waived` → écriture scénario D (renonciation → 654000)
> 4. Renseigne `regularization_invoice_id` (si invoice créée) + `settled_at = now()`.
> 5. Utilise le moteur Sprint 1 (`calculateRegularization` ou `computeRegularization`) pour recalculer le balance juste avant écriture.
> 6. Tests : 1 test e2e par settlement_method (5 tests) + vérification écritures équilibrées (`SUM(debit) = SUM(credit)`).
>
> Contrainte : ne pas étendre `/api/accounting/charges/regularisation/*` (legacy).

---

## TL;DR

> **Sprint 0 (0.a + 0.b) : DONE.** Sprint 1 : DONE. Seul P0 #2 (écriture comptable auto au settle) reste, et c'est exactement le périmètre du Sprint 2 prévu. Pas de corruption, pas de régression, skill à jour. Feu vert pour prompter le Sprint 2 après validation DB en prod.

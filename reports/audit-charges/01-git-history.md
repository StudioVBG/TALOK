# PASS 1 — Inventaire git

Date audit : 2026-04-18
Branche audit : `claude/audit-charges-regularization-dHAdt` (branche système imposée ; l'énoncé demandait `audit/charges-regularization-state`, substituée par la branche officielle de la session).

---

## Branches distantes liées

| Branche | Statut |
|---|---|
| `origin/claude/audit-charges-regularization-dHAdt` | branche courante (audit read-only, ce rapport) |

Aucune autre branche ouverte liée à `charge*` ou `regulariz*`. La branche de développement `claude/charges-regularization-module-nxYoL` qui portait les Sprints 0.a, 0.b et 1 a été mergée dans `main` via PR #432 le 17/04/2026 puis supprimée.

---

## Commits sur `main` liés au module (ordre anti-chronologique)

| SHA | Date | Auteur | Message |
|---|---|---|---|
| `a6c9b96` | 2026-04-18 | Claude | fix(sprint-b2): inject epci_reference_table dep into batch 9 |
| `66d5a71` | 2026-04-18 | Claude | fix(sprint-b2): batch 44 — wrap legacy charge_regularisations migration |
| `efd8252` | 2026-04-17 | StudioVBG | Merge pull request #432 from StudioVBG/claude/charges-regularization-module-nxYoL |
| `2811e81` | 2026-04-17 | Claude | feat(charges): sprint 1 — calculation engine, types, constants |
| `89b4bb3` | 2026-04-17 | Claude | feat(charges): sprint 0.b — seeds PCG + EPCI + skill sync (P0 gap #3) |
| `761bc71` | 2026-04-17 | Claude | feat(charges): sprint 0.a — db structure for charges regularization |
| `4a87f91` | antérieur | Claude | docs(skills): ajouter skill talok-charges-regularization |

---

## Fichiers modifiés par commit

### `761bc71` — Sprint 0.a (DB structure)
- `supabase/migrations/20260417090000_charges_reg_invoice_link.sql` (22 lignes) — P0 #1
- `supabase/migrations/20260417090100_tax_notices_table.sql` (71 lignes)
- `supabase/migrations/20260417090200_epci_reference_table.sql` (50 lignes)
- `supabase/migrations/20260417090300_fix_tenant_contest_rls.sql` (48 lignes) — P0 #4

### `89b4bb3` — Sprint 0.b (seeds + skill sync)
- `.claude/skills/talok-charges-regularization/SKILL.md` (+56/-38) — P0 #3 notes
- `lib/accounting/chart-amort-ocr.ts` (+2) — ajout 419100 + 654000 à `PCG_OWNER_ACCOUNTS`
- `supabase/migrations/20260417090400_charges_pcg_accounts_backfill.sql` (31 lignes)
- `supabase/migrations/20260417090500_epci_reference_seed_drom.sql` (92 lignes, 23 EPCI)

### `2811e81` — Sprint 1 (moteur de calcul)
- `lib/charges/constants.ts` (+64) — PCG_ACCOUNTS, seuils (prescription, échelonnement, frais TEOM)
- `lib/charges/engine.ts` (+220) — `diffDays`, `prorataCentimes`, `computeTeomNet`, `computeProvisionsVersees`, `computeRegularization`
- `lib/charges/types.ts` (+111) — `RegularizationInput/Result`, `RegularizationStatus`, `SettlementMethod`, `TaxNoticeExtraction`
- `lib/charges/index.ts` (+22) — barrel export
- `tests/unit/charges/engine.test.ts` (+352) — tests unitaires moteur

### `efd8252` — Merge PR #432 vers main
Consolide les 3 commits ci-dessus en un seul merge.

### `66d5a71`, `a6c9b96` — Fix-ups Sprint B2 (lendemain, 18/04)
- `reports/batches/phase4-critique-batch-08.sql` (recâble la migration legacy `charge_regularisations` dans le wrapper Sprint B2)
- `reports/batches/phase1-safe-batch-09.sql` (+48) — injecte la dépendance `epci_reference_table` dans un batch
- **Aucune modification de schéma supplémentaire** — ce sont des ajustements d'ordonnancement de batch pour l'application de prod via le pipeline Sprint B2.

---

## Conclusion PASS 1

Les 3 commits Sprint 0.a + 0.b + 1 sont mergés dans `main` via PR #432. Les 2 fix-ups du 18/04 sont des ajustements de wrapper Sprint B2 et n'ajoutent ni ne retirent de schéma. **Rien n'a été perdu ou rebasé agressivement** — l'historique est propre.

# Sprint 0.c — Apply en prod

**Branche** : `feat/charges-regul-sprint-0c-rescue`
**Date exécution** : 2026-04-18
**Statut** : ✅ **APPLIQUÉ EN PROD** (PASS 1 + PASS 2 DB-validés)

---

## Verdict final

> ✅ **"Sprint 0.c appliqué avec succès en prod. P0 #3 et P0 #4 fermés. Prêt pour Sprint 0.d."**

### Conditions validées

| Gap | Migration | Preuve |
|---|---|---|
| P0 #4 RLS tenant contest | `20260418150000_fix_charges_contested_rls` | Policy `lease_charge_reg_tenant_contest` a désormais USING `status='sent' AND tenant` + WITH CHECK `status IN ('sent','contested') AND tenant` (cf `04-after-rls.md`) |
| P0 #3 PCG 614100 + 708000 | `20260418150100_charges_pcg_accounts_backfill_p2` | 4 comptes × 3 entities = 12 rows, aucun doublon, `708000` en `account_type='income'` conforme CHECK (cf `05-after-backfill.md`) |
| Enregistrement Supabase | les 2 | `schema_migrations` passe de 393 → 395 rows, les 2 versions présentes (cf `06-after-global.md` §3.1) |

---

## Journal d'exécution

| Étape | Date | Résultat |
|---|---|---|
| PASS 0 snapshots avant | 2026-04-18 | ✅ Bug P0 #4 confirmé, 614100/708000 absents, schema_migrations à 393 |
| PASS 1 migration RLS | 2026-04-18 | ✅ DROP + CREATE + COMMENT sans erreur, policy conforme |
| PASS 2 migration backfill | 2026-04-18 | ✅ INSERT 0 3 × 2, 12 rows totales, 0 doublons |
| PASS 3 delta + schema_migrations | 2026-04-18 | ✅ +6 rows PCG, +2 schema_migrations |
| PASS 3.2 smoke test UI/Sentry | — | ⏳ asynchrone, non bloquant |

---

## Contenu du dossier

| Fichier | État |
|---|---|
| `01-migration-rls.sql` | dump commit `7aac8ed` — appliqué ✅ |
| `02-migration-backfill.sql` | dump commit `56ef301` — appliqué ✅ |
| `03-before.md` | snapshots AVANT, outputs prod collés ✅ |
| `04-after-rls.md` | validation PASS 1 ✅ |
| `05-after-backfill.md` | validation PASS 2 ✅ |
| `06-after-global.md` | delta + smoke test (asynchrone) ✅/⏳ |
| `rollback.sql` | dormant — non exécuté, à archiver ✅ |
| `README.md` | ce fichier ✅ |

---

## Smoke test applicatif — asynchrone

Les PASS 1 et PASS 2 étant purement DB et validés par re-queries côté information_schema / pg_policies / chart_of_accounts, le verdict ✅ est scellé côté base. Le smoke test UI (`/owner/properties/[id]/charges/regularization`, plan comptable, Sentry 30min) reste à faire par Thomas en asynchrone.

Si le smoke test révèle un problème côté applicatif, il sera traité séparément sans toucher aux migrations déjà en place.

---

## Prochaines étapes

1. **Asynchrone** — Thomas exécute le smoke test de `06-after-global.md §3.2` et met à jour les 3 "À compléter" si besoin.
2. **Sprint 0.d** — peut démarrer : prompt en attente d'envoi (migration colonnes `settlement_method` + `installment_count` + `settled_at` + route API `POST /api/charges/regularization/[id]/apply`). Design acté dans `reports/audit-charges/07-settle-trigger-design.md`.
3. **Skill update** — commit 4 du Sprint 0.c initial reste à faire : mettre à jour `.claude/skills/talok-charges-regularization/SKILL.md` pour marquer P0 #3 et P0 #4 ✅ en prod (à faire dans le prompt Sprint 0.d ou en commit isolé).

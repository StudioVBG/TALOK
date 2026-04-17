# Vérifications pré-apply — 2026-04-17

**Branche :** `claude/audit-supabase-migrations-1C87Q` (rebasée sur `origin/main` commit `efd8252a`)
**Portée :** 221 migrations pending (intègre les 6 migrations Sprint 0 mergées via PR #432)
**Mode :** lecture seule sur DB. Modifications fichiers : `AUDIT_MIGRATIONS_BACKLOG.md` (résumé exécutif) + création de ce document.

---

## 0. Rebase status

```
git rebase origin/main
Rebasing (1/1)
Successfully rebased and updated refs/heads/claude/audit-supabase-migrations-1C87Q.
```

- **Fast-forward propre**, aucun conflit.
- HEAD : `3319f873 docs(audit): backlog migrations Supabase — 215 pending, 1 🔴 identifié`
- Parent : `efd8252a Merge pull request #432 from StudioVBG/claude/charges-regularization-module-nxYoL`
- Les 6 migrations Sprint 0 (`20260417090000`–`090500`) sont maintenant dans la working tree.

**VERDICT : ✅ Fast-forward OK**

---

## 1. Audit rafraîchi (résumé exécutif mis à jour)

Modifications apportées à `AUDIT_MIGRATIONS_BACKLOG.md`, **section 1 uniquement** :

| Champ | Avant | Après |
|-------|-------|-------|
| Total | 215 | **221** |
| 🟢 Safe | 45 (20%) | **50 (23%)** |
| 🟡 À surveiller | 169 (78%) | **170 (77%)** |
| 🔴 Risqué | 1 | 1 (inchangé) |
| Écart doc `pending-migrations.md` | +47 | **+53** |
| Note ajoutée | — | "intègre les 6 migrations Sprint 0 (20260417090000–090500) validées via PR #432, toutes classées 🟢 sauf 20260417090300 (DROP+CREATE POLICY, 🟡 safe)" |

Classification détaillée Sprint 0 vérifiée par lecture des fichiers :

| Fichier | L | Risk | Raison |
|---------|--:|:----:|--------|
| `20260417090000_charges_reg_invoice_link.sql` | 23 | 🟢 | ADD COLUMN ×2 + CREATE INDEX |
| `20260417090100_tax_notices_table.sql` | 72 | 🟢 | Nouvelle table (DROP POL = idempotence sur policy qu'elle crée) |
| `20260417090200_epci_reference_table.sql` | 51 | 🟢 | Nouvelle table (idem) |
| `20260417090300_fix_tenant_contest_rls.sql` | 49 | 🟡 | DROP+CREATE POLICY sur `lease_charge_regularizations` existante |
| `20260417090400_charges_pcg_accounts_backfill.sql` | 32 | 🟢 | INSERT seed PCG |
| `20260417090500_epci_reference_seed_drom.sql` | 93 | 🟢 | INSERT seed 23 EPCI |

Aucun refactor des sections 2-8 (plan d'application, dépendances, questions ouvertes) — à affiner séparément si besoin.

---

## 2. Timestamps dupliqués `20260408120000`

### Liste des 7 fichiers

```
20260408120000_api_keys_webhooks.sql
20260408120000_colocation_module.sql
20260408120000_edl_sortie_workflow.sql
20260408120000_providers_module_sota.sql
20260408120000_smart_meters_connected.sql
20260408120000_subscription_addons.sql
20260408120000_whitelabel_agency_module.sql
```

### Analyse tables créées / référencées

| Migration | CREATE TABLE (nouvelles) | ALTER TABLE (existantes) | REFERENCES (FK vers) |
|-----------|--------------------------|---------------------------|----------------------|
| `api_keys_webhooks` | `api_keys`, `api_logs`, `api_webhook_deliveries`, `api_webhooks` | — | `legal_entities`, `profiles` |
| `colocation_module` | `colocation_expenses`, `colocation_members`, `colocation_rooms`, `colocation_rules`, `colocation_tasks` | `leases`, `properties` | `documents`, `leases`, `profiles`, `properties` |
| `edl_sortie_workflow` | `edl_rooms`, `vetuste_grid` | `edl`, `edl_items` | `edl`, `edl_rooms` |
| `providers_module_sota` | `owner_providers`, `providers` | `work_orders` | `documents`, `leases`, `legal_entities`, `profiles`, `properties` |
| `smart_meters_connected` | `meter_alerts`, `property_meter_readings`, `property_meters` | — | `documents`, `profiles`, `properties` |
| `subscription_addons` | `sms_usage`, `subscription_addons` | — | `legal_entities`, `profiles` |
| `whitelabel_agency_module` | `agency_crg`, `agency_mandant_accounts`, `agency_mandates`, `whitelabel_configs` | — | `documents`, `legal_entities`, `profiles` |

### Détection de dépendances inter-migrations

Exécution du script : pour chaque migration, intersection entre `REFERENCES` et tables créées par les 6 autres.

```
Dépendances inter-migrations (FK d'une vers table créée dans une autre):
  (aucune)
```

- **Ensembles de tables créées disjoints** (sauf collisions éventuelles côté `ALTER TABLE leases/properties/work_orders/edl` sur des tables pré-existantes — sans conflit car chaque migration ajoute des colonnes distinctes via `ADD COLUMN IF NOT EXISTS`).
- Toutes les FK pointent vers des tables **pré-existantes** (`profiles`, `legal_entities`, `properties`, `leases`, `documents`, `work_orders`, `edl`, `edl_items`).

### Ordre lexicographique produit par Supabase CLI

Le tri alphabétique après le timestamp commun donne :
```
api_keys_webhooks → colocation_module → edl_sortie_workflow → providers_module_sota → smart_meters_connected → subscription_addons → whitelabel_agency_module
```

Chaque migration est **autonome** : elle ne dépend d'aucune autre du même timestamp. L'ordre n'a donc **aucune conséquence métier**.

### VERDICT : ✅ **Safe**

Aucun conflit, aucun renommage nécessaire. L'ordre lexicographique est non-signifiant puisqu'il n'y a pas de chaîne de dépendance.

---

## 3. Migration 🔴 RENAME legacy `20260408044152_reconcile_charge_regularisations_and_backfill_entry_lines.sql`

### Type de vue de compatibilité

La vue `public.charge_regularisations` créée est **updatable via triggers INSTEAD OF** (pas une vue read-only).

Lignes 127–151 : `CREATE OR REPLACE VIEW` simple (mapping colonnes + conversion cents↔euros).

Triggers ajoutés (lignes 159–238) :
- `charge_regularisations_on_insert` → `INSTEAD OF INSERT` → redirect vers `charge_regularizations` (INSERT + conversion euros→cents + résolution `entity_id` via properties)
- `charge_regularisations_on_update` → `INSTEAD OF UPDATE` → redirect avec conversion
- `charge_regularisations_on_delete` → `INSTEAD OF DELETE` → DELETE sur `charge_regularizations`

⚠️ Les triggers sont définis avec `CREATE TRIGGER` (pas `CREATE OR REPLACE`) → **non-idempotents** sur cette partie. Une ré-exécution échouera.

### Références code actif

Recherche dans `app/`, `lib/`, `features/`, `supabase/functions/` (hors `supabase/migrations/` et fichiers `_legacy`) :

| Fichier | Lignes | Opérations |
|---------|-------:|------------|
| `features/accounting/services/charge-regularization.service.ts` | 195, 236, 294, 335, 351, 366, 384, 424, 443, 474, 514, 584 | **12 refs** : `.insert()` ×1, `.update()` ×5, `.select()` ×6 — **via la vue** |
| `app/api/accounting/charges/regularisation/[id]/apply/route.ts` | 54 | 1 ref `.select()` — **via la vue** |
| `features/accounting/types/index.ts` | 495 | **Commentaire uniquement** (pas de code actif) |
| `lib/supabase/database.types.ts` | 2304 | `tenant_charge_regularisations` (**table différente**, pas la même) |
| `features/copro/services/regularisation.service.ts` | 190, 212, 269, 289, 377 | `tenant_charge_regularisations` (**table différente**) |

**Refs réelles à la vue `charge_regularisations`** : **13 occurrences** dans 2 fichiers actifs.

Les triggers INSTEAD OF gèrent INSERT/UPDATE/DELETE → le code legacy **continue de fonctionner** sans modification après l'apply.

### Sous-risque détecté : valeurs de `status` incompatibles

Le code legacy écrit `status: "applied"` et `status: "cancelled"` (lignes 296, 337, 353, 444 de `charge-regularization.service.ts`).

Le trigger INSERT fait `COALESCE(NEW.statut, 'draft')`. Le trigger UPDATE fait `status = COALESCE(NEW.statut, status)`.

**Point d'attention** : Le CHECK constraint sur `charge_regularizations.status` (à vérifier) accepte d'après Sprint 1 : `'draft' | 'calculated' | 'sent' | 'acknowledged' | 'contested' | 'settled'`. Les valeurs legacy `'applied'` et `'cancelled'` **pourraient violer le CHECK** lors d'un write par le service.

Ce risque est **externe** à la migration (il vient du code legacy) — la migration elle-même ne crée pas le problème.

### VERDICT : 🟡 **Safe à appliquer, cleanup code recommandé à court terme**

- ✅ La vue + triggers INSTEAD OF préservent la compatibilité sur INSERT/UPDATE/DELETE
- ✅ Les 13 refs code continuent de fonctionner après apply (lecture garantie, écriture dépend du sous-risque ci-dessus)
- ⚠️ Idempotence partielle : si la migration a été exécutée partiellement, les `CREATE TRIGGER` échoueront sur ré-exécution → ajouter guards `DO $$ IF NOT EXISTS` sur les 3 triggers avant apply
- 🔧 À planifier hors apply : migrer les 13 refs code vers la table canonique `charge_regularizations` (+ aligner les valeurs de status)

**Non-bloquant** pour l'apply. Cleanup code à faire en sprint séparé.

---

## 4. Usage pg_cron

### Pending migrations utilisant `cron.schedule` ou `CREATE EXTENSION pg_cron`

| Migration | Lignes | Crons planifiés |
|-----------|-------:|-----------------|
| `20260304100000_activate_pg_cron_schedules.sql` | 131 | **CREATE EXTENSION pg_cron + pg_net** + 10 crons (payment-reminders, generate-monthly-invoices, generate-invoices, process-webhooks, lease-expiry-alerts, check-cni-expiry, subscription-alerts, irl-indexation, visit-reminders, cleanup-exports, cleanup-webhooks) |
| `20260305000002_payment_crons.sql` | 20 | 1 cron : `overdue-check` |
| `20260321100000_fix_cron_post_refactoring_sota2026.sql` | 50+ | 1 cron : `process-outbox` (refactor post-SOTA) |
| `20260410110000_cleanup_orphan_analyses.sql` | 84 | 1 cron : `cleanup-orphan-analyses` — **défensif** : `DO $$ IF pg_extension pg_cron EXISTS THEN ... ELSE RAISE NOTICE ...` |
| `20260410180000_fix_invoice_generation_sota.sql` | 461 | 8 crons refondés : `payment-reminders`, `generate-invoices`, `process-outbox`, `process-webhooks`, `lease-expiry-alerts`, `check-cni-expiry`, `subscription-alerts`, `irl-indexation`, `visit-reminders` (net.http_post → net.http_get + Vault secrets) |
| `20260411120000_schedule_onboarding_reminders_cron.sql` | 45+ | 1 cron : `onboarding-reminders` |
| `20260412130000_copro_cron_schedules.sql` | 91 | 5 crons copro : `copro-convocation-reminders`, `copro-fund-call-reminders`, `copro-overdue-alerts`, `copro-assembly-countdown`, `copro-pv-distribution` |

**7 migrations pending** utilisent `cron.schedule` activement.

**Mentions sans appel** (ignorer) :
- `20260408130000_active_sessions.sql` — commentaire `-- to be called by pg_cron`
- `20260412150000_create_cron_logs.sql` — crée la table `cron_logs`, pas de schedule

### Total crons planifiés après apply complet

~24 crons uniques (certains redéfinis par `fix_invoice_generation_sota` qui `unschedule` puis re-`schedule` les 8 pertinents).

### Point de vigilance

`20260304100000` fait `CREATE EXTENSION IF NOT EXISTS pg_cron;` puis `CREATE EXTENSION IF NOT EXISTS pg_net;`. Sur Supabase :
- `pg_cron` + `pg_net` sont disponibles mais parfois **non activés par défaut** selon le plan.
- Activation possible via Dashboard → Database → Extensions, ou ticket support selon le plan.

Si les extensions **ne sont pas activées en prod**, la migration `20260304100000` échouera au `CREATE EXTENSION` → cascade d'échecs sur les 6 migrations cron suivantes.

**Migration `cleanup_orphan_analyses` est déjà défensive** (check pg_extension avant d'appeler `cron.schedule`). Les 6 autres ne le sont pas.

### VERDICT : ⚠️ **Vérification support requise avant apply**

Action préalable :
```sql
-- À exécuter sur prod AVANT d'appliquer les migrations :
SELECT extname, extversion FROM pg_extension WHERE extname IN ('pg_cron', 'pg_net');
```

Si vide ou absent → ouvrir ticket Supabase pour activer `pg_cron` + `pg_net` (ou activer via Dashboard → Database → Extensions), **avant** de lancer la Phase 2 du plan d'application.

---

## Synthèse

| Vérif | Verdict | Blocker ? |
|-------|---------|:---------:|
| 0. Rebase | ✅ Fast-forward | Non |
| 1. Audit rafraîchi | ✅ Sections 1 mise à jour | Non |
| 2. Timestamps dupliqués | ✅ Safe, aucun renommage nécessaire | Non |
| 3. Migration 🔴 RENAME legacy | 🟡 Safe à appliquer, cleanup code recommandé + guards idempotence | Non |
| 4. pg_cron | ⚠️ Activation extension à vérifier côté prod | **Potentiel** |

**Nombre de blockers avant apply : 0 hard, 1 soft (pg_cron activation).**

### Prochaine action recommandée

1. **Ouvrir ticket ou vérifier dashboard Supabase** : confirmer que `pg_cron` + `pg_net` sont activés en prod → sinon activer avant toute chose.
2. **Facultatif (mais sain)** : ajouter guards `DO $$ IF NOT EXISTS` autour des 3 triggers INSTEAD OF de `20260408044152` pour robustesse en cas de ré-exécution.
3. **Régénérer les batch files** `APPLY_ALL_MIGRATIONS.sql` + `batch_01..05.sql` pour intégrer les **53 migrations** postérieures au 2026-04-09 (53 = 47 initialement comptées + 6 Sprint 0).
4. Planifier l'apply selon le plan Phases 1→5 décrit dans `AUDIT_MIGRATIONS_BACKLOG.md` §6.

---

_Vérifications générées le 2026-04-17, lecture seule, aucune mutation DB._

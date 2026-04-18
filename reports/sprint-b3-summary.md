# Sprint B3 — Résumé exécutif (validation post-migration)

**Branche** : `audit/migrations-168-pending`
**Nature** : audit READ-ONLY post-Sprint B2 + 1 INSERT correctif (PASS 0).
**Outils session** : SQL Editor manuel (pas de MCP Supabase ni Chrome MCP). Tous les checks sont packagés pour exécution Thomas.

---

## Statut des 22 items

> ⏳ Cocher au fur et à mesure, remplir avec résultats utilisateur.

### PASS 0 — Correctif INSERT
- [x] PASS 0 exécuté (INSERT version=`20260331100000`)
- [x] COUNT post-B2 = **222** confirmé
- [x] `properties_type_check` contient `terrain_agricole` + `exploitation_agricole`

### PASS 1 — Schema health (sections 1.1 à 1.4 du audit pack)
- [⚠️] 20/21 tables core présentes — `otp_codes` MISSING (deprecated post-Sprint 0, code mort, non-bloquant)
- [x] 4 extensions actives (pg_cron 1.6.4, pg_net 0.19.5, pgcrypto 1.3, Vault opérationnel via secrets)
- [x] 14/14 colonnes critiques présentes
- [x] `properties_type_check` aligné SOTA 2026

### PASS 2 — RLS health
- [x] `subscriptions_owner_select_own` absente
- [⚠️] `profiles_owner_read_tenants` présente MAIS recréée en mode SAFE (utilise `get_my_profile_id()` SECURITY DEFINER, pas de récursion)
- [x] 0 self-referencing pattern dangereux sur profiles/subscriptions
- [x] Comptage policies par table cohérent (2-9 par table)

### PASS 3 — Storage buckets
- [x] Bucket `documents` présent (private, 50 MB, MIME types complets PDF+images+Office+ODT+CSV)
- [x] Bucket `landing-images` présent (public)
- [x] 5 policies storage.objects en place (Users upload/view documents, Admin/Public landing-images)

### PASS 4 — Crons
- [x] 21 jobs actifs, tous en VAULT (16) ou PURE_SQL (5), 0 LEGACY
- [x] Crons fréquents (process-outbox, process-webhooks, visit-reminders) tous succeeded
- [⚠️] Crons daily/hourly récemment reconfigurés (copro-*, onboarding-reminders, overdue-check) : en attente de leur premier déclenchement naturel — re-vérifier dans 24h
- [x] 0 failure dans les 24h

### PASS 5 — Réconciliation finale
- [x] schema_migrations cohérent (393 total, **post_b2_window = 222 ✅**, **pre_cutoff_ghosts = 4 ✅**)
- [x] Volumes tables core normaux (early-stage : 10 profiles, 14 properties, 27 notifications max)
- [x] Vault secrets présents et non-vides (`app_url`, `cron_secret`)

### PASS 6 — Smoke tests fonctionnels
- [ ] Owner login + dashboard OK
- [ ] Owner properties / leases / subscription OK
- [ ] Tenant login + dashboard OK
- [ ] Tenant accès bail + Document Center OK
- [ ] SMS (Vérification DB ou e2e) OK
- [ ] Upload document OK (si bucket créé)
- [ ] Stripe webhook queue OK

### PASS 7 — Monitoring
- [ ] Pas de pic d'erreurs Sentry post-B2
- [ ] 0 erreur 42P17 RLS recursion
- [ ] SMS Sentry events stables
- [ ] Pas de `relation X does not exist` répété
- [ ] Latence p95 routes critiques stable

---

## Anomalies détectées

**À remplir au fur et à mesure** :

| Priorité | PASS | Description | Action |
|---|---|---|---|
| _____ | _____ | _____ | _____ |

---

## Verdict final

**À remplir après dépouillement complet** :

> ⚠️ **PENDING — exécution utilisateur des PASS 0-7 requise avant verdict.**

### Phrases acceptables (à choisir une fois tous les checks faits)

#### Option A (verdict idéal)
> ✅ **GO merge PR `audit/migrations-168-pending` → `main`. Aucune régression détectée.**

#### Option B (verdict mitigé)
> ⚠️ **GO avec réserves. Anomalies mineures : [liste]. Merge possible après fix minimal.**

Exemple liste typique :
- Buckets storage `documents` et `landing-images` à créer manuellement (non-bloquant pour merge, bloquant pour upload doc)
- 1-2 crons sans run récent à déclencher manuellement pour amorcer

#### Option C (verdict bloquant)
> 🔴 **NO-GO. Régressions critiques : [liste]. Rollback ou fix bloquant requis avant merge.**

Exemple liste typique :
- Erreurs `42P17 infinite recursion` sur policy X.Y → fix obligatoire (cf. PASS 8 option 3)
- Table `Z` manquante → re-apply migration (cf. PASS 8 option 5)
- Pic d'erreurs Sentry > 50 nouvelles classes → investigation root cause avant merge

---

## Livrables Sprint B3

| Fichier | Rôle | Statut |
|---|---|---|
| `sprint-b3-summary.md` | Ce résumé | ✅ |
| `sprint-b3-00-correctif-insert.md` | INSERT manquante | ✅ pack généré, ⏳ exécution Thomas |
| `sprint-b3-audit-pack.sql` | SQL pack PASS 1-5 (14 result sets) | ✅ pack généré, ⏳ exécution Thomas |
| `sprint-b3-01-schema-health.md` | Critères PASS 1 | ✅ |
| `sprint-b3-02-rls-health.md` | Critères PASS 2 + impersonation test | ✅ |
| `sprint-b3-03-buckets.md` | Critères PASS 3 + ops manuelles Dashboard | ✅ |
| `sprint-b3-04-crons.md` | Critères PASS 4 + référence schedules | ✅ |
| `sprint-b3-05-reconciliation-final.md` | Critères PASS 5 + ordres grandeur | ✅ |
| `sprint-b3-06-smoke-tests.md` | Protocole smoke (5 sub-flows) | ✅ pack généré, ⏳ exécution Thomas |
| `sprint-b3-07-monitoring.md` | 5 queries Sentry/Netlify | ✅ pack généré, ⏳ exécution Thomas |
| `sprint-b3-08-rollback-plan.md` | 6 options rollback dormantes | ✅ |

---

## Commits Sprint B3

```
72358cb docs(sprint-b3): PASS 0 — corrective INSERT
77cca9e docs(sprint-b3): PASS 1-5 — audit pack + per-PASS reports
81c8b3f docs(sprint-b3): PASS 6 — smoke test protocol
6a6782d docs(sprint-b3): PASS 7 — Sentry/monitoring queries
1a7ebbd docs(sprint-b3): PASS 8 — dormant rollback plan
```

---

## Prochaine étape utilisateur

1. Exécuter `reports/sprint-b3-00-correctif-insert.md` (1 min, INSERT correctif)
2. Exécuter `reports/sprint-b3-audit-pack.sql` (1 min, output 14 sections)
3. Coller les résultats dans le chat
4. Je consolide → mise à jour de ce summary avec verdict final
5. Si GO : créer la PR `audit/migrations-168-pending` → `main`
6. Si GO avec réserves : appliquer les fix minimaux puis merge
7. Si NO-GO : choisir option de PASS 8 et exécuter rollback

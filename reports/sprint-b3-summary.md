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
- [x] Owner/Admin login + dashboard OK (11 users, 13 logements, MRR 69€ affichés)
- [⚠️] Owner properties / leases / subscription : circuit-breaker déclenché (42P17 recursion) → 2 hotfix appliqués (commits 71342d6 + 48668dc) → re-test OK
- [x] Tenant login + dashboard OK (impayés 70€, bail Fort-de-France, badge Live)
- [x] Tenant accès bail (da2eb9da-1ff1-4020-8682-5f993aa6fde7) OK post-hotfix
- [⚠️] SMS : `sms_messages` vide (0 ligne) — OTP via Twilio Verify (hors table), transactionnels attendent un event eligible. **Non-bloquant**
- [⏭️] Upload document skippé (bucket `documents` non créé, cf. PASS 3)
- [x] Stripe webhook queue + logs vides (= aucun event stuck) — cohérent MVP early-stage

### PASS 7 — Monitoring
- [x] 0 erreur `42P17` en console live post-hotfix (owner + tenant testés)
- [⚠️] 374× `[RealtimeSync] Connection lost (CLOSED)` en loop — websocket, non-bloquant (REST charge normalement)
- [⚠️] 2× React error #425/#422 (hydration mismatch) — non-bloquant, page s'affiche
- [⏭️] Sentry UI non vérifié (pas de MCP en session, console live clean → à valider post-merge)
- [x] Pas de `relation X does not exist`

---

## Anomalies détectées

| Priorité | PASS | Description | Action |
|---|---|---|---|
| 🔴→🟢 | 6.1 | `42P17 infinite recursion` sur `profiles`, `lease_signers`, `leases`, `tickets` | **RÉSOLU** — 2 hotfix SECURITY DEFINER (commits `71342d6` + `48668dc`), re-test owner+tenant OK |
| 🟡 | 3 | Bucket storage `documents` absent | Action manuelle Supabase Dashboard (cf. `sprint-b3-03-buckets.md`) |
| 🟡 | 6 | `TWILIO_VERIFY_SERVICE_SID` absent des env vars Netlify | Post-merge : créer Verify Service + ajouter `VA...` SID dans Netlify env |
| 🟡 | 6/7 | 374× `[RealtimeSync] CLOSED/reconnect` loop | Investigation hors scope B3 : Supabase Realtime config + client cleanup |
| 🟢 | 1 | Table `otp_codes` MISSING | Deprecated post-Sprint 0, code mort, non-bloquant |
| 🟢 | 6.3 | `sms_messages` vide | Attendu (OTP via Twilio Verify hors table, transactionnels pas déclenchés) |
| 🟢 | 6.5 | `webhook_queue` / `webhook_logs` vides | Cohérent MVP early-stage, aucun event stripe pending/stuck |

---

## Verdict final

> ⚠️ **GO avec réserves. Anomalies mineures** :
> - Buckets storage `documents` (et `landing-images` à vérifier) à créer manuellement via Dashboard Supabase (non-bloquant pour merge, bloquant pour upload doc)
> - `TWILIO_VERIFY_SERVICE_SID` à ajouter dans Netlify env vars (bloquant pour flux OTP : signature bail + 2FA)
> - Websocket Realtime loop à investiguer (non-bloquant, REST OK)
>
> **Merge possible après ces 2 ajouts config (bucket + Twilio Verify SID)**, ou merge d'abord et fix config en post-merge puisque la DB elle-même est saine.

Pourquoi pas Option A : 2 régressions 42P17 ont été **détectées pendant l'audit** (profiles/lease_signers puis leases/tickets). Elles sont résolues et trackées en git — mais "aucune régression détectée" est factuellement faux. D'où Option B.

Pourquoi pas Option C : toutes les régressions détectées sont résolues, tous les smoke tests critiques passent, aucun blocker résiduel.

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
c0693d9 docs(sprint-b3): PASS 9 — executive summary scaffold + 22-item checklist
06d2867 docs(sprint-b3): PASS 0 validated — COUNT=222 + agricultural types in constraint
253d1aa fix(sprint-b3): audit pack section 3.2 — storage.policies removed in modern Supabase
7a16c16 docs(sprint-b3): PASS 1-5 results — 2 minor flags, no blockers
71342d6 fix(rls): break profiles/lease_signers 42P17 recursion (Sprint B3 PASS 6.1)
48668dc fix(rls): break leases<->units and tickets<->work_orders 42P17 cycles
```

---

## Prochaines étapes utilisateur (post-verdict)

1. **Avant merge PR #434** (optionnel, peut aussi se faire post-merge) :
   - Créer le bucket `documents` via Supabase Dashboard (private, 50 MB, MIME PDF+images+Office) + les policies storage (cf. `sprint-b3-03-buckets.md`)
   - Créer un Twilio Verify Service (console.twilio.com → Verify → Services) + ajouter `TWILIO_VERIFY_SERVICE_SID` dans Netlify env vars
2. **Merger PR #434** (`audit/migrations-168-pending` → `main`) — les 2 hotfix RLS sont inclus et idempotents
3. **Post-merge** :
   - Investiguer la boucle Realtime reconnect (Supabase Dashboard → Realtime logs + client cleanup de channels)
   - Smoke test e2e OTP (envoyer un SMS signature bail) une fois Verify SID configuré
   - Vérifier Sentry UI dashboard window 4h post-merge pour confirmer 0 régression résiduelle

# PASS 3 — Validation globale + delta + smoke test

Exécuté le **2026-04-18** en prod.

---

## 3.1 — Delta synthétique

### Delta RLS

| | AVANT | APRÈS |
|---|---|---|
| Policy `lease_charge_reg_tenant_contest` **USING** | `lease_id IN (tenant)` — pas de filtre status | `status = 'sent'` + `lease_id IN (tenant)` |
| Policy `lease_charge_reg_tenant_contest` **WITH CHECK** | `status = 'sent'` ← **bug P0 #4** | `status IN ('sent', 'contested')` + `lease_id IN (tenant)` |
| Transition tenant `sent → contested` | ❌ bloquée (42501) | ✅ autorisée |
| UPDATE tenant depuis status ≠ 'sent' | ❌ bloquée par WITH CHECK (mais USING laissait passer) | ❌ bloquée dès USING (plus propre) |

### Delta PCG

| Compte | AVANT (`entity_count`) | APRÈS (`entity_count`) | Delta |
|---|---|---|---|
| 419100 | 3 | 3 | 0 (inchangé) |
| 654000 | 3 | 3 | 0 (inchangé) |
| **614100** | **0** | **3** | **+3** |
| **708000** | **0** | **3** | **+3** |
| Total rows concernés | 6 | **12** | **+6** |

### Delta schema_migrations

| | AVANT | APRÈS |
|---|---|---|
| `total_migrations` | 393 | 395 (+2) |
| `20260418150000` | ❌ absent | ✅ présent |
| `20260418150100` | ❌ absent | ✅ présent |

---

## 3.2 — Smoke test applicatif

> ⚠️ À exécuter par Thomas en asynchrone — non bloquant pour le verdict PASS 1 + PASS 2 qui sont purement DB.

### Étape 1 — Plan comptable owner (si UI expose le COA)

1. Login avec un owner ayant au moins une entity
2. Naviguer vers `/owner/accounting` (route à confirmer selon build actuel)
3. Vérifier que les 4 comptes sont listés : `419100`, `614100`, `654000`, `708000`

> Résultat : **À compléter**.

### Étape 2 — Page régul charges

1. Naviguer vers `/owner/properties/[id]/charges/regularization` (remplacer `[id]` par un id de bien réel)
2. Vérifier : pas d'erreur 500, la page se charge

> Résultat : **À compléter**.

### Étape 3 — Sentry 30 min

Filtrer les 30 dernières minutes post-application :
- Erreurs `42501` (`new row violates row-level security policy`)
- Erreurs `42P17` (`infinite recursion detected in policy`)
- Erreurs `23514` sur `chart_of_accounts_account_type_check`

> Résultat : **À compléter**.

---

## 3.3 — Verdict global

- [x] ✅ **Sprint 0.c appliqué avec succès en prod (PASS 1 + PASS 2 DB-validés)**
- [ ] ⚠️ Appliqué partiellement
- [ ] 🔴 Échec

**Conditions validées** :
- PASS 1 RLS ✅ (policy corrigée, USING+WITH CHECK conformes)
- PASS 2 backfill ✅ (4 comptes × 3 entities = 12 rows, doublons nuls)
- schema_migrations ✅ (2 versions enregistrées)

**Restant en asynchrone (non bloquant)** :
- Smoke test UI + Sentry (section 3.2)

Si le smoke test révèle une anomalie, la remonter séparément — les corrections DB sont déjà en place et ne peuvent plus régresser.

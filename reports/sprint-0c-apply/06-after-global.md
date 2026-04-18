# PASS 3 — Validation globale + delta + smoke test

À remplir après PASS 1 et PASS 2 ✅.

---

## 3.1 — Delta synthétique

### Delta RLS

| | AVANT | APRÈS |
|---|---|---|
| Policy `lease_charge_reg_tenant_contest` USING | `status = 'sent'` + tenant | identique (inchangé) |
| Policy `lease_charge_reg_tenant_contest` WITH CHECK | *coller la valeur de 03-before.md Snapshot 1* | `status IN ('sent', 'contested')` + tenant |
| Effet | *si AVANT='sent' strict : bloquait toute transition → bug P0 #4 non fixé* / *si AVANT='contested' strict : fix appliqué mais bloquait patchs idempotents* | Transition sent→contested autorisée + idempotence sent→sent |

### Delta PCG

| Compte | AVANT (`entity_count`) | APRÈS (`entity_count`) |
|---|---|---|
| 419100 | *3 attendu si Sprint 0.b a tourné, sinon 0* | 3 (inchangé si déjà OK) |
| 654000 | *3 attendu si Sprint 0.b a tourné, sinon 0* | 3 (inchangé si déjà OK) |
| **614100** | *0 ou partiel* | **3** |
| **708000** | *0 ou partiel* | **3** |
| Total rows concernés | *à calculer* | **4 × 3 = 12 rows** |

### Delta schema_migrations

| | AVANT | APRÈS |
|---|---|---|
| `total_migrations` | *N* | N + 2 |
| `20260418150000` présent | ❌ | ✅ |
| `20260418150100` présent | ❌ | ✅ |

> Remplir en collant les valeurs réelles depuis `03-before.md` et en re-runnant les snapshots après PASS 2.

---

## 3.2 — Smoke test applicatif

### Étape 1 — Plan comptable owner (si UI expose le COA)

1. Login avec un owner ayant au moins une entity
2. Naviguer vers `/owner/accounting` ou `/owner/comptabilite` (route à confirmer selon build actuel)
3. Vérifier que les 4 comptes sont listés : `419100`, `614100`, `654000`, `708000`
4. Aucune erreur console / Sentry

> Résultat :
>
> ```
> (coller ou "UI non exposée — skip")
> ```

### Étape 2 — Page régul charges

1. Naviguer vers `/owner/properties/[id]/charges/regularization` (remplacer `[id]` par un id de bien réel)
2. Vérifier : pas d'erreur 500, la page se charge
3. Aucun warning RLS dans la console

> Résultat :
>
> ```
> (coller)
> ```

### Étape 3 — Sentry 30 min

Dans Sentry, filtrer les 30 dernières minutes post-application :
- Erreurs `42501` (`new row violates row-level security policy`) : doit rester à 0 ou au niveau pré-application
- Erreurs `42P17` (`infinite recursion detected in policy`) : doit rester à 0
- Erreurs `23514` (`check constraint violation`) sur `chart_of_accounts_account_type_check` : doit rester à 0

> Résultat (capture ou lien Sentry) :
>
> ```
> (coller)
> ```

---

## 3.3 — Verdict global

- [ ] ✅ PASS 1 OK + PASS 2 OK + smoke test clean → **Sprint 0.c appliqué avec succès en prod**
- [ ] ⚠️ PASS 1 OK + PASS 2 partiel (ex: compte déjà présent avec label différent sur 1 entity) → **Sprint 0.c appliqué partiellement**
- [ ] 🔴 Au moins 1 PASS échec + rollback exécuté → **Sprint 0.c échec**

### Détail si ⚠️ ou 🔴

> (décrire)

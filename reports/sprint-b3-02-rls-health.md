# Sprint B3 — PASS 2 : RLS policies non-récursives

## Statut

⏳ **En attente d'exécution utilisateur** — sections 2.1, 2.2, 2.3 du `sprint-b3-audit-pack.sql`.

## Critères de validation

### 2.1 — Policies historiquement récursives interdites

Doivent être **absentes** :
- `profiles.profiles_owner_read_tenants` (droppée avril 2026, mémoire projet)
- `subscriptions.subscriptions_owner_select_own` (droppée avril 2026)

Si l'output 2.1 retourne **0 ligne** → ✅ OK.
Si l'output retourne 1+ lignes avec `status = FLAG_FORBIDDEN_POLICY` → 🔴 régression.

### 2.2 — Self-referencing patterns

Aucune policy sur `profiles` ne doit faire `EXISTS (... FROM profiles ...)`.
Aucune policy sur `subscriptions` ne doit faire `EXISTS (... FROM subscriptions ...)`.

Toutes les lignes doivent avoir `status = OK`. Toute `FLAG_RECURSIVE_*` est bloquante.

### 2.3 — Comptage policies par table core

Référence approximative (post-Sprint B2) :

| Table | Nb policies attendu (approx) |
|---|---|
| profiles | 4-8 |
| subscriptions | 2-4 |
| leases | 4-6 |
| properties | 6-10 |
| documents | 4-6 |
| invoices | 3-6 |
| tenants | 1-3 |
| tickets | 6-10 |
| sms_messages | 2-3 |

Si une table a 0 policy → ⚠️ FLAG (RLS non protégée).
Si > 20 → ⚠️ FLAG (probable accumulation, à dédupliquer).

## Test impersonation runtime (optionnel mais recommandé)

```sql
-- Dans une nouvelle session SQL Editor :
SET LOCAL request.jwt.claim.sub = '<owner_user_id_test>';
SET LOCAL ROLE authenticated;

-- Tester la lecture
SELECT COUNT(*) FROM profiles;
SELECT COUNT(*) FROM subscriptions;
SELECT COUNT(*) FROM leases LIMIT 5;

-- Reset
RESET ROLE;
```

Aucune erreur `42P17 (infinite recursion)` ne doit apparaître.

Si erreur 42P17 → identifier la policy fautive via `pg_policies` puis appliquer fix `get_my_profile_id()` (SECURITY DEFINER) en remplacement du sous-SELECT direct.

## Output utilisateur attendu

3 résultats à coller (2.1, 2.2, 2.3) + verdict GO/NO-GO sur les recursions.

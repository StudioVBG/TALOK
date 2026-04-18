## Sprint B3 — PASS 8 : Incident report — 42P17 recursion profiles/lease_signers

**Date** : 2026-04-18
**Branche** : `audit/migrations-168-pending`
**PASS déclencheur** : 6.1 (login owner)
**Option rollback activée** : **Option 3 — Fix RLS recursion ciblé**
**Verdict Sprint B3 initial** : 🔴 NO-GO (avant fix) → 🟢 à confirmer post-fix

---

## Symptôme

Login owner sur `https://talok.fr/owner` provoque :

```
GET /rest/v1/profiles?select=*&user_id=eq.<uuid> 500
[AuthService] Erreur récupération profil: {
  code: '42P17',
  message: 'infinite recursion detected in policy for relation "profiles"'
}

GET /rest/v1/lease_signers?select=lease_id&profile_id=eq.<uuid> 500
[useTenantRealtime] fetchLeaseIds error:
  infinite recursion detected in policy for relation "lease_signers"
```

Cascade : Realtime disconnect + dashboard owner inaccessible.

---

## Root cause — chaîne de recursion à deux sauts

1. App query `SELECT FROM profiles WHERE user_id = X`
2. Postgres évalue (OR'd) toutes les SELECT policies sur `profiles` — dont `profiles_owner_read_tenants` :
   ```sql
   EXISTS (
     SELECT 1
     FROM lease_signers ls
     JOIN leases l ON l.id = ls.lease_id
     JOIN properties p ON p.id = l.property_id
     WHERE ls.profile_id = profiles.id
       AND p.owner_id = get_my_profile_id()
   )
   ```
3. Le sub-SELECT sur `lease_signers` déclenche RLS sur cette table.
4. `lease_signers_tenant_view_for_doc_center` USING était :
   ```sql
   profile_id IN (SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid())
   ```
5. Sub-SELECT sur `profiles` → re-déclenche RLS profiles → re-évalue `profiles_owner_read_tenants` → re-sub-SELECT sur `lease_signers` → **boucle infinie**.

Diagnostic queries (exécutées PASS B3 compléments) ont confirmé :
- `get_my_profile_id()` est bien SECURITY DEFINER (`prosecdef = true`) — helper safe
- Les 4 policies sur `profiles` sont correctes individuellement, c'est la cross-référence avec `lease_signers` qui casse
- La seule policy SELECT sur `lease_signers` est `lease_signers_tenant_view_for_doc_center`, et elle contient le sub-SELECT anti-pattern

---

## Fix appliqué

Option 3 du plan de rollback, variante minimale : **rewrite d'une seule policy, côté `lease_signers`**, en remplaçant le sub-SELECT par le helper SECURITY DEFINER (pattern validé Talok).

```sql
BEGIN;

DROP POLICY IF EXISTS lease_signers_tenant_view_for_doc_center ON public.lease_signers;

CREATE POLICY lease_signers_tenant_view_for_doc_center
  ON public.lease_signers
  FOR SELECT
  TO authenticated
  USING (profile_id = public.get_my_profile_id());

COMMIT;
```

**Sémantique conservée** : le tenant voit toujours uniquement ses propres `lease_signers`.
**Recursion cassée** : `get_my_profile_id()` étant SECURITY DEFINER, la query interne bypasse la RLS de `profiles` → plus de réentrée → plus de boucle.

### Tracking

- SQL Editor prod : `Success. No rows returned` (2026-04-18)
- Fichier migration `supabase/migrations/20260418120000_fix_lease_signers_recursion.sql` créé sur `audit/migrations-168-pending` (idempotent via `DROP POLICY IF EXISTS`)

---

## Seconde itération — récursions cascadantes `leases` + `tickets`

Le premier hotfix a résolu profiles/lease_signers mais a révélé **2 autres cycles** côté tenant :

### Cycle A — `leases` ↔ `units`
- `leases."Owners can view leases of own properties"` USING fait `EXISTS (FROM units u JOIN properties p ...)`
- `units."Users can view units of accessible properties"` USING fait `EXISTS (FROM leases l JOIN lease_signers ls ...)`
- **Évaluation croisée** : lecture leases déclenche évaluation units → re-déclenche évaluation leases → recursion.

### Cycle B — `tickets` ↔ `work_orders`
- `tickets."Users can view tickets of accessible properties"` USING fait `EXISTS (FROM work_orders wo WHERE provider_id)`
- `work_orders.owners_view_work_orders` et `tenants_view_work_orders` USING font `EXISTS (FROM tickets ...)`
- Mêmes symptômes.

### Fix cycle A + B (migration `20260418130000_fix_leases_tickets_rls_recursion.sql`)

- **4 helpers SECURITY DEFINER créés** : `is_unit_accessible_to_tenant`, `is_ticket_provider`, `work_order_is_for_my_property`, `work_order_ticket_created_by_me`.
- **Policies réécrites** : `units "Users can view units..."`, `tickets "Users can view tickets..."` + `"Users can create tickets..."`, `work_orders.owners_view/update/create_work_orders`, `work_orders.tenants_view_work_orders`.

Commit `48668dc` sur `audit/migrations-168-pending`. Appliqué en prod via SQL Editor.

---

## Validation post-fix (2026-04-18)

| Check | Attendu | Résultat |
|---|---|---|
| `SELECT FROM profiles WHERE user_id = X` en mode authenticated | 1 row, pas de 42P17 | ✅ owner admin dashboard OK |
| `SELECT FROM lease_signers WHERE profile_id = X` en mode authenticated | N rows, pas de 42P17 | ✅ tenant dashboard charge son bail |
| Login owner → `/owner` dashboard | 200 OK, pas d'erreur console | ✅ "Thomas Admin" - 11 users, 13 logements, MRR 69€ |
| Login tenant → `/tenant` dashboard + accès bail | 200 OK | ✅ "Thomas locataire" - bail Fort-de-France, impayés 70€, badge Live |
| Console live post-fix | 0 erreur 42P17 | ✅ uniquement warnings Realtime reconnect (non-bloquant) |

## Statut final incident

🟢 **RÉSOLU** — 2 cycles RLS 42P17 détectés pendant PASS 6.1, fix appliqué via 2 migrations chirurgicales (pattern Talok SECURITY DEFINER helpers), validation e2e owner+tenant OK.

Verdict Sprint B3 : **Option B (GO avec réserves)** — merge possible, l'incident étant résolu dans le scope du sprint et tracké par 2 migrations idempotentes.

---

## Suite

1. Confirmer post-fix le login owner + tenant (PASS 6.1 + 6.2)
2. Continuer PASS 6.3-6.5 (SMS DB-only, upload si bucket, stripe webhooks)
3. Lancer PASS 7 Sentry — confirmer `42P17` count = 0 sur la window post-fix
4. Remplir verdict final dans `sprint-b3-summary.md` (Option A si tout green, Option B si mineurs)
5. Si tout green → PR `audit/migrations-168-pending` → `main`

---

## Leçon retenue

Mon assessment PASS 2.1 a incorrectement classé `profiles_owner_read_tenants` comme "SAFE car utilise `get_my_profile_id()`". Le helper SECURITY DEFINER couvre bien la partie `p.owner_id = get_my_profile_id()`, mais le `FROM lease_signers` dans le USING était resté non-blindé et a permis à la RLS de `lease_signers` de re-entrer dans `profiles`.

**Pattern Talok à durcir** : toute policy qui fait `FROM <autre_table>` dans son USING doit vérifier que les policies de `<autre_table>` n'elles-mêmes ne réfèrent pas la table courante sans helper SECURITY DEFINER. Une simple grep suffit :

```bash
grep -r "FROM profiles" supabase/migrations/*.sql | grep -i "policy\|USING"
```

À ajouter au CI check / checklist future migrations.

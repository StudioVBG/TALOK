# PROVIDER_SCHEMA_AUDIT — Schéma réel module prestataires

**Date audit** : 2026-04-20
**Branche** : `claude/fix-provider-dashboard-crash-sE6Pb`
**Source** : migrations `supabase/migrations/*provider*.sql` + `20240101000001_rls_policies.sql`
**Limite** : audit conduit sans accès MCP Supabase live — le schéma déclaratif est dérivé des migrations. Un `pg_dump --schema-only` en prod reste recommandé pour confirmer.

---

## 1. Tables du module

| Table | Migration source | Colonne PK | Colonne provider (FK profiles.id) |
|---|---|---|---|
| `providers` (annuaire) | `20260408120000_providers_module_sota.sql` | `id` | `profile_id` (nullable) + `added_by_owner_id` |
| `owner_providers` (carnet) | `20260408120000_providers_module_sota.sql` | `id` | `provider_id` → `providers.id` |
| `work_orders` | `20240101000000_initial_schema.sql` + alter multiples | `id` | `provider_id` → **`profiles.id`** |
| `provider_reviews` | `20251205700000_provider_missing_tables.sql` | `id` | `provider_profile_id` |
| `provider_availability` | `20251205700000_provider_missing_tables.sql` | `id` | `provider_profile_id` |
| `provider_quotes` | `20251205700000_provider_missing_tables.sql` | `id` | `provider_profile_id` |
| `provider_quote_items` | `20251205700000_provider_missing_tables.sql` | `id` | via `quote_id` |
| `provider_invoices` | `20251205500000_invoicing_professional.sql` (refonte) | `id` | `provider_profile_id` |
| `provider_portfolio_items` | `20251206200000_provider_portfolio.sql` | `id` | `provider_profile_id` |
| `provider_compliance_*` | `20251205200000_provider_compliance_sota.sql` | — | — |

### ⚠ Incohérence FK

- `work_orders.provider_id` référence `profiles(id)` (pas `providers.id`).
- `provider_reviews.provider_profile_id` référence `profiles(id)`.
- Le code client parfois itère sur `provider_id` alors que la table expose `provider_profile_id` → voir section 4.

---

## 2. Colonnes critiques — nommage réel

### `work_orders`
- `statut` TEXT CHECK (`'assigned' | 'scheduled' | 'in_progress' | 'done' | 'cancelled'`) — **legacy**
- `status` TEXT CHECK (`'draft' | 'quote_requested' | 'quote_received' | 'quote_approved' | 'quote_rejected' | 'scheduled' | 'in_progress' | 'completed' | 'invoiced' | 'paid' | 'disputed' | 'cancelled'`) — **nouveau, ajouté par `20260408120000`**, coexiste
- Les deux colonnes sont backfillées mais le code lit presque exclusivement `statut`
- `ticket_id` UUID — **nullable depuis `20260408120000`** (work_orders standalone possibles)
- `property_id`, `owner_id`, `entity_id`, `lease_id` — ajoutées par `20260408120000`
- `cout_estime`, `cout_final`, `date_intervention_prevue`, `date_intervention_reelle` (FR — legacy)
- `accepted_at`, `actual_start_at`, `actual_end_at`, `scheduled_start_at` (EN — nouvelles)

### `properties`
- `adresse_complete` (TEXT) — pas `adresse`
- `ville` (TEXT)
- `code_postal` (TEXT)
- `owner_id` → `profiles(id)`

### `provider_reviews`
- `provider_profile_id`, `reviewer_profile_id` — **jamais** `provider_id`
- `rating_overall`, `rating_punctuality`, `rating_quality`, `rating_communication`, `rating_value`
- `is_published` BOOLEAN (défaut `true`)

### `profiles`
- `id` PK
- `user_id` → `auth.users(id)` (lookup via `eq('user_id', user.id)`)
- `identity_status` enum (depuis `20260401000000`)
- `onboarding_step` enum
- `role` TEXT CHECK (`'owner' | 'tenant' | 'provider' | 'guarantor' | 'syndic' | 'agency' | 'admin'`)

---

## 3. RLS policies — état

### Tables fixées via SECURITY DEFINER (anti-42P17)
- `work_orders` :
  - `Providers can view own work orders` — `provider_id = public.user_profile_id()` (simple, safe)
  - `Owners can view work orders of own properties` — utilise `public.owner_accessible_work_order_ids()` (helper SECURITY DEFINER — migration `20260411100000`)
  - `owners_view_work_orders` / `owners_update_work_orders` / `owners_create_work_orders` — utilisent `public.work_order_is_for_my_property(ticket_id)` (helper — migration `20260418130000`)
  - `tenants_view_work_orders` — utilise `public.work_order_ticket_created_by_me(ticket_id)`
- `tickets` :
  - `Users can view tickets of accessible properties` — utilise `public.is_ticket_provider(tickets.id)` + autres helpers
- `units` : helper `public.is_unit_accessible_to_tenant`

### Tables non normalisées (potentiel 42P17 futur)
- `providers` : policies sub-SELECT directement `profiles` (migration `20260408120000`)
  ```sql
  USING (added_by_owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
         OR is_marketplace = true
         OR profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
  ```
  Ne pose pas de problème actuellement (profiles n'a pas de policy croisée vers providers), mais casse la règle architecturale « toujours passer par SECURITY DEFINER helpers ».
- `owner_providers`, `provider_reviews`, `provider_availability`, `provider_quotes`, `provider_quote_items`, `provider_portfolio_items` — même pattern sub-SELECT profiles. Même risque latent.

### Politique manquante signalée
- `provider_reviews` INSERT : actuellement `WHERE role = 'owner'` uniquement → les tenants (qui interagissent aussi avec prestataires via tickets) ne peuvent pas noter. À clarifier produit.

---

## 4. Contradictions code ↔ schéma — liste à corriger

| # | Fichier | Ligne | Pose | Réalité schéma |
|---|---|---|---|---|
| 1 | `app/api/provider/dashboard/route.ts` | L60 | `.eq("provider_id", profile.id)` sur `provider_reviews` | Colonne réelle : `provider_profile_id` |
| 2 | `app/api/provider/dashboard/route.ts` | L72 | Filtre `["pending", "accepted", "scheduled"].includes(wo.statut)` | Valeurs légales : `assigned, scheduled, in_progress, done, cancelled` — "pending" et "accepted" n'existent pas |
| 3 | `app/api/provider/dashboard/route.ts` | L55 | Select `property:properties(adresse_complete, ville)` | TS `PendingOrder.property.adresse` → clé `adresse` manquante dans fallback |
| 4 | `app/provider/dashboard/page.tsx` | L49-62 | Interface `property.adresse` | Schéma réel : `adresse_complete`. La RPC remappe bien en `adresse`, mais le fallback ne remappe pas |
| 5 | `lib/hooks/use-realtime-provider.ts` | L164 | `review.provider_id !== profileId` | Colonne réelle : `provider_profile_id` → filtre temps réel **ne match jamais** |
| 6 | `app/api/provider/jobs/[id]/status/route.ts` | L171 | `properties!inner(owner_id)` | FK nommée implicite — à valider (`properties_owner_id_fkey` existe) |
| 7 | Toutes les routes API provider | — | `createRouteHandlerClient` pour queries après `getUser()` | Règle Talok : `createClient()` uniquement pour auth, `getServiceClient()` pour queries SSR/API |

---

## 5. RPC — inventaire

| RPC | Migration | SECURITY DEFINER | Issue |
|---|---|---|---|
| `provider_dashboard(p_user_id)` | `20251205700000` | ✅ | INNER JOIN tickets via ticket_id → exclut les work_orders standalone (depuis que ticket_id est nullable) |
| `provider_analytics_dashboard(p_user_id, ...)` | `20251205400000` | ✅ | OK, usage optionnel |
| `update_provider_kyc_status(p_profile_id)` | `20251205200000` | ✅ | OK |
| `get_provider_missing_documents` | `20251205200000` | ✅ | OK |
| `calculate_provider_compliance_score` | `20251205200000` | ✅ | OK |

---

## 6. Migrations provider ordonnées (chronologie)

```
20240101000000 initial_schema.sql (work_orders, tickets — legacy)
20240101000001 rls_policies.sql   (policies work_orders originales)
20240101000018 missing_core_tables.sql (provider_invoices v1)
20240101000025 add_provider_validation.sql
20240101000026 fix_provider_rls.sql
20251205200000 provider_compliance_sota.sql
20251205400000 provider_analytics_dashboard.sql
20251205500000 invoicing_professional.sql  (refonte provider_invoices)
20251205700000 provider_missing_tables.sql (reviews, availability, quotes, RPC provider_dashboard)
20251205800000 intervention_flow_complete.sql
20251206200000 provider_portfolio.sql
20251206750000 fix_all_missing_tables.sql (recreate RPC provider_dashboard)
20260224100000 normalize_provider_names.sql
20260408120000 providers_module_sota.sql (providers, owner_providers, work_orders extensions)
20260411100000 fix_work_orders_policy_recursion.sql
20260418130000 fix_leases_tickets_rls_recursion.sql
```

**À confirmer en prod** : que la dernière migration `20260418130000` est bien appliquée — si non, tickets et work_orders subissent encore 42P17.

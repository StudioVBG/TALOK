# PROVIDER_CONFORMITY_REPORT — Audit conformité module prestataires

**Date audit** : 2026-04-20
**Branche** : `claude/fix-provider-dashboard-crash-sE6Pb`
**Périmètre** : `app/provider/*` + `app/api/provider/*` + hooks & helpers associés

---

## 1. Inventaire fichiers (Phase 0.2)

### Pages (`app/provider/`)
- `layout.tsx` · `page.tsx` (redirect dashboard) · `error.tsx` · `loading.tsx`
- `dashboard/` (page, loading, error) — **P0 crash**
- `jobs/` (list, loading, error) + `[id]/page.tsx` + `[id]/JobDetailClient.tsx`
- `tickets/` (list) + `[id]/page.tsx`
- `invoices/` (list, loading, error)
- `quotes/` (list, loading, error) + `[id]/page.tsx` + `new/page.tsx`
- `calendar/page.tsx` · `reviews/page.tsx` · `portfolio/page.tsx`
- `compliance/` (page, loading, error)
- `documents/page.tsx` · `messages/page.tsx` · `settings/page.tsx` · `help/page.tsx`
- `onboarding/` : `profile`, `services`, `ops`, `review`

### API routes (`app/api/provider/`)
- `dashboard/route.ts`
- `portfolio/route.ts` + `[id]/route.ts`
- `jobs/[id]/status/route.ts`
- `invoices/route.ts` + `[id]/route.ts` + `[id]/payments/route.ts` + `[id]/send/route.ts`
- `quotes/route.ts` + `[id]/route.ts` + `[id]/send/route.ts`
- `compliance/status/route.ts` + `upload/route.ts` + `documents/route.ts` + `documents/[id]/route.ts`

### Hooks / helpers
- `lib/hooks/use-realtime-provider.ts` — realtime Supabase
- `features/tickets/server/data-fetching.ts:getTickets("provider")`
- `components/layout/provider-{sidebar,rail-nav,bottom-nav}.tsx`

---

## 2. Grille conformité client Supabase (Phase 2.1)

Règle Talok :
- **SSR/API** : `getServiceClient()` pour queries, `createClient()` uniquement pour `getUser()`.
- **Browser** : `createClient()` obligatoire (clé anon, RLS appliquée).

| Fichier | Auth (`getUser`) | Queries | Conforme ? | Statut |
|---|---|---|---|---|
| `app/provider/layout.tsx` | `createClient()` ✅ | via `getServerProfile` (fallback service role) ✅ | ✅ | — |
| `app/provider/jobs/[id]/page.tsx` | `createClient()` ✅ | `getServiceClient()` ✅ | ✅ | **fixé dans cette PR** |
| `app/api/provider/dashboard/route.ts` | `createRouteHandlerClient()` ✅ | RPC + fallback via `serviceClient` ✅ | ✅ | **fixé P0 dans cette PR** |
| `app/api/provider/portfolio/route.ts` | `createRouteHandlerClient()` ✅ | `serviceClient` ✅ | ✅ | **fixé P1 dans cette PR** |
| `app/api/provider/portfolio/[id]/route.ts` | idem | `serviceClient` ✅ | ✅ | **fixé P1 dans cette PR** |
| `app/api/provider/jobs/[id]/status/route.ts` | `createClient()` ✅ | `serviceClient` ✅ + fallback owner_id standalone WO | ✅ | **fixé P1 dans cette PR** |
| `app/api/provider/invoices/route.ts` | `createClient()` ✅ | `serviceClient` ✅ | ✅ | **fixé P1 dans cette PR** |
| `app/api/provider/invoices/[id]/route.ts` | idem | `serviceClient` ✅ | ✅ | **fixé P1 dans cette PR** |
| `app/api/provider/invoices/[id]/payments/route.ts` | idem | `serviceClient` ✅ | ✅ | **fixé P1 dans cette PR** |
| `app/api/provider/invoices/[id]/send/route.ts` | idem | `serviceClient` ✅ | ✅ | **fixé P1 dans cette PR** |
| `app/api/provider/quotes/route.ts` | idem | `serviceClient` ✅ | ✅ | **fixé P1 dans cette PR** |
| `app/api/provider/quotes/[id]/route.ts` | idem | `serviceClient` ✅ | ✅ | **fixé P1 dans cette PR** |
| `app/api/provider/quotes/[id]/send/route.ts` | idem | `serviceClient` ✅ | ✅ | **fixé P1 dans cette PR** |
| `app/api/provider/compliance/status/route.ts` | idem | `serviceClient` ✅ + RPC | ✅ | **fixé P1 dans cette PR** |
| `app/api/provider/compliance/documents/route.ts` | idem | `serviceClient` ✅ | ✅ | **fixé P1 dans cette PR** |
| `app/api/provider/compliance/documents/[id]/route.ts` | idem | `serviceClient` ✅ + storage | ✅ | **fixé P1 dans cette PR** |
| `app/api/provider/compliance/upload/route.ts` | idem | `serviceClient` ✅ + storage + RPC | ✅ | **fixé P1 dans cette PR** |

**Résumé** : 17/17 routes/pages SSR provider conformes après cette PR.

### Principe de scoping conservé
Le passage au service client **bypass RLS**, mais la RBAC reste garantie par des filtres `.eq('provider_profile_id', profile.id)` explicites sur toutes les queries (déjà présents). Aucun changement de surface d'attaque.

### Browser-side (client components)

| Fichier | Usage | Conforme ? |
|---|---|---|
| `lib/hooks/use-realtime-provider.ts` | `createClient()` from `/lib/supabase/client` ✅ | ✅ |
| `app/provider/reviews/page.tsx` | `createClient()` ✅ | ✅ |
| `app/provider/invoices/page.tsx` | `createClient()` ✅ | ✅ |
| `app/provider/calendar/page.tsx` | `createClient()` ✅ | ✅ |
| `app/provider/jobs/[id]/JobDetailClient.tsx` | `createClient()` ✅ | ✅ |
| `app/provider/onboarding/*` | `createClient()` dynamic import ✅ | ✅ |

Aucune fuite de `getServiceClient()` côté client détectée ✅.

---

## 3. Feature gating (Phase 2.2)

Grep `PLAN_LIMITS`, `isSubscriptionStatusEntitled`, `providers_*`, `interventions_*` → **aucun flag** spécifique prestataire dans `lib/subscriptions/plans.ts`.

**Interprétation** : les prestataires sont des utilisateurs B2B autonomes (profil `role=provider`), pas rattachés à un plan payant. Le gating s'applique côté **propriétaire** (qui invite/paie le prestataire). Conforme à l'architecture actuelle.

**Action** : aucune — à confirmer avec le produit si la politique change.

---

## 4. RBAC (Phase 2.3)

Toutes les routes API provider vérifient `profile.role === 'provider'` avant mutation.

Ressources scopées :
- `work_orders` : `provider_id = profile.id` ✅
- `provider_invoices`, `provider_quotes`, `provider_portfolio_items` : `provider_profile_id = profile.id` ✅
- `provider_reviews` : lecture OK, le fallback dashboard filtre incorrectement sur `provider_id` au lieu de `provider_profile_id` ❌ (voir PROVIDER_CRASH_STACK §3.1)

**Hook realtime** : filtre côté client `review.provider_id !== profileId` alors que le payload contient `provider_profile_id` → **le filtre ne match jamais**, toast jamais déclenché sur avis reçus. Bug sourd.

---

## 5. Colonnes / noms réels (Phase 2.4)

| Occurrence | Fichier:ligne | Colonne code | Colonne réelle |
|---|---|---|---|
| ❌ | `app/api/provider/dashboard/route.ts:60` | `provider_id` | `provider_profile_id` |
| ❌ | `lib/hooks/use-realtime-provider.ts:164` | `provider_id` | `provider_profile_id` |
| ⚠️ | `app/api/provider/dashboard/route.ts:55` | `properties(adresse_complete, ville)` | correct côté SQL, mais type `PendingOrder.property.adresse` inattendu côté composant |
| ℹ️ | partout dans provider | `statut` | coexiste avec `status` (nouveau) — pas un bug mais dette technique |

Aucune référence à des tables fantômes (`property_owners`, etc.) détectée. ✅

---

## 6. RLS (Phase 2.5)

### Policies à risque récursion latente

Tables dont les policies sub-SELECT `profiles` sans passer par un helper SECURITY DEFINER (issues de la migration `20260408120000_providers_module_sota.sql`) :
- `providers`
- `owner_providers`
- `provider_reviews` (+ `provider_availability`, `provider_quotes`, `provider_quote_items`, `provider_portfolio_items` — `20251205700000` et `20251206200000`)

**Impact** : aucune récursion actuelle car `profiles` n'a pas de policy croisée vers ces tables. Mais toute future policy sur `profiles` qui référencerait une de ces tables déclencherait 42P17.

**Recommandation P2** : réécrire via `public.user_profile_id()` (déjà utilisé ailleurs dans la base) — migration unifiée.

### Policies fixées correctement
- `work_orders` : 4 policies utilisent des helpers SECURITY DEFINER (`20260411100000`, `20260418130000`) ✅
- `tickets` : `is_ticket_provider()` helper ✅

### Doute applicabilité prod
À confirmer via `SELECT * FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 10;` :
- `20260418130000_fix_leases_tickets_rls_recursion.sql` appliquée ?
- `20260411100000_fix_work_orders_policy_recursion.sql` appliquée ?

---

## 7. Dark mode (Phase 2.6)

`app/provider/dashboard/page.tsx` :
- Palette `from-orange-600 via-amber-600 to-orange-700` (header) — OK par design (thème prestataire)
- `bg-orange-100` (L322, L337) — durs en light, OK contrast dark mode existant via `dark:bg-orange-900/20` par ailleurs
- GlassCard utilise `bg-card` (variable thème) ✅
- Checklist onboarding : `bg-orange-50/30 dark:bg-orange-950/10` ✅

**Action P2** : passer en audit exhaustif tous les `bg-white`, `text-gray-*` résiduels dans `app/provider/` — 0 trouvé à un scan rapide, mais vérif à faire.

---

## 8. Priorisation

### P0 — Crash bloquant prod
1. **Fallback `/api/provider/dashboard`** : colonne `provider_profile_id`, filtre statut, shape pending_orders, serviceClient cohérent, garde null. (Patch inclus)
2. **Migration conformité RLS** (optionnel — à planifier) : confirmer que `20260418130000` est bien appliquée.

### P1 — Bugs fonctionnels silencieux
1. ✅ `lib/hooks/use-realtime-provider.ts:164` — `review.provider_profile_id` au lieu de `provider_id` (fixé)
2. ✅ Interface `PendingOrder.property.adresse` → fallback harmonisé dans API + page défensive (fixé)
3. ✅ `app/api/provider/portfolio/*`, `jobs/[id]/status`, `invoices/*`, `quotes/*`, `compliance/*` — migrés sur `getServiceClient()` (fixé)
4. ✅ RPC `provider_dashboard` : LEFT JOIN tickets + properties via `COALESCE(wo.property_id, t.property_id)` (migration `20260420120000`)

### P2 — Dette technique
1. RLS `providers`, `owner_providers`, `provider_reviews`, `provider_availability`, `provider_quotes`, `provider_portfolio_items` — réécrire avec `public.user_profile_id()` et SECURITY DEFINER helpers
2. Unifier `status` (EN) vs `statut` (FR) sur `work_orders` — décider d'une source unique, déprécier l'autre, migrer le code
3. Dead column : `cout_estime` vs `quote_amount_cents` — même débat

---

## 9. Actions livrées dans cette PR

- [x] Rapports `PROVIDER_SCHEMA_AUDIT.md`, `PROVIDER_CRASH_STACK.md`, `PROVIDER_CONFORMITY_REPORT.md`
- [x] Patch P0 `app/api/provider/dashboard/route.ts` — service client cohérent, colonnes correctes, shape normalisée
- [x] Patch défensif `app/provider/dashboard/page.tsx` — guard + coercion array + fallback par item
- [x] Patch P1 `lib/hooks/use-realtime-provider.ts` — fix colonne `provider_profile_id` realtime
- [x] Patch P1 — **17 routes + SSR** migrés sur `getServiceClient()` :
  - `app/provider/jobs/[id]/page.tsx`
  - `app/api/provider/jobs/[id]/status/route.ts` (+ résolution owner_id standalone)
  - `app/api/provider/portfolio/route.ts` + `[id]/route.ts`
  - `app/api/provider/invoices/route.ts` + `[id]/route.ts` + `[id]/payments/route.ts` + `[id]/send/route.ts`
  - `app/api/provider/quotes/route.ts` + `[id]/route.ts` + `[id]/send/route.ts`
  - `app/api/provider/compliance/status/route.ts` + `documents/route.ts` + `documents/[id]/route.ts` + `upload/route.ts`
- [x] Migration SQL `20260420120000_provider_dashboard_rpc_standalone_work_orders.sql`
- [ ] `npx tsc --noEmit` : non exécuté (node_modules absent dans cet environnement). **À relancer en local avant merge.**
- [ ] P2 restant : réécriture policies `providers` / `owner_providers` / `provider_reviews` / `provider_availability` / `provider_quotes` / `provider_portfolio_items` via SECURITY DEFINER helpers — migration à planifier séparément.

# Audit exhaustif des Dashboards TALOK — SOTA 2026

**Date** : 4 mars 2026
**Portée** : Tableaux de bord Owner, Tenant et Provider
**Stack** : Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, shadcn/ui, Supabase (Auth + RPC + Realtime), Framer Motion
**Méthode** : Lecture exhaustive de chaque fichier, chaque fonction, chaque requête

---

## Table des matières

1. [Cartographie des routes et composants](#1-cartographie-des-routes-et-composants)
2. [Flux de données détaillés](#2-flux-de-données-détaillés)
3. [Analyse des fonctions](#3-analyse-des-fonctions)
4. [Scorecards](#4-scorecards)
5. [Findings détaillés](#5-findings-détaillés)
6. [Matrice de priorisation](#6-matrice-de-priorisation)
7. [Roadmap 3 sprints](#7-roadmap-3-sprints)

---

## 1. Cartographie des routes et composants

### 1.1 Owner Dashboard

| Fichier | Type | Lignes | Rôle |
|---------|------|--------|------|
| `app/owner/layout.tsx` | Server | 157 | Auth + vérification rôle + data loading parallèle + OwnerDataProvider + EntityProvider + CsrfTokenInjector |
| `app/owner/dashboard/page.tsx` | Server | 46 | Fetch profileCompletion via Supabase + render DashboardClient |
| `app/owner/dashboard/DashboardClient.tsx` | Client | 523 | Orchestrateur principal : useOwnerData() + useRealtimeDashboard() + 4 dynamic imports + urgentActions builder |
| `app/owner/dashboard/loading.tsx` | Server | ~47 | Skeleton fidèle au layout (header + KPI + zones) |
| `app/owner/dashboard/error.tsx` | Client | 5 | Error boundary via `DashboardError` component |
| `app/owner/_data/OwnerDataProvider.tsx` | Client | 197 | Context React : server data + client fetch `/api/owner/dashboard` + refetch |
| `app/owner/_data/fetchDashboard.ts` | Server | 273 | RPC `owner_dashboard` + fallback 5 requêtes parallèles |
| `app/owner/_data/fetchProperties.ts` | Server | 133 | Query properties + stats (count leases) |
| `app/owner/_data/fetchContracts.ts` | Server | 165 | Query leases via service-role client |
| `app/owner/_data/fetchProfileCompletion.ts` | Server | 107 | 5 requêtes parallèles (profiles, owner_profiles, entities, properties, documents) |
| `components/owner/dashboard/owner-finance-summary.tsx` | Client | ~180 | Widget finances : chart Recharts + 3 KPIs |
| `components/owner/dashboard/owner-portfolio-by-module.tsx` | Client | ~120 | Widget portefeuille par module (habitation, LCD, pro, parking) |
| `components/owner/dashboard/owner-risk-section.tsx` | Client | ~100 | Widget risques/conformité (DPE, baux, indexation) |
| `components/owner/dashboard/profile-completion-card.tsx` | Client | ~200 | Carte progression profil avec SVG circulaire + 13 tâches |
| `components/owner/dashboard/realtime-revenue-widget.tsx` | Client | ~150 | Widget revenus temps réel + statut connexion |
| `components/owner/dashboard/recent-activity.tsx` | Client | ~80 | Flux d'activité récente (factures, tickets, signatures) |
| `components/owner/dashboard/urgent-actions-section.tsx` | Client | ~130 | Actions urgentes triées par priorité (critical → high → medium) |
| `components/owner/dashboard/signature-alert-banner.tsx` | Client | ~100 | Bannière signatures en attente (fetch API + sessionStorage dismiss) |
| `lib/hooks/use-realtime-dashboard.ts` | Client | 613 | 8 channels Supabase Realtime (payments, invoices, signers, tickets, leases, edl, documents, work_orders) |

**Total Owner** : ~19 fichiers, ~3 200 lignes

### 1.2 Tenant Dashboard

| Fichier | Type | Lignes | Rôle |
|---------|------|--------|------|
| `app/tenant/layout.tsx` | Server | 117 | Auth + rôle + autoLinkLeaseSigners + fetchTenantDashboard + TenantDataProvider |
| `app/tenant/dashboard/page.tsx` | Server | 57 | Fetch pending EDL signatures via Supabase |
| `app/tenant/dashboard/DashboardClient.tsx` | Client | **1059** | **Monolithique** : multi-lease, onboarding, credit score, consumption, activity feed, DPE, AI tips, landlord contact |
| `app/tenant/dashboard/loading.tsx` | Server | ~100 | Skeleton détaillé bento-grid |
| `app/tenant/dashboard/error.tsx` | Client | 5 | Error boundary via `DashboardError` |
| `app/tenant/_data/TenantDataProvider.tsx` | Client | 91 | Context + refetch `/api/tenant/dashboard` + optimistic update |
| `app/tenant/_data/fetchTenantDashboard.ts` | Server | **754** | RPC `tenant_dashboard` + fallback massif 18 requêtes |
| `app/tenant/_data/fetchTenantLease.ts` | Server | ~100 | Fetch bail unique (détail) |
| `app/tenant/_data/fetchTenantInvoices.ts` | Server | ~80 | Fetch factures + paiements |
| `app/tenant/_data/fetchTenantTickets.ts` | Server | ~60 | Fetch tickets + relations |
| `features/tenant/components/credit-builder-card.tsx` | Client | ~120 | Widget score crédit (300-850) |
| `features/tenant/components/consumption-chart.tsx` | Client | ~100 | Widget consommation compteurs (6 mois) |
| `lib/hooks/use-realtime-tenant.ts` | Client | 683 | 7 channels (leases, invoices, documents, tickets, signers, properties, edl) |

**Total Tenant** : ~13 fichiers, ~3 300 lignes

### 1.3 Provider Dashboard

| Fichier | Type | Lignes | Rôle |
|---------|------|--------|------|
| `app/provider/layout.tsx` | Server | 153 | Auth + rôle + navigation 3 variantes (sidebar/rail/bottom) |
| `app/provider/dashboard/page.tsx` | **Client** | **513** | `"use client"` — Fetch via `fetch("/api/provider/dashboard")` dans useEffect |
| `app/provider/dashboard/loading.tsx` | Server | 5 | Simple `PageLoading` spinner (pas de skeleton) |
| `app/provider/dashboard/error.tsx` | Client | 5 | Error boundary via `DashboardError` |
| `app/api/provider/dashboard/route.ts` | Server | 114 | API Route : RPC `provider_dashboard` + fallback 2 requêtes |
| `lib/hooks/use-realtime-provider.ts` | Client | 219 | 2 channels (work_orders, provider_reviews) |

**Total Provider** : ~6 fichiers, ~1 010 lignes

### 1.4 Infrastructure partagée

| Fichier | Type | Rôle |
|---------|------|------|
| `middleware.ts` | Edge | Cookie check auth, protected paths, white-label, legacy redirects |
| `tailwind.config.ts` | Config | Breakpoints custom (xs:360 → 3xl:1920), design tokens shadcn |
| `app/globals.css` | CSS | Variables light/dark, focus-visible, reduced-motion, high-contrast, safe-area |
| `components/ui/glass-card.tsx` | Client | Glassmorphism card (backdrop-blur, hover glow) |
| `components/ui/page-transition.tsx` | Client | AnimatePresence wrapper |
| `components/ui/empty-state.tsx` | Client | État vide avec useReducedMotion |
| `components/ui/dashboard-error.tsx` | Client | Error boundary réutilisable (section, title, returnHref) |
| `components/ui/page-loading.tsx` | Client | Spinner loading (Loader2) |
| `components/security/CsrfTokenInjector.tsx` | Client | Injection token CSRF |
| `components/error-boundary.tsx` | Client | ErrorBoundary React wrapper |
| `lib/helpers/format.ts` | Shared | formatCurrency, formatDate, formatDateShort |
| `lib/helpers/auth-helper.ts` | Server | getServerProfile (fallback service role) |
| `lib/helpers/role-redirects.ts` | Server | getRoleDashboardUrl |
| `lib/supabase/server.ts` | Server | createClient (cookie-based) |
| `lib/supabase/service-client.ts` | Server | getServiceClient (service role singleton) |

---

## 2. Flux de données détaillés

### 2.1 Owner — Data Flow

```
┌────────────────────────────────────────────────────────────┐
│ MIDDLEWARE (Edge)                                           │
│ Cookie check → redirect /auth/signin si absent             │
└──────────────────────┬─────────────────────────────────────┘
                       ↓
┌────────────────────────────────────────────────────────────┐
│ app/owner/layout.tsx (SERVER)                              │
│                                                            │
│ 1. supabase.auth.getUser()                                 │
│ 2. getServerProfile(user.id, "id, role, prenom, nom")      │
│ 3. if role !== "owner" → redirect                          │
│ 4. Auto-create owner_profiles + legal_entities si absents  │
│ 5. Promise.allSettled([                                    │
│      fetchProperties(profile.id),                          │
│      fetchDashboard(profile.id),   ← RPC owner_dashboard  │
│      fetchContracts({ ownerId }),                          │
│    ])                                                      │
│ 6. Wrap children dans OwnerDataProvider + EntityProvider    │
└──────────────────────┬─────────────────────────────────────┘
                       ↓
┌────────────────────────────────────────────────────────────┐
│ app/owner/dashboard/page.tsx (SERVER)                      │
│                                                            │
│ 1. supabase.auth.getUser()                                 │
│ 2. query profiles.select("id").eq("user_id")               │
│ 3. fetchProfileCompletion(profile.id)                      │
│ 4. <DashboardClient profileCompletion={...} />             │
└──────────────────────┬─────────────────────────────────────┘
                       ↓
┌────────────────────────────────────────────────────────────┐
│ DashboardClient.tsx (CLIENT)                               │
│                                                            │
│ 1. useOwnerData() → {dashboard, apiData, isLoadingApi}     │
│    ↑ OwnerDataProvider fetches /api/owner/dashboard        │
│                                                            │
│ 2. useRealtimeDashboard() → 8 channels Supabase           │
│    • payments INSERT → totalRevenue++                      │
│    • invoices UPDATE → pendingPayments/latePayments        │
│    • lease_signers UPDATE → pendingSignatures              │
│    • tickets INSERT/UPDATE → openTickets                   │
│    • leases UPDATE → activeLeases                          │
│    • edl INSERT/UPDATE → events (⚠ BUG DASH-028)          │
│    • documents INSERT → events                             │
│    • work_orders INSERT/UPDATE → events                    │
│                                                            │
│ 3. calculateCompletionPercentage(profileCompletion)        │
│ 4. Build urgentActions[] from dashboard counts             │
│ 5. Transform to zone1/zone2/zone3 data                    │
│ 6. Render: Header → Profile → Notifications → Urgent →    │
│    QuickLinks → Finances → Portfolio → Risk → Activity     │
└────────────────────────────────────────────────────────────┘
```

### 2.2 Tenant — Data Flow

```
┌────────────────────────────────────────────────────────────┐
│ app/tenant/layout.tsx (SERVER)                             │
│                                                            │
│ 1. Auth + role check                                       │
│ 2. autoLinkLeaseSigners(profile.id, user.email)            │
│    ↳ Lie les lease_signers orphelins par email             │
│    ↳ Backfill invoices.tenant_id                           │
│ 3. fetchTenantDashboard(user.id)                           │
│    ↳ RPC tenant_dashboard                                  │
│    ↳ Si RPC échoue OU retourne 0 baux → fallback direct   │
│      → 18 requêtes (12 parallèles + 6 séquentielles)      │
│      → Tables: profiles, lease_signers, leases, properties,│
│        invoices, tickets, edl, edl_signatures, meters,     │
│        meter_readings, documents, notifications, charges,  │
│        tenant_charges_base, tenant_profiles                │
│ 4. Wrap dans TenantDataProvider                            │
└──────────────────────┬─────────────────────────────────────┘
                       ↓
┌────────────────────────────────────────────────────────────┐
│ app/tenant/dashboard/page.tsx (SERVER)                     │
│                                                            │
│ 1. Query edl_signatures + edl + property (pending)         │
│ 2. <DashboardClient serverPendingEDLs={...} />             │
└──────────────────────┬─────────────────────────────────────┘
                       ↓
┌────────────────────────────────────────────────────────────┐
│ DashboardClient.tsx (CLIENT) — 1059 lignes                 │
│                                                            │
│ 1. useTenantData() → dashboard from context                │
│ 2. useTenantRealtime() → 7 channels                       │
│ 3. Auto-retry if dashboard null (race condition)           │
│ 4. fetch /api/tenant/credit-score → CreditScoreData       │
│ 5. fetch /api/tenant/consumption → ConsumptionResponse     │
│ 6. Compute: selectedLease, activityFeed, pendingActions,   │
│    onboardingProgress, nextDueDate                         │
│ 7. Render 12-column bento grid inline (pas de widgets)     │
└────────────────────────────────────────────────────────────┘
```

### 2.3 Provider — Data Flow

```
┌────────────────────────────────────────────────────────────┐
│ app/provider/layout.tsx (SERVER)                           │
│                                                            │
│ 1. Auth + role check                                       │
│ 2. PAS de data loading / PAS de DataProvider               │
│ 3. Render navigation (sidebar/rail/bottom) + children      │
└──────────────────────┬─────────────────────────────────────┘
                       ↓
┌────────────────────────────────────────────────────────────┐
│ app/provider/dashboard/page.tsx (CLIENT ⚠)                 │
│ "use client" — entièrement client-side                     │
│                                                            │
│ 1. useRealtimeProvider() → 2 channels                      │
│ 2. useEffect → loadDashboard()                             │
│    ↳ fetch("/api/provider/dashboard")                      │
│      ↓                                                     │
│ ┌──────────────────────────────────────────┐               │
│ │ API Route (route.ts)                     │               │
│ │ 1. Auth check (createRouteHandlerClient) │               │
│ │ 2. Role check via service client         │               │
│ │ 3. RPC provider_dashboard(p_user_id)     │               │
│ │    ↳ Fallback: 2 queries parallèles      │               │
│ │      (work_orders + provider_reviews)     │               │
│ │ 4. Return JSON                           │               │
│ └──────────────────────────────────────────┘               │
│                                                            │
│ 3. Auto-refresh when realtime.newOrdersCount > 0           │
│ 4. Render inline: Header → Stats → Orders/Reviews → Quick  │
└────────────────────────────────────────────────────────────┘
```

---

## 3. Analyse des fonctions

### 3.1 Fonctions serveur — Owner

| Fonction | Fichier | Entrée | Sortie | Détail |
|----------|---------|--------|--------|--------|
| `OwnerLayout()` | `app/owner/layout.tsx` | `children` | JSX | Auth → rôle → auto-create profiles/entities → Promise.allSettled 3 fetches → wrap providers |
| `OwnerDashboardPage()` | `app/owner/dashboard/page.tsx` | — | JSX | Auth → fetch profileCompletion → render DashboardClient |
| `fetchDashboard(ownerId)` | `_data/fetchDashboard.ts` | `string` | `OwnerDashboardData` | Auth vérif → RPC `owner_dashboard` → fallback `fetchDashboardDirect` |
| `fetchDashboardDirect(supabase, ownerId)` | `_data/fetchDashboard.ts` | client, string | `OwnerDashboardData` | 5 queries parallèles (properties, leases, invoices, tickets, edl + recentInvoices) |
| `fetchProperties(ownerId, opts)` | `_data/fetchProperties.ts` | string, options | `PropertiesWithStats` | Auth → properties SELECT * → optional leases COUNT |
| `fetchContracts(options)` | `_data/fetchContracts.ts` | `FetchContractsOptions` | `LeaseRow[]` | Auth → elevated client → properties IDs → leases SELECT * |
| `fetchProfileCompletion(ownerId)` | `_data/fetchProfileCompletion.ts` | `string` | `ProfileCompletionData` | Service role → 5 queries parallèles → boolean flags pour 13 tâches |

### 3.2 Fonctions client — Owner

| Fonction | Fichier | Rôle |
|----------|---------|------|
| `DashboardClient({ profileCompletion })` | `DashboardClient.tsx` | Orchestre tous les widgets, construit urgentActions[], transforme données |
| `calculateCompletionPercentage(data)` | `DashboardClient.tsx` | Calcule % complétion profil (10-12 tâches selon type) |
| `useOwnerData()` | `OwnerDataProvider.tsx` | Hook context : properties, dashboard, contracts, apiData, refetch |
| `useRealtimeDashboard(options)` | `use-realtime-dashboard.ts` | 8 channels realtime + reconnect auto 30s + events + toast |

### 3.3 Fonctions serveur — Tenant

| Fonction | Fichier | Entrée | Sortie | Détail |
|----------|---------|--------|--------|--------|
| `TenantLayout()` | `app/tenant/layout.tsx` | `children` | JSX | Auth → rôle → autoLinkLeaseSigners → fetchTenantDashboard → TenantDataProvider |
| `autoLinkLeaseSigners(profileId, email)` | `app/tenant/layout.tsx` | string, string | void | Lie lease_signers orphelins par email + backfill invoices.tenant_id |
| `TenantDashboardPage()` | `app/tenant/dashboard/page.tsx` | — | JSX | Auth → query edl_signatures pending → DashboardClient |
| `fetchTenantDashboard(userId)` | `_data/fetchTenantDashboard.ts` | `string` | `TenantDashboardData \| null` | Auth → RPC → si 0 baux fallback direct → normalize signers |
| `fetchTenantDashboardDirect(supabase, userId)` | `_data/fetchTenantDashboard.ts` | client, string | `TenantDashboardData \| null` | Service role → profile (+ fallback email) → lease_signers (par profile_id + email) → 18 queries (properties, owners, invoices, tickets, edl, meters, meter_readings, keys, insurance, notifications, charges, charges_base, kyc_status) → enrichissement lease + property |

### 3.4 Fonctions client — Tenant

| Fonction | Fichier | Rôle |
|----------|---------|------|
| `DashboardClient({ serverPendingEDLs })` | `DashboardClient.tsx` | 1059L monolithique : multi-lease selector, onboarding progress, activity feed, pendingActions, nextDueDate, credit score, consumption chart, DPE, AI tips, landlord contact |
| `useTenantData()` | `TenantDataProvider.tsx` | Hook context : dashboard, profile, refetch, updateDashboard (optimistic) |
| `useTenantRealtime(options)` | `use-realtime-tenant.ts` | 7 channels (leases, invoices, documents, tickets, signers, properties, edl) + reconnect auto |

### 3.5 Fonctions — Provider

| Fonction | Fichier | Rôle |
|----------|---------|------|
| `VendorLayout()` | `app/provider/layout.tsx` | Server : Auth + rôle → navigation 3 variantes → NO DataProvider |
| `ProviderDashboardPage()` | `app/provider/dashboard/page.tsx` | **Client** : useState/useEffect → fetch API → render inline |
| `loadDashboard(isRefresh)` | `page.tsx` | Client fetch `/api/provider/dashboard` → setData |
| `GET /api/provider/dashboard` | `route.ts` | Server : Auth → rôle → RPC `provider_dashboard` → fallback 2 queries (work_orders + reviews) → aggregations |
| `RatingStars({ rating })` | `page.tsx` | Render 5 étoiles (SVG lucide) |
| `useRealtimeProvider(options)` | `use-realtime-provider.ts` | 2 channels (work_orders, reviews) + newOrdersCount + reconnect |

### 3.6 Requêtes Supabase — Synthèse

| Dashboard | RPC principale | Fallback queries | Tables touchées | Realtime channels |
|-----------|---------------|------------------|-----------------|-------------------|
| Owner | `owner_dashboard(p_owner_id)` | 5 parallèles | properties, leases, invoices, tickets, edl | 8 |
| Tenant | `tenant_dashboard(p_tenant_user_id)` | 18 (12 parallèles + 6 séquentielles) | profiles, lease_signers, leases, properties, invoices, tickets, edl, edl_signatures, meters, meter_readings, documents, notifications, charges, tenant_charges_base, tenant_profiles | 7 |
| Provider | `provider_dashboard(p_user_id)` | 2 parallèles | work_orders, tickets, properties, provider_reviews, profiles | 2 |

---

## 4. Scorecards

### Critères d'évaluation

| # | Critère | Description |
|---|---------|-------------|
| 1 | Architecture | Pattern RSC, séparation server/client, data-flow |
| 2 | Sécurité | Auth, rôle, isolation données, CSRF, RLS |
| 3 | Performance | TTI, caching, lazy loading, bundle size |
| 4 | Accessibilité | ARIA, focus, reduced-motion, contrastes |
| 5 | Responsive | Mobile, tablet, desktop, safe-area |
| 6 | UX | États vides, loading, erreur, cohérence |
| 7 | Qualité code | TypeScript, tests, duplication, naming |
| 8 | Realtime | Channels, reconnection, toast, events |
| 9 | SOTA 2026 | Suspense, streaming, optimistic, edge |

### Scores

| Critère | Owner | Tenant | Provider | Commentaire |
|---------|:-----:|:------:|:--------:|-------------|
| Architecture | **8** | **7** | **4** | Owner exemplaire (RSC + Context + widgets). Tenant solide mais monolithique. Provider full client-side = anti-pattern Next.js. |
| Sécurité | **8** | **8** | **8** | 3 layouts vérifient auth + rôle. CSRF injecté. RLS active. Provider double-vérifie dans l'API route. |
| Performance | **7** | **5** | **5** | Owner : 4 dynamic imports, Promise.allSettled. Tenant : 0 lazy loading, 18 fallback queries. Provider : client fetch = TTI dégradé. |
| Accessibilité | **4** | **4** | **3** | Tous : quasi-absence d'ARIA sur les widgets. globals.css a focus-visible + reduced-motion mais non propagé aux composants framer-motion. |
| Responsive | **8** | **7** | **8** | Breakpoints custom modernes. Provider a 3 variantes nav (sidebar/rail/bottom). Safe-area supporté. |
| UX | **8** | **7** | **6** | Owner : widgets modulaires, états vides, actions urgentes. Tenant : onboarding + credit score mais monolithique. Provider : basique. |
| Qualité code | **7** | **5** | **6** | Owner bien typé. Tenant : 30+ `any`, 750L fallback. Provider : propre mais simple. Aucun test nulle part. |
| Realtime | **8** | **8** | **7** | Owner : 8 channels + events. Tenant : 7 channels + importance levels. Provider : 2 channels. Tous : auto-reconnect 30s. |
| SOTA 2026 | **6** | **6** | **4** | Pas de Suspense boundaries. Tenant a optimistic updates. Provider n'utilise pas les patterns modernes. |

| Dashboard | **Score global** |
|-----------|:----------------:|
| **Owner** | **7.1 / 10** |
| **Tenant** | **6.3 / 10** |
| **Provider** | **5.7 / 10** |

---

## 5. Findings détaillés

### Légende des sévérités

| Icône | Niveau | Signification |
|:-----:|--------|--------------|
| 🔴 | Critique | Bug actif ou dette technique bloquante |
| 🟠 | Haute | Problème impactant la performance/maintenabilité |
| 🟡 | Moyenne | Amélioration recommandée |
| 🔵 | Faible | Nice-to-have |

---

### DASH-001 🔴 Provider dashboard full client-side

**Catégorie** : Architecture
**Fichier** : `app/provider/dashboard/page.tsx:1` (`"use client"`)
**Problème** : Le dashboard Provider est entièrement rendu côté client. Les données sont fetchées via `useEffect` → `fetch("/api/provider/dashboard")`. Cela signifie :
- Aucun contenu HTML au premier rendu (le navigateur reçoit des skeletons)
- TTI dégradé vs les dashboards Owner/Tenant qui envoient des données pré-rendues
- Incohérence architecturale avec les 2 autres dashboards

**Recommandation** : Migrer vers le pattern Owner/Tenant :
1. Créer `ProviderDataProvider` (React Context)
2. Charger les données dans `layout.tsx` côté serveur
3. Convertir `page.tsx` en Server Component qui passe les données à un `DashboardClient.tsx`

**Effort** : M (1-2 jours)

---

### DASH-002 🟠 Triple auth check redondant

**Catégorie** : Architecture / Performance
**Fichiers** :
- `app/owner/layout.tsx:28` — `supabase.auth.getUser()`
- `app/owner/_data/fetchDashboard.ts:232` — `supabase.auth.getUser()`
- `app/owner/_data/fetchProperties.ts:36` — `supabase.auth.getUser()`
- `app/owner/_data/fetchContracts.ts:45` — `supabase.auth.getUser()`

**Problème** : Le layout vérifie déjà l'authentification et le rôle, puis chaque fonction fetch re-vérifie indépendamment. Cela génère **4 appels `auth.getUser()`** par chargement de page Owner.

**Recommandation** : Les fetch functions sont déjà appelées depuis le layout qui a vérifié l'auth. Passer le `user` vérifié en paramètre au lieu de re-fetch :
```typescript
// Avant
export async function fetchDashboard(ownerId: string) { ... auth.getUser() ... }
// Après
export async function fetchDashboard(ownerId: string, userId: string) { ... }
```

**Effort** : S (quelques heures)

---

### DASH-003 🟠 Tenant fallback : 18 requêtes massives

**Catégorie** : Architecture / Performance
**Fichier** : `app/tenant/_data/fetchTenantDashboard.ts:163-670`
**Problème** : La fonction `fetchTenantDashboardDirect` fait :
- 12 requêtes en parallèle (Promise.allSettled)
- Puis 1 requête séquentielle pour `meter_readings`
- Puis 1 requête séquentielle pour `tenant_profiles.kyc_status`
- Plus les requêtes initiales (profile, signers par profile_id, signers par email, leases, all_lease_signers)
- Total : **~18 requêtes** pour un seul chargement

Ce fallback de 750 lignes est déclenché quand la RPC échoue OU retourne 0 baux.

**Recommandation** :
1. Fiabiliser la RPC `tenant_dashboard` pour couvrir le cas email-match
2. Inclure credit-score et consumption dans la RPC
3. En fallback, grouper les requêtes en 3 batches max

**Effort** : L (3-5 jours)

---

### DASH-004 🟡 Owner layout auto-crée des entités à chaque load

**Catégorie** : Architecture
**Fichier** : `app/owner/layout.tsx:52-107`
**Problème** : À chaque chargement de page Owner, le layout :
1. Vérifie si `owner_profiles` existe → crée si absent
2. Vérifie si `legal_entities` active existe → crée si absente
3. Lie les propriétés orphelines à la nouvelle entité

Ces vérifications sont idempotentes (upsert-like) mais font 2-3 requêtes SELECT + potentiellement 1-2 INSERT à chaque navigation.

**Recommandation** : Déplacer cette logique dans un hook `useEffect` one-time côté client, ou dans un endpoint API appelé à l'inscription/première connexion uniquement. Pas à chaque page load.

**Effort** : S (quelques heures)

---

### DASH-005 🟡 `force-dynamic` partout — pas de caching

**Catégorie** : Performance
**Fichiers** : `app/owner/layout.tsx:1`, `app/tenant/layout.tsx:1`, `app/provider/layout.tsx:2`
**Problème** : `export const dynamic = "force-dynamic"` désactive toute mise en cache Next.js. Chaque visite re-fetch tout depuis Supabase.

**Recommandation** : Pour les données peu volatiles (propriétés, profil), utiliser `unstable_cache` ou `revalidate`. Les données temps réel (paiements, tickets) restent dynamiques.

**Effort** : M (1-2 jours)

---

### DASH-006 🔴 Zéro internationalisation

**Catégorie** : UX
**Fichiers** : Tous les composants dashboard
**Problème** : Tous les textes sont hardcodés en français. Pas de bibliothèque i18n. Les dates utilisent `formatDateShort` avec locale fr-FR implicite. Pas de gestion des fuseaux horaires (DOM-TOM).

**Recommandation** : Si le produit reste exclusivement francophone, documenter cette décision. Sinon, intégrer `next-intl` ou `react-i18next`.

**Effort** : XL (si migration i18n)

---

### DASH-007 🔴 Tenant DashboardClient : 1059 lignes monolithiques

**Catégorie** : UX / Qualité code
**Fichier** : `app/tenant/dashboard/DashboardClient.tsx`
**Problème** : Ce fichier contient :
- Multi-lease selector
- Onboarding progress calculator
- Credit score fetching + rendering
- Consumption chart fetching + rendering
- Activity feed composition (realtime + invoices + tickets)
- DPE energy display
- AI tip generator
- Landlord contact card
- Next due date calculator
- Deleted property alert
- Empty states multiples

Le dashboard Owner utilise ~13 widgets séparés dans `components/owner/dashboard/`. Le Tenant met tout inline.

**Recommandation** : Découper en 8-10 widgets :
- `TenantOnboardingWidget`
- `TenantNextDueWidget`
- `TenantFinancialStatusWidget`
- `TenantPropertyCard`
- `TenantActivityFeed`
- `TenantCreditWidget`
- `TenantConsumptionWidget`
- `TenantLandlordWidget`
- `TenantDPEWidget`
- `TenantAITipWidget`

**Effort** : L (3-5 jours)

---

### DASH-009 🟡 Empty states incohérents

**Catégorie** : UX
**Fichiers** :
- Owner : `components/ui/empty-state.tsx` (composant réutilisable avec icon + title + description + CTA)
- Tenant : inline dans DashboardClient (div + texte)
- Provider : inline (div + icon CheckCircle2 + texte)

**Recommandation** : Utiliser `EmptyState` component partout.

**Effort** : S

---

### DASH-012 🔴 Quasi-absence d'ARIA

**Catégorie** : Accessibilité
**Fichiers** : Tous les DashboardClient et widgets
**Problème** :
- Aucun `role="img"` sur les SVG (donut occupation, progress bars, rating stars)
- Aucun `aria-label` sur les liens "Voir tout"
- Aucun `aria-live` sur les compteurs animés (AnimatedCounter)
- Les badges de statut n'ont pas d'`aria-label` descriptif
- Les graphiques Recharts n'ont pas d'alternative textuelle

**Recommandation** :
1. `role="img" aria-label="..."` sur tous les SVG décoratifs/informatifs
2. `aria-label="Voir tous les tickets"` sur les liens génériques
3. `aria-live="polite"` sur les compteurs temps réel
4. `aria-label` sur les badges colorés (ne pas dépendre de la couleur seule)

**Effort** : M (1-2 jours)

---

### DASH-013 🟠 Animations sans useReducedMotion

**Catégorie** : Accessibilité
**Fichiers** :
- `app/owner/dashboard/DashboardClient.tsx:64-86` (containerVariants, itemVariants)
- `app/provider/dashboard/page.tsx:78-90` (mêmes variants)
- Tenant DashboardClient utilise aussi framer-motion

**Problème** : `globals.css` gère `prefers-reduced-motion` via CSS mais les animations framer-motion sont en JavaScript et ne sont pas affectées par les media queries CSS.

**Recommandation** : Utiliser `useReducedMotion()` de framer-motion :
```typescript
const shouldReduceMotion = useReducedMotion();
const variants = shouldReduceMotion ? {} : containerVariants;
```

`EmptyState` le fait déjà correctement — propager ce pattern.

**Effort** : S (quelques heures)

---

### DASH-015 🟡 Contrastes insuffisants dans les headers gradient

**Catégorie** : Accessibilité
**Fichiers** :
- Owner : `DashboardClient.tsx:347` — `text-slate-400` sur fond `from-slate-900`
- Provider : `page.tsx:256` — `text-white/60` sur fond gradient orange

**Problème** : `text-slate-400` (#94A3B8) sur `slate-900` (#0F172A) → ratio ~4.9:1 (passe AA normal mais échoue AAA). `text-white/60` (rgba 255,255,255,0.6) sur fond orange → ratio ~3.2:1 (échoue AA).

**Recommandation** : Remplacer `text-white/60` par `text-white/80` et `text-slate-400` par `text-slate-300`.

**Effort** : XS

---

### DASH-016 🟠 Tenant : aucun lazy loading

**Catégorie** : Performance
**Fichier** : `app/tenant/dashboard/DashboardClient.tsx`
**Problème** : Owner utilise 4 `next/dynamic` imports avec `ssr: false` pour les composants lourds (OwnerFinanceSummary, OwnerPortfolioByModule, OwnerRiskSection, ProfileCompletionCard). Tenant importe tout statiquement, y compris `CreditBuilderCard` et `ConsumptionChart`.

**Recommandation** : Appliquer `next/dynamic` sur CreditBuilderCard, ConsumptionChart, et les sections below-the-fold.

**Effort** : S

---

### DASH-018 🟡 Provider loading.tsx : spinner au lieu de skeleton

**Catégorie** : Performance / UX
**Fichier** : `app/provider/dashboard/loading.tsx`
**Problème** : Utilise `PageLoading` (simple spinner animé) au lieu d'un skeleton matching le layout final. Owner et Tenant utilisent des squelettes fidèles qui réduisent le Cumulative Layout Shift (CLS).

**Recommandation** : Créer un skeleton matching (header gradient + 4 stat cards + 2 colonnes).

**Effort** : S

---

### DASH-019 🟡 Incohérence UI : Card vs GlassCard

**Catégorie** : UI
**Fichiers** :
- Owner : `GlassCard` (glassmorphism backdrop-blur)
- Tenant : `GlassCard`
- Provider : `Card` shadcn classique pour les sections principales

**Recommandation** : Harmoniser en utilisant `GlassCard` partout ou faire un choix unique.

**Effort** : S

---

### DASH-021 🟡 Duplication KPI stats (Provider)

**Catégorie** : UI
**Fichier** : `app/provider/dashboard/page.tsx:254-274` (header) + `:278-329` (cards)
**Problème** : Les mêmes 4 KPI (interventions, en attente, CA, note) sont affichés dans le header gradient ET dans les cartes détaillées juste en-dessous.

**Recommandation** : Garder les stats dans le header (comme Owner) et remplacer les cards par des informations complémentaires (ex: completion rate chart, prochaines dates).

**Effort** : S

---

### DASH-027 🟠 4 patterns de client service-role

**Catégorie** : Architecture / Sécurité
**Fichiers** :
1. `lib/supabase/service-client.ts` → `getServiceClient()` — le pattern officiel singleton
2. `app/owner/_data/fetchProfileCompletion.ts:17` → `createServerClient(URL, KEY)` direct
3. `app/owner/_data/fetchContracts.ts:7` → `createServiceRoleClient()` importé de `@supabase/supabase-js`
4. `app/api/provider/dashboard/route.ts:9` → `createRouteHandlerClient()`

**Problème** : 4 façons différentes de créer un client avec le service role key. Si les env vars changent ou si un pattern oublie `autoRefreshToken: false`, on crée des fuites de mémoire.

**Recommandation** : Utiliser `getServiceClient()` partout. Supprimer les 3 autres patterns.

**Effort** : S (quelques heures)

---

### DASH-028 🔴 BUG : Realtime EDL vérifie des colonnes inexistantes

**Catégorie** : Architecture / Bug
**Fichier** : `lib/hooks/use-realtime-dashboard.ts:463-481`
**Code problématique** :
```typescript
// Ligne 463
if (oldEdl.statut !== "completed" && edl.statut === "completed" && !edl.owner_signed) {
// Ligne 473
if (!oldEdl.owner_signed && edl.owner_signed) {
```

**Problème** : Le code vérifie `edl.statut` et `edl.owner_signed`, mais :
- `fetchDashboard.ts:143` commente : *"colonnes correctes: `status` (pas `statut`)"*
- `fetchDashboard.ts:212` commente : *"Pas de colonne `owner_signed`"*

Les événements EDL realtime ne se déclenchent jamais car les conditions comparent des champs `undefined`.

**Recommandation** :
```typescript
// Corriger
if (oldEdl.status !== "completed" && edl.status === "completed") {
// Supprimer la vérification owner_signed ou utiliser edl_signatures
```

**Effort** : XS (correction immédiate)

---

### DASH-029 🟡 Provider sans DataProvider/Context

**Catégorie** : Architecture
**Fichier** : `app/provider/layout.tsx`
**Problème** : Contrairement à Owner (OwnerDataProvider) et Tenant (TenantDataProvider), le layout Provider ne fournit aucun Context. Les données ne sont pas partagées entre les pages `/provider/*`. Naviguer de `/provider/dashboard` à `/provider/jobs` puis revenir au dashboard re-fetch tout.

**Recommandation** : Créer `ProviderDataProvider` dans le layout, alimenté par le serveur.

**Effort** : M (1-2 jours)

---

### DASH-030 🟡 Tenant auto-retry race condition

**Catégorie** : Architecture
**Fichier** : `app/tenant/dashboard/DashboardClient.tsx:80-87`
```typescript
const [retried, setRetried] = useState(false);
useEffect(() => {
  if (!dashboard && !error && !isRefetching && !retried) {
    setRetried(true);
    const timer = setTimeout(() => refetch(), 1500);
    return () => clearTimeout(timer);
  }
}, [dashboard, error, isRefetching, retried, refetch]);
```

**Problème** : Ce workaround compense une race condition où le dashboard est null au premier rendu. Le `setTimeout(1500)` est un délai arbitraire.

**Recommandation** : Investiguer la cause racine (probablement le Context qui n'est pas hydraté immédiatement). Utiliser un pattern `isReady` dans le provider au lieu d'un retry aveugle.

**Effort** : S

---

### DASH-031 🟠 Realtime channels sans filtre côté serveur

**Catégorie** : Performance
**Fichier** : `lib/hooks/use-realtime-dashboard.ts:207-570`
**Problème** : Les 8 channels Owner écoutent les changements sur des tables entières sans filtre :
```typescript
supabase.channel(`payments:${ownerId}`)
  .on("postgres_changes", { event: "INSERT", schema: "public", table: "payments" }, ...)
```
Le filtre devrait être :
```typescript
.on("postgres_changes", { event: "INSERT", schema: "public", table: "payments", filter: `owner_id=eq.${ownerId}` }, ...)
```

Sans filtre, le serveur Supabase Realtime envoie TOUS les événements de la table au client, et le filtrage dépend uniquement des RLS policies.

**Recommandation** : Ajouter des filtres `filter: "column=eq.value"` à chaque channel.

**Effort** : S (quelques heures)

---

### DASH-032 🟡 Tenant : API calls client en plus du context

**Catégorie** : Performance
**Fichier** : `app/tenant/dashboard/DashboardClient.tsx:89-92`
**Problème** : Le DashboardClient fetch en plus du context :
- `GET /api/tenant/credit-score`
- `GET /api/tenant/consumption`

Ces données pourraient être incluses dans la RPC `tenant_dashboard` ou lazy-loaded via Suspense.

**Effort** : M

---

### DASH-033 🟠 30+ types `any` dans le fetch Tenant

**Catégorie** : Qualité code
**Fichier** : `app/tenant/_data/fetchTenantDashboard.ts`
**Problème** : Au moins 30 occurrences de `any` dans ce fichier de 754 lignes. Exemples :
- `let leases: any[] = []` (ligne 270)
- `.filter((sig: any) => ...)` (ligne 43 dans page.tsx, multiples dans fetch)
- `enrichedLeases.reduce((sum: number, l: any) => ...)` (ligne 666)

Owner est bien mieux typé avec des interfaces explicites.

**Recommandation** : Créer des interfaces strictes pour chaque type de donnée intermédiaire.

**Effort** : M (1-2 jours)

---

### DASH-034 🟡 Aucun test unitaire

**Catégorie** : Qualité code
**Fichiers** : Aucun `*.test.tsx` trouvé dans `app/*/dashboard/`, `features/*/dashboard/`, `components/owner/dashboard/`
**Problème** : Zéro test pour les dashboards. Les widgets Owner, le monolithe Tenant, et le Provider n'ont aucune couverture.

**Recommandation** : Ajouter au minimum :
- Tests de rendu pour chaque widget (état vide, normal, limites)
- Tests du calculateCompletionPercentage
- Tests des transformations de données

**Effort** : L (3-5 jours)

---

### DASH-035 🟡 eslint-disable pour react-hooks/exhaustive-deps

**Catégorie** : Qualité code
**Fichiers** :
- `use-realtime-dashboard.ts:105,191,602`
- `use-realtime-tenant.ts` (multiples)
- `use-realtime-provider.ts`

**Problème** : 4+ suppressions d'ESLint pour `exhaustive-deps`. Symptôme de dépendances instables (toast, addEvent). Le commentaire "FIX AUDIT 2026-02-16: Stabiliser toast dans un ref" montre que le problème est connu.

**Recommandation** : Stabiliser toutes les dépendances via `useRef` ou `useCallback` au lieu de supprimer les warnings.

**Effort** : S

---

### DASH-037 🟡 Middleware ne vérifie que le cookie

**Catégorie** : Sécurité
**Fichier** : `middleware.ts:90-95`
```typescript
const hasAuthCookie = allCookies.some(
  (c) => c.name.includes("auth-token") || c.name.startsWith("sb-")
);
```

**Problème** : Le middleware vérifie seulement la présence d'un cookie, pas sa validité. C'est par design (Edge runtime ne peut pas importer Supabase), mais ça signifie qu'un cookie expiré ou invalide permet d'atteindre les layouts avant d'être redirigé.

**Impact** : Faible — les layouts font la vraie vérification. Mais l'utilisateur voit un flash de chargement avant la redirection.

**Recommandation** : Acceptable tel quel. Documenter dans les ADR.

**Effort** : N/A

---

### DASH-038 🟡 fetchContracts crée son propre service client

**Catégorie** : Sécurité / Architecture
**Fichier** : `app/owner/_data/fetchContracts.ts:6-37`
```typescript
import { createClient as createServiceRoleClient } from "@supabase/supabase-js";
async function getElevatedClient() {
  return createServiceRoleClient<Database>(supabaseUrl, serviceRoleKey, ...);
}
```

**Problème** : Crée un client Supabase unique au lieu d'utiliser le singleton `getServiceClient()`. Même env vars mais pas de cache de connexion partagée.

**Recommandation** : Remplacer par `import { getServiceClient } from "@/lib/supabase/service-client"`.

**Effort** : XS

---

## 6. Matrice de priorisation

### Impact × Effort

```
                    EFFORT
           XS    S      M      L      XL
        ┌──────┬──────┬──────┬──────┬──────┐
  HIGH  │028   │002   │001   │003   │006   │
        │      │027   │012   │007   │      │
        │      │031   │      │      │      │
        ├──────┼──────┼──────┼──────┼──────┤
  MED   │015   │004   │005   │034   │      │
        │038   │013   │029   │      │      │
        │      │016   │032   │      │      │
        │      │030   │033   │      │      │
        │      │035   │      │      │      │
        ├──────┼──────┼──────┼──────┼──────┤
  LOW   │      │009   │022   │      │      │
        │      │018   │023   │      │      │
        │      │019   │025   │      │      │
        │      │021   │      │      │      │
        │      │036   │      │      │      │
        └──────┴──────┴──────┴──────┴──────┘
```

### Quick Wins (Impact élevé + Effort faible)

| Finding | Action | Effort |
|---------|--------|--------|
| DASH-028 | Corriger `edl.statut` → `edl.status`, supprimer `owner_signed` | XS |
| DASH-002 | Passer userId en paramètre aux fetch functions | S |
| DASH-027 | Remplacer les 3 patterns service-role par `getServiceClient()` | S |
| DASH-031 | Ajouter `filter` aux channels realtime | S |
| DASH-015 | Ajuster contrastes `text-white/60` → `text-white/80` | XS |
| DASH-038 | Remplacer le client custom dans fetchContracts | XS |

---

## 7. Roadmap 3 sprints

### Sprint 1 — Quick Wins & Bugs (1 semaine)

| # | Finding | Action | Effort |
|---|---------|--------|--------|
| 1 | DASH-028 | **Fix bug** : corriger les noms de colonnes EDL dans use-realtime-dashboard.ts | XS |
| 2 | DASH-027 | Unifier les 4 patterns service-role → getServiceClient() | S |
| 3 | DASH-038 | Migrer fetchContracts.ts vers getServiceClient() | XS |
| 4 | DASH-002 | Éliminer les auth checks redondants dans les fetch functions | S |
| 5 | DASH-031 | Ajouter des filtres aux channels realtime (owner_id, profile_id) | S |
| 6 | DASH-015 | Corriger les contrastes dans les headers gradient | XS |
| 7 | DASH-013 | Ajouter useReducedMotion() aux animations framer-motion | S |
| 8 | DASH-009 | Harmoniser les empty states avec le composant EmptyState | S |
| 9 | DASH-018 | Créer un skeleton matching pour Provider loading.tsx | S |
| 10 | DASH-019 | Harmoniser Card → GlassCard dans Provider | S |

**Résultat** : Bugs corrigés, performance realtime améliorée, cohérence UI de base.

### Sprint 2 — Architecture & Performance (2 semaines)

| # | Finding | Action | Effort |
|---|---------|--------|--------|
| 1 | DASH-001 | Migrer Provider vers pattern Server Component + DataProvider | M |
| 2 | DASH-029 | Créer ProviderDataProvider dans le layout | M |
| 3 | DASH-016 | Ajouter dynamic imports dans Tenant DashboardClient | S |
| 4 | DASH-004 | Déplacer auto-create owner_profiles vers onboarding/first-login | S |
| 5 | DASH-030 | Investiguer et corriger la race condition Tenant | S |
| 6 | DASH-005 | Implémenter unstable_cache pour données peu volatiles | M |
| 7 | DASH-012 | Audit ARIA complet + corrections (role, aria-label, aria-live) | M |
| 8 | DASH-021 | Supprimer la duplication KPI header/cards dans Provider | S |
| 9 | DASH-033 | Typer strictement fetchTenantDashboard.ts (éliminer any) | M |
| 10 | DASH-035 | Stabiliser les hooks realtime (éliminer eslint-disable) | S |

**Résultat** : Architecture cohérente entre les 3 dashboards, performance améliorée, accessibilité WCAG 2.1 AA.

### Sprint 3 — Refactoring & SOTA (2 semaines)

| # | Finding | Action | Effort |
|---|---------|--------|--------|
| 1 | DASH-007 | Décomposer Tenant DashboardClient en 8-10 widgets | L |
| 2 | DASH-003 | Optimiser/fiabiliser la RPC tenant_dashboard (inclure email-match) | L |
| 3 | DASH-032 | Inclure credit-score et consumption dans la RPC ou lazy-load | M |
| 4 | DASH-022 | Ajouter Suspense boundaries pour streaming SSR | M |
| 5 | DASH-023 | Implémenter optimistic updates dans Owner et Provider | M |
| 6 | DASH-034 | Écrire les premiers tests unitaires (widgets + transformations) | L |
| 7 | DASH-025 | Intégrer NotificationCenter dans les 3 dashboards | M |

**Résultat** : Code maintenable, tenant modulaire, streaming SSR, premiers tests.

---

## Annexe — Résumé des findings par sévérité

| Sévérité | Count | Findings |
|----------|:-----:|---------|
| 🔴 Critique | 5 | DASH-001, DASH-006, DASH-007, DASH-012, DASH-028 |
| 🟠 Haute | 9 | DASH-002, DASH-003, DASH-013, DASH-016, DASH-027, DASH-031, DASH-033 |
| 🟡 Moyenne | 18 | DASH-004, DASH-005, DASH-009, DASH-015, DASH-018, DASH-019, DASH-021, DASH-022, DASH-023, DASH-024, DASH-025, DASH-029, DASH-030, DASH-032, DASH-034, DASH-035, DASH-037, DASH-038 |
| 🔵 Faible | 3 | DASH-011, DASH-020, DASH-036 |
| **Total** | **35** | |

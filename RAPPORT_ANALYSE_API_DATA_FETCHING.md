# 🔍 RAPPORT D'ANALYSE COMPLÈTE - API & Data Fetching

**Date**: 2025-01-XX  
**Objectif**: Analyser l'intégralité du code API et du data-fetching pour identifier les problèmes majeurs

---

## 📊 RÉSUMÉ EXÉCUTIF

### Problèmes Critiques Identifiés

1. **❌ Aucune structure `/_data`** - Tous les fetchs sont dispersés dans les composants
2. **❌ 149 routes API** - Beaucoup trop de routes, beaucoup de duplication
3. **❌ 252+ appels Supabase directs** dans les composants et routes API
4. **❌ Client Components partout** - Très peu de Server Components
5. **❌ useEffect pour data-fetching** - Pattern obsolète et inefficace
6. **❌ Pas de RPC Supabase** - Aucune fonction batch pour réduire les appels
7. **❌ Pas de Layout Loader** - Chaque page refetch ses données
8. **❌ Doublons massifs** - Même logique répétée partout
9. **❌ Pas de Context Provider** - Données refetchées à chaque navigation
10. **❌ React Query mal utilisé** - Pas de staleTime optimisé, refetch inutiles

---

## 🔴 PROBLÈME 1 : ARCHITECTURE DISPERSÉE

### État Actuel

```
❌ Pas de dossier /_data
❌ Fetchs dans les composants UI
❌ Fetchs dans les modals
❌ Fetchs dans les steps du wizard
❌ Fetchs dans les tables
```

### Exemples Trouvés

**Composants avec fetch direct:**
- `app/blog/page.tsx` - useEffect + fetch
- `app/admin/overview/page.tsx` - useEffect + fetch API
- `app/admin/integrations/page.tsx` - useEffect + fetch
- `features/tickets/components/ticket-form.tsx` - useEffect + fetch leases
- `app/tickets/[id]/page.tsx` - useEffect + fetch ticket
- `app/work-orders/[id]/page.tsx` - useEffect + fetch work order

**Hooks avec fetch:**
- `lib/hooks/use-auth.ts` - fetch profile dans useEffect
- `lib/hooks/use-profile.ts` - fetch specialized profile dans useEffect
- `lib/hooks/use-properties.ts` - React Query mais appelle API route
- `lib/hooks/use-leases.ts` - React Query mais appelle service qui appelle API

### Impact

- **Performance**: Chaque composant fait son propre fetch
- **Duplication**: Même logique répétée 10+ fois
- **Maintenance**: Impossible de centraliser les optimisations
- **Cache**: Pas de cache partagé entre composants

---

## 🔴 PROBLÈME 2 : TROP DE ROUTES API (149 routes)

### Analyse des Routes API

**Routes redondantes identifiées:**

1. **Properties** - 15+ routes pour la même ressource
   - `/api/properties` (GET, POST)
   - `/api/properties/[id]` (GET, PUT, DELETE)
   - `/api/properties/[id]/documents`
   - `/api/properties/[id]/features`
   - `/api/properties/[id]/heating`
   - `/api/properties/[id]/inspections`
   - `/api/properties/[id]/invitations`
   - `/api/properties/[id]/meters`
   - `/api/properties/[id]/photos`
   - `/api/properties/[id]/rooms`
   - `/api/properties/[id]/share`
   - `/api/properties/[id]/submit`
   - `/api/properties/[id]/units`
   - `/api/properties/diagnostic`
   - `/api/properties/share/[token]`
   - `/api/properties/test`
   - `/api/properties/test-create`
   - `/api/properties/test-insert`

2. **Leases** - 20+ routes
   - `/api/leases` (GET, POST)
   - `/api/leases/[id]` (GET, PUT, DELETE)
   - `/api/leases/[id]/activate`
   - `/api/leases/[id]/autopay`
   - `/api/leases/[id]/deposit`
   - `/api/leases/[id]/documents`
   - `/api/leases/[id]/pay`
   - `/api/leases/[id]/payment-shares`
   - `/api/leases/[id]/receipts`
   - `/api/leases/[id]/rent-invoices`
   - `/api/leases/[id]/roommates`
   - `/api/leases/[id]/sign`
   - `/api/leases/[id]/signature-sessions`
   - `/api/leases/[id]/signers`
   - `/api/leases/[id]/summary`
   - `/api/leases/[id]/terminate`
   - `/api/leases/[id]/visale`

3. **Tickets** - 10+ routes
4. **Admin** - 30+ routes
5. **Documents** - 8+ routes
6. **Charges** - 5+ routes
7. **Invoices** - 5+ routes

### Problèmes

- **Overhead HTTP**: Chaque route = nouveau round-trip
- **Duplication logique**: Même code de validation/auth répété
- **Maintenance**: Impossible de maintenir 149 routes
- **Performance**: Trop de requêtes HTTP

### Solution Recommandée

**Fusionner en RPC Supabase:**
- `owner_dashboard(owner_id)` → retourne properties + leases + invoices + stats
- `property_details(property_id)` → retourne property + leases + tickets + documents
- `lease_summary(lease_id)` → retourne lease + signers + invoices + payments

**Réduire à ~20 routes API** uniquement pour:
- Mutations (POST/PUT/DELETE)
- Actions complexes (signatures, paiements)
- Webhooks externes

---

## 🔴 PROBLÈME 3 : APPELS SUPABASE DIRECTS PARTOUT

### Statistiques

- **252+ occurrences** de `createClient()` ou `supabase.from()` dans le code
- **149 routes API** qui font toutes des appels Supabase
- **Tous les composants** qui fetch directement

### Exemples Problématiques

**Dans les composants:**
```typescript
// app/blog/page.tsx
useEffect(() => {
  blogService.getPublishedPosts().then(setPosts);
}, []);

// app/admin/overview/page.tsx
useEffect(() => {
  fetch("/api/admin/overview").then(r => r.json()).then(setData);
}, []);
```

**Dans les routes API:**
```typescript
// app/api/properties/route.ts
const supabase = await createClient();
const { data } = await supabase.from("properties").select("*");
```

**Dans les services:**
```typescript
// features/admin/services/people.service.ts
const supabase = createClient();
const { data } = await supabase.from("profiles").select("*");
```

### Impact

- **Pas de cache serveur**: Chaque requête = DB query
- **Pas de batch**: 10 requêtes au lieu d'1 RPC
- **RLS overhead**: RLS évalué pour chaque requête séparément

---

## 🔴 PROBLÈME 4 : CLIENT COMPONENTS PARTOUT

### État Actuel

**Pages en Client Component:**
- `app/blog/page.tsx` - "use client"
- `app/admin/overview/page.tsx` - "use client"
- `app/admin/integrations/page.tsx` - "use client"
- `app/tickets/[id]/page.tsx` - "use client"
- `app/work-orders/[id]/page.tsx` - "use client"
- Et 50+ autres...

**Problème:**
```typescript
"use client";
export default function Page() {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetchData(); // ❌ Fetch côté client
  }, []);
  return <UI data={data} />;
}
```

**Devrait être:**
```typescript
// Server Component
export default async function Page() {
  const data = await fetchData(); // ✅ Fetch côté serveur
  return <UI data={data} />;
}
```

### Impact

- **Bundle size**: Tout le code JS envoyé au client
- **Performance**: Hydration lente, pas de streaming
- **SEO**: Contenu non indexable
- **First Load**: Plus lent car fetch côté client

---

## 🔴 PROBLÈME 5 : REACT QUERY MAL UTILISÉ

### Problèmes Identifiés

**Dans `lib/hooks/use-properties.ts`:**
```typescript
staleTime: 30 * 1000, // ❌ Trop court
gcTime: 5 * 60 * 1000, // ❌ Trop court
refetchOnWindowFocus: false, // ✅ Bon
```

**Dans `lib/hooks/use-leases.ts`:**
```typescript
staleTime: 30 * 1000, // ❌ Trop court
refetchInterval: false, // ✅ Bon
```

### Problèmes

1. **staleTime trop court** → Refetch trop souvent
2. **Pas de queryKey unifié** → Cache fragmenté
3. **Pas de prefetch** → Pas de préchargement
4. **Invalidation excessive** → Refetch inutiles

### Recommandations

```typescript
staleTime: 1000 * 60 * 5, // 5 minutes
gcTime: 1000 * 60 * 30, // 30 minutes
refetchOnWindowFocus: false,
refetchOnMount: false, // Si données déjà en cache
```

---

## 🔴 PROBLÈME 6 : PAS DE RPC SUPABASE

### État Actuel

**Aucune fonction RPC trouvée** pour batch les requêtes.

**Exemple actuel (mauvais):**
```typescript
// 5 requêtes séparées
const properties = await supabase.from("properties").select("*");
const leases = await supabase.from("leases").select("*");
const invoices = await supabase.from("invoices").select("*");
const tickets = await supabase.from("tickets").select("*");
const stats = await supabase.from("stats").select("*");
```

**Devrait être:**
```sql
CREATE FUNCTION owner_dashboard(owner_id uuid)
RETURNS jsonb AS $$
BEGIN
  RETURN jsonb_build_object(
    'properties', (SELECT jsonb_agg(p) FROM properties p WHERE p.owner_id = owner_dashboard.owner_id),
    'leases', (SELECT jsonb_agg(l) FROM leases l WHERE l.owner_id = owner_dashboard.owner_id),
    'invoices', (SELECT jsonb_agg(i) FROM invoices i WHERE i.owner_id = owner_dashboard.owner_id),
    'tickets', (SELECT jsonb_agg(t) FROM tickets t WHERE t.owner_id = owner_dashboard.owner_id),
    'stats', (SELECT jsonb_build_object(...) FROM ...)
  );
END;
$$ LANGUAGE plpgsql;
```

```typescript
// 1 seule requête
const { data } = await supabase.rpc("owner_dashboard", { owner_id });
```

### Impact

- **5x plus de requêtes** que nécessaire
- **5x plus de latence**
- **5x plus de charge DB**

---

## 🔴 PROBLÈME 7 : PAS DE LAYOUT LOADER

### État Actuel

**Chaque page fetch ses données:**
```typescript
// app/app/owner/dashboard/page.tsx
export default function Page() {
  useEffect(() => {
    fetchDashboard(); // ❌ Fetch à chaque visite
  }, []);
}

// app/app/owner/properties/page.tsx
export default function Page() {
  useEffect(() => {
    fetchProperties(); // ❌ Refetch même si déjà chargé
  }, []);
}
```

**Devrait être:**
```typescript
// app/app/owner/layout.tsx
export default async function Layout({ children }) {
  const [properties, dashboard] = await Promise.all([
    fetchProperties(),
    fetchDashboard(),
  ]);
  
  return (
    <OwnerDataProvider properties={properties} dashboard={dashboard}>
      {children}
    </OwnerDataProvider>
  );
}

// app/app/owner/dashboard/page.tsx
export default function Page() {
  const { dashboard } = useOwnerData(); // ✅ Données déjà chargées
  return <DashboardUI data={dashboard} />;
}
```

### Impact

- **Navigation lente**: Refetch à chaque changement de page
- **Expérience utilisateur**: Loading à chaque navigation
- **Ressources**: Requêtes inutiles

---

## 🔴 PROBLÈME 8 : DOUBLONS MASSIFS

### Exemples de Doublons

**1. Fetch Properties - Répété 10+ fois:**
- `lib/hooks/use-properties.ts`
- `features/properties/services/properties.service.ts`
- `app/api/properties/route.ts`
- `app/app/owner/properties/page.tsx`
- `app/properties/page.tsx`
- Etc.

**2. Fetch Profile - Répété 5+ fois:**
- `lib/hooks/use-auth.ts`
- `lib/hooks/use-profile.ts`
- `app/api/me/profile/route.ts`
- `features/profiles/services/profile.service.ts`
- Etc.

**3. Validation Auth - Répété dans chaque route API:**
```typescript
// Répété 149 fois dans chaque route
const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
```

### Impact

- **Code dupliqué**: Impossible à maintenir
- **Bugs**: Correction dans 1 endroit = oubli dans 9 autres
- **Taille**: Codebase gonflé

---

## 🔴 PROBLÈME 9 : PAS DE CONTEXT PROVIDER

### État Actuel

**Pas de Context pour partager les données:**
- Chaque composant fetch ses propres données
- Pas de propagation des données chargées
- Refetch à chaque navigation

**Devrait être:**
```typescript
// app/app/owner/layout.tsx
const OwnerDataContext = createContext();

export function OwnerDataProvider({ children, data }) {
  return (
    <OwnerDataContext.Provider value={data}>
      {children}
    </OwnerDataContext.Provider>
  );
}

// Composants enfants
export function useOwnerData() {
  return useContext(OwnerDataContext);
}
```

### Impact

- **Refetch inutiles**: Même données chargées plusieurs fois
- **Performance**: Latence à chaque navigation
- **UX**: Loading states partout

---

## 🔴 PROBLÈME 10 : OPTIMISATIONS SUPABASE MANQUANTES

### Indexes Manquants

**Colonnes souvent filtrées sans index:**
- `properties.owner_id` - Pas d'index trouvé
- `leases.owner_id` - Pas d'index trouvé
- `leases.tenant_id` - Pas d'index trouvé
- `invoices.lease_id` - Pas d'index trouvé
- `tickets.property_id` - Pas d'index trouvé

### RLS Non Optimisé

**RLS évalué pour chaque requête:**
- Pas de cache RLS
- Pas de batch RLS
- RLS récursif dans certains cas

### PostgREST Caching

**Pas de cache activé:**
- Pas de `Cache-Control` headers
- Pas de `ETag` support
- Pas de stale-while-revalidate

---

## 📈 MÉTRIQUES ESTIMÉES

### Avant Refonte

- **149 routes API** → Trop de routes
- **252+ appels Supabase** → Trop d'appels
- **~500ms par page** → Latence élevée
- **~10 requêtes par page** → Trop de requêtes
- **Bundle size**: ~500KB → Trop lourd
- **First Load**: ~2s → Trop lent

### Après Refonte (Objectif)

- **~20 routes API** → Réduction de 87%
- **~50 appels Supabase** → Réduction de 80%
- **~100ms par page** → Amélioration de 80%
- **~2 requêtes par page** → Réduction de 80%
- **Bundle size**: ~200KB → Réduction de 60%
- **First Load**: ~0.5s → Amélioration de 75%

---

## 🎯 PLAN D'ACTION RECOMMANDÉ

### Phase 1 : Structure `/_data` (Priorité 1)

1. Créer `/app/app/owner/_data/`
2. Créer `/app/app/tenant/_data/`
3. Créer `/app/admin/_data/`
4. Migrer tous les fetchs vers `/_data`

### Phase 2 : Server Components (Priorité 1)

1. Convertir toutes les pages en Server Components
2. Supprimer tous les `useEffect` pour data-fetching
3. Utiliser `async function Page()`

### Phase 3 : RPC Supabase (Priorité 2)

1. Créer `owner_dashboard(owner_id)`
2. Créer `property_details(property_id)`
3. Créer `lease_summary(lease_id)`
4. Créer autres RPC nécessaires

### Phase 4 : Layout Loader (Priorité 2)

1. Créer Context Providers
2. Charger données dans layouts
3. Propager via Context

### Phase 5 : Optimisations (Priorité 3)

1. Ajouter indexes Supabase
2. Optimiser RLS
3. Activer PostgREST caching
4. Configurer React Query staleTime

### Phase 6 : Nettoyage (Priorité 4)

1. Supprimer routes API inutilisées
2. Supprimer code mort
3. Supprimer doublons
4. Harmoniser conventions

---

## ✅ CONCLUSION

Le code actuel présente **10 problèmes majeurs** qui impactent:
- **Performance**: Latence élevée, trop de requêtes
- **Maintenabilité**: Code dupliqué, architecture dispersée
- **Expérience utilisateur**: Loading states partout, navigation lente
- **Coûts**: Trop de requêtes DB, overhead HTTP

**La refonte complète selon les règles SOTA 2025 est nécessaire et urgente.**

**Estimation**: 2-3 semaines de travail pour refonte complète.

---

**Prochaines étapes**: 
1. Valider ce rapport
2. Commencer Phase 1 (Structure `/_data`)
3. Itérer phase par phase


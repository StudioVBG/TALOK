# 🚀 PLAN DE REFONTE COMPLÈTE - Data Fetching SOTA 2025

**Date**: 2025-01-XX  
**Objectif**: Réécrire entièrement le code de data-fetching selon les standards SOTA 2025

---

## ✅ ÉTAPES DÉJÀ COMPLÉTÉES

### Phase 1 : Structure `/_data` (EN COURS)

- ✅ Créé `/app/owner/_data/`
- ✅ Créé `fetchProperties.ts`
- ✅ Créé `fetchDashboard.ts`
- ✅ Créé `fetchContracts.ts`
- ✅ Créé `OwnerDataProvider.tsx`
- ✅ Créé migration SQL pour RPC `owner_dashboard`

---

## 📋 PROCHAINES ÉTAPES

### Phase 1 : Structure `/_data` (À COMPLÉTER)

#### 1.1 Créer les fonctions de data-fetching manquantes

**Pour Owner:**
- [ ] `fetchInvoices.ts` - Factures
- [ ] `fetchTickets.ts` - Tickets
- [ ] `fetchDocuments.ts` - Documents
- [ ] `fetchProfile.ts` - Profil propriétaire

**Pour Tenant:**
- [ ] Créer `/app/tenant/_data/`
- [ ] `fetchTenantDashboard.ts`
- [ ] `fetchTenantLeases.ts`
- [ ] `fetchTenantInvoices.ts`
- [ ] `fetchTenantTickets.ts`

**Pour Admin:**
- [ ] Créer `/app/admin/_data/`
- [ ] `fetchAdminStats.ts`
- [ ] `fetchAdminPeople.ts`
- [ ] `fetchAdminProperties.ts`

#### 1.2 Créer les RPC Supabase manquantes

**Migration SQL à créer:**
- [ ] `tenant_dashboard(tenant_id)` - Dashboard locataire
- [ ] `admin_stats()` - Statistiques admin
- [ ] `property_details(property_id, owner_id)` - Détails propriété (déjà créée)

**Fichier:** `supabase/migrations/20250101000002_tenant_admin_rpc.sql`

---

### Phase 2 : Convertir les Layouts en Server Components

#### 2.1 Layout Owner

**Fichier:** `app/owner/layout.tsx`

**Avant (Client Component):**
```typescript
"use client";
export default function OwnerLayout({ children }) {
  return <OwnerAppLayout>{children}</OwnerAppLayout>;
}
```

**Après (Server Component):**
```typescript
import { fetchProperties, fetchDashboard } from "./_data";
import { OwnerDataProvider } from "./_data/OwnerDataProvider";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function OwnerLayout({ children }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect("/auth/signin");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.role !== "owner") {
    redirect("/dashboard");
  }

  // Charger toutes les données en parallèle
  const [properties, dashboard] = await Promise.all([
    fetchProperties(profile.id),
    fetchDashboard(profile.id),
  ]);

  return (
    <OwnerDataProvider properties={properties} dashboard={dashboard}>
      <OwnerAppLayout>{children}</OwnerAppLayout>
    </OwnerDataProvider>
  );
}
```

#### 2.2 Layout Tenant

**Fichier:** `app/tenant/layout.tsx` (à créer)

#### 2.3 Layout Admin

**Fichier:** `app/admin/layout.tsx` (à créer)

---

### Phase 3 : Convertir les Pages en Server Components

#### 3.1 Pages Owner

**Priorité 1:**
- [ ] `app/owner/dashboard/page.tsx`
- [ ] `app/owner/properties/page.tsx`
- [ ] `app/owner/leases/page.tsx`

**Priorité 2:**
- [ ] `app/owner/properties/[id]/page.tsx`
- [ ] `app/owner/leases/[id]/page.tsx`
- [ ] `app/owner/money/page.tsx`
- [ ] `app/owner/documents/page.tsx`

**Exemple de conversion:**

**Avant:**
```typescript
"use client";
export default function PropertiesPage() {
  const { data, isLoading } = useProperties();
  // ...
}
```

**Après:**
```typescript
import { fetchProperties } from "../_data";
import { useOwnerData } from "../_data/OwnerDataProvider";
import { PropertiesList } from "@/features/properties/components/properties-list";

export default async function PropertiesPage() {
  const { properties } = useOwnerData(); // Données déjà chargées dans layout
  
  return <PropertiesList properties={properties?.properties || []} />;
}
```

#### 3.2 Pages Tenant

- [ ] `app/tenant/page.tsx`
- [ ] `app/tenant/leases/page.tsx`
- [ ] `app/tenant/invoices/page.tsx`

#### 3.3 Pages Admin

- [ ] `app/admin/dashboard/page.tsx`
- [ ] `app/admin/overview/page.tsx`
- [ ] `app/admin/people/page.tsx`

---

### Phase 4 : Optimiser React Query (Client-side uniquement)

#### 4.1 Configurer React Query Provider

**Fichier:** `app/layout.tsx` ou `components/providers/query-provider.tsx`

```typescript
"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes
      refetchOnWindowFocus: false,
      refetchOnMount: false, // Si données déjà en cache
      retry: 1,
    },
  },
});

export function QueryProvider({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
```

#### 4.2 Mettre à jour les hooks React Query existants

**Fichiers à modifier:**
- [ ] `lib/hooks/use-properties.ts` - Augmenter staleTime à 5 min
- [ ] `lib/hooks/use-leases.ts` - Augmenter staleTime à 5 min
- [ ] `lib/hooks/use-dashboard.ts` - Augmenter staleTime à 5 min

**Changements:**
```typescript
staleTime: 1000 * 60 * 5, // 5 minutes (au lieu de 30s)
gcTime: 1000 * 60 * 30, // 30 minutes (au lieu de 5 min)
refetchOnWindowFocus: false,
refetchOnMount: false, // Nouveau
```

---

### Phase 5 : Nettoyer les Routes API

#### 5.1 Routes à supprimer (remplacées par Server Components)

**Routes GET simples:**
- [ ] `/api/properties` (GET) → Utiliser `fetchProperties` dans Server Component
- [ ] `/api/properties/[id]` (GET) → Utiliser `fetchProperty` dans Server Component
- [ ] `/api/leases` (GET) → Utiliser `fetchContracts` dans Server Component
- [ ] `/api/invoices` (GET) → Utiliser `fetchInvoices` dans Server Component
- [ ] `/api/tickets` (GET) → Utiliser `fetchTickets` dans Server Component
- [ ] `/api/owner/dashboard` (GET) → Utiliser `fetchDashboard` dans Server Component

**Total estimé:** ~30 routes GET à supprimer

#### 5.2 Routes à garder (mutations/actions)

**Routes POST/PUT/DELETE:**
- ✅ `/api/properties` (POST) - Création
- ✅ `/api/properties/[id]` (PUT, DELETE) - Modification/Suppression
- ✅ `/api/leases` (POST) - Création
- ✅ `/api/invoices` (POST) - Création
- ✅ `/api/tickets` (POST) - Création
- ✅ Routes de paiement, signatures, webhooks

**Total estimé:** ~20 routes à garder

#### 5.3 Routes à fusionner en RPC

**Routes multiples pour une même ressource:**
- [ ] `/api/properties/[id]/documents` + `/api/properties/[id]/tickets` + `/api/properties/[id]/leases`
  → Utiliser `property_details(property_id)` RPC

---

### Phase 6 : Optimisations Supabase

#### 6.1 Indexes manquants

**Migration SQL à créer:** `supabase/migrations/20250101000003_indexes.sql`

```sql
-- Indexes pour optimiser les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_properties_owner_id ON properties(owner_id);
CREATE INDEX IF NOT EXISTS idx_properties_statut ON properties(statut);
CREATE INDEX IF NOT EXISTS idx_leases_property_id ON leases(property_id);
CREATE INDEX IF NOT EXISTS idx_leases_owner_id ON leases(owner_id);
CREATE INDEX IF NOT EXISTS idx_leases_tenant_id ON leases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leases_statut ON leases(statut);
CREATE INDEX IF NOT EXISTS idx_invoices_lease_id ON invoices(lease_id);
CREATE INDEX IF NOT EXISTS idx_invoices_owner_id ON invoices(owner_id);
CREATE INDEX IF NOT EXISTS idx_invoices_statut ON invoices(statut);
CREATE INDEX IF NOT EXISTS idx_tickets_property_id ON tickets(property_id);
CREATE INDEX IF NOT EXISTS idx_tickets_statut ON tickets(statut);
```

#### 6.2 Activer PostgREST Caching

**Configuration Supabase:**
- [ ] Activer `Cache-Control` headers
- [ ] Configurer `ETag` support
- [ ] Activer `stale-while-revalidate`

**Documentation:** Voir `docs/optimisations-supabase.md`

---

### Phase 7 : Nettoyage du Code

#### 7.1 Supprimer le code mort

**Fichiers à supprimer:**
- [ ] Hooks inutilisés dans `lib/hooks/`
- [ ] Services dupliqués dans `features/*/services/`
- [ ] Composants non utilisés

#### 7.2 Supprimer les doublons

**Fonctions dupliquées:**
- [ ] `fetchProperties` répété 10+ fois → Unifier dans `/_data`
- [ ] `fetchProfile` répété 5+ fois → Unifier dans `/_data`
- [ ] Validation auth répétée 149 fois → Créer helper `getAuthenticatedUser()`

#### 7.3 Harmoniser les conventions

**À standardiser:**
- [ ] Noms de fichiers (kebab-case vs camelCase)
- [ ] Structure des imports
- [ ] Gestion d'erreurs
- [ ] Types TypeScript

---

## 📊 MÉTRIQUES DE SUCCÈS

### Objectifs de Performance

- ✅ **Réduction des routes API**: 149 → ~20 (87% de réduction)
- ✅ **Réduction des appels Supabase**: 252+ → ~50 (80% de réduction)
- ✅ **Latence par page**: 500ms → 100ms (80% d'amélioration)
- ✅ **Requêtes par page**: 10 → 2 (80% de réduction)
- ✅ **Bundle size**: 500KB → 200KB (60% de réduction)
- ✅ **First Load**: 2s → 0.5s (75% d'amélioration)

### Objectifs de Code

- ✅ **100% des fetchs** dans `/_data`
- ✅ **0 fetch** dans les composants UI
- ✅ **0 useEffect** pour data-fetching
- ✅ **100% Server Components** pour les pages
- ✅ **React Query** uniquement pour client-side nécessaire

---

## 🎯 ORDRE D'EXÉCUTION RECOMMANDÉ

1. **Semaine 1**: Phase 1 (Structure `/_data`) + Phase 2 (Layouts)
2. **Semaine 2**: Phase 3 (Pages Owner) + Phase 4 (React Query)
3. **Semaine 3**: Phase 5 (Nettoyage API) + Phase 6 (Optimisations)
4. **Semaine 4**: Phase 7 (Nettoyage) + Tests + Documentation

---

## 📝 NOTES IMPORTANTES

### Migration Progressive

- Ne pas tout refaire d'un coup
- Tester chaque phase avant de passer à la suivante
- Garder l'ancien code en commentaire pendant la transition
- Créer des branches Git pour chaque phase

### Rétrocompatibilité

- Les routes API existantes doivent continuer à fonctionner pendant la transition
- Ajouter des logs pour identifier les routes encore utilisées
- Supprimer progressivement après validation

### Tests

- Tester chaque fonction `/_data` individuellement
- Tester les Server Components avec des données réelles
- Tester les performances avant/après

---

## ✅ CHECKLIST FINALE

Avant de considérer la refonte comme terminée:

- [ ] Toutes les pages converties en Server Components
- [ ] Toutes les données chargées dans les layouts
- [ ] Toutes les RPC Supabase créées et testées
- [ ] Toutes les routes API inutilisées supprimées
- [ ] Tous les indexes Supabase créés
- [ ] React Query optimisé (staleTime 5 min)
- [ ] Code mort supprimé
- [ ] Doublons supprimés
- [ ] Tests passent
- [ ] Documentation à jour
- [ ] Métriques de performance atteintes

---

**Prochaine étape immédiate**: Compléter la Phase 1 en créant les fonctions `/_data` manquantes.


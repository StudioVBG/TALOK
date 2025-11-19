# Guide de connexion MCP Supabase → Frontend

**Date** : 2025-02-15  
**Statut** : ✅ Système de connexion automatique BDD → Types → Frontend opérationnel

---

## 🎯 Objectif

Utiliser toutes les potentialités du MCP Supabase pour connecter automatiquement toute l'application entre la base de données et le frontend sur toutes les pages, toutes les charts, tous les components.

---

## 📊 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    SUPABASE DATABASE                        │
│  (PostgreSQL avec RLS, Functions, Views, Triggers)         │
└───────────────────────┬───────────────────────────────────┘
                         │
                         │ MCP Supabase Tools
                         │ - generate_typescript_types
                         │ - list_tables
                         │ - execute_sql
                         │ - get_advisors
                         │
┌────────────────────────▼───────────────────────────────────┐
│          lib/supabase/database.types.ts                    │
│  Types TypeScript générés automatiquement depuis BDD      │
│  - Database (structure complète)                           │
│  - Tables<"table_name"> (Row, Insert, Update)            │
│  - Views, Functions, Enums                                │
└───────────────────────┬───────────────────────────────────┘
                         │
                         │ Type-safe client
                         │
┌────────────────────────▼───────────────────────────────────┐
│          lib/supabase/typed-client.ts                       │
│  Client Supabase typé avec Database                        │
│  - typedSupabaseClient (frontend)                          │
│  - createTypedServiceClient() (backend)                    │
│  - Type helpers (PropertyRow, PropertyInsert, etc.)        │
└───────────────────────┬───────────────────────────────────┘
                         │
                         │ React Query hooks
                         │
┌────────────────────────▼───────────────────────────────────┐
│          lib/hooks/use-*.ts                                 │
│  Hooks React Query type-safe pour chaque entité            │
│  - useProperties()                                         │
│  - useLeases()                                             │
│  - useInvoices()                                           │
│  - useTickets()                                            │
│  - ... (extensible)                                       │
└───────────────────────┬───────────────────────────────────┘
                         │
                         │ Components & Pages
                         │
┌────────────────────────▼───────────────────────────────────┐
│          app/**/*.tsx                                       │
│  Toutes les pages et composants                            │
│  - Dashboard owner                                         │
│  - Liste des propriétés                                    │
│  - Charts & visualisations                                 │
│  - Forms & wizards                                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 Outils MCP Supabase utilisés

### 1. Génération des types TypeScript

```typescript
// Via MCP : mcp_supabase_generate_typescript_types
// Résultat : lib/supabase/database.types.ts
```

**Avantages** :
- ✅ Types toujours synchronisés avec la BDD
- ✅ Auto-complétion complète dans l'IDE
- ✅ Détection d'erreurs à la compilation
- ✅ Refactoring sûr

### 2. Liste des tables et structure

```typescript
// Via MCP : mcp_supabase_list_tables
// Permet de comprendre la structure complète de la BDD
```

**Utilisation** :
- Vérifier les colonnes disponibles
- Comprendre les relations
- Identifier les tables manquantes

### 3. Exécution SQL directe

```typescript
// Via MCP : mcp_supabase_execute_sql
// Permet de vérifier la structure réelle de la BDD
```

**Exemple** :
```sql
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'properties'
```

### 4. Conseils de sécurité et performance

```typescript
// Via MCP : mcp_supabase_get_advisors
// Identifie automatiquement :
// - Tables sans RLS policies
// - Fonctions avec search_path mutable
// - Vues SECURITY DEFINER
// - Problèmes de performance
```

**Problèmes identifiés** :
- ⚠️ Tables sans RLS : `charges`, `documents`, `invoices`, `payments`, `tickets`, `units`, `work_orders`
- ⚠️ Tables publiques sans RLS : `tenants`, `lease_templates`
- ⚠️ Vues SECURITY DEFINER : `payment_shares_public`, `v_portfolio_age_buckets`, `v_person_age`
- ⚠️ Fonctions avec search_path mutable : 15 fonctions

---

## 📁 Fichiers créés

### 1. Types générés

**`lib/supabase/database.types.ts`**
- Types complets générés depuis la BDD
- Structure Database avec Tables, Views, Functions, Enums
- Helpers Types : `Tables<"table_name">`, `TablesInsert<"table_name">`, `TablesUpdate<"table_name">`

### 2. Client typé

**`lib/supabase/typed-client.ts`**
- `typedSupabaseClient` : Client frontend typé
- `createTypedServiceClient()` : Client backend avec service role
- Type helpers : `PropertyRow`, `PropertyInsert`, `PropertyUpdate`, etc.

### 3. Hooks React Query

**`lib/hooks/use-properties.ts`**
- `useProperties()` : Liste des propriétés avec filtrage par rôle
- `useProperty(id)` : Détails d'une propriété
- `useCreateProperty()` : Création
- `useUpdateProperty()` : Mise à jour
- `useDeleteProperty()` : Suppression

**`lib/hooks/use-leases.ts`**
- `useLeases(propertyId?)` : Liste des baux
- `useLease(id)` : Détails d'un bail
- `useCreateLease()` : Création
- `useUpdateLease()` : Mise à jour

**`lib/hooks/use-invoices.ts`**
- `useInvoices(leaseId?)` : Liste des factures
- `useInvoice(id)` : Détails d'une facture
- `useCreateInvoice()` : Création
- `useUpdateInvoice()` : Mise à jour

**`lib/hooks/use-tickets.ts`**
- `useTickets(propertyId?)` : Liste des tickets
- `useTicket(id)` : Détails d'un ticket
- `useCreateTicket()` : Création
- `useUpdateTicket()` : Mise à jour

**`lib/hooks/index.ts`**
- Export centralisé de tous les hooks

---

## 🚀 Utilisation dans les composants

### Exemple : Dashboard Owner

```typescript
"use client";

import { useProperties, useLeases, useInvoices } from "@/lib/hooks";

export function OwnerDashboard() {
  // Récupération automatique avec filtrage par rôle
  const { data: properties, isLoading } = useProperties();
  const { data: leases } = useLeases();
  const { data: invoices } = useInvoices();
  
  // Les données sont automatiquement typées selon la BDD
  // properties: PropertyRow[]
  // leases: LeaseRow[]
  // invoices: InvoiceRow[]
  
  if (isLoading) return <div>Chargement...</div>;
  
  return (
    <div>
      <h1>Mes logements ({properties?.length})</h1>
      {/* Utilisation type-safe */}
    </div>
  );
}
```

### Exemple : Liste des propriétés

```typescript
"use client";

import { useProperties, useDeleteProperty } from "@/lib/hooks";
import { useToast } from "@/components/ui/use-toast";

export function PropertiesList() {
  const { data: properties, isLoading } = useProperties();
  const deleteProperty = useDeleteProperty();
  const { toast } = useToast();
  
  const handleDelete = async (id: string) => {
    try {
      await deleteProperty.mutateAsync(id);
      toast({ title: "Logement supprimé" });
    } catch (error) {
      toast({ title: "Erreur", variant: "destructive" });
    }
  };
  
  return (
    <div>
      {properties?.map((property) => (
        <PropertyCard 
          key={property.id} 
          property={property}
          onDelete={() => handleDelete(property.id)}
        />
      ))}
    </div>
  );
}
```

### Exemple : Charts avec données réelles

```typescript
"use client";

import { useInvoices } from "@/lib/hooks";
import { LineChart, Line, XAxis, YAxis, Tooltip } from "recharts";

export function RevenueChart() {
  const { data: invoices } = useInvoices();
  
  // Transformer les données pour le chart
  const chartData = useMemo(() => {
    if (!invoices) return [];
    
    return invoices
      .filter((inv) => inv.statut === "paid")
      .map((inv) => ({
        periode: inv.periode,
        montant: Number(inv.montant_total),
      }))
      .sort((a, b) => a.periode.localeCompare(b.periode));
  }, [invoices]);
  
  return (
    <LineChart data={chartData}>
      <XAxis dataKey="periode" />
      <YAxis />
      <Tooltip />
      <Line type="monotone" dataKey="montant" stroke="#8884d8" />
    </LineChart>
  );
}
```

---

## 🔄 Synchronisation automatique

### Régénération des types

**Quand** : Après chaque migration BDD

**Comment** :
1. Utiliser l'outil MCP : `mcp_supabase_generate_typescript_types`
2. Copier le résultat dans `lib/supabase/database.types.ts`
3. Les types sont automatiquement propagés via `typed-client.ts` → hooks → components

### Avantages

- ✅ **Type-safety** : Erreurs détectées à la compilation
- ✅ **Auto-complétion** : IDE suggère automatiquement les colonnes disponibles
- ✅ **Refactoring sûr** : Renommer une colonne dans la BDD → erreurs TypeScript partout
- ✅ **Documentation vivante** : Les types servent de documentation à jour

---

## 📈 Prochaines étapes

### 1. Intégrer dans tous les composants

- [ ] Dashboard owner → Utiliser `useProperties()`, `useInvoices()`, `useLeases()`
- [ ] Liste des propriétés → Utiliser `useProperties()`
- [ ] Détails d'une propriété → Utiliser `useProperty(id)`
- [ ] Charts → Utiliser les hooks pour les données réelles
- [ ] Forms → Utiliser les mutations pour créer/mettre à jour

### 2. Créer des hooks supplémentaires

- [ ] `useRooms(propertyId)` : Pièces d'une propriété
- [ ] `usePhotos(propertyId, roomId?)` : Photos
- [ ] `usePayments(invoiceId?)` : Paiements
- [ ] `useWorkOrders(ticketId?)` : Ordres de travail
- [ ] `useDocuments(propertyId?, leaseId?)` : Documents

### 3. Corriger les problèmes de sécurité identifiés

- [ ] Ajouter des RLS policies pour les tables sans policies
- [ ] Corriger les fonctions avec search_path mutable
- [ ] Réviser les vues SECURITY DEFINER

### 4. Optimisations

- [ ] Ajouter des `select()` spécifiques pour réduire la taille des requêtes
- [ ] Utiliser `useInfiniteQuery` pour la pagination
- [ ] Ajouter du cache avec `staleTime` et `cacheTime`
- [ ] Implémenter l'optimistic updates

---

## 🎉 Résultat

**Avant** :
- Types manuels, souvent désynchronisés avec la BDD
- Pas de type-safety dans les requêtes Supabase
- Erreurs détectées à l'exécution
- Refactoring risqué

**Après** :
- ✅ Types générés automatiquement depuis la BDD
- ✅ Type-safety complète dans toutes les requêtes
- ✅ Erreurs détectées à la compilation
- ✅ Refactoring sûr et automatisé
- ✅ Auto-complétion dans tout le code
- ✅ Documentation vivante via les types

---

**Guide créé le** : 2025-02-15


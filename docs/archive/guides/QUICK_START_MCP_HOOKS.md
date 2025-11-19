# Guide rapide : Utiliser les hooks MCP dans vos composants

**Date** : 2025-02-15

---

## 🚀 Démarrage rapide

### 1. Importer les hooks

```typescript
import { useProperties, useLeases, useInvoices, useTickets } from "@/lib/hooks";
```

### 2. Utiliser dans votre composant

```typescript
"use client";

export function MyComponent() {
  // Récupération automatique avec filtrage par rôle
  const { data: properties, isLoading, error } = useProperties();
  const { data: leases } = useLeases();
  const { data: invoices } = useInvoices();
  
  if (isLoading) return <div>Chargement...</div>;
  if (error) return <div>Erreur : {error.message}</div>;
  
  return (
    <div>
      <h1>Mes logements ({properties?.length})</h1>
      {/* Les données sont automatiquement typées ! */}
    </div>
  );
}
```

---

## 📊 Hooks disponibles

### Propriétés

```typescript
// Liste de toutes les propriétés (filtrée par rôle automatiquement)
const { data: properties, isLoading } = useProperties();

// Détails d'une propriété
const { data: property } = useProperty(propertyId);

// Créer une propriété
const createProperty = useCreateProperty();
await createProperty.mutateAsync({
  type: "appartement",
  adresse_complete: "123 Rue Example",
  // ... autres champs
});

// Mettre à jour
const updateProperty = useUpdateProperty();
await updateProperty.mutateAsync({
  id: propertyId,
  data: { adresse_complete: "Nouvelle adresse" }
});

// Supprimer
const deleteProperty = useDeleteProperty();
await deleteProperty.mutateAsync(propertyId);
```

### Baux

```typescript
// Liste des baux (optionnel : filtrer par propriété)
const { data: leases } = useLeases(propertyId);

// Détails d'un bail
const { data: lease } = useLease(leaseId);

// Créer un bail
const createLease = useCreateLease();
await createLease.mutateAsync({
  property_id: propertyId,
  type_bail: "nu",
  loyer: 1000,
  // ...
});

// Mettre à jour
const updateLease = useUpdateLease();
await updateLease.mutateAsync({
  id: leaseId,
  data: { loyer: 1100 }
});
```

### Factures

```typescript
// Liste des factures (optionnel : filtrer par bail)
const { data: invoices } = useInvoices(leaseId);

// Détails d'une facture
const { data: invoice } = useInvoice(invoiceId);

// Créer une facture
const createInvoice = useCreateInvoice();
await createInvoice.mutateAsync({
  lease_id: leaseId,
  tenant_id: tenantId,
  periode: "2025-01",
  montant_loyer: 1000,
  montant_total: 1200,
  // ...
});
```

### Tickets

```typescript
// Liste des tickets (optionnel : filtrer par propriété)
const { data: tickets } = useTickets(propertyId);

// Détails d'un ticket
const { data: ticket } = useTicket(ticketId);

// Créer un ticket
const createTicket = useCreateTicket();
await createTicket.mutateAsync({
  property_id: propertyId,
  titre: "Fuite d'eau",
  description: "Fuite dans la salle de bain",
  priorite: "haute",
  // ...
});
```

---

## 📈 Exemple : Dashboard avec données réelles

```typescript
"use client";

import { useProperties, useInvoices, useLeases } from "@/lib/hooks";
import { LineChart, Line, XAxis, YAxis, Tooltip } from "recharts";
import { useMemo } from "react";

export function OwnerDashboard() {
  const { data: properties, isLoading: loadingProperties } = useProperties();
  const { data: invoices, isLoading: loadingInvoices } = useInvoices();
  const { data: leases, isLoading: loadingLeases } = useLeases();
  
  // Calculer les KPIs depuis les données réelles
  const kpis = useMemo(() => {
    if (!invoices || !leases || !properties) return null;
    
    const totalCollected = invoices
      .filter((inv) => inv.statut === "paid")
      .reduce((sum, inv) => sum + Number(inv.montant_total), 0);
    
    const totalExpected = invoices
      .reduce((sum, inv) => sum + Number(inv.montant_total), 0);
    
    const activeLeases = leases.filter((l) => l.statut === "active").length;
    const totalProperties = properties.length;
    const occupancyRate = totalProperties > 0 ? activeLeases / totalProperties : 0;
    
    return {
      collected: totalCollected,
      expected: totalExpected,
      occupancyRate,
      activeLeases,
      totalProperties,
    };
  }, [invoices, leases, properties]);
  
  // Données pour le chart
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
  
  if (loadingProperties || loadingInvoices || loadingLeases) {
    return <div>Chargement...</div>;
  }
  
  if (!kpis) return null;
  
  return (
    <div>
      <h1>Tableau de bord</h1>
      
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardTitle>Encaissements</CardTitle>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.collected.toFixed(2)} €</div>
            <div className="text-sm text-muted-foreground">
              Sur {kpis.expected.toFixed(2)} € attendus
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardTitle>Taux d'occupation</CardTitle>
          <CardContent>
            <div className="text-2xl font-bold">{(kpis.occupancyRate * 100).toFixed(1)}%</div>
            <div className="text-sm text-muted-foreground">
              {kpis.activeLeases} baux actifs / {kpis.totalProperties} logements
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Chart */}
      <Card>
        <CardTitle>Évolution des encaissements</CardTitle>
        <CardContent>
          <LineChart data={chartData} width={600} height={300}>
            <XAxis dataKey="periode" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="montant" stroke="#8884d8" />
          </LineChart>
        </CardContent>
      </Card>
      
      {/* Liste des propriétés */}
      <div>
        <h2>Mes logements</h2>
        {properties?.map((property) => (
          <PropertyCard key={property.id} property={property} />
        ))}
      </div>
    </div>
  );
}
```

---

## 🎯 Avantages

### Type-safety complète

```typescript
// ✅ Auto-complétion pour toutes les colonnes
const property = properties?.[0];
property?.adresse_complete; // ✅ TypeScript connaît ce champ
property?.surface; // ✅ TypeScript connaît ce champ
property?.invalidField; // ❌ Erreur TypeScript immédiate
```

### Filtrage automatique par rôle

```typescript
// Les hooks filtrent automatiquement selon le rôle de l'utilisateur
// - Owner : voit ses propriétés
// - Tenant : voit les propriétés où il a un bail actif
// - Admin : voit tout
const { data: properties } = useProperties();
// Pas besoin de filtrer manuellement !
```

### Cache automatique

```typescript
// React Query gère automatiquement le cache
// - Les données sont mises en cache
// - Invalidation automatique après mutations
// - Refetch intelligent
const { data } = useProperties();
// Les données sont réutilisées entre les composants !
```

### Optimistic updates (à venir)

```typescript
// Les mutations peuvent être optimistes
const updateProperty = useUpdateProperty();
updateProperty.mutate(
  { id, data },
  {
    onMutate: async (newData) => {
      // Mettre à jour le cache immédiatement
      await queryClient.cancelQueries({ queryKey: ["properties"] });
      const previous = queryClient.getQueryData(["properties"]);
      queryClient.setQueryData(["properties"], (old) => {
        // Mise à jour optimiste
      });
      return { previous };
    },
    onError: (err, newData, context) => {
      // Rollback en cas d'erreur
      queryClient.setQueryData(["properties"], context.previous);
    },
  }
);
```

---

## 🔄 Synchronisation avec la BDD

### Régénérer les types après une migration

1. Utiliser l'outil MCP : `mcp_supabase_generate_typescript_types`
2. Copier le résultat dans `lib/supabase/database.types.ts`
3. Les types sont automatiquement propagés partout !

### Vérifier la structure de la BDD

```typescript
// Via MCP : mcp_supabase_list_tables
// Permet de voir toutes les tables et leurs colonnes
```

### Exécuter du SQL directement

```typescript
// Via MCP : mcp_supabase_execute_sql
// Permet de vérifier ou modifier la BDD directement
```

---

## 📚 Documentation complète

- **Guide complet** : `MCP_CONNECTION_GUIDE.md`
- **Résumé d'intégration** : `MCP_INTEGRATION_SUMMARY.md`

---

**Guide créé le** : 2025-02-15


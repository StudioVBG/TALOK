# 📚 Exemples d'Utilisation des Nouveaux Composants

## Date : 2025-01-XX

## 🎯 Guide d'utilisation des améliorations

### 1. **useMutationWithToast** - Mutations avec notifications automatiques

#### Exemple : Supprimer une propriété

```tsx
import { useMutationWithToast } from "@/lib/hooks/use-mutation-with-toast";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/lib/hooks/use-auth";

function PropertyDeleteButton({ propertyId }: { propertyId: string }) {
  const { profile } = useAuth();
  
  const deleteProperty = useMutationWithToast({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/properties/${id}`);
    },
    successMessage: "Bien supprimé avec succès",
    errorMessage: "Impossible de supprimer le bien",
    invalidateQueries: ["properties"],
    optimisticUpdate: {
      queryKey: ["properties", profile?.id],
      updateFn: (old: any[], id: string) => old?.filter((p) => p.id !== id) ?? [],
    },
    onSuccess: () => {
      router.push("/owner/properties");
    },
  });

  return (
    <Button
      onClick={() => deleteProperty.mutate(propertyId)}
      disabled={deleteProperty.isPending}
    >
      {deleteProperty.isPending ? "Suppression..." : "Supprimer"}
    </Button>
  );
}
```

#### Exemple : Créer une facture

```tsx
const createInvoice = useMutationWithToast({
  mutationFn: (data: InvoiceData) => apiClient.post("/invoices", data),
  successMessage: "Facture créée avec succès",
  errorMessage: "Impossible de créer la facture",
  invalidateQueries: ["invoices", "dashboard"],
});
```

---

### 2. **ConfirmDialog** - Dialogue de confirmation

#### Exemple : Suppression avec confirmation

```tsx
import { useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";

function DeletePropertyButton({ propertyId }: { propertyId: string }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const deleteProperty = useMutationWithToast({ /* ... */ });

  return (
    <>
      <Button
        variant="destructive"
        onClick={() => setDialogOpen(true)}
      >
        Supprimer
      </Button>

      <ConfirmDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Supprimer ce bien ?"
        description="Cette action est irréversible. Le bien et toutes ses données seront supprimés."
        onConfirm={() => deleteProperty.mutate(propertyId)}
        variant="destructive"
        loading={deleteProperty.isPending}
        confirmText="Supprimer définitivement"
        cancelText="Annuler"
      />
    </>
  );
}
```

#### Exemple : Confirmation pour action non-destructive

```tsx
<ConfirmDialog
  open={isOpen}
  onOpenChange={setIsOpen}
  title="Terminer ce bail ?"
  description="Le bail sera marqué comme terminé. Vous pourrez toujours le consulter dans l'historique."
  onConfirm={handleTerminateLease}
  variant="default"
  confirmText="Terminer le bail"
/>
```

---

### 3. **useDashboard** - Hook React Query pour le dashboard

#### Exemple : Utilisation dans une page

```tsx
import { useDashboard } from "@/lib/hooks/use-dashboard";

function DashboardPage() {
  const { data, isLoading, error, refetch } = useDashboard();

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div>
        <p>Erreur : {error.message}</p>
        <Button onClick={() => refetch()}>Réessayer</Button>
      </div>
    );
  }

  return (
    <div>
      <h1>Tableau de bord</h1>
      {/* Utiliser data.zone1_tasks, data.zone2_finances, etc. */}
    </div>
  );
}
```

**Avantages :**
- Cache automatique (2 minutes)
- Refetch automatique toutes les 5 minutes
- Synchronisation entre composants
- Gestion d'erreurs avec retry

---

### 4. **Error Boundary** - Protection contre les crashes

#### Exemple : Wrapper d'une page

```tsx
import { ErrorBoundary } from "@/components/error-boundary";

export default function Page() {
  return (
    <ErrorBoundary>
      <YourComponent />
    </ErrorBoundary>
  );
}
```

#### Exemple : Error Boundary avec fallback personnalisé

```tsx
<ErrorBoundary
  fallback={
    <div className="text-center p-8">
      <h2>Oops ! Une erreur est survenue</h2>
      <Button onClick={() => window.location.reload()}>
        Recharger
      </Button>
    </div>
  }
>
  <YourComponent />
</ErrorBoundary>
```

**Note :** Déjà intégré dans `app/owner/layout.tsx` pour toutes les pages owner.

---

### 5. **Optimistic Updates** - UI instantanée

#### Exemple : Mise à jour optimiste

```tsx
const updateProperty = useMutation({
  mutationFn: ({ id, data }) => apiClient.patch(`/properties/${id}`, data),
  onMutate: async ({ id, data }) => {
    // Annuler les requêtes en cours
    await queryClient.cancelQueries({ queryKey: ["properties"] });
    
    // Sauvegarder l'état précédent
    const previous = queryClient.getQueryData(["properties", profile?.id]);
    
    // Mise à jour optimiste
    queryClient.setQueryData(["properties", profile?.id], (old: any[]) =>
      old?.map((p) => (p.id === id ? { ...p, ...data } : p))
    );
    
    return { previous };
  },
  onError: (error, variables, context) => {
    // Rollback en cas d'erreur
    queryClient.setQueryData(["properties", profile?.id], context.previous);
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["properties"] });
  },
});
```

---

## 🔄 Migration des Mutations Existantes

### Avant (sans toast)

```tsx
const deleteProperty = useDeleteProperty();

const handleDelete = async () => {
  try {
    await deleteProperty.mutateAsync(propertyId);
    toast({ title: "Succès", description: "Bien supprimé" });
    router.push("/owner/properties");
  } catch (error) {
    toast({ title: "Erreur", description: "Échec de la suppression", variant: "destructive" });
  }
};
```

### Après (avec useMutationWithToast)

```tsx
const deleteProperty = useMutationWithToast({
  mutationFn: (id: string) => apiClient.delete(`/properties/${id}`),
  successMessage: "Bien supprimé avec succès",
  errorMessage: "Impossible de supprimer le bien",
  invalidateQueries: ["properties"],
  onSuccess: () => router.push("/owner/properties"),
});

// Utilisation simple
<Button onClick={() => deleteProperty.mutate(propertyId)}>
  Supprimer
</Button>
```

---

## 📋 Checklist d'Intégration

Pour chaque nouvelle mutation :

- [ ] Utiliser `useMutationWithToast` au lieu de `useMutation`
- [ ] Définir `successMessage` et `errorMessage`
- [ ] Spécifier `invalidateQueries` si nécessaire
- [ ] Ajouter `optimisticUpdate` pour les actions critiques
- [ ] Ajouter `ConfirmDialog` pour les actions destructives

Pour chaque page :

- [ ] Vérifier que l'Error Boundary est présent (déjà dans layout owner)
- [ ] Utiliser les hooks React Query au lieu de useState/useEffect
- [ ] Ajouter des skeleton loaders pour les états de chargement

---

## 🎯 Bonnes Pratiques

1. **Toujours utiliser ConfirmDialog pour les suppressions**
   ```tsx
   // ✅ Bon
   <ConfirmDialog onConfirm={handleDelete} variant="destructive" />
   
   // ❌ Mauvais
   <Button onClick={handleDelete}>Supprimer</Button>
   ```

2. **Utiliser useMutationWithToast pour toutes les mutations**
   ```tsx
   // ✅ Bon
   const mutation = useMutationWithToast({ mutationFn, successMessage, errorMessage });
   
   // ❌ Mauvais
   const mutation = useMutation({ mutationFn });
   ```

3. **Ajouter optimistic updates pour les actions fréquentes**
   ```tsx
   // ✅ Bon - UI instantanée
   optimisticUpdate: { queryKey: [...], updateFn: ... }
   
   // ⚠️ Acceptable - UI après confirmation serveur
   onSuccess: () => invalidateQueries(...)
   ```

4. **Utiliser React Query pour toutes les données serveur**
   ```tsx
   // ✅ Bon
   const { data } = useDashboard();
   
   // ❌ Mauvais
   const [data, setData] = useState(null);
   useEffect(() => { fetchData().then(setData); }, []);
   ```

---

## 📚 Ressources

- Documentation React Query : https://tanstack.com/query/latest
- Documentation Framer Motion : https://www.framer.com/motion/
- Composants shadcn/ui : https://ui.shadcn.com/


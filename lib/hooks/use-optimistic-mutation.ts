"use client";

import { useCallback, useState } from "react";
import { useMutation, useQueryClient, QueryKey } from "@tanstack/react-query";
import { toast } from "@/components/ui/use-toast";

/**
 * Hook pour les mutations optimistes avec React Query
 * Permet de mettre à jour l'UI immédiatement avant la confirmation serveur
 */

interface OptimisticMutationOptions<TData, TVariables, TContext> {
  /** Clé React Query à mettre à jour */
  queryKey: QueryKey;
  
  /** Fonction de mutation (appel API) */
  mutationFn: (variables: TVariables) => Promise<TData>;
  
  /** Fonction pour calculer la nouvelle valeur optimiste */
  optimisticUpdate: (oldData: TData | undefined, variables: TVariables) => TData;
  
  /** Message de succès */
  successMessage?: string;
  
  /** Message d'erreur */
  errorMessage?: string;
  
  /** Callback après succès */
  onSuccess?: (data: TData, variables: TVariables) => void;
  
  /** Callback après erreur */
  onError?: (error: Error, variables: TVariables, context: TContext | undefined) => void;
}

export function useOptimisticMutation<TData, TVariables, TContext = { previousData: TData | undefined }>({
  queryKey,
  mutationFn,
  optimisticUpdate,
  successMessage = "Modification enregistrée",
  errorMessage = "Une erreur est survenue",
  onSuccess,
  onError,
}: OptimisticMutationOptions<TData, TVariables, TContext>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    
    // Avant la mutation : sauvegarder l'état actuel et appliquer l'update optimiste
    onMutate: async (variables: TVariables) => {
      // Annuler les requêtes en cours pour éviter les conflits
      await queryClient.cancelQueries({ queryKey });

      // Sauvegarder la valeur actuelle
      const previousData = queryClient.getQueryData<TData>(queryKey);

      // Appliquer la mise à jour optimiste
      queryClient.setQueryData<TData>(queryKey, (old) => optimisticUpdate(old, variables));

      // Retourner le contexte pour rollback
      return { previousData } as TContext;
    },

    // En cas d'erreur : rollback
    onError: (error: Error, variables: TVariables, context: TContext | undefined) => {
      // Restaurer les données précédentes
      if (context && (context as any).previousData !== undefined) {
        queryClient.setQueryData(queryKey, (context as any).previousData);
      }

      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      });

      onError?.(error, variables, context);
    },

    // En cas de succès
    onSuccess: (data: TData, variables: TVariables) => {
      toast({
        title: "Succès",
        description: successMessage,
      });

      onSuccess?.(data, variables);
    },

    // Dans tous les cas : invalider pour synchroniser avec le serveur
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}

/**
 * Hook simplifié pour les toggles (like, favorite, etc.)
 */
export function useOptimisticToggle<TItem extends { id: string }>(
  queryKey: QueryKey,
  toggleFn: (id: string, value: boolean) => Promise<any>,
  getToggleValue: (item: TItem) => boolean,
  setToggleValue: (item: TItem, value: boolean) => TItem
) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<Set<string>>(new Set());

  const toggle = useCallback(
    async (id: string) => {
      if (pending.has(id)) return; // Éviter les doubles clics

      setPending((prev) => new Set(prev).add(id));

      // Trouver l'item et sa valeur actuelle
      const items = queryClient.getQueryData<TItem[]>(queryKey);
      const item = items?.find((i) => i.id === id);
      if (!item) return;

      const currentValue = getToggleValue(item);
      const newValue = !currentValue;

      // Update optimiste
      queryClient.setQueryData<TItem[]>(queryKey, (old) =>
        old?.map((i) => (i.id === id ? setToggleValue(i, newValue) : i))
      );

      try {
        await toggleFn(id, newValue);
      } catch {
        // Rollback
        queryClient.setQueryData<TItem[]>(queryKey, (old) =>
          old?.map((i) => (i.id === id ? setToggleValue(i, currentValue) : i))
        );
        toast({
          title: "Erreur",
          description: "Impossible de mettre à jour",
          variant: "destructive",
        });
      } finally {
        setPending((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [queryKey, queryClient, toggleFn, getToggleValue, setToggleValue, pending]
  );

  return { toggle, isPending: (id: string) => pending.has(id) };
}

/**
 * Hook pour les suppressions optimistes dans une liste
 */
export function useOptimisticDelete<TItem extends { id: string }>(
  queryKey: QueryKey,
  deleteFn: (id: string) => Promise<any>,
  options: { successMessage?: string; errorMessage?: string } = {}
) {
  const { successMessage = "Élément supprimé", errorMessage = "Erreur lors de la suppression" } = options;
  
  return useOptimisticMutation<TItem[], string, { previousData: TItem[] | undefined }>({
    queryKey,
    mutationFn: async (id) => {
      await deleteFn(id);
      return []; // On ne retourne pas de données, l'invalidation se chargera de la sync
    },
    optimisticUpdate: (oldData, id) => oldData?.filter((item) => item.id !== id) || [],
    successMessage,
    errorMessage,
  });
}

/**
 * Hook pour les créations optimistes dans une liste
 */
export function useOptimisticCreate<TItem extends { id: string }, TVariables>(
  queryKey: QueryKey,
  createFn: (variables: TVariables) => Promise<TItem>,
  createOptimisticItem: (variables: TVariables) => TItem,
  options: { successMessage?: string; errorMessage?: string } = {}
) {
  const { successMessage = "Élément créé", errorMessage = "Erreur lors de la création" } = options;
  
  return useOptimisticMutation<TItem[], TVariables, { previousData: TItem[] | undefined; tempId: string }>({
    queryKey,
    mutationFn: async (variables) => {
      const created = await createFn(variables);
      return [created];
    },
    optimisticUpdate: (oldData, variables) => {
      const optimisticItem = createOptimisticItem(variables);
      return [...(oldData || []), optimisticItem];
    },
    successMessage,
    errorMessage,
  });
}

export default useOptimisticMutation;



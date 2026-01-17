/**
 * Hook pour les mutations avec notifications toast automatiques
 * 
 * Simplifie l'utilisation des mutations avec gestion d'erreurs
 * et notifications utilisateur automatiques
 */

"use client";

import { useMutation, useMutationState, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";

interface UseMutationWithToastOptions<TData, TVariables, TContext> {
  mutationFn: (variables: TVariables) => Promise<TData>;
  successMessage?: string | ((data: TData) => string);
  errorMessage?: string | ((error: Error) => string);
  onSuccess?: (data: TData, variables: TVariables) => void | Promise<void>;
  onError?: (error: Error, variables: TVariables) => void;
  invalidateQueries?: string[];
  optimisticUpdate?: {
    queryKey: string[];
    updateFn: (old: any, variables: TVariables) => any;
  };
}

/**
 * Hook pour créer une mutation avec notifications toast automatiques
 * 
 * Exemple :
 * const deleteProperty = useMutationWithToast({
 *   mutationFn: (id: string) => apiClient.delete(`/properties/${id}`),
 *   successMessage: "Bien supprimé avec succès",
 *   errorMessage: "Impossible de supprimer le bien",
 *   invalidateQueries: ["properties"],
 * });
 */
export function useMutationWithToast<TData, TVariables, TContext = unknown>({
  mutationFn,
  successMessage,
  errorMessage,
  onSuccess,
  onError,
  invalidateQueries = [],
  optimisticUpdate,
}: UseMutationWithToastOptions<TData, TVariables, TContext>) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onMutate: optimisticUpdate
      ? async (variables) => {
          // Annuler les requêtes en cours
          await queryClient.cancelQueries({ queryKey: optimisticUpdate.queryKey });

          // Sauvegarder l'état précédent
          const previousData = queryClient.getQueryData(optimisticUpdate.queryKey);

          // Mise à jour optimiste
          queryClient.setQueryData(
            optimisticUpdate.queryKey,
            (old: any) => optimisticUpdate.updateFn(old, variables)
          );

          return { previousData };
        }
      : undefined,
    onSuccess: async (data, variables) => {
      // Afficher le toast de succès
      const message =
        typeof successMessage === "function" ? successMessage(data) : successMessage;
      
      if (message) {
        toast({
          title: "Succès",
          description: message,
          variant: "default",
        });
      }

      // Invalider les queries spécifiées
      invalidateQueries.forEach((queryKey) => {
        queryClient.invalidateQueries({ queryKey: [queryKey] });
      });

      // Appeler le callback onSuccess
      await onSuccess?.(data, variables);
    },
    onError: (error: Error, variables, context) => {
      // Rollback si optimistic update
      if (optimisticUpdate && context) {
        queryClient.setQueryData(
          optimisticUpdate.queryKey,
          (context as any).previousData
        );
      }

      // Afficher le toast d'erreur
      const message =
        typeof errorMessage === "function" ? errorMessage(error) : errorMessage;
      
      toast({
        title: "Erreur",
        description: message || error instanceof Error ? error.message : "Une erreur est survenue",
        variant: "destructive",
      });

      // Appeler le callback onError
      onError?.(error, variables);
    },
  });
}


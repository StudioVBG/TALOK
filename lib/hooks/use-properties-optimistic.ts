/**
 * Hooks avec optimistic updates pour les propriétés
 * 
 * Mise à jour immédiate de l'UI avant confirmation serveur
 * Rollback automatique en cas d'erreur
 */

"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { typedSupabaseClient } from "@/lib/supabase/typed-client";
import type { PropertyRow, PropertyUpdate } from "@/lib/supabase/typed-client";
import { useAuth } from "@/lib/hooks/use-auth";
import { getTypedSupabaseClient } from "@/lib/helpers/supabase-client";

/**
 * Hook pour mettre à jour une propriété avec optimistic update
 */
export function useUpdatePropertyOptimistic() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: PropertyUpdate }) => {
      const supabaseClient = getTypedSupabaseClient(typedSupabaseClient);
      const { data: property, error } = await supabaseClient
        .from("properties")
        .update(data as any)
        .eq("id", id)
        .select()
        .single();
      
      if (error) throw error;
      return property as PropertyRow;
    },
    // Optimistic update
    onMutate: async ({ id, data }) => {
      // Annuler les requêtes en cours pour éviter les conflits
      await queryClient.cancelQueries({ queryKey: ["properties"] });
      await queryClient.cancelQueries({ queryKey: ["property", id] });
      
      // Sauvegarder l'état précédent pour rollback
      const previousProperties = queryClient.getQueryData<PropertyRow[]>(["properties", profile?.id]);
      const previousProperty = queryClient.getQueryData<PropertyRow>(["property", id]);
      
      // Mise à jour optimiste
      if (previousProperties) {
        queryClient.setQueryData<PropertyRow[]>(
          ["properties", profile?.id],
          (old) =>
            old?.map((p) => (p.id === id ? { ...p, ...data } : p)) ?? []
        );
      }
      
      if (previousProperty) {
        queryClient.setQueryData<PropertyRow>(["property", id], (old) => ({
          ...(old as PropertyRow),
          ...data,
        }));
      }
      
      return { previousProperties, previousProperty };
    },
    // En cas d'erreur, rollback
    onError: (error, variables, context) => {
      if (context?.previousProperties) {
        queryClient.setQueryData(["properties", profile?.id], context.previousProperties);
      }
      if (context?.previousProperty) {
        queryClient.setQueryData(["property", variables.id], context.previousProperty);
      }
    },
    // Toujours refetch après succès pour synchroniser
    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({ queryKey: ["properties"] });
      queryClient.invalidateQueries({ queryKey: ["property", variables.id] });
    },
  });
}


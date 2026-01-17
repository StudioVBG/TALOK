/**
 * Hook React Query pour les propriétés
 * 
 * Utilise les types Database générés depuis Supabase
 * pour une connexion type-safe BDD → Frontend
 */

"use client";

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import type { PropertyRow, PropertyInsert, PropertyUpdate } from "@/lib/supabase/typed-client";
import { useAuth } from "@/lib/hooks/use-auth";
import { apiClient } from "@/lib/api-client";

const ITEMS_PER_PAGE = 12;

/**
 * Hook pour récupérer toutes les propriétés de l'utilisateur (mode standard)
 */
export function useProperties() {
  const { profile } = useAuth();
  
  return useQuery({
    queryKey: ["properties", profile?.id],
    queryFn: async () => {
      if (!profile) {
        throw new Error("Non authentifié");
      }
      
      try {
        // ✅ Utiliser l'API route scopée aux propriétaires /api/owner/properties
        const response = await apiClient.get<{ 
          properties: PropertyRow[];
          pagination: {
            page: number;
            limit: number;
            total: number;
          };
        }>("/owner/properties");
        
        // ✅ Gérer le format de réponse OwnerPropertiesResponse
        if (response && typeof response === "object") {
          if ("properties" in response && Array.isArray(response.properties)) {
            return response.properties;
          }
          // Fallback : si la réponse est directement un tableau (rétrocompatibilité)
          if (Array.isArray(response)) {
            return response;
          }
        }
        
        console.warn("[useProperties] Unexpected response format:", response);
        return [];
      } catch (error: unknown) {
        console.error("[useProperties] Error fetching properties:", error);
        console.error("[useProperties] Error details:", {
          message: error?.message,
          statusCode: error?.statusCode,
          data: error?.data,
        });
        
        // Si c'est une erreur de timeout ou réseau
        if (error?.statusCode === 504 || error?.message?.includes("timeout") || error?.message?.includes("Timeout")) {
          throw new Error("Le chargement prend trop de temps. Veuillez réessayer.");
        }
        
        // Si c'est une erreur d'authentification
        if (error?.statusCode === 401 || error?.statusCode === 403) {
          throw new Error("Vous n'êtes pas autorisé à accéder à ces données.");
        }
        
        // Pour les autres erreurs, propager l'erreur originale avec le message détaillé
        const errorMessage = error?.data?.error || error?.message || "Erreur lors de la récupération des propriétés";
        throw new Error(errorMessage);
      }
    },
    enabled: !!profile,
    retry: (failureCount, error: any) => {
      // Ne pas réessayer si c'est une erreur d'authentification ou de timeout
      if (error?.statusCode === 401 || error?.statusCode === 403 || error?.statusCode === 504) {
        return false;
      }
      // Réessayer une seule fois pour les autres erreurs
      return failureCount < 1;
    },
    staleTime: 30 * 1000, // 30 secondes - considérer les données comme fraîches pendant 30s
    gcTime: 5 * 60 * 1000, // 5 minutes - garder en cache pendant 5 minutes
    refetchOnWindowFocus: false, // Ne pas refetch automatiquement quand la fenêtre reprend le focus
  });
}

/**
 * Hook pour récupérer les propriétés avec pagination infinie
 * 
 * Utilise useInfiniteQuery pour charger les propriétés par pages
 * Optimisé pour de grandes listes
 */
export function usePropertiesInfinite() {
  const { profile } = useAuth();
  
  return useInfiniteQuery({
    queryKey: ["properties", "infinite", profile?.id],
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      if (!profile) throw new Error("Non authentifié");
      
      try {
        // Utiliser l'API route avec pagination
        const response = await apiClient.get<{ properties: PropertyRow[] }>(
          `/properties?page=${pageParam}&limit=${ITEMS_PER_PAGE}`
        );
        
        const properties = Array.isArray(response)
          ? response
          : (response as any).properties || [];
        
        const hasMore = properties.length === ITEMS_PER_PAGE;
        
        return {
          data: properties,
          nextPage: hasMore ? (pageParam as number) + ITEMS_PER_PAGE : null,
        };
      } catch (error: unknown) {
        console.error("[usePropertiesInfinite] Error fetching properties:", error);
        throw error;
      }
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    enabled: !!profile,
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Hook pour récupérer une propriété par ID
 */
export function useProperty(propertyId: string | null) {
  return useQuery({
    queryKey: ["property", propertyId],
    queryFn: async () => {
      if (!propertyId) throw new Error("Property ID requis");
      
      // Utiliser l'API route au lieu d'appeler directement Supabase
      const response = await apiClient.get<PropertyRow>(`/properties/${propertyId}`);
      return response;
    },
    enabled: !!propertyId,
  });
}

/**
 * Hook pour créer une propriété
 */
export function useCreateProperty() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  
  return useMutation({
    mutationFn: async (data: PropertyInsert) => {
      if (!profile) throw new Error("Non authentifié");
      
      // Utiliser l'API route au lieu d'appeler directement Supabase
      const response = await apiClient.post<PropertyRow>("/properties", {
        ...data,
        owner_id: profile.id,
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["properties"] });
    },
  });
}

/**
 * Hook pour mettre à jour une propriété
 * 
 * @param optimistic - Si true, utilise optimistic updates (mise à jour immédiate UI)
 */
export function useUpdateProperty(optimistic: boolean = false) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: PropertyUpdate }) => {
      // Utiliser l'API route au lieu d'appeler directement Supabase
      const response = await apiClient.patch<PropertyRow>(`/properties/${id}`, data);
      return response;
    },
    // Optimistic update si activé
    onMutate: optimistic
      ? async ({ id, data }) => {
          // Annuler les requêtes en cours pour éviter les conflits
          await queryClient.cancelQueries({ queryKey: ["properties"] });
          await queryClient.cancelQueries({ queryKey: ["property", id] });
          
          // Sauvegarder l'état précédent pour rollback
          const previousProperties = queryClient.getQueryData<PropertyRow[]>([
            "properties",
            profile?.id,
          ]);
          const previousProperty = queryClient.getQueryData<PropertyRow>(["property", id]);
          
          // Mise à jour optimiste
          if (previousProperties) {
            queryClient.setQueryData<PropertyRow[]>(
              ["properties", profile?.id],
              (old) => old?.map((p) => (p.id === id ? { ...p, ...data } : p)) ?? []
            );
          }
          
          if (previousProperty) {
            queryClient.setQueryData<PropertyRow>(["property", id], (old) => ({
              ...(old as PropertyRow),
              ...data,
            }));
          }
          
          return { previousProperties, previousProperty };
        }
      : undefined,
    // En cas d'erreur, rollback si optimistic
    onError: optimistic
      ? (error, variables, context) => {
          if (context?.previousProperties) {
            queryClient.setQueryData(["properties", profile?.id], context.previousProperties);
          }
          if (context?.previousProperty) {
            queryClient.setQueryData(["property", variables.id], context.previousProperty);
          }
        }
      : undefined,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["properties"] });
      queryClient.invalidateQueries({ queryKey: ["property", variables.id] });
    },
  });
}

/**
 * Hook pour supprimer une propriété avec optimistic update
 */
export function useDeleteProperty() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  
  return useMutation({
    mutationFn: async (id: string) => {
      // Utiliser l'API route au lieu d'appeler directement Supabase
      await apiClient.delete(`/properties/${id}`);
    },
    onMutate: async (id) => {
      // Annuler les requêtes en cours pour éviter les conflits
      await queryClient.cancelQueries({ queryKey: ["properties"] });
      await queryClient.cancelQueries({ queryKey: ["property", id] });
      
      // Sauvegarder l'état précédent pour rollback
      const previousProperties = queryClient.getQueryData<PropertyRow[]>([
        "properties",
        profile?.id,
      ]);
      const previousProperty = queryClient.getQueryData<PropertyRow>(["property", id]);
      
      // Mise à jour optimiste - supprimer la propriété de la liste
      if (previousProperties) {
        queryClient.setQueryData<PropertyRow[]>(
          ["properties", profile?.id],
          (old) => old?.filter((p) => p.id !== id) ?? []
        );
      }
      
      // Supprimer aussi de la cache individuelle
      queryClient.removeQueries({ queryKey: ["property", id] });
      
      return { previousProperties, previousProperty };
    },
    onError: (error, id, context) => {
      // Rollback en cas d'erreur
      if (context?.previousProperties) {
        queryClient.setQueryData(["properties", profile?.id], context.previousProperties);
      }
      if (context?.previousProperty) {
        queryClient.setQueryData(["property", id], context.previousProperty);
      }
    },
    onSuccess: () => {
      // Invalider les queries pour s'assurer que les données sont à jour
      queryClient.invalidateQueries({ queryKey: ["properties"] });
    },
  });
}


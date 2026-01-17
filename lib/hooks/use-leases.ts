/**
 * Hook React Query pour les baux
 * 
 * Utilise les types Database générés depuis Supabase
 */

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { LeaseRow, LeaseInsert, LeaseUpdate } from "@/lib/supabase/typed-client";
import { useAuth } from "@/lib/hooks/use-auth";
import { leasesService } from "@/features/leases/services/leases.service";

/**
 * Hook pour récupérer tous les baux de l'utilisateur
 */
export function useLeases(propertyId?: string | null, options?: { enabled?: boolean }) {
  const { profile } = useAuth();
  
  return useQuery({
    queryKey: ["leases", profile?.id, propertyId],
    queryFn: async () => {
      if (!profile) {
        throw new Error("Non authentifié");
      }
      
      try {
        if (propertyId) {
          return await leasesService.getLeasesByProperty(propertyId);
        }
        
        // Filtrer selon le rôle
        if (profile.role === "owner") {
          return await leasesService.getLeasesByOwner(profile.id);
        } else if (profile.role === "tenant") {
          return await leasesService.getLeasesByTenant(profile.id);
        }
        
        // Par défaut, récupérer tous les baux (admin)
        return await leasesService.getLeases();
      } catch (error: unknown) {
        console.error("[useLeases] Error fetching leases:", error);
        
        // Retourner un tableau vide pour éviter de bloquer l'UI
        // Les erreurs sont loggées mais n'interrompent pas le rendu
        return [];
      }
    },
    enabled: options?.enabled !== false && !!profile, // Utiliser le paramètre enabled si fourni
    retry: (failureCount, error: any) => {
      // Ne pas réessayer si c'est une erreur d'authentification ou de timeout
      if (error?.statusCode === 401 || error?.statusCode === 403 || error?.statusCode === 504) {
        return false;
      }
      // Réessayer une seule fois pour les autres erreurs
      return failureCount < 1;
    },
    staleTime: 30 * 1000, // 30 secondes
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    // PROTECTION : Limiter les tentatives pour éviter les requêtes infinies
    refetchInterval: false,
    refetchIntervalInBackground: false,
  });
}

/**
 * Hook pour récupérer un bail par ID
 */
export function useLease(leaseId: string | null) {
  return useQuery({
    queryKey: ["lease", leaseId],
    queryFn: async () => {
      if (!leaseId) throw new Error("Lease ID requis");
      return await leasesService.getLeaseById(leaseId);
    },
    enabled: !!leaseId,
  });
}

/**
 * Hook pour créer un bail
 */
export function useCreateLease() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: LeaseInsert) => {
      return await leasesService.createLease(data as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leases"] });
    },
  });
}

/**
 * Hook pour mettre à jour un bail
 */
export function useUpdateLease() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: LeaseUpdate }) => {
      return await leasesService.updateLease(id, data as any);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["leases"] });
      queryClient.invalidateQueries({ queryKey: ["lease", variables.id] });
    },
  });
}

/**
 * Hook pour supprimer un bail
 * Invalide automatiquement le cache après suppression
 */
export function useDeleteLease() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (leaseId: string) => {
      await leasesService.deleteLease(leaseId);
      return leaseId;
    },
    onSuccess: (deletedId) => {
      // Invalider toutes les requêtes de baux pour forcer le rafraîchissement
      queryClient.invalidateQueries({ queryKey: ["leases"] });
      // Supprimer le bail du cache individuel
      queryClient.removeQueries({ queryKey: ["lease", deletedId] });
      // Invalider aussi le dashboard car il peut afficher des stats de baux
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["owner-dashboard"] });
    },
  });
}


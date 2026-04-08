/**
 * Hook React Query pour la gestion des lots de copropriete
 *
 * CRUD lots : listing, creation, mise a jour, suppression
 * Utilise dans les pages syndic copro.
 */

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "./use-auth";

// -- Types -------------------------------------------------------------------

export interface CoproLot {
  id: string;
  site_id: string;
  lot_number: string;
  owner_name: string;
  owner_id: string | null;
  tantiemes: number;
  tantiemes_total: number;
  surface_m2: number | null;
  type: "habitation" | "commerce" | "parking" | "cave" | "autre";
  floor: string | null;
  created_at: string;
  updated_at: string;
}

export interface CoproSite {
  id: string;
  name: string;
  address: string;
  total_tantiemes: number;
  lot_count: number;
  syndic_id: string;
}

export interface CreateLotInput {
  site_id: string;
  lot_number: string;
  owner_name: string;
  owner_id?: string;
  tantiemes: number;
  surface_m2?: number;
  type?: CoproLot["type"];
  floor?: string;
}

export interface UpdateLotInput extends Partial<CreateLotInput> {
  id: string;
}

// -- Hook principal ----------------------------------------------------------

export function useCoproLots(siteId?: string) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const lotsQuery = useQuery({
    queryKey: ["copro", "lots", siteId],
    queryFn: async (): Promise<CoproLot[]> => {
      if (!siteId) return [];
      try {
        const data = await apiClient.get<CoproLot[]>(
          `/copro/lots?site_id=${siteId}`
        );
        return data ?? [];
      } catch {
        return [];
      }
    },
    enabled: !!profile && !!siteId,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: async (input: CreateLotInput) => {
      return apiClient.post<CoproLot>("/copro/lots", input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["copro", "lots", siteId] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (input: UpdateLotInput) => {
      const { id, ...data } = input;
      return apiClient.patch<CoproLot>(`/copro/lots/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["copro", "lots", siteId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (lotId: string) => {
      return apiClient.delete(`/copro/lots/${lotId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["copro", "lots", siteId] });
    },
  });

  return {
    lots: lotsQuery.data ?? [],
    isLoading: lotsQuery.isLoading,
    error: lotsQuery.error,
    createLot: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateLot: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    deleteLot: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    refetch: lotsQuery.refetch,
  };
}

// -- Sites hook --------------------------------------------------------------

export function useCoproSites() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ["copro", "sites"],
    queryFn: async (): Promise<CoproSite[]> => {
      try {
        const data = await apiClient.get<CoproSite[]>("/copro/sites");
        return data ?? [];
      } catch {
        return [];
      }
    },
    enabled: !!profile,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
}

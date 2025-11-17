/**
 * Hook React Query pour les baux
 * 
 * Utilise les types Database générés depuis Supabase
 */

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { typedSupabaseClient } from "@/lib/supabase/typed-client";
import type { LeaseRow, LeaseInsert, LeaseUpdate } from "@/lib/supabase/typed-client";
import { useAuth } from "@/lib/hooks/use-auth";
import { getTypedSupabaseClient } from "@/lib/helpers/supabase-client";

/**
 * Hook pour récupérer tous les baux de l'utilisateur
 */
export function useLeases(propertyId?: string | null) {
  const { profile } = useAuth();
  
  return useQuery({
    queryKey: ["leases", profile?.id, propertyId],
    queryFn: async () => {
      if (!profile) throw new Error("Non authentifié");
      
      const supabaseClient = getTypedSupabaseClient(typedSupabaseClient);
      let query = supabaseClient
        .from("leases")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (propertyId) {
        query = query.eq("property_id", propertyId);
      }
      
      // Filtrer selon le rôle
      if (profile.role === "owner") {
        // Les propriétaires voient les baux de leurs propriétés
        const { data: properties } = await supabaseClient
          .from("properties")
          .select("id")
          .eq("owner_id", profile.id);
        
        if (!properties || properties.length === 0) {
          return [];
        }
        
        const propertyIds = (properties as any[]).map((p: any) => p.id);
        query = query.in("property_id", propertyIds);
      } else if (profile.role === "tenant") {
        // Les locataires voient leurs baux via lease_signers
        const { data: signers } = await supabaseClient
          .from("lease_signers")
          .select("lease_id")
          .eq("profile_id", profile.id);
        
        if (!signers || signers.length === 0) {
          return [];
        }
        
        const leaseIds = (signers as any[]).map((s: any) => s.lease_id);
        query = query.in("id", leaseIds);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as LeaseRow[];
    },
    enabled: !!profile,
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
      
      const supabaseClient = getTypedSupabaseClient(typedSupabaseClient);
      const { data, error } = await supabaseClient
        .from("leases")
        .select("*")
        .eq("id", leaseId)
        .single();
      
      if (error) throw error;
      return data as LeaseRow;
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
      const supabaseClient = getTypedSupabaseClient(typedSupabaseClient);
      const { data: lease, error } = await supabaseClient
        .from("leases")
        .insert(data as any)
        .select()
        .single();
      
      if (error) throw error;
      return lease as LeaseRow;
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
      const supabaseClient = getTypedSupabaseClient(typedSupabaseClient);
      const { data: lease, error } = await supabaseClient
        .from("leases")
        .update(data as any)
        .eq("id", id)
        .select()
        .single();
      
      if (error) throw error;
      return lease as LeaseRow;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["leases"] });
      queryClient.invalidateQueries({ queryKey: ["lease", variables.id] });
    },
  });
}


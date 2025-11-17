/**
 * Hook React Query pour les tickets/maintenance
 * 
 * Utilise les types Database générés depuis Supabase
 */

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { typedSupabaseClient } from "@/lib/supabase/typed-client";
import type { TicketRow, TicketInsert, TicketUpdate } from "@/lib/supabase/typed-client";
import { useAuth } from "@/lib/hooks/use-auth";
import { getTypedSupabaseClient } from "@/lib/helpers/supabase-client";

/**
 * Hook pour récupérer tous les tickets de l'utilisateur
 */
export function useTickets(propertyId?: string | null) {
  const { profile } = useAuth();
  
  return useQuery({
    queryKey: ["tickets", profile?.id, propertyId],
    queryFn: async () => {
      if (!profile) throw new Error("Non authentifié");
      
      const supabaseClient = getTypedSupabaseClient(typedSupabaseClient);
      let query = supabaseClient
        .from("tickets")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (propertyId) {
        query = query.eq("property_id", propertyId);
      }
      
      // Filtrer selon le rôle
      if (profile.role === "owner") {
        // Les propriétaires voient les tickets de leurs propriétés
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
        // Les locataires voient les tickets qu'ils ont créés ou ceux de leurs baux
        const { data: signers } = await supabaseClient
          .from("lease_signers")
          .select("lease_id")
          .eq("profile_id", profile.id);
        
        if (signers && signers.length > 0) {
          const leaseIds = (signers as any[]).map((s: any) => s.lease_id);
          const { data: leases } = await supabaseClient
            .from("leases")
            .select("property_id")
            .in("id", leaseIds);
          
          if (leases && leases.length > 0) {
            const propertyIds = [...new Set((leases as any[]).map((l: any) => l.property_id).filter(Boolean))];
            query = query.or(`property_id.in.(${propertyIds.join(",")}),created_by_profile_id.eq.${profile.id}`);
          } else {
            query = query.eq("created_by_profile_id", profile.id);
          }
        } else {
          query = query.eq("created_by_profile_id", profile.id);
        }
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as TicketRow[];
    },
    enabled: !!profile,
  });
}

/**
 * Hook pour récupérer un ticket par ID
 */
export function useTicket(ticketId: string | null) {
  return useQuery({
    queryKey: ["ticket", ticketId],
    queryFn: async () => {
      if (!ticketId) throw new Error("Ticket ID requis");
      return await ticketsService.getTicketById(ticketId);
    },
    enabled: !!ticketId,
  });
}

/**
 * Hook pour créer un ticket
 */
export function useCreateTicket() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  
  return useMutation({
    mutationFn: async (data: TicketInsert) => {
      if (!profile) throw new Error("Non authentifié");
      return await ticketsService.createTicket({
        ...data,
        property_id: data.property_id,
        lease_id: (data as any).lease_id || null,
        titre: (data as any).titre || "",
        description: (data as any).description || "",
        priorite: (data as any).priorite || "normale",
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    },
  });
}

/**
 * Hook pour mettre à jour un ticket
 */
export function useUpdateTicket() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: TicketUpdate }) => {
      return await ticketsService.updateTicket(id, data as any);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      queryClient.invalidateQueries({ queryKey: ["ticket", variables.id] });
    },
  });
}


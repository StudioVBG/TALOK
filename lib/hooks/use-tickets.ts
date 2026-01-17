/**
 * Hook React Query pour les tickets/maintenance
 * 
 * Utilise les types Database générés depuis Supabase
 */

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { TicketRow, TicketInsert, TicketUpdate } from "@/lib/supabase/typed-client";
import { useAuth } from "@/lib/hooks/use-auth";
import { ticketsService } from "@/features/tickets/services/tickets.service";

/**
 * Hook pour récupérer tous les tickets de l'utilisateur
 */
export function useTickets(propertyId?: string | null) {
  const { profile } = useAuth();
  
  return useQuery({
    queryKey: ["tickets", profile?.id, propertyId],
    queryFn: async () => {
      if (!profile) throw new Error("Non authentifié");
      
      try {
        if (propertyId) {
          return await ticketsService.getTicketsByProperty(propertyId);
        }
        
        // Filtrer selon le rôle
        if (profile.role === "owner") {
          return await ticketsService.getTicketsByOwner(profile.id);
        } else if (profile.role === "tenant") {
          return await ticketsService.getTicketsByTenant(profile.id);
        }
        
        // Par défaut, récupérer tous les tickets (admin)
        return await ticketsService.getTickets();
      } catch (error: unknown) {
        // Gérer les erreurs silencieusement pour éviter les erreurs 500 dans la console
        console.error("[useTickets] Error fetching tickets:", error);
        return [];
      }
    },
    enabled: !!profile,
    retry: 1, // Ne réessayer qu'une fois en cas d'erreur
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


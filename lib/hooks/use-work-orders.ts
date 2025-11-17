/**
 * Hook React Query pour les ordres de travail
 * 
 * Utilise les types Database générés depuis Supabase
 */

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { typedSupabaseClient } from "@/lib/supabase/typed-client";
import type { Database } from "@/lib/supabase/database.types";
import { useAuth } from "@/lib/hooks/use-auth";
import { getTypedSupabaseClient } from "@/lib/helpers/supabase-client";

type WorkOrderRow = {
  id: string;
  ticket_id: string;
  provider_id?: string | null;
  date_intervention_prevue?: string | null;
  date_intervention_reelle?: string | null;
  cout_estime?: number | null;
  cout_final?: number | null;
  statut: string;
  created_at?: string;
  updated_at?: string;
};
type WorkOrderInsert = Partial<WorkOrderRow>;
type WorkOrderUpdate = Partial<WorkOrderRow>;

/**
 * Hook pour récupérer tous les ordres de travail de l'utilisateur
 */
export function useWorkOrders(ticketId?: string | null) {
  const { profile } = useAuth();
  
  return useQuery({
    queryKey: ["work_orders", profile?.id, ticketId],
    queryFn: async () => {
      if (!profile) throw new Error("Non authentifié");
      
      const supabaseClient = getTypedSupabaseClient(typedSupabaseClient);
      let query = supabaseClient
        .from("work_orders")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (ticketId) {
        query = query.eq("ticket_id", ticketId);
      }
      
      // Filtrer selon le rôle
      if (profile.role === "provider") {
        // Les prestataires voient leurs ordres de travail
        query = query.eq("provider_id", profile.id);
      } else if (profile.role === "owner") {
        // Les propriétaires voient les ordres de travail de leurs tickets
        const { data: tickets } = await supabaseClient
          .from("tickets")
          .select("id")
          .eq("created_by_profile_id", profile.id);
        
        if (!tickets || tickets.length === 0) {
          return [];
        }
        
        const ticketIds = (tickets as any[]).map((t: any) => t.id);
        query = query.in("ticket_id", ticketIds);
      } else if (profile.role === "tenant") {
        // Les locataires voient les ordres de travail de leurs tickets
        const { data: tickets } = await supabaseClient
          .from("tickets")
          .select("id")
          .eq("created_by_profile_id", profile.id);
        
        if (!tickets || tickets.length === 0) {
          return [];
        }
        
        const ticketIds = (tickets as any[]).map((t: any) => t.id);
        query = query.in("ticket_id", ticketIds);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as WorkOrderRow[];
    },
    enabled: !!profile,
  });
}

/**
 * Hook pour récupérer un ordre de travail par ID
 */
export function useWorkOrder(workOrderId: string | null) {
  return useQuery({
    queryKey: ["work_order", workOrderId],
    queryFn: async () => {
      if (!workOrderId) throw new Error("Work Order ID requis");
      
      const supabaseClient = getTypedSupabaseClient(typedSupabaseClient);
      const { data, error } = await supabaseClient
        .from("work_orders")
        .select("*")
        .eq("id", workOrderId)
        .single();
      
      if (error) throw error;
      return data as WorkOrderRow;
    },
    enabled: !!workOrderId,
  });
}

/**
 * Hook pour créer un ordre de travail
 */
export function useCreateWorkOrder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: WorkOrderInsert) => {
      const supabaseClient = getTypedSupabaseClient(typedSupabaseClient);
      const { data: workOrder, error } = await supabaseClient
        .from("work_orders")
        .insert(data as any)
        .select()
        .single();
      
      if (error) throw error;
      return workOrder as WorkOrderRow;
    },
    onSuccess: (workOrder) => {
      queryClient.invalidateQueries({ queryKey: ["work_orders"] });
      queryClient.invalidateQueries({ queryKey: ["ticket", workOrder.ticket_id] });
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    },
  });
}

/**
 * Hook pour mettre à jour un ordre de travail
 */
export function useUpdateWorkOrder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: WorkOrderUpdate }) => {
      const supabaseClient = getTypedSupabaseClient(typedSupabaseClient);
      const { data: workOrder, error } = await supabaseClient
        .from("work_orders")
        .update(data as any)
        .eq("id", id)
        .select()
        .single();
      
      if (error) throw error;
      return workOrder as WorkOrderRow;
    },
    onSuccess: (workOrder, variables) => {
      queryClient.invalidateQueries({ queryKey: ["work_orders"] });
      queryClient.invalidateQueries({ queryKey: ["work_order", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["ticket", workOrder.ticket_id] });
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    },
  });
}


/**
 * Hook React Query pour les factures
 * 
 * Utilise les types Database générés depuis Supabase
 */

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { typedSupabaseClient } from "@/lib/supabase/typed-client";
import { getTypedSupabaseClient } from "@/lib/helpers/supabase-client";
import type { InvoiceRow, InvoiceInsert, InvoiceUpdate } from "@/lib/supabase/typed-client";
import { useAuth } from "@/lib/hooks/use-auth";

/**
 * Hook pour récupérer toutes les factures de l'utilisateur
 */
export function useInvoices(leaseId?: string | null) {
  const { profile } = useAuth();
  
  return useQuery({
    queryKey: ["invoices", profile?.id, leaseId],
    queryFn: async () => {
      if (!profile) throw new Error("Non authentifié");
      
      const supabaseClient = getTypedSupabaseClient(typedSupabaseClient);
      let query = supabaseClient
        .from("invoices")
        .select("*")
        .order("periode", { ascending: false });
      
      if (leaseId) {
        query = query.eq("lease_id", leaseId);
      }
      
      // Filtrer selon le rôle
      if (profile.role === "owner") {
        query = query.eq("owner_id", profile.id);
      } else if (profile.role === "tenant") {
        query = query.eq("tenant_id", profile.id);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as InvoiceRow[];
    },
    enabled: !!profile,
  });
}

/**
 * Hook pour récupérer une facture par ID
 */
export function useInvoice(invoiceId: string | null) {
  return useQuery({
    queryKey: ["invoice", invoiceId],
    queryFn: async () => {
      if (!invoiceId) throw new Error("Invoice ID requis");
      
      const supabaseClient = getTypedSupabaseClient(typedSupabaseClient);
      const { data, error } = await supabaseClient
        .from("invoices")
        .select("*")
        .eq("id", invoiceId)
        .single();
      
      if (error) throw error;
      return data as InvoiceRow;
    },
    enabled: !!invoiceId,
  });
}

/**
 * Hook pour créer une facture
 */
export function useCreateInvoice() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  
  return useMutation({
    mutationFn: async (data: InvoiceInsert) => {
      if (!profile) throw new Error("Non authentifié");
      
      const supabaseClient = getTypedSupabaseClient(typedSupabaseClient);
      const { data: invoice, error } = await supabaseClient
        .from("invoices")
        .insert({
          ...data,
          owner_id: profile.role === "owner" ? profile.id : data.owner_id,
        } as any)
        .select()
        .single();
      
      if (error) throw error;
      return invoice as InvoiceRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}

/**
 * Hook pour mettre à jour une facture
 */
export function useUpdateInvoice() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: InvoiceUpdate }) => {
      const supabaseClient = getTypedSupabaseClient(typedSupabaseClient);
      const { data: invoice, error } = await supabaseClient
        .from("invoices")
        .update(data as any)
        .eq("id", id)
        .select()
        .single();
      
      if (error) throw error;
      return invoice as InvoiceRow;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoice", variables.id] });
    },
  });
}


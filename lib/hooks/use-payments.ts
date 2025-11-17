/**
 * Hook React Query pour les paiements
 * 
 * Utilise les types Database générés depuis Supabase
 */

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { typedSupabaseClient } from "@/lib/supabase/typed-client";
import type { Database } from "@/lib/supabase/database.types";
import { useAuth } from "@/lib/hooks/use-auth";
import { getTypedSupabaseClient } from "@/lib/helpers/supabase-client";

type PaymentRow = {
  id: string;
  invoice_id: string;
  montant: number;
  moyen: string;
  provider_ref?: string | null;
  date_paiement?: string | null;
  statut: string;
  created_at?: string;
  updated_at?: string;
};
type PaymentInsert = Partial<PaymentRow>;
type PaymentUpdate = Partial<PaymentRow>;

/**
 * Hook pour récupérer tous les paiements de l'utilisateur
 */
export function usePayments(invoiceId?: string | null) {
  const { profile } = useAuth();
  
  return useQuery({
    queryKey: ["payments", profile?.id, invoiceId],
    queryFn: async () => {
      if (!profile) throw new Error("Non authentifié");
      
      const supabaseClient = getTypedSupabaseClient(typedSupabaseClient);
      let query = supabaseClient
        .from("payments")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (invoiceId) {
        query = query.eq("invoice_id", invoiceId);
      }
      
      // Filtrer selon le rôle via les factures
      if (profile.role === "owner") {
        // Les propriétaires voient les paiements de leurs factures
        const { data: invoices } = await supabaseClient
          .from("invoices")
          .select("id")
          .eq("owner_id", profile.id);
        
        if (!invoices || invoices.length === 0) {
          return [];
        }
        
        const invoiceIds = (invoices as any[]).map((inv: any) => inv.id);
        query = query.in("invoice_id", invoiceIds);
      } else if (profile.role === "tenant") {
        // Les locataires voient les paiements de leurs factures
        const { data: invoices } = await supabaseClient
          .from("invoices")
          .select("id")
          .eq("tenant_id", profile.id);
        
        if (!invoices || invoices.length === 0) {
          return [];
        }
        
        const invoiceIds = (invoices as any[]).map((inv: any) => inv.id);
        query = query.in("invoice_id", invoiceIds);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as PaymentRow[];
    },
    enabled: !!profile,
  });
}

/**
 * Hook pour récupérer un paiement par ID
 */
export function usePayment(paymentId: string | null) {
  return useQuery({
    queryKey: ["payment", paymentId],
    queryFn: async () => {
      if (!paymentId) throw new Error("Payment ID requis");
      
      const supabaseClient = getTypedSupabaseClient(typedSupabaseClient);
      const { data, error } = await supabaseClient
        .from("payments")
        .select("*")
        .eq("id", paymentId)
        .single();
      
      if (error) throw error;
      return data as PaymentRow;
    },
    enabled: !!paymentId,
  });
}

/**
 * Hook pour créer un paiement
 */
export function useCreatePayment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: PaymentInsert) => {
      const supabaseClient = getTypedSupabaseClient(typedSupabaseClient);
      const { data: payment, error } = await supabaseClient
        .from("payments")
        .insert(data as any)
        .select()
        .single();
      
      if (error) throw error;
      return payment as PaymentRow;
    },
    onSuccess: (payment) => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["invoice", payment.invoice_id] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}

/**
 * Hook pour mettre à jour un paiement
 */
export function useUpdatePayment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: PaymentUpdate }) => {
      const supabaseClient = getTypedSupabaseClient(typedSupabaseClient);
      const { data: payment, error } = await supabaseClient
        .from("payments")
        .update(data as any)
        .eq("id", id)
        .select()
        .single();
      
      if (error) throw error;
      return payment as PaymentRow;
    },
    onSuccess: (payment, variables) => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["payment", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["invoice", payment.invoice_id] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}


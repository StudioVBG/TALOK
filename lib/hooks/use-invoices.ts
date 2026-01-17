/**
 * Hook React Query pour les factures
 * 
 * Utilise les types Database générés depuis Supabase
 */

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { InvoiceRow, InvoiceInsert, InvoiceUpdate } from "@/lib/supabase/typed-client";
import { useAuth } from "@/lib/hooks/use-auth";
import { invoicesService } from "@/features/billing/services/invoices.service";

/**
 * Hook pour récupérer toutes les factures de l'utilisateur
 */
export function useInvoices(leaseId?: string | null) {
  const { profile } = useAuth();
  
  return useQuery({
    queryKey: ["invoices", profile?.id, leaseId],
    queryFn: async () => {
      if (!profile) throw new Error("Non authentifié");
      
      try {
        if (leaseId) {
          return await invoicesService.getInvoicesByLease(leaseId);
        }
        
        // Filtrer selon le rôle
        if (profile.role === "owner") {
          return await invoicesService.getInvoicesByOwner(profile.id);
        } else if (profile.role === "tenant") {
          return await invoicesService.getInvoicesByTenant(profile.id);
        }
        
        // Par défaut, récupérer toutes les factures (admin)
        return await invoicesService.getInvoices();
      } catch (error: unknown) {
        // Gérer les erreurs silencieusement pour éviter les erreurs 500 dans la console
        console.error("[useInvoices] Error fetching invoices:", error);
        return [];
      }
    },
    enabled: !!profile,
    retry: 1, // Ne réessayer qu'une fois en cas d'erreur
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
      return await invoicesService.getInvoiceById(invoiceId);
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
      return await invoicesService.createInvoice({
        ...data,
        lease_id: data.lease_id,
        periode: data.periode || "",
        montant_loyer: (data as any).montant_loyer || 0,
        montant_charges: (data as any).montant_charges || 0,
      } as any);
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
      return await invoicesService.updateInvoice(id, data as any);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoice", variables.id] });
    },
  });
}


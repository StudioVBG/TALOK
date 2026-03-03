"use client";

/**
 * SOTA 2026 : Hook React Query pour les moyens de paiement locataire
 * Gère le CRUD, le choix du défaut, et le cache optimiste
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/hooks/use-auth";
import type {
  TenantPaymentMethod,
  SepaMandate,
  PaymentMethodAuditEntry,
  PaymentMethodDisplay,
} from "@/lib/types/payment-methods";
import { toPaymentMethodDisplay } from "@/lib/types/payment-methods";

const QUERY_KEY = "tenant-payment-methods";
const MANDATES_KEY = "tenant-sepa-mandates";
const AUDIT_KEY = "tenant-payment-audit";

export function useTenantPaymentMethods() {
  const { profile } = useAuth();

  return useQuery<TenantPaymentMethod[]>({
    queryKey: [QUERY_KEY, profile?.id],
    queryFn: async () => {
      const res = await fetch("/api/tenant/payment-methods");
      if (!res.ok) throw new Error("Impossible de charger les moyens de paiement");
      const data = await res.json();
      return data.methods;
    },
    enabled: !!profile && profile.role === "tenant",
    staleTime: 5 * 60 * 1000,
  });
}

export function useTenantPaymentMethodsDisplay(): {
  methods: PaymentMethodDisplay[];
  defaultMethod: PaymentMethodDisplay | null;
  isLoading: boolean;
  error: Error | null;
} {
  const { data, isLoading, error } = useTenantPaymentMethods();

  const methods = (data ?? [])
    .filter((pm) => pm.status === "active")
    .map(toPaymentMethodDisplay);

  const defaultMethod = methods.find((m) => m.is_default) ?? methods[0] ?? null;

  return { methods, defaultMethod, isLoading, error: error as Error | null };
}

export function useAddPaymentMethod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      stripe_payment_method_id: string;
      type?: string;
      is_default?: boolean;
      label?: string;
    }) => {
      const res = await fetch("/api/tenant/payment-methods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur lors de l'ajout");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

export function useRemovePaymentMethod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (paymentMethodId: string) => {
      const res = await fetch(`/api/tenant/payment-methods?id=${paymentMethodId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur lors de la suppression");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

export function useSetDefaultPaymentMethod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (paymentMethodId: string) => {
      const res = await fetch("/api/tenant/payment-methods", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: paymentMethodId, is_default: true }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur lors de la mise à jour");
      }
      return res.json();
    },
    onMutate: async (paymentMethodId) => {
      await queryClient.cancelQueries({ queryKey: [QUERY_KEY] });

      const prev = queryClient.getQueryData<TenantPaymentMethod[]>([QUERY_KEY]);
      if (prev) {
        queryClient.setQueryData<TenantPaymentMethod[]>(
          [QUERY_KEY],
          prev.map((pm) => ({
            ...pm,
            is_default: pm.id === paymentMethodId,
          }))
        );
      }
      return { prev };
    },
    onError: (_err, _id, context) => {
      if (context?.prev) {
        queryClient.setQueryData([QUERY_KEY], context.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

export function useSepaMandates() {
  const { profile } = useAuth();

  return useQuery<SepaMandate[]>({
    queryKey: [MANDATES_KEY, profile?.id],
    queryFn: async () => {
      const res = await fetch("/api/tenant/payment-methods?type=mandates");
      if (!res.ok) throw new Error("Impossible de charger les mandats");
      const data = await res.json();
      return data.mandates;
    },
    enabled: !!profile && profile.role === "tenant",
    staleTime: 10 * 60 * 1000,
  });
}

export function usePaymentAuditLog() {
  const { profile } = useAuth();

  return useQuery<PaymentMethodAuditEntry[]>({
    queryKey: [AUDIT_KEY, profile?.id],
    queryFn: async () => {
      const res = await fetch("/api/tenant/payment-methods?type=audit");
      if (!res.ok) throw new Error("Impossible de charger l'historique");
      const data = await res.json();
      return data.audit;
    },
    enabled: !!profile && profile.role === "tenant",
    staleTime: 2 * 60 * 1000,
  });
}

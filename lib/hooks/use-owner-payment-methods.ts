"use client";

/**
 * SOTA 2026 : Hooks React Query pour les moyens de paiement propriétaire (abonnement).
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/hooks/use-auth";

const QUERY_KEY = "owner-payment-methods";
const CURRENT_KEY = "owner-payment-methods-current";
const AUDIT_KEY = "owner-payment-audit";

export interface OwnerPaymentMethodItem {
  id: string;
  type: string;
  card: {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
  } | null;
  created: number;
}

export interface OwnerCurrentPaymentMethod {
  id: string;
  brand: "visa" | "mastercard" | "amex" | "discover" | "unknown";
  last4: string;
  exp_month: number;
  exp_year: number;
}

export interface OwnerPaymentAuditEntry {
  id: string;
  action: string;
  payment_method_type: string | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export function useOwnerPaymentMethods() {
  const { profile } = useAuth();

  return useQuery<OwnerPaymentMethodItem[]>({
    queryKey: [QUERY_KEY, profile?.id],
    queryFn: async () => {
      const res = await fetch("/api/owner/payment-methods");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 503 || data?.code === "STRIPE_CONFIG_ERROR") {
          throw new Error(typeof data?.error === "string" ? data.error : "Impossible de charger les moyens de paiement");
        }
        throw new Error("Impossible de charger les moyens de paiement");
      }
      const data = await res.json();
      return data.methods ?? [];
    },
    enabled: !!profile && (profile.role === "owner" || profile.role === "admin"),
    staleTime: 2 * 60 * 1000,
  });
}

export function useOwnerCurrentPaymentMethod() {
  const { profile } = useAuth();

  return useQuery<OwnerCurrentPaymentMethod | null>({
    queryKey: [CURRENT_KEY, profile?.id],
    queryFn: async () => {
      const res = await fetch("/api/owner/payment-methods/current");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 503 || data?.code === "STRIPE_CONFIG_ERROR") {
          throw new Error(typeof data?.error === "string" ? data.error : "Impossible de charger le moyen de paiement");
        }
        throw new Error("Impossible de charger le moyen de paiement");
      }
      const data = await res.json();
      return data.payment_method ?? null;
    },
    enabled: !!profile && (profile.role === "owner" || profile.role === "admin"),
    staleTime: 2 * 60 * 1000,
  });
}

export function useAddOwnerPaymentMethod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (stripePaymentMethodId: string) => {
      const res = await fetch("/api/owner/payment-methods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stripe_payment_method_id: stripePaymentMethodId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Erreur lors de l'ajout");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [CURRENT_KEY] });
      queryClient.invalidateQueries({ queryKey: [AUDIT_KEY] });
    },
  });
}

export function useRemoveOwnerPaymentMethod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (paymentMethodId: string) => {
      const res = await fetch(`/api/owner/payment-methods?id=${encodeURIComponent(paymentMethodId)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Erreur lors de la suppression");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [CURRENT_KEY] });
      queryClient.invalidateQueries({ queryKey: [AUDIT_KEY] });
    },
  });
}

export function useSetDefaultOwnerPaymentMethod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (paymentMethodId: string) => {
      const res = await fetch("/api/owner/payment-methods", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ default_payment_method_id: paymentMethodId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Erreur lors de la mise à jour");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [CURRENT_KEY] });
      queryClient.invalidateQueries({ queryKey: [AUDIT_KEY] });
    },
  });
}

export function useOwnerPaymentAuditLog() {
  const { profile } = useAuth();

  return useQuery<OwnerPaymentAuditEntry[]>({
    queryKey: [AUDIT_KEY, profile?.id],
    queryFn: async () => {
      const res = await fetch("/api/owner/payment-methods/audit");
      if (!res.ok) throw new Error("Impossible de charger l'historique");
      const data = await res.json();
      return data.audit ?? [];
    },
    enabled: !!profile && (profile.role === "owner" || profile.role === "admin"),
    staleTime: 2 * 60 * 1000,
  });
}

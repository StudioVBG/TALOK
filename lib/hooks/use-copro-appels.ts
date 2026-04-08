/**
 * Hook React Query pour les appels de fonds copropriete
 *
 * Appels de fonds, paiements, relances, generation automatique.
 */

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "./use-auth";

// -- Types -------------------------------------------------------------------

export type AppelPeriodicity = "trimestriel" | "semestriel" | "annuel";
export type AppelStatus = "genere" | "envoye" | "partiellement_collecte" | "collecte" | "en_retard";
export type LotPaymentStatus = "paye" | "en_attente" | "en_retard";

export interface AppelPeriod {
  id: string;
  site_id: string;
  period_label: string;
  period_key: string;
  start_date: string;
  end_date: string;
  status: AppelStatus;
  total_due_cents: number;
  total_collected_cents: number;
  collection_pct: number;
  lot_count: number;
  overdue_count: number;
  sent_at: string | null;
}

export interface AppelLotDetail {
  lot_id: string;
  lot_number: string;
  owner_name: string;
  tantiemes: number;
  tantiemes_total: number;
  due_cents: number;
  paid_cents: number;
  balance_cents: number;
  status: LotPaymentStatus;
  last_payment_date: string | null;
}

export interface RegisterPaymentInput {
  appel_period_id: string;
  lot_id: string;
  amount_cents: number;
  payment_date: string;
  payment_type: "virement" | "cheque" | "prelevement" | "especes";
}

export interface GenerateAppelsInput {
  site_id: string;
  budget_id: string;
  periodicity: AppelPeriodicity;
}

// -- Hook principal ----------------------------------------------------------

export function useCoproAppels(siteId?: string) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const appelsQuery = useQuery({
    queryKey: ["copro", "appels", siteId],
    queryFn: async (): Promise<AppelPeriod[]> => {
      if (!siteId) return [];
      try {
        const data = await apiClient.get<AppelPeriod[]>(
          `/copro/appels?site_id=${siteId}`
        );
        return data ?? [];
      } catch {
        return [];
      }
    },
    enabled: !!profile && !!siteId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  return {
    appels: appelsQuery.data ?? [],
    isLoading: appelsQuery.isLoading,
    error: appelsQuery.error,
    refetch: appelsQuery.refetch,
  };
}

// -- Hook detail appel -------------------------------------------------------

export function useCoproAppelDetail(appelId?: string) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const detailQuery = useQuery({
    queryKey: ["copro", "appels", "detail", appelId],
    queryFn: async (): Promise<AppelLotDetail[]> => {
      if (!appelId) return [];
      try {
        const data = await apiClient.get<AppelLotDetail[]>(
          `/copro/appels/${appelId}/lots`
        );
        return data ?? [];
      } catch {
        return [];
      }
    },
    enabled: !!profile && !!appelId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const registerPaymentMutation = useMutation({
    mutationFn: async (input: RegisterPaymentInput) => {
      return apiClient.post("/copro/appels/payments", input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["copro", "appels"] });
    },
  });

  const sendRelanceMutation = useMutation({
    mutationFn: async (lotIds: string[]) => {
      return apiClient.post(`/copro/appels/${appelId}/relance`, { lot_ids: lotIds });
    },
  });

  return {
    lotDetails: detailQuery.data ?? [],
    isLoading: detailQuery.isLoading,
    error: detailQuery.error,
    registerPayment: registerPaymentMutation.mutateAsync,
    isRegistering: registerPaymentMutation.isPending,
    sendRelance: sendRelanceMutation.mutateAsync,
    isSendingRelance: sendRelanceMutation.isPending,
    refetch: detailQuery.refetch,
  };
}

// -- Hook generation ---------------------------------------------------------

export function useCoproAppelGeneration() {
  const queryClient = useQueryClient();

  const generateMutation = useMutation({
    mutationFn: async (input: GenerateAppelsInput) => {
      return apiClient.post("/copro/appels/generate", input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["copro", "appels"] });
    },
  });

  return {
    generateAppels: generateMutation.mutateAsync,
    isGenerating: generateMutation.isPending,
  };
}

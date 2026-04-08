/**
 * Hook React Query pour la gestion du budget copropriete
 *
 * Budget courant, comparaison N-1, lignes budgetaires,
 * execution et repartition des charges.
 */

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "./use-auth";

// -- Types -------------------------------------------------------------------

export interface BudgetLine {
  id: string;
  account_number: string;
  label: string;
  budget_cents: number;
  realise_cents: number;
  ecart_cents: number;
  execution_pct: number;
  n1_budget_cents: number | null;
}

export interface CoproBudget {
  id: string;
  site_id: string;
  exercise_id: string;
  exercise_label: string;
  status: "draft" | "voted" | "active" | "closed";
  total_budget_cents: number;
  total_realise_cents: number;
  total_ecart_cents: number;
  execution_pct: number;
  voted_at: string | null;
  lines: BudgetLine[];
}

export interface BudgetComparison {
  current: CoproBudget;
  previous: CoproBudget | null;
}

export interface CreateBudgetLineInput {
  account_number: string;
  label: string;
  budget_cents: number;
}

export interface CreateBudgetInput {
  site_id: string;
  exercise_id: string;
  lines: CreateBudgetLineInput[];
}

// -- Comptes de charges copro (classe 6) -------------------------------------

export const COPRO_CHARGE_ACCOUNTS = [
  { account_number: "601000", label: "Eau" },
  { account_number: "602000", label: "Electricite parties communes" },
  { account_number: "603000", label: "Chauffage collectif" },
  { account_number: "604000", label: "Assurance immeuble" },
  { account_number: "611000", label: "Entretien courant" },
  { account_number: "612000", label: "Espaces verts" },
  { account_number: "613000", label: "Nettoyage" },
  { account_number: "614000", label: "Ascenseur" },
  { account_number: "615000", label: "Honoraires syndic" },
  { account_number: "616000", label: "Frais de gestion" },
  { account_number: "617000", label: "Gardiennage / Concierge" },
  { account_number: "618000", label: "Digicode / Interphone" },
  { account_number: "619000", label: "Autres charges" },
  { account_number: "671000", label: "Impots et taxes" },
  { account_number: "681000", label: "Provisions pour travaux" },
] as const;

// -- Hook principal ----------------------------------------------------------

export function useCoproBudget(siteId?: string) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const budgetQuery = useQuery({
    queryKey: ["copro", "budget", siteId],
    queryFn: async (): Promise<BudgetComparison | null> => {
      if (!siteId) return null;
      try {
        return await apiClient.get<BudgetComparison>(
          `/copro/budget?site_id=${siteId}`
        );
      } catch {
        return null;
      }
    },
    enabled: !!profile && !!siteId,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  const createBudgetMutation = useMutation({
    mutationFn: async (input: CreateBudgetInput) => {
      return apiClient.post<CoproBudget>("/copro/budget", input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["copro", "budget", siteId] });
    },
  });

  const voteBudgetMutation = useMutation({
    mutationFn: async (budgetId: string) => {
      return apiClient.post(`/copro/budget/${budgetId}/vote`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["copro", "budget", siteId] });
    },
  });

  return {
    budget: budgetQuery.data?.current ?? null,
    previousBudget: budgetQuery.data?.previous ?? null,
    isLoading: budgetQuery.isLoading,
    error: budgetQuery.error,
    createBudget: createBudgetMutation.mutateAsync,
    isCreating: createBudgetMutation.isPending,
    voteBudget: voteBudgetMutation.mutateAsync,
    isVoting: voteBudgetMutation.isPending,
    refetch: budgetQuery.refetch,
  };
}

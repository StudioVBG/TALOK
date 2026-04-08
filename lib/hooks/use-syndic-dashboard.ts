/**
 * Hook React Query pour le dashboard syndic copropriete
 *
 * KPIs, impayes, prochain appel, fonds travaux.
 * Utilise dans SyndicDashboardClient.
 */

"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "./use-auth";

// -- Types -------------------------------------------------------------------

export interface SyndicKPIs {
  budget_execution_pct: number;
  tresorerie_cents: number;
  taux_recouvrement_pct: number;
  impayes_cents: number;
  impayes_count: number;
}

export interface BudgetVsRealise {
  poste: string;
  budget_cents: number;
  realise_cents: number;
}

export interface NextFundCall {
  id: string;
  period_label: string;
  due_date: string;
  total_cents: number;
  is_sent: boolean;
}

export interface OverdueCopro {
  lot_id: string;
  lot_number: string;
  owner_name: string;
  amount_cents: number;
  days_late: number;
}

export interface WorksFundSummary {
  balance_cents: number;
  rate_pct: number;
  evolution_cents: number;
}

export interface SyndicDashboardData {
  kpis: SyndicKPIs;
  budget_vs_realise: BudgetVsRealise[];
  next_fund_call: NextFundCall | null;
  overdue_copros: OverdueCopro[];
  works_fund: WorksFundSummary;
}

// -- Hook principal ----------------------------------------------------------

export function useSyndicDashboard(siteId?: string) {
  const { profile } = useAuth();

  const dashboardQuery = useQuery({
    queryKey: ["syndic", "dashboard", siteId],
    queryFn: async (): Promise<SyndicDashboardData | null> => {
      if (!siteId) return null;
      try {
        return await apiClient.get<SyndicDashboardData>(
          `/syndic/dashboard?site_id=${siteId}`
        );
      } catch {
        return null;
      }
    },
    enabled: !!profile && !!siteId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const data = dashboardQuery.data;

  return {
    kpis: data?.kpis ?? null,
    budgetVsRealise: data?.budget_vs_realise ?? [],
    nextFundCall: data?.next_fund_call ?? null,
    overdueCopros: data?.overdue_copros ?? [],
    worksFund: data?.works_fund ?? null,
    isLoading: dashboardQuery.isLoading,
    error: dashboardQuery.error,
    refetch: dashboardQuery.refetch,
  };
}

/**
 * Hook React Query pour les widgets KPI complémentaires du dashboard
 * comptable propriétaire.
 *
 * Consomme /api/accounting/dashboard/widgets en un seul appel pour :
 *   - top biens par revenu
 *   - comparaison YoY (revenus / charges / résultat)
 *   - charges récupérables (708xxx)
 *
 * Désactivé tant que entityId ou exerciseId ne sont pas résolus côté
 * appelant (cf. useAccountingDashboard pour leur résolution).
 */

"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { DashboardWidgetsResponse } from "@/lib/accounting/dashboard-widgets-types";

interface UseAccountingWidgetsOptions {
  entityId: string | undefined;
  exerciseId: string | undefined;
}

interface ApiEnvelope<T> {
  success?: boolean;
  data?: T;
}

export function useAccountingWidgets({
  entityId,
  exerciseId,
}: UseAccountingWidgetsOptions) {
  return useQuery({
    queryKey: ["accounting", "widgets", entityId, exerciseId],
    queryFn: async (): Promise<DashboardWidgetsResponse | null> => {
      if (!entityId || !exerciseId) return null;
      const res = await apiClient.get<ApiEnvelope<DashboardWidgetsResponse>>(
        `/accounting/dashboard/widgets?entityId=${encodeURIComponent(
          entityId,
        )}&exerciseId=${encodeURIComponent(exerciseId)}`,
      );
      return res?.data ?? null;
    },
    enabled: Boolean(entityId && exerciseId),
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
}

export type {
  DashboardWidgetsResponse,
  TopPropertyResult,
  YoyComparisonResult,
} from "@/lib/accounting/dashboard-widgets-types";

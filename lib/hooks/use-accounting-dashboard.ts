/**
 * Hook React Query pour le dashboard comptabilite proprietaire
 *
 * Recupere l'exercice courant, la balance et les ecritures recentes
 * pour l'entite selectionnee.
 */

"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "./use-auth";

// ── Types ───────────────────────────────────────────────────────────

export interface AccountingExercise {
  id: string;
  entityId: string;
  label: string;
  startDate: string;
  endDate: string;
  status: "open" | "closed";
}

export interface AccountingBalance {
  totalDebitCents: number;
  totalCreditCents: number;
  resultCents: number;
  revenueCents: number;
  expensesCents: number;
  monthlySeries: Array<{
    month: string;
    debitCents: number;
    creditCents: number;
  }>;
}

export interface AccountingEntry {
  id: string;
  entryDate: string;
  label: string;
  journalCode: string;
  totalDebitCents: number;
  source: "manual" | "stripe" | "ocr";
  isValidated: boolean;
}

interface UseAccountingDashboardOptions {
  entityId?: string;
}

// ── Hook ────────────────────────────────────────────────────────────

// API response envelope used by the accounting routes. All routes wrap the
// payload in `{ success, data }` — the older client code assumed the response
// itself was the raw data, which produced `TypeError: O.find is not a
// function` at runtime on the dashboard.
interface AccountingApiEnvelope<T> {
  success?: boolean;
  data?: T;
}

export function useAccountingDashboard(options: UseAccountingDashboardOptions = {}) {
  const { profile } = useAuth();
  const entityId =
    options.entityId ??
    (profile as { default_entity_id?: string | null } | null)?.default_entity_id ??
    undefined;

  const exerciseQuery = useQuery({
    queryKey: ["accounting", "exercises", entityId],
    queryFn: async (): Promise<AccountingExercise | null> => {
      if (!entityId) return null;
      try {
        // Server returns `{ success, data: { exercises: [...] } }`.
        // Fallback accepts a raw array so the hook is resilient if the
        // shape ever gets simplified.
        const response = await apiClient.get<
          AccountingApiEnvelope<{ exercises: AccountingExercise[] }> | AccountingExercise[]
        >(`/accounting/exercises?entityId=${entityId}`);
        const exercises: AccountingExercise[] = Array.isArray(response)
          ? response
          : response?.data?.exercises ?? [];
        return (
          exercises.find((e) => e.status === "open") ?? exercises[0] ?? null
        );
      } catch (error) {
        console.error("[useAccountingDashboard] exercises query failed:", error);
        throw error;
      }
    },
    enabled: !!profile && !!entityId,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  const exerciseId = exerciseQuery.data?.id;

  const balanceQuery = useQuery({
    queryKey: ["accounting", "balance-summary", exerciseId, entityId],
    queryFn: async (): Promise<AccountingBalance | null> => {
      if (!exerciseId || !entityId) return null;
      try {
        // The dashboard needs the aggregated KPI shape (revenue/
        // expenses/result/monthlySeries), not the per-account breakdown
        // used by the Balance page. The endpoint switches to that shape
        // via `?format=summary` and the server-side aggregation lives
        // in app/api/accounting/exercises/[exerciseId]/balance/route.ts.
        const response = await apiClient.get<
          AccountingApiEnvelope<{ summary: AccountingBalance }>
        >(
          `/accounting/exercises/${exerciseId}/balance?entityId=${encodeURIComponent(entityId)}&format=summary`,
        );
        return response?.data?.summary ?? null;
      } catch (error) {
        console.error("[useAccountingDashboard] balance query failed:", error);
        throw error;
      }
    },
    enabled: !!exerciseId && !!entityId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const entriesQuery = useQuery({
    queryKey: ["accounting", "entries", entityId],
    queryFn: async (): Promise<AccountingEntry[]> => {
      if (!entityId) return [];
      try {
        // Server returns `{ success, data: AccountingEntry[], meta }`.
        const response = await apiClient.get<
          AccountingApiEnvelope<AccountingEntry[]> | AccountingEntry[]
        >(`/accounting/entries?entityId=${entityId}&limit=5&sort=created_at:desc`);
        if (Array.isArray(response)) return response;
        return response?.data ?? [];
      } catch (error) {
        console.error("[useAccountingDashboard] entries query failed:", error);
        throw error;
      }
    },
    enabled: !!profile && !!entityId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  return {
    currentExercise: exerciseQuery.data ?? null,
    balance: balanceQuery.data ?? null,
    recentEntries: entriesQuery.data ?? [],
    isLoading:
      exerciseQuery.isLoading || balanceQuery.isLoading || entriesQuery.isLoading,
    error: exerciseQuery.error || balanceQuery.error || entriesQuery.error,
  };
}

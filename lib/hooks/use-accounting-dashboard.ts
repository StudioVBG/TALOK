// @ts-nocheck
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

export function useAccountingDashboard(options: UseAccountingDashboardOptions = {}) {
  const { profile } = useAuth();
  const entityId = options.entityId ?? profile?.default_entity_id;

  const exerciseQuery = useQuery({
    queryKey: ["accounting", "exercises", entityId],
    queryFn: async (): Promise<AccountingExercise | null> => {
      if (!entityId) return null;
      try {
        const data = await apiClient.get<AccountingExercise[]>(
          `/accounting/exercises?entityId=${entityId}`
        );
        // Return the current open exercise, or the most recent one
        return data?.find((e) => e.status === "open") ?? data?.[0] ?? null;
      } catch {
        return null;
      }
    },
    enabled: !!profile && !!entityId,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  const exerciseId = exerciseQuery.data?.id;

  const balanceQuery = useQuery({
    queryKey: ["accounting", "balance", exerciseId],
    queryFn: async (): Promise<AccountingBalance | null> => {
      if (!exerciseId) return null;
      try {
        return await apiClient.get<AccountingBalance>(
          `/accounting/exercises/${exerciseId}/balance`
        );
      } catch {
        return null;
      }
    },
    enabled: !!exerciseId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const entriesQuery = useQuery({
    queryKey: ["accounting", "entries", entityId],
    queryFn: async (): Promise<AccountingEntry[]> => {
      if (!entityId) return [];
      try {
        const data = await apiClient.get<AccountingEntry[]>(
          `/accounting/entries?entityId=${entityId}&limit=5&sort=created_at:desc`
        );
        return data ?? [];
      } catch {
        return [];
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

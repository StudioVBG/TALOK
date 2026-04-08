// @ts-nocheck
/**
 * Hook React Query pour le rapprochement bancaire
 *
 * Recupere les transactions bancaires et statistiques de rapprochement.
 * Exporte aussi useReconciliationActions pour les actions manuelles.
 */

"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "./use-auth";
import { useCallback } from "react";

// ── Types ───────────────────────────────────────────────────────────

export interface ReconciliationSuggestion {
  entryId: string;
  entryNumber: string;
  entryLabel: string;
  score: number;
  matchReasons: string[];
}

export interface BankTransactionRow {
  id: string;
  connection_id: string;
  transaction_date: string;
  value_date: string | null;
  amount_cents: number;
  label: string | null;
  raw_label: string | null;
  counterpart_name: string | null;
  reconciliation_status: "pending" | "matched_auto" | "matched_manual" | "suggested" | "orphan" | "ignored";
  matched_entry_id: string | null;
  match_score: number | null;
  suggestion: ReconciliationSuggestion | null;
  is_internal_transfer: boolean;
  matched_entry?: {
    id: string;
    entry_number: string;
    entry_date: string;
    label: string;
    journal_code: string;
    is_validated: boolean;
  } | null;
}

export interface ReconciliationStats {
  total: number;
  matched: number;
  suggested: number;
  orphan: number;
}

interface UseReconciliationOptions {
  entityId?: string;
  connectionId?: string;
  status?: string;
}

// ── Hook principal ──────────────────────────────────────────────────

export function useReconciliation(options: UseReconciliationOptions = {}) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const entityId = options.entityId ?? profile?.default_entity_id;

  const query = useQuery({
    queryKey: [
      "bank",
      "reconciliation",
      entityId,
      options.connectionId,
      options.status,
    ],
    queryFn: async (): Promise<{
      transactions: BankTransactionRow[];
      stats: ReconciliationStats;
    }> => {
      if (!entityId)
        return {
          transactions: [],
          stats: { total: 0, matched: 0, suggested: 0, orphan: 0 },
        };
      try {
        const params = new URLSearchParams({ entityId });
        if (options.connectionId)
          params.set("connectionId", options.connectionId);
        if (options.status) params.set("status", options.status);

        const data = await apiClient.get<{
          data: {
            transactions: BankTransactionRow[];
            stats: ReconciliationStats;
          };
        }>(`/accounting/bank/reconciliation?${params.toString()}`);

        return data?.data ?? {
          transactions: [],
          stats: { total: 0, matched: 0, suggested: 0, orphan: 0 },
        };
      } catch {
        return {
          transactions: [],
          stats: { total: 0, matched: 0, suggested: 0, orphan: 0 },
        };
      }
    },
    enabled: !!profile && !!entityId,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const mutate = () => {
    queryClient.invalidateQueries({
      queryKey: ["bank", "reconciliation"],
    });
  };

  return {
    transactions: query.data?.transactions ?? [],
    stats: query.data?.stats ?? { total: 0, matched: 0, suggested: 0, orphan: 0 },
    isLoading: query.isLoading,
    error: query.error,
    mutate,
  };
}

// ── Actions ─────────────────────────────────────────────────────────

export function useReconciliationActions() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const entityId = profile?.default_entity_id;

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["bank", "reconciliation"] });
  }, [queryClient]);

  const match = useCallback(
    async (transactionId: string, entryId: string) => {
      await apiClient.post("/accounting/bank/reconciliation/match", {
        transactionId,
        entryId,
      });
      invalidate();
    },
    [invalidate]
  );

  const ignore = useCallback(
    async (transactionId: string) => {
      await apiClient.post(`/accounting/reconciliation/${transactionId}`, {
        action: "ignore",
      });
      invalidate();
    },
    [invalidate]
  );

  const categorize = useCallback(
    async (
      transactionId: string,
      data: {
        accountNumber: string;
        label: string;
        journalCode: string;
      }
    ) => {
      await apiClient.post(`/accounting/reconciliation/${transactionId}`, {
        action: "categorize",
        ...data,
      });
      invalidate();
    },
    [invalidate]
  );

  const runMatching = useCallback(
    async (exerciseId: string) => {
      if (!entityId) return;
      const result = await apiClient.post<{
        data: { summary: { total: number; matchedAuto: number; suggested: number; orphan: number } };
      }>("/accounting/bank/reconciliation/run", {
        entityId,
        exerciseId,
      });
      invalidate();
      return result?.data?.summary;
    },
    [entityId, invalidate]
  );

  return { match, ignore, categorize, runMatching };
}

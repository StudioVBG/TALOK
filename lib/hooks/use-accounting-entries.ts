/**
 * Hook React Query pour la liste des ecritures comptables
 *
 * Recupere les ecritures avec filtrage, pagination et totaux
 * pour l'entite selectionnee.
 */

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "./use-auth";

// -- Types -------------------------------------------------------------------

export type EntrySource = "manual" | "stripe" | "ocr" | "import";
export type EntryStatus = "all" | "draft" | "validated";
export type JournalCode = "ACH" | "VE" | "BQ" | "OD" | "AN" | "CL";

export interface AccountingEntryRow {
  id: string;
  entity_id: string;
  exercise_id: string;
  journal_code: string;
  entry_number: string;
  entry_date: string;
  label: string;
  source: EntrySource | string | null;
  reference: string | null;
  is_validated: boolean;
  is_locked: boolean;
  reversal_of: string | null;
  created_at: string;
  updated_at: string;
  // Legacy fields (may co-exist)
  ecriture_num?: string;
  ecriture_date?: string;
  ecriture_lib?: string;
  debit?: number;
  credit?: number;
  valid_date?: string | null;
  // Computed totals from entry lines (set by server)
  total_debit_cents?: number;
  total_credit_cents?: number;
}

export interface EntriesApiResponse {
  success: boolean;
  data: AccountingEntryRow[];
  meta: {
    total: number;
    limit: number;
    offset: number;
    totals: {
      debit: number;
      credit: number;
      balance: number;
    };
  };
}

export interface UseAccountingEntriesParams {
  entityId?: string;
  exerciseId?: string;
  journalCode?: string;
  status?: EntryStatus;
  source?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

// -- Hook --------------------------------------------------------------------

export function useAccountingEntries(params: UseAccountingEntriesParams) {
  const { profile } = useAuth();
  const entityId =
    params.entityId ??
    (profile as { default_entity_id?: string | null } | null)?.default_entity_id ??
    undefined;
  const queryClient = useQueryClient();

  const limit = params.limit ?? 50;
  const page = params.page ?? 1;
  const offset = (page - 1) * limit;

  const queryKey = [
    "accounting",
    "entries",
    "list",
    entityId,
    params.exerciseId,
    params.journalCode,
    params.status,
    params.source,
    params.search,
    params.startDate,
    params.endDate,
    page,
    limit,
  ];

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<EntriesApiResponse> => {
      if (!entityId) {
        return { success: true, data: [], meta: { total: 0, limit, offset: 0, totals: { debit: 0, credit: 0, balance: 0 } } };
      }

      const searchParams = new URLSearchParams();
      searchParams.set("owner_id", entityId);
      searchParams.set("limit", String(limit));
      searchParams.set("offset", String(offset));

      if (params.journalCode) searchParams.set("journal_code", params.journalCode);
      if (params.startDate) searchParams.set("start_date", params.startDate);
      if (params.endDate) searchParams.set("end_date", params.endDate);
      if (params.search) searchParams.set("piece_ref", params.search);

      return apiClient.get<EntriesApiResponse>(
        `/accounting/entries?${searchParams.toString()}`
      );
    },
    enabled: !!profile && !!entityId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  // Normalize entries for convenience: merge legacy and new-schema fields
  const rawEntries = query.data?.data ?? [];
  const entries: AccountingEntryRow[] = rawEntries;

  const total = query.data?.meta?.total ?? 0;
  const totals = query.data?.meta?.totals ?? { debit: 0, credit: 0, balance: 0 };
  const totalPages = Math.max(1, Math.ceil(total / limit));

  // -- Validate mutation ---------------------------------------------------

  const validateMutation = useMutation({
    mutationFn: async (entryIds: string[]) => {
      return apiClient.post("/accounting/entries/validate", {
        entry_ids: entryIds,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounting", "entries"] });
    },
  });

  return {
    entries,
    total,
    totals,
    totalPages,
    currentPage: page,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    mutate: () => queryClient.invalidateQueries({ queryKey: ["accounting", "entries"] }),
    validateEntries: validateMutation.mutateAsync,
    isValidating: validateMutation.isPending,
  };
}

// -- Chart of accounts hook ------------------------------------------------

export interface ChartAccount {
  id: string;
  entity_id: string;
  account_number: string;
  label: string;
  account_type: string;
}

export function useChartOfAccounts(entityId?: string) {
  const { profile } = useAuth();
  const resolvedEntityId =
    entityId ??
    (profile as { default_entity_id?: string | null } | null)?.default_entity_id ??
    undefined;

  return useQuery({
    queryKey: ["accounting", "chart", resolvedEntityId],
    queryFn: async (): Promise<ChartAccount[]> => {
      if (!resolvedEntityId) return [];
      const res = await apiClient.get<{ success: boolean; data: { accounts: ChartAccount[] } }>(
        `/accounting/chart?entityId=${resolvedEntityId}`
      );
      return res?.data?.accounts ?? [];
    },
    enabled: !!profile && !!resolvedEntityId,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

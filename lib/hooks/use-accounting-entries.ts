/**
 * Hook React Query pour la liste des ecritures comptables
 *
 * Recupere les ecritures avec filtrage, pagination et totaux
 * pour l'entite selectionnee.
 */

"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "./use-auth";
import { useEntityStore } from "@/stores/useEntityStore";

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
  informational?: boolean;
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
  // Match the resolution order used by ExportsPageClient and the rest of the
  // accounting UI: explicit param → Zustand active entity → legacy profile
  // fallback. Without the Zustand read, this hook stays stuck on whatever
  // `default_entity_id` was baked into the profile (often null) and the
  // entries list renders empty even when rows exist.
  const activeEntityId = useEntityStore((s) => s.activeEntityId);
  const entityId =
    params.entityId ??
    activeEntityId ??
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
      // Engine-created entries carry `entity_id` (new double-entry schema),
      // not `owner_id` (which references profiles.id on legacy flat entries).
      searchParams.set("entity_id", entityId);
      searchParams.set("limit", String(limit));
      searchParams.set("offset", String(offset));

      if (params.journalCode) searchParams.set("journal_code", params.journalCode);
      if (params.startDate) searchParams.set("start_date", params.startDate);
      if (params.endDate) searchParams.set("end_date", params.endDate);
      if (params.search) searchParams.set("search", params.search);
      if (params.status && params.status !== "all") {
        searchParams.set("status", params.status);
      }
      if (params.source) searchParams.set("source", params.source);

      return apiClient.get<EntriesApiResponse>(
        `/accounting/entries?${searchParams.toString()}`
      );
    },
    enabled: !!profile && !!entityId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
    // Keep the previous page's data visible while the next page is loading
    // to avoid a flash of skeleton when the user types in the search box or
    // changes filters.
    placeholderData: keepPreviousData,
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
  const activeEntityId = useEntityStore((s) => s.activeEntityId);
  const resolvedEntityId =
    entityId ??
    activeEntityId ??
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

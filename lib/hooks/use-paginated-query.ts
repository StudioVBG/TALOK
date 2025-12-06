/**
 * Hook de pagination générique
 * 
 * Fournit une pagination côté serveur avec React Query.
 * Utilisable pour toutes les listes (propriétés, baux, factures, etc.)
 * 
 * Features:
 * - Pagination côté serveur (offset/limit)
 * - Tri personnalisable
 * - Filtres dynamiques
 * - Prefetch de la page suivante
 * - Compteur total
 */

import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useCallback, useState } from "react";

// Types
export interface PaginationParams {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  filters?: Record<string, any>;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface UsePaginatedQueryOptions<T> {
  queryKey: string[];
  fetchFn: (params: PaginationParams) => Promise<PaginatedResponse<T>>;
  initialPage?: number;
  initialPageSize?: number;
  initialSortBy?: string;
  initialSortOrder?: "asc" | "desc";
  initialFilters?: Record<string, any>;
  staleTime?: number;
  refetchOnWindowFocus?: boolean;
  enabled?: boolean;
}

export interface UsePaginatedQueryReturn<T> {
  // Données
  data: T[];
  total: number;
  totalPages: number;
  
  // État pagination
  page: number;
  pageSize: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  
  // Actions pagination
  goToPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  setPageSize: (size: number) => void;
  
  // Tri
  sortBy: string | undefined;
  sortOrder: "asc" | "desc";
  setSort: (field: string, order?: "asc" | "desc") => void;
  
  // Filtres
  filters: Record<string, any>;
  setFilter: (key: string, value: any) => void;
  setFilters: (filters: Record<string, any>) => void;
  clearFilters: () => void;
  
  // État query
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Hook de pagination générique
 */
export function usePaginatedQuery<T>({
  queryKey,
  fetchFn,
  initialPage = 1,
  initialPageSize = 20,
  initialSortBy,
  initialSortOrder = "desc",
  initialFilters = {},
  staleTime = 30000, // 30 secondes
  refetchOnWindowFocus = false,
  enabled = true,
}: UsePaginatedQueryOptions<T>): UsePaginatedQueryReturn<T> {
  const queryClient = useQueryClient();

  // État local
  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSizeState] = useState(initialPageSize);
  const [sortBy, setSortBy] = useState(initialSortBy);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(initialSortOrder);
  const [filters, setFiltersState] = useState<Record<string, any>>(initialFilters);

  // Paramètres de la requête
  const params: PaginationParams = {
    page,
    pageSize,
    sortBy,
    sortOrder,
    filters,
  };

  // Clé de cache complète
  const fullQueryKey = [...queryKey, params];

  // Query principale
  const {
    data: response,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: fullQueryKey,
    queryFn: () => fetchFn(params),
    placeholderData: keepPreviousData,
    staleTime,
    refetchOnWindowFocus,
    enabled,
  });

  // Prefetch de la page suivante
  const prefetchNextPage = useCallback(() => {
    if (response?.hasNextPage) {
      const nextParams = { ...params, page: page + 1 };
      queryClient.prefetchQuery({
        queryKey: [...queryKey, nextParams],
        queryFn: () => fetchFn(nextParams),
        staleTime,
      });
    }
  }, [response?.hasNextPage, page, params, queryKey, fetchFn, queryClient, staleTime]);

  // Prefetch au hover sur "suivant"
  // useEffect(() => {
  //   prefetchNextPage();
  // }, [page, prefetchNextPage]);

  // Actions
  const goToPage = useCallback((newPage: number) => {
    setPage(Math.max(1, Math.min(newPage, response?.totalPages || 1)));
  }, [response?.totalPages]);

  const nextPage = useCallback(() => {
    if (response?.hasNextPage) {
      setPage((p) => p + 1);
      prefetchNextPage();
    }
  }, [response?.hasNextPage, prefetchNextPage]);

  const prevPage = useCallback(() => {
    if (response?.hasPrevPage) {
      setPage((p) => Math.max(1, p - 1));
    }
  }, [response?.hasPrevPage]);

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    setPage(1); // Reset à la première page
  }, []);

  const setSort = useCallback((field: string, order?: "asc" | "desc") => {
    if (sortBy === field && !order) {
      // Toggle order si même champ
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder(order || "desc");
    }
    setPage(1); // Reset à la première page
  }, [sortBy]);

  const setFilter = useCallback((key: string, value: any) => {
    setFiltersState((prev) => {
      if (value === undefined || value === null || value === "") {
        const { [key]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [key]: value };
    });
    setPage(1); // Reset à la première page
  }, []);

  const setFilters = useCallback((newFilters: Record<string, any>) => {
    setFiltersState(newFilters);
    setPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setFiltersState({});
    setPage(1);
  }, []);

  return {
    // Données
    data: response?.data || [],
    total: response?.total || 0,
    totalPages: response?.totalPages || 0,

    // État pagination
    page,
    pageSize,
    hasNextPage: response?.hasNextPage || false,
    hasPrevPage: response?.hasPrevPage || false,

    // Actions pagination
    goToPage,
    nextPage,
    prevPage,
    setPageSize,

    // Tri
    sortBy,
    sortOrder,
    setSort,

    // Filtres
    filters,
    setFilter,
    setFilters,
    clearFilters,

    // État query
    isLoading,
    isFetching,
    isError,
    error: error as Error | null,
    refetch,
  };
}

/**
 * Helper pour créer une fonction fetch paginée depuis une API
 */
export function createPaginatedFetcher<T>(
  baseUrl: string,
  mapResponse?: (data: any) => T[]
) {
  return async (params: PaginationParams): Promise<PaginatedResponse<T>> => {
    const searchParams = new URLSearchParams();
    
    searchParams.set("page", String(params.page));
    searchParams.set("limit", String(params.pageSize));
    
    if (params.sortBy) {
      searchParams.set("sort_by", params.sortBy);
      searchParams.set("sort_order", params.sortOrder || "desc");
    }
    
    if (params.filters) {
      Object.entries(params.filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          searchParams.set(key, String(value));
        }
      });
    }

    const response = await fetch(`${baseUrl}?${searchParams.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Erreur ${response.status}: ${response.statusText}`);
    }

    const json = await response.json();

    // Adapter selon le format de réponse API
    const data = mapResponse ? mapResponse(json.data || json) : (json.data || json);
    const total = json.total || json.count || data.length;
    const totalPages = Math.ceil(total / params.pageSize);

    return {
      data,
      total,
      page: params.page,
      pageSize: params.pageSize,
      totalPages,
      hasNextPage: params.page < totalPages,
      hasPrevPage: params.page > 1,
    };
  };
}

export default usePaginatedQuery;


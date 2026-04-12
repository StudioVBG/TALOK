/**
 * Context Provider pour propager les données Owner
 * Évite les refetch inutiles lors de la navigation
 *
 * SOTA 2026 - Support refetch + données détaillées de l'API
 * (finances, portfolio, activité récente)
 */

"use client";

import { createContext, useContext, ReactNode, useState, useCallback, useEffect, useRef } from "react";
import type { PropertiesWithStats } from "./fetchProperties";
import type { OwnerDashboardData } from "./fetchDashboard";
import type { LeaseRow } from "@/lib/supabase/typed-client";
import { useEntityStore } from "@/stores/useEntityStore";

/**
 * Données détaillées retournées par /api/owner/dashboard
 * Incluent les finances réelles, le portfolio par module et l'activité récente
 */
export interface OwnerApiDashboardData {
  zone1_tasks: Array<{
    id: string;
    type: string;
    priority: string;
    label: string;
    count?: number;
    total_amount?: number;
    action_url: string;
  }>;
  recentActivity: Array<{
    id: string;
    type: "invoice" | "ticket" | "signature" | "lease";
    title: string;
    description: string;
    date: string;
    status?: string;
  }>;
  zone2_finances: {
    chart_data: Array<{
      period: string;
      expected: number;
      collected: number;
    }>;
    kpis: {
      revenue_current_month: {
        collected: number;
        expected: number;
        percentage: number;
      };
      revenue_last_month: {
        collected: number;
        expected: number;
        percentage: number;
      };
      arrears_amount: number;
    };
  };
  zone3_portfolio: {
    modules: Array<{
      module: "habitation" | "lcd" | "pro" | "parking";
      label: string;
      stats: {
        active_leases?: number;
        monthly_revenue?: number;
        occupancy_rate?: number;
        nights_sold?: number;
        revenue?: number;
        properties_count?: number;
      };
      action_url: string;
    }>;
    compliance: Array<{
      id: string;
      type: string;
      severity: "high" | "medium" | "low";
      label: string;
      action_url: string;
    }>;
    performance: {
      total_investment: number;
      total_monthly_revenue: number;
      annual_yield: number;
      roi: number;
    } | null;
  };
}

export interface OwnerDataContextValue {
  properties: PropertiesWithStats | null;
  dashboard: OwnerDashboardData | null;
  contracts: LeaseRow[] | null;
  /** Données détaillées de l'API (finances, portfolio, activité) */
  apiData: OwnerApiDashboardData | null;
  /** Indique si les données API sont en cours de chargement */
  isLoadingApi: boolean;
  isLoading?: boolean;
  error?: string | null;
  /** Rafraîchit les données détaillées depuis /api/owner/dashboard */
  refetch: () => Promise<void>;
  /** Indique si un rafraîchissement est en cours */
  isRefetching: boolean;
}

const OwnerDataContext = createContext<OwnerDataContextValue | null>(null);

export interface OwnerDataProviderProps {
  children: ReactNode;
  properties?: PropertiesWithStats | null;
  dashboard?: OwnerDashboardData | null;
  contracts?: LeaseRow[] | null;
  isLoading?: boolean;
  error?: string | null;
}

export function OwnerDataProvider({
  children,
  properties = null,
  dashboard: initialDashboard = null,
  contracts = null,
  isLoading = false,
  error: initialError = null,
}: OwnerDataProviderProps) {
  const [dashboard, setDashboard] = useState<OwnerDashboardData | null>(initialDashboard);
  const [apiData, setApiData] = useState<OwnerApiDashboardData | null>(null);
  const [isLoadingApi, setIsLoadingApi] = useState(true);
  const [isRefetching, setIsRefetching] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const activeEntityId = useEntityStore((s) => s.activeEntityId);
  const getActiveEntity = useEntityStore((s) => s.getActiveEntity);
  const prevEntityId = useRef(activeEntityId);

  /**
   * Résout l'entityId à envoyer à l'API :
   * - null → pas de filtre (tous les biens)
   * - entité de type "particulier" → "personal" (biens en nom propre, legal_entity_id IS NULL)
   * - autre UUID → tel quel (SCI, SARL, etc.)
   */
  const resolveEntityFilter = useCallback((): string | undefined => {
    if (!activeEntityId) return undefined;
    const activeEntity = getActiveEntity();
    if (activeEntity?.entityType === "particulier") return "personal";
    return activeEntityId;
  }, [activeEntityId, getActiveEntity]);

  // Charger les données détaillées de l'API au montage
  const fetchApiData = useCallback(async (entityId?: string | null) => {
    try {
      const params = new URLSearchParams();
      if (entityId) params.set("entityId", entityId);
      const url = `/api/owner/dashboard${params.toString() ? `?${params}` : ""}`;
      const res = await fetch(url, {
        method: "GET",
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(`Erreur ${res.status}`);
      }

      const data = await res.json();
      if (data && !data.error) {
        setApiData(data);
        // Update dashboard KPIs from entity-filtered API counts
        if (data.counts) {
          setDashboard((prev) => prev ? {
            ...prev,
            properties: {
              ...prev.properties,
              total: data.counts.properties?.total ?? prev.properties?.total ?? 0,
            },
            leases: {
              ...prev.leases,
              active: data.counts.leases?.active ?? prev.leases?.active ?? 0,
              pending: data.counts.leases?.pending ?? prev.leases?.pending ?? 0,
              total: data.counts.leases?.total ?? prev.leases?.total ?? 0,
            },
          } : prev);
        }
      }
    } catch (err) {
      console.error("[OwnerDataProvider] Erreur chargement API dashboard:", err);
    }
  }, []);

  // Chargement initial des données API
  useEffect(() => {
    setIsLoadingApi(true);
    fetchApiData(resolveEntityFilter()).finally(() => setIsLoadingApi(false));
  }, [fetchApiData, resolveEntityFilter]);

  // Re-fetch quand l'entité active change (après le montage initial)
  useEffect(() => {
    if (prevEntityId.current !== activeEntityId) {
      prevEntityId.current = activeEntityId;
      fetchApiData(resolveEntityFilter());
    }
  }, [activeEntityId, fetchApiData, resolveEntityFilter]);

  // Rafraîchir toutes les données
  const refetch = useCallback(async () => {
    setIsRefetching(true);
    try {
      await fetchApiData(resolveEntityFilter());
    } finally {
      setIsRefetching(false);
    }
  }, [fetchApiData, resolveEntityFilter]);

  return (
    <OwnerDataContext.Provider
      value={{
        properties,
        dashboard,
        contracts,
        apiData,
        isLoadingApi,
        isLoading,
        error,
        refetch,
        isRefetching,
      }}
    >
      {children}
    </OwnerDataContext.Provider>
  );
}

/**
 * Hook pour accéder aux données Owner depuis le Context
 */
export function useOwnerData(): OwnerDataContextValue {
  const context = useContext(OwnerDataContext);

  if (!context) {
    throw new Error("useOwnerData must be used within OwnerDataProvider");
  }

  return context;
}

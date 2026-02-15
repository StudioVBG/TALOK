/**
 * Context Provider pour les données Tenant
 * 
 * SOTA 2026 - Support refetch pour mise à jour des données après actions
 * (paiement, signature, upload document, etc.)
 */
"use client";

import { createContext, useContext, ReactNode, useState, useCallback } from "react";
import type { TenantDashboardData } from "./fetchTenantDashboard";

export interface TenantDataContextValue {
  dashboard: TenantDashboardData | null;
  profile: any | null;
  error?: string | null;
  /** Rafraîchit les données du dashboard en appelant l'API */
  refetch: () => Promise<void>;
  /** Indique si un rafraîchissement est en cours */
  isRefetching: boolean;
  /** Met à jour partiellement le dashboard (optimistic update) */
  updateDashboard: (updater: (prev: TenantDashboardData | null) => TenantDashboardData | null) => void;
}

const TenantDataContext = createContext<TenantDataContextValue | null>(null);

export interface TenantDataProviderProps {
  children: ReactNode;
  dashboard?: TenantDashboardData | null;
  profile?: any | null;
  error?: string | null;
}

export function TenantDataProvider({
  children,
  dashboard: initialDashboard = null,
  profile = null,
  error: initialError = null,
}: TenantDataProviderProps) {
  const [dashboard, setDashboard] = useState<TenantDashboardData | null>(initialDashboard);
  const [error, setError] = useState<string | null>(initialError);
  const [isRefetching, setIsRefetching] = useState(false);

  // Mise à jour optimiste du dashboard (ex: marquer une facture comme payée immédiatement)
  const updateDashboard = useCallback(
    (updater: (prev: TenantDashboardData | null) => TenantDashboardData | null) => {
      setDashboard(updater);
    },
    []
  );

  // Rafraîchir les données depuis l'API
  const refetch = useCallback(async () => {
    setIsRefetching(true);
    try {
      const res = await fetch("/api/tenant/dashboard", {
        method: "GET",
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(`Erreur ${res.status}`);
      }

      const data = await res.json();
      if (data) {
        setDashboard(data);
        setError(null);
      }
    } catch (err) {
      console.error("[TenantDataProvider] Erreur refetch:", err);
      // On ne remplace pas le dashboard existant en cas d'erreur de refetch
    } finally {
      setIsRefetching(false);
    }
  }, []);

  return (
    <TenantDataContext.Provider value={{ dashboard, profile, error, refetch, isRefetching, updateDashboard }}>
      {children}
    </TenantDataContext.Provider>
  );
}

export function useTenantData(): TenantDataContextValue {
  const context = useContext(TenantDataContext);
  if (!context) {
    throw new Error("useTenantData must be used within TenantDataProvider");
  }
  return context;
}

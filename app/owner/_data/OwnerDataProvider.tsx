// @ts-nocheck
/**
 * Context Provider pour propager les données Owner
 * Évite les refetch inutiles lors de la navigation
 */

"use client";

import { createContext, useContext, ReactNode } from "react";
import type { PropertiesWithStats } from "./fetchProperties";
import type { OwnerDashboardData } from "./fetchDashboard";
import type { LeaseRow } from "@/lib/supabase/typed-client";

export interface OwnerDataContextValue {
  properties: PropertiesWithStats | null;
  dashboard: OwnerDashboardData | null;
  contracts: LeaseRow[] | null;
  isLoading?: boolean;
  refetch?: () => void;
}

const OwnerDataContext = createContext<OwnerDataContextValue | null>(null);

export interface OwnerDataProviderProps {
  children: ReactNode;
  properties?: PropertiesWithStats | null;
  dashboard?: OwnerDashboardData | null;
  contracts?: LeaseRow[] | null;
  isLoading?: boolean;
  refetch?: () => void;
}

export function OwnerDataProvider({
  children,
  properties = null,
  dashboard = null,
  contracts = null,
  isLoading = false,
  refetch = () => {},
}: OwnerDataProviderProps) {
  return (
    <OwnerDataContext.Provider
      value={{
        properties,
        dashboard,
        contracts,
        isLoading,
        refetch,
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


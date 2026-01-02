/**
 * Context Provider pour les données Tenant
 */
"use client";

import { createContext, useContext, ReactNode } from "react";
import type { TenantDashboardData } from "./fetchTenantDashboard";

export interface TenantDataContextValue {
  dashboard: TenantDashboardData | null;
  profile: any | null;
}

const TenantDataContext = createContext<TenantDataContextValue | null>(null);

export interface TenantDataProviderProps {
  children: ReactNode;
  dashboard?: TenantDashboardData | null;
  profile?: any | null;
}

export function TenantDataProvider({
  children,
  dashboard = null,
  profile = null,
}: TenantDataProviderProps) {
  return (
    <TenantDataContext.Provider value={{ dashboard, profile }}>
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


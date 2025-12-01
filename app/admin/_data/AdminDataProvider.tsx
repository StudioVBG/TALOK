"use client";
// @ts-nocheck

import { createContext, useContext, ReactNode } from "react";
import type { AdminStatsData } from "./fetchAdminStats";

export interface AdminDataContextValue {
  stats: AdminStatsData | null;
}

const AdminDataContext = createContext<AdminDataContextValue | null>(null);

export interface AdminDataProviderProps {
  children: ReactNode;
  stats?: AdminStatsData | null;
}

export function AdminDataProvider({
  children,
  stats = null,
}: AdminDataProviderProps) {
  return (
    <AdminDataContext.Provider value={{ stats }}>
      {children}
    </AdminDataContext.Provider>
  );
}

export function useAdminData(): AdminDataContextValue {
  const context = useContext(AdminDataContext);
  if (!context) {
    throw new Error("useAdminData must be used within AdminDataProvider");
  }
  return context;
}


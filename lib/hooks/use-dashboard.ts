/**
 * Hook React Query pour le dashboard propriétaire
 * 
 * Remplace useState/useEffect par React Query pour :
 * - Cache automatique
 * - Synchronisation entre composants
 * - Refetch automatique
 * - Gestion d'erreurs améliorée
 */

"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "./use-auth";

export interface DashboardData {
  zone1_tasks: Array<{
    id: string;
    type: "rent_arrears" | "sign_contracts" | "indexation" | "lease_end" | "compliance";
    priority: "high" | "medium" | "low";
    label: string;
    count?: number;
    total_amount?: number;
    action_url: string;
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
      type: "dpe_expiring" | "lease_end" | "indexation_due" | "tax_declaration" | "compliance";
      severity: "high" | "medium" | "low";
      label: string;
      action_url: string;
    }>;
    performance?: {
      total_investment: number;
      total_monthly_revenue: number;
      annual_yield: number;
      roi: number;
    } | null;
  };
}

/**
 * Hook pour récupérer les données du dashboard propriétaire
 */
export function useDashboard() {
  const { profile } = useAuth();
  
  return useQuery({
    queryKey: ["dashboard", "owner", profile?.id],
    queryFn: async (): Promise<DashboardData> => {
      if (!profile) {
        throw new Error("Non authentifié");
      }
      
      try {
        const response = await apiClient.get<DashboardData>("/owner/dashboard");
        
        // S'assurer que la réponse a le bon format
        if (response && response.zone1_tasks && response.zone2_finances && response.zone3_portfolio) {
          return response;
        }
        
        // Format de fallback si la structure est différente
        return {
          zone1_tasks: [],
          zone2_finances: {
            chart_data: [],
            kpis: {
              revenue_current_month: { collected: 0, expected: 0, percentage: 0 },
              revenue_last_month: { collected: 0, expected: 0, percentage: 0 },
              arrears_amount: 0,
            },
          },
          zone3_portfolio: {
            modules: [],
            compliance: [],
          },
        };
      } catch (error: unknown) {
        console.error("[useDashboard] Error fetching dashboard:", error);
        
        // Si c'est une erreur de timeout ou réseau
        if (error?.statusCode === 504 || error?.message?.includes("timeout")) {
          throw new Error("Le chargement prend trop de temps. Veuillez réessayer.");
        }
        
        // Si c'est une erreur d'authentification
        if (error?.statusCode === 401 || error?.statusCode === 403) {
          throw new Error("Vous n'êtes pas autorisé à accéder à ces données.");
        }
        
        throw error;
      }
    },
    enabled: !!profile && profile.role === "owner",
    retry: (failureCount, error: any) => {
      // Ne pas réessayer si c'est une erreur d'authentification ou de timeout
      if (error?.statusCode === 401 || error?.statusCode === 403 || error?.statusCode === 504) {
        return false;
      }
      // Réessayer jusqu'à 2 fois pour les autres erreurs
      return failureCount < 2;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes - considérer les données comme fraîches pendant 2min
    gcTime: 10 * 60 * 1000, // 10 minutes - garder en cache pendant 10 minutes
    refetchOnWindowFocus: true, // Refetch quand la fenêtre reprend le focus
    refetchInterval: 5 * 60 * 1000, // Refetch automatique toutes les 5 minutes
  });
}


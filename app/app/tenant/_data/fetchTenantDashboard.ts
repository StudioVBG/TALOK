// @ts-nocheck
import { createClient } from "@/lib/supabase/server";

export interface TenantDashboardData {
  profile_id: string;
  lease: any | null;
  property: any | null;
  invoices: any[];
  tickets: any[];
  stats: {
    unpaid_amount: number;
    unpaid_count: number;
  };
}

export async function fetchTenantDashboard(userId: string): Promise<TenantDashboardData | null> {
  const supabase = await createClient();

  // On passe directement le user_id à la RPC qui est sécurisée (SECURITY DEFINER)
  // mais on vérifie quand même que c'est bien le user connecté
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user || user.id !== userId) {
    throw new Error("Accès non autorisé");
  }

  const { data, error } = await supabase.rpc("tenant_dashboard", {
    p_tenant_user_id: userId,
  });

  if (error) {
    console.error("[fetchTenantDashboard] RPC Error:", error);
    throw new Error("Erreur lors du chargement du dashboard locataire");
  }

  if (!data) return null;

  return data as TenantDashboardData;
}


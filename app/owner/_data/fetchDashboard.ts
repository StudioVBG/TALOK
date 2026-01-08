/**
 * Data fetching pour le dashboard Owner
 * Utilise une RPC Supabase pour batch les requêtes
 */

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export interface OwnerDashboardData {
  properties: {
    total: number;
    active: number;
    draft: number;
  };
  leases: {
    total: number;
    active: number;
    pending: number;
  };
  invoices: {
    total: number;
    paid: number;
    pending: number;
    late: number;
  };
  tickets: {
    total: number;
    open: number;
    in_progress: number;
  };
  edl: {
    total: number;
    pending_owner_signature: number;
  };
  zone3_portfolio?: {
    compliance: Array<{
      id: string;
      type: string;
      severity: "low" | "medium" | "high";
      label: string;
      action_url: string;
    }>;
  };
  recentActivity: Array<{
    type: string;
    title: string;
    date: string;
  }>;
}

// Type pour la réponse RPC
interface OwnerDashboardRPCResponse {
  properties_stats?: {
    total: number;
    active: number;
    draft: number;
  };
  leases_stats?: {
    total: number;
    active: number;
    pending: number;
  };
  invoices_stats?: {
    total: number;
    paid: number;
    pending: number;
    late: number;
  };
  tickets_stats?: {
    total: number;
    open: number;
    in_progress: number;
  };
  edl_stats?: {
    total: number;
    pending_owner_signature: number;
  };
  zone3_portfolio?: {
    compliance: Array<{
      id: string;
      type: string;
      severity: "low" | "medium" | "high";
      label: string;
      action_url: string;
    }>;
  };
}

/**
 * Récupère les données du dashboard pour un propriétaire
 * Utilise une RPC Supabase pour réduire les appels
 */
export async function fetchDashboard(ownerId: string): Promise<OwnerDashboardData> {
  const supabase = await createClient();

  // Vérifier l'authentification
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/auth/signin");
  }

  // Vérifier les permissions
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.role !== "owner" || profile.id !== ownerId) {
    throw new Error("Accès non autorisé");
  }

  // Utilisation de la RPC unique owner_dashboard
  // Cette fonction a été créée via la migration 20250101000001_owner_dashboard_rpc.sql
  const { data, error } = await supabase.rpc("owner_dashboard", {
    p_owner_id: ownerId,
  });

  if (error) {
    console.error("Erreur RPC dashboard:", error);
    // En cas d'erreur RPC, on pourrait envisager un fallback, mais ici on propage l'erreur
    // pour ne pas masquer le problème de configuration DB
    throw new Error(`Erreur lors du chargement du dashboard: ${error.message}`);
  }

  const dashboardData = data as OwnerDashboardRPCResponse;

  return {
    properties: dashboardData?.properties_stats || { total: 0, active: 0, draft: 0 },
    leases: dashboardData?.leases_stats || { total: 0, active: 0, pending: 0 },
    invoices: dashboardData?.invoices_stats || { total: 0, paid: 0, pending: 0, late: 0 },
    tickets: dashboardData?.tickets_stats || { total: 0, open: 0, in_progress: 0 },
    edl: dashboardData?.edl_stats || { total: 0, pending_owner_signature: 0 },
    zone3_portfolio: dashboardData?.zone3_portfolio || { compliance: [] },
    recentActivity: [], // À implémenter plus tard
  };
}


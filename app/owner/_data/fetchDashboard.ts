/**
 * Data fetching pour le dashboard Owner
 * Utilise une RPC Supabase pour batch les requêtes
 * Fallback sur des requêtes directes si la RPC échoue
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
  recentActivity?: Array<{
    type: string;
    title: string;
    date: string;
  }>;
}

/**
 * Fallback : requêtes directes quand la RPC n'est pas disponible
 */
async function fetchDashboardFallback(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ownerId: string
): Promise<OwnerDashboardData> {
  // Récupérer les IDs des propriétés de ce propriétaire
  const { data: ownedProperties } = await supabase
    .from("properties")
    .select("id, etat")
    .eq("owner_id", ownerId);

  const propertyIds = ownedProperties?.map((p) => p.id) || [];

  const propertiesStats = {
    total: ownedProperties?.length || 0,
    active: ownedProperties?.filter((p) => p.etat === "published").length || 0,
    draft: ownedProperties?.filter((p) => p.etat === "draft").length || 0,
  };

  // Baux
  let leasesStats = { total: 0, active: 0, pending: 0 };
  if (propertyIds.length > 0) {
    const { data: leases } = await supabase
      .from("leases")
      .select("id, statut")
      .in("property_id", propertyIds);

    if (leases) {
      leasesStats = {
        total: leases.length,
        active: leases.filter((l) => l.statut === "active").length,
        pending: leases.filter((l) => l.statut === "pending_signature").length,
      };
    }
  }

  // Factures
  let invoicesStats = { total: 0, paid: 0, pending: 0, late: 0 };
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, statut")
    .eq("owner_id", ownerId);

  if (invoices) {
    invoicesStats = {
      total: invoices.length,
      paid: invoices.filter((i) => i.statut === "paid").length,
      pending: invoices.filter((i) => i.statut === "sent").length,
      late: invoices.filter((i) => i.statut === "late").length,
    };
  }

  // Tickets
  let ticketsStats = { total: 0, open: 0, in_progress: 0 };
  if (propertyIds.length > 0) {
    const { data: tickets } = await supabase
      .from("tickets")
      .select("id, statut")
      .in("property_id", propertyIds);

    if (tickets) {
      ticketsStats = {
        total: tickets.length,
        open: tickets.filter((t) => t.statut === "open").length,
        in_progress: tickets.filter((t) => t.statut === "in_progress").length,
      };
    }
  }

  return {
    properties: propertiesStats,
    leases: leasesStats,
    invoices: invoicesStats,
    tickets: ticketsStats,
    edl: { total: 0, pending_owner_signature: 0 },
    zone3_portfolio: { compliance: [] },
    recentActivity: [],
  };
}

/**
 * Récupère les données du dashboard pour un propriétaire
 * Tente la RPC Supabase, fallback sur requêtes directes si échec
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

  // 1. Tenter la RPC owner_dashboard
  const { data, error } = await supabase.rpc("owner_dashboard", {
    p_owner_id: ownerId,
  });

  if (error) {
    console.error("Erreur RPC dashboard, fallback sur requêtes directes:", error.message);
    // Fallback : requêtes directes table par table
    return fetchDashboardFallback(supabase, ownerId);
  }

  // 2. Mapper la réponse RPC
  const dashboardData = data as OwnerDashboardRPCResponse;

  return {
    properties: dashboardData?.properties_stats || { total: 0, active: 0, draft: 0 },
    leases: dashboardData?.leases_stats || { total: 0, active: 0, pending: 0 },
    invoices: dashboardData?.invoices_stats || { total: 0, paid: 0, pending: 0, late: 0 },
    tickets: dashboardData?.tickets_stats || { total: 0, open: 0, in_progress: 0 },
    edl: dashboardData?.edl_stats || { total: 0, pending_owner_signature: 0 },
    zone3_portfolio: dashboardData?.zone3_portfolio || { compliance: [] },
    recentActivity: dashboardData?.recentActivity || [],
  };
}

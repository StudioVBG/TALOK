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
  recent_activity?: Array<{
    type: string;
    title: string;
    date: string;
  }>;
}

/**
 * Fallback: requêtes directes quand la RPC n'est pas disponible
 */
async function fetchDashboardDirect(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ownerId: string
): Promise<OwnerDashboardData> {
  // Récupérer les propriétés du propriétaire
  const { data: properties } = await supabase
    .from("properties")
    .select("id, etat")
    .eq("owner_id", ownerId);

  const propertyIds = (properties || []).map((p: { id: string }) => p.id);

  const propertiesStats = {
    total: properties?.length || 0,
    active: (properties || []).filter((p: { etat?: string }) => p.etat === "published").length,
    draft: (properties || []).filter((p: { etat?: string }) => p.etat === "draft").length,
  };

  // Si aucune propriété, retourner des données vides
  if (propertyIds.length === 0) {
    return {
      properties: propertiesStats,
      leases: { total: 0, active: 0, pending: 0 },
      invoices: { total: 0, paid: 0, pending: 0, late: 0 },
      tickets: { total: 0, open: 0, in_progress: 0 },
      edl: { total: 0, pending_owner_signature: 0 },
      zone3_portfolio: { compliance: [] },
      recentActivity: [],
    };
  }

  // Requêtes parallèles pour les stats (incluant EDL et activité récente)
  const leaseIds: string[] = [];
  const [leasesResult, invoicesResult, ticketsResult, edlResult, recentInvoicesResult] = await Promise.allSettled([
    supabase
      .from("leases")
      .select("id, statut")
      .in("property_id", propertyIds),
    supabase
      .from("invoices")
      .select("id, statut")
      .eq("owner_id", ownerId),
    supabase
      .from("tickets")
      .select("id, statut, created_at")
      .in("property_id", propertyIds),
    // EDL query - récupérer les états des lieux liés aux propriétés
    supabase
      .from("edl")
      .select("id, statut, owner_signed")
      .in("property_id", propertyIds),
    // Activité récente - dernières factures et tickets pour le flux d'activité
    supabase
      .from("invoices")
      .select("id, statut, periode, created_at")
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const leases = leasesResult.status === "fulfilled" ? leasesResult.value.data || [] : [];
  const invoices = invoicesResult.status === "fulfilled" ? invoicesResult.value.data || [] : [];
  const tickets = ticketsResult.status === "fulfilled" ? ticketsResult.value.data || [] : [];
  const edls = edlResult.status === "fulfilled" ? edlResult.value.data || [] : [];
  const recentInvoices = recentInvoicesResult.status === "fulfilled" ? recentInvoicesResult.value.data || [] : [];

  // Construire l'activité récente à partir des factures ET tickets récents
  const recentActivity = [
    ...recentInvoices.map((inv: { id: string; statut: string; periode: string; created_at: string }) => ({
      type: "invoice" as const,
      title: `Facture ${inv.periode} - ${inv.statut === "paid" ? "payée" : inv.statut === "late" ? "en retard" : "envoyée"}`,
      date: inv.created_at,
    })),
    // Ajouter les tickets récents (triés par date)
    ...(tickets || [])
      .filter((t: any) => t.created_at)
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 3)
      .map((t: any) => ({
        type: "ticket" as const,
        title: `Ticket ${t.statut === "open" ? "ouvert" : t.statut === "in_progress" ? "en cours" : "résolu"}`,
        date: t.created_at,
      })),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 8);

  return {
    properties: propertiesStats,
    leases: {
      total: leases.length,
      // "Actifs" = baux en vigueur (active + notice_given + amended)
      active: leases.filter((l: { statut: string }) =>
        ["active", "notice_given", "amended"].includes(l.statut)
      ).length,
      // "En attente" = tout le pipeline de signature
      pending: leases.filter((l: { statut: string }) =>
        ["sent", "pending_signature", "partially_signed", "pending_owner_signature", "fully_signed"].includes(l.statut)
      ).length,
    },
    invoices: {
      total: invoices.length,
      paid: invoices.filter((i: { statut: string }) => i.statut === "paid").length,
      pending: invoices.filter((i: { statut: string }) => i.statut === "sent").length,
      late: invoices.filter((i: { statut: string }) => i.statut === "late").length,
    },
    tickets: {
      total: tickets.length,
      open: tickets.filter((t: { statut: string }) => t.statut === "open").length,
      in_progress: tickets.filter((t: { statut: string }) => t.statut === "in_progress").length,
    },
    edl: {
      total: edls.length,
      pending_owner_signature: (edls as Array<{ statut?: string; owner_signed?: boolean | null }>).filter((e) =>
        e.statut === "completed" && !e.owner_signed
      ).length,
    },
    zone3_portfolio: { compliance: [] },
    recentActivity,
  };
}

/**
 * Récupère les données du dashboard pour un propriétaire
 * Utilise une RPC Supabase pour réduire les appels, avec fallback sur requêtes directes
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

  // Tenter la RPC optimisée en premier
  const { data, error } = await supabase.rpc("owner_dashboard", {
    p_owner_id: ownerId,
  });

  if (error) {
    console.warn("[fetchDashboard] RPC owner_dashboard failed, using direct queries fallback:", error.message);
    // Fallback sur des requêtes directes aux tables
    return fetchDashboardDirect(supabase, ownerId);
  }

  const dashboardData = data as OwnerDashboardRPCResponse;

  return {
    properties: dashboardData?.properties_stats || { total: 0, active: 0, draft: 0 },
    leases: dashboardData?.leases_stats || { total: 0, active: 0, pending: 0 },
    invoices: dashboardData?.invoices_stats || { total: 0, paid: 0, pending: 0, late: 0 },
    tickets: dashboardData?.tickets_stats || { total: 0, open: 0, in_progress: 0 },
    edl: dashboardData?.edl_stats || { total: 0, pending_owner_signature: 0 },
    zone3_portfolio: dashboardData?.zone3_portfolio || { compliance: [] },
    recentActivity: dashboardData?.recent_activity || [],
  };
}


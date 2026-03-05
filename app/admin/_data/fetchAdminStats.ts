import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export interface AdminStatsData {
  totalUsers: number;
  usersByRole: {
    admin: number;
    owner: number;
    tenant: number;
    provider: number;
  };
  totalProperties: number;
  propertiesByType: Record<string, number>;
  totalLeases: number;
  activeLeases: number;
  leasesByStatus: Record<string, number>;
  totalInvoices: number;
  unpaidInvoices: number;
  invoicesByStatus: Record<string, number>;
  totalTickets: number;
  openTickets: number;
  ticketsByStatus: Record<string, number>;
  totalDocuments: number;
  totalBlogPosts: number;
  publishedBlogPosts: number;
  recentActivity: any[];
}

export async function fetchAdminStats(): Promise<AdminStatsData | null> {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    // Rediriger au lieu de lancer une erreur - le layout devrait déjà gérer cela
    // mais cette protection supplémentaire évite les erreurs non gérées
    redirect("/auth/signin");
  }

  // Note: Cette RPC est rapide (agrégats). 
  // On pourrait utiliser unstable_cache ici si la charge DB devenait critique,
  // mais cela nécessiterait de gérer l'auth context (via service role).
  // Pour l'instant, le Streaming UI (Suspense) suffit pour l'UX.
  
  const { data, error } = await supabase.rpc("admin_stats");

  if (error) {
    console.error("[fetchAdminStats] RPC Error:", error);
    return null;
  }

  return data as AdminStatsData;
}

// Type V2 avec données réelles (revenus mensuels, tendances, modération, abonnements)
export interface AdminStatsDataV2 {
  totalUsers: number;
  usersByRole: { admin: number; owner: number; tenant: number; provider: number };
  newUsersThisMonth: number;
  newUsersPrevMonth: number;
  totalProperties: number;
  propertiesByStatus: { active: number; rented: number; draft: number; archived: number };
  totalLeases: number;
  activeLeases: number;
  leasesByStatus: { active: number; pending_signature: number; draft: number; terminated: number };
  totalInvoices: number;
  unpaidInvoices: number;
  invoicesByStatus: { paid: number; sent: number; late: number; draft: number };
  totalTickets: number;
  openTickets: number;
  ticketsByStatus: { open: number; in_progress: number; resolved: number; closed: number };
  monthlyRevenue: Array<{ month: string; attendu: number; encaisse: number }>;
  trends: { users: number[]; properties: number[]; leases: number[] };
  occupancyRate: number;
  collectionRate: number;
  totalDocuments: number;
  totalBlogPosts: number;
  publishedBlogPosts: number;
  moderationPending: number;
  moderationCritical: number;
  subscriptionStats: { total: number; active: number; trial: number; churned: number };
  recentActivity: Array<{ type: 'user' | 'property' | 'lease' | 'payment'; description: string; date: string }>;
}

export async function fetchAdminStatsV2(): Promise<AdminStatsDataV2 | null> {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    redirect("/auth/signin");
  }

  // Appel de la RPC admin_stats de base
  const { data, error } = await supabase.rpc("admin_stats");

  if (error) {
    console.error("[fetchAdminStatsV2] RPC Error:", error);
    return null;
  }

  const base = data as AdminStatsData;

  // Enrichir avec les données V2 calculées côté serveur
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0).toISOString();

  // Nouveaux utilisateurs ce mois / mois précédent
  const [newThisMonth, newPrevMonth] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", startOfMonth),
    supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", startOfPrevMonth).lte("created_at", endOfPrevMonth),
  ]);

  // Revenus mensuels (12 derniers mois)
  let monthlyData = null;
  try {
    const result = await supabase.rpc("admin_monthly_revenue");
    monthlyData = result.data;
  } catch {
    // RPC may not exist yet
  }

  // Modération
  const [moderationPending, moderationCritical] = await Promise.all([
    supabase.from("moderation_queue").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("moderation_queue").select("id", { count: "exact", head: true }).eq("status", "pending").eq("severity", "critical"),
  ]);

  // Abonnements
  let subStats = null;
  try {
    const result = await supabase.rpc("admin_subscription_stats");
    subStats = result.data;
  } catch {
    // RPC may not exist yet
  }

  // Tendances 7 jours (comptages quotidiens)
  let trendData = null;
  try {
    const result = await supabase.rpc("admin_daily_trends");
    trendData = result.data;
  } catch {
    // RPC may not exist yet
  }

  // Taux d'occupation et de recouvrement
  const occupancyRate = base.totalProperties > 0
    ? Math.round((base.activeLeases / base.totalProperties) * 100)
    : 0;
  const collectionRate = base.totalInvoices > 0
    ? Math.round(((base.totalInvoices - base.unpaidInvoices) / base.totalInvoices) * 100)
    : 100;

  return {
    totalUsers: base.totalUsers,
    usersByRole: base.usersByRole || { admin: 0, owner: 0, tenant: 0, provider: 0 },
    newUsersThisMonth: newThisMonth.count || 0,
    newUsersPrevMonth: newPrevMonth.count || 0,
    totalProperties: base.totalProperties,
    propertiesByStatus: {
      active: (base.propertiesByType as Record<string, number>)?.active || base.totalProperties,
      rented: (base.propertiesByType as Record<string, number>)?.rented || 0,
      draft: (base.propertiesByType as Record<string, number>)?.draft || 0,
      archived: (base.propertiesByType as Record<string, number>)?.archived || 0,
    },
    totalLeases: base.totalLeases,
    activeLeases: base.activeLeases,
    leasesByStatus: {
      active: base.leasesByStatus?.active || base.activeLeases,
      pending_signature: base.leasesByStatus?.pending_signature || 0,
      draft: base.leasesByStatus?.draft || 0,
      terminated: base.leasesByStatus?.terminated || 0,
    },
    totalInvoices: base.totalInvoices,
    unpaidInvoices: base.unpaidInvoices,
    invoicesByStatus: {
      paid: base.invoicesByStatus?.paid || 0,
      sent: base.invoicesByStatus?.sent || 0,
      late: base.invoicesByStatus?.late || base.unpaidInvoices,
      draft: base.invoicesByStatus?.draft || 0,
    },
    totalTickets: base.totalTickets,
    openTickets: base.openTickets,
    ticketsByStatus: {
      open: base.ticketsByStatus?.open || base.openTickets,
      in_progress: base.ticketsByStatus?.in_progress || 0,
      resolved: base.ticketsByStatus?.resolved || 0,
      closed: base.ticketsByStatus?.closed || 0,
    },
    monthlyRevenue: (monthlyData as AdminStatsDataV2["monthlyRevenue"]) || [],
    trends: (trendData as AdminStatsDataV2["trends"]) || { users: [], properties: [], leases: [] },
    occupancyRate,
    collectionRate,
    totalDocuments: base.totalDocuments,
    totalBlogPosts: base.totalBlogPosts,
    publishedBlogPosts: base.publishedBlogPosts,
    moderationPending: moderationPending.count || 0,
    moderationCritical: moderationCritical.count || 0,
    subscriptionStats: (subStats as AdminStatsDataV2["subscriptionStats"]) || { total: 0, active: 0, trial: 0, churned: 0 },
    recentActivity: (base.recentActivity as AdminStatsDataV2["recentActivity"]) || [],
  };
}

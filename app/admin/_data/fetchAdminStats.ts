import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

// Shape brute renvoyee par la RPC admin_stats — utilisee comme base par fetchAdminStatsV2.
export interface AdminStatsData {
  totalUsers: number;
  usersByRole: {
    admin: number;
    owner: number;
    tenant: number;
    provider: number;
    syndic?: number;
    agency?: number;
    guarantor?: number;
  };
  totalProperties: number;
  deletedProperties?: number;
  propertiesByType: Record<string, number>;
  propertiesByRentalStatus?: Record<string, number>;
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
  recentActivity: Array<{
    type: string;
    description: string;
    date: string;
  }>;
}

// Type V2 avec données réelles (revenus mensuels, tendances, modération, abonnements)
export interface AdminStatsDataV2 {
  totalUsers: number;
  usersByRole: {
    admin: number;
    owner: number;
    tenant: number;
    provider: number;
    syndic: number;
    agency: number;
    guarantor: number;
  };
  newUsersThisMonth: number;
  newUsersPrevMonth: number;
  totalProperties: number;
  deletedProperties: number;
  propertiesByType: Record<string, number>;
  propertiesByRentalStatus: Record<string, number>;
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
  /** New users in the last 7 days */
  newUsersThisWeek: number;
  /** MRR in cents (monthly + yearly/12 for active/trialing subs) */
  mrr: number;
  /** Churn rate (%) on last 30 days: canceled / active_at_start_of_period */
  churnRate: number;
  /** MRR distribution by plan */
  revenueByPlan: Array<{ plan: string; mrr: number; subscribers: number }>;
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

  // New users this week
  const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { count: newUsersThisWeek } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .gte("created_at", startOfWeek);

  // MRR + revenue by plan (from active/trialing subscriptions joined with subscription_plans)
  let mrr = 0;
  const revenueByPlan: Array<{ plan: string; mrr: number; subscribers: number }> = [];
  try {
    const { data: activeSubs } = await supabase
      .from("subscriptions")
      .select("billing_cycle, plan:subscription_plans!plan_id(name, price_monthly, price_yearly)")
      .in("status", ["active", "trialing"]);

    if (activeSubs) {
      const perPlan = new Map<string, { mrr: number; subscribers: number }>();
      for (const sub of activeSubs as Array<{
        billing_cycle: string;
        plan: { name: string; price_monthly: number; price_yearly: number } | null;
      }>) {
        if (!sub.plan) continue;
        const monthlyRev =
          sub.billing_cycle === "yearly"
            ? Math.round((sub.plan.price_yearly || 0) / 12)
            : sub.plan.price_monthly || 0;
        mrr += monthlyRev;
        const existing = perPlan.get(sub.plan.name) || { mrr: 0, subscribers: 0 };
        perPlan.set(sub.plan.name, {
          mrr: existing.mrr + monthlyRev,
          subscribers: existing.subscribers + 1,
        });
      }
      for (const [plan, { mrr: planMrr, subscribers }] of perPlan) {
        revenueByPlan.push({ plan, mrr: planMrr, subscribers });
      }
      revenueByPlan.sort((a, b) => b.mrr - a.mrr);
    }
  } catch {
    // table may not exist or join may fail
  }

  // Churn rate (last 30 days): canceled / (active + canceled) in period
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  let churnRate = 0;
  try {
    const [canceledResult, activeResult] = await Promise.all([
      supabase
        .from("subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("status", "canceled")
        .gte("canceled_at", thirtyDaysAgo),
      supabase
        .from("subscriptions")
        .select("id", { count: "exact", head: true })
        .in("status", ["active", "trialing"]),
    ]);
    const canceled = canceledResult.count || 0;
    const active = activeResult.count || 0;
    const denominator = canceled + active;
    churnRate = denominator > 0 ? Math.round((canceled / denominator) * 100 * 10) / 10 : 0;
  } catch {
    // no subscriptions table
  }

  // Taux d'occupation = (properties avec rental_status != vacant) / total
  const rentalStatus = (base as { propertiesByRentalStatus?: Record<string, number> }).propertiesByRentalStatus || {};
  const occupiedCount = Object.entries(rentalStatus)
    .filter(([key]) => key !== "vacant" && key !== "non_defini")
    .reduce((sum, [, v]) => sum + (v || 0), 0);

  const occupancyRate = base.totalProperties > 0
    ? Math.round((occupiedCount / base.totalProperties) * 100)
    : 0;
  const collectionRate = base.totalInvoices > 0
    ? Math.round(((base.totalInvoices - base.unpaidInvoices) / base.totalInvoices) * 100)
    : 100;

  const baseRoles = base.usersByRole || { admin: 0, owner: 0, tenant: 0, provider: 0 };

  return {
    totalUsers: base.totalUsers,
    usersByRole: {
      admin: baseRoles.admin || 0,
      owner: baseRoles.owner || 0,
      tenant: baseRoles.tenant || 0,
      provider: baseRoles.provider || 0,
      syndic: baseRoles.syndic || 0,
      agency: baseRoles.agency || 0,
      guarantor: baseRoles.guarantor || 0,
    },
    newUsersThisMonth: newThisMonth.count || 0,
    newUsersPrevMonth: newPrevMonth.count || 0,
    totalProperties: base.totalProperties,
    deletedProperties: (base as { deletedProperties?: number }).deletedProperties || 0,
    propertiesByType: base.propertiesByType || {},
    propertiesByRentalStatus: rentalStatus,
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
    newUsersThisWeek: newUsersThisWeek || 0,
    mrr,
    churnRate,
    revenueByPlan,
    recentActivity: (base.recentActivity as AdminStatsDataV2["recentActivity"]) || [],
  };
}

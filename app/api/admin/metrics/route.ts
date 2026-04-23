import { NextResponse } from "next/server";
import { requireAdminPermissions, isAdminAuthError } from "@/lib/middleware/admin-rbac";
import { createServiceRoleClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const auth = await requireAdminPermissions(request, ["admin.reports.read"], {
    rateLimit: "adminStandard",
    auditAction: "Consultation métriques admin",
  });
  if (isAdminAuthError(auth)) return auth;

  const serviceClient = createServiceRoleClient();

  // Inscriptions par jour (30 derniers jours)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: recentUsers } = await serviceClient
    .from("profiles")
    .select("created_at, role")
    .gte("created_at", thirtyDaysAgo.toISOString())
    .order("created_at", { ascending: true });

  // Grouper par jour
  const signupsByDay: Record<string, number> = {};
  const signupsByRole: Record<string, number> = {};
  (recentUsers || []).forEach((u: Record<string, unknown>) => {
    const day = (u.created_at as string).split("T")[0];
    signupsByDay[day] = (signupsByDay[day] || 0) + 1;
    const role = (u.role as string) || "unknown";
    signupsByRole[role] = (signupsByRole[role] || 0) + 1;
  });

  // Totaux par role
  const { data: allProfiles } = await serviceClient
    .from("profiles")
    .select("role", { count: "exact" });

  const totalByRole: Record<string, number> = {};
  (allProfiles || []).forEach((p: Record<string, unknown>) => {
    const role = (p.role as string) || "unknown";
    totalByRole[role] = (totalByRole[role] || 0) + 1;
  });

  // Biens crees (30 jours)
  const { count: newProperties } = await serviceClient
    .from("properties")
    .select("id", { count: "exact", head: true })
    .gte("created_at", thirtyDaysAgo.toISOString());

  // Baux actifs
  const { count: activeLeases } = await serviceClient
    .from("leases")
    .select("id", { count: "exact", head: true })
    .eq("statut", "active");

  const { count: totalLeases } = await serviceClient
    .from("leases")
    .select("id", { count: "exact", head: true });

  // Paiements (volume)
  const { data: payments } = await serviceClient
    .from("invoices")
    .select("amount, status, created_at")
    .gte("created_at", thirtyDaysAgo.toISOString());

  const paymentStats = {
    total_volume: 0,
    paid_volume: 0,
    count: payments?.length || 0,
    paid_count: 0,
  };
  (payments || []).forEach((p: Record<string, unknown>) => {
    const amount = Number(p.amount) || 0;
    paymentStats.total_volume += amount;
    if (p.status === "paid") {
      paymentStats.paid_volume += amount;
      paymentStats.paid_count += 1;
    }
  });

  // Support tickets stats
  const { data: ticketStats } = await serviceClient
    .from("support_tickets")
    .select("status")
    .limit(1000);

  const openTickets = (ticketStats || []).filter(
    (t: Record<string, unknown>) => t.status === "open" || t.status === "in_progress"
  ).length;

  // Conversions: users with subscriptions vs free
  const { count: totalUsers } = await serviceClient
    .from("profiles")
    .select("id", { count: "exact", head: true });

  const { count: payingUsers } = await serviceClient
    .from("subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("status", "active")
    .neq("plan_slug", "gratuit");

  // Monthly signups for chart (12 months)
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  const { data: yearUsers } = await serviceClient
    .from("profiles")
    .select("created_at")
    .gte("created_at", twelveMonthsAgo.toISOString())
    .order("created_at", { ascending: true });

  const monthLabels = [
    "Jan", "Fev", "Mar", "Avr", "Mai", "Juin",
    "Juil", "Aout", "Sep", "Oct", "Nov", "Dec",
  ];
  const monthlySignups = Array(12).fill(0);
  (yearUsers || []).forEach((u: Record<string, unknown>) => {
    const month = new Date(u.created_at as string).getMonth();
    monthlySignups[month] += 1;
  });

  const signupsChart = monthLabels.map((label, i) => ({
    month: label,
    inscriptions: monthlySignups[i],
  }));

  return NextResponse.json({
    signupsByDay,
    signupsByRole,
    totalByRole,
    newProperties: newProperties || 0,
    activeLeases: activeLeases || 0,
    totalLeases: totalLeases || 0,
    paymentStats,
    openTickets,
    totalUsers: totalUsers || 0,
    payingUsers: payingUsers || 0,
    conversionRate: totalUsers ? Math.round(((payingUsers || 0) / totalUsers) * 100) : 0,
    signupsChart,
  });
}

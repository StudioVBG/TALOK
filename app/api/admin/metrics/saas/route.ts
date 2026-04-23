export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/metrics/saas
 * Métriques SaaS avancées : churn, MRR trend, ARPU, cohortes, LTV estimé.
 */

import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireAdminPermissions, isAdminAuthError } from "@/lib/middleware/admin-rbac";

export async function GET(request: Request) {
  const auth = await requireAdminPermissions(request, ["admin.reports.read"], {
    rateLimit: "adminStandard",
    auditAction: "Consultation des métriques SaaS",
  });
  if (isAdminAuthError(auth)) return auth;

  const supabase = createServiceRoleClient();
  const now = new Date();
  const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const d90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  // ============================================================
  // 1. MRR historique 12 mois (via subscription_events ou subscriptions)
  // ============================================================
  const { data: subs } = await supabase
    .from("subscriptions")
    .select(
      `
      id, owner_id, status, created_at, canceled_at,
      plan:subscription_plans!plan_id(slug, price_monthly, name)
    `
    );

  const subsList = (subs || []) as Array<Record<string, unknown>>;
  const entitled = (st: string) => ["active", "trialing", "past_due"].includes(st);

  const mrrByMonth: { month: string; mrr: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
    const mrr = subsList.reduce((sum, s) => {
      const plan = s.plan as Record<string, unknown> | null;
      const price = (plan?.price_monthly as number) || 0;
      const createdAt = new Date((s.created_at as string) || 0);
      const canceledAt = s.canceled_at ? new Date(s.canceled_at as string) : null;
      const status = s.status as string;
      // Actif sur ce mois si créé avant la fin et non annulé avant le début
      if (createdAt <= endOfMonth && (!canceledAt || canceledAt > d) && entitled(status)) {
        return sum + price;
      }
      return sum;
    }, 0);
    mrrByMonth.push({
      month: d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }),
      mrr,
    });
  }

  // ============================================================
  // 2. Churn rate sur 30 et 90 jours
  //    churn = abonnements annulés / abonnements au début de la période
  // ============================================================
  const activeAtStartOfPeriod = (periodStart: Date) =>
    subsList.filter((s) => {
      const createdAt = new Date((s.created_at as string) || 0);
      const canceledAt = s.canceled_at ? new Date(s.canceled_at as string) : null;
      return createdAt <= periodStart && (!canceledAt || canceledAt > periodStart);
    }).length;

  const canceledWithin = (since: Date) =>
    subsList.filter((s) => {
      if (!s.canceled_at) return false;
      return new Date(s.canceled_at as string) >= since;
    }).length;

  const active30 = activeAtStartOfPeriod(d30);
  const active90 = activeAtStartOfPeriod(d90);
  const cancel30 = canceledWithin(d30);
  const cancel90 = canceledWithin(d90);

  const churn30 = active30 > 0 ? Math.round((cancel30 / active30) * 1000) / 10 : 0;
  const churn90 = active90 > 0 ? Math.round((cancel90 / active90) * 1000) / 10 : 0;

  // ============================================================
  // 3. Churn par plan (30 jours)
  // ============================================================
  const churnByPlan: Record<string, { name: string; active: number; canceled: number; rate: number }> = {};
  subsList.forEach((s) => {
    const plan = s.plan as Record<string, unknown> | null;
    const slug = (plan?.slug as string) || "inconnu";
    const name = (plan?.name as string) || "Inconnu";
    if (!churnByPlan[slug]) {
      churnByPlan[slug] = { name, active: 0, canceled: 0, rate: 0 };
    }
    const createdAt = new Date((s.created_at as string) || 0);
    const canceledAt = s.canceled_at ? new Date(s.canceled_at as string) : null;
    if (createdAt <= d30 && (!canceledAt || canceledAt > d30)) {
      churnByPlan[slug].active += 1;
    }
    if (canceledAt && canceledAt >= d30) {
      churnByPlan[slug].canceled += 1;
    }
  });
  Object.values(churnByPlan).forEach((c) => {
    c.rate = c.active > 0 ? Math.round((c.canceled / c.active) * 1000) / 10 : 0;
  });

  // ============================================================
  // 4. ARPU & LTV estimé
  //    MRR actuel / nombre d'abonnés payants
  //    LTV ≈ ARPU / churn_rate (mensuel)
  // ============================================================
  const currentMrr = subsList
    .filter((s) => {
      const plan = s.plan as Record<string, unknown> | null;
      return entitled(s.status as string) && (plan?.slug !== "gratuit");
    })
    .reduce((sum, s) => {
      const plan = s.plan as Record<string, unknown> | null;
      return sum + ((plan?.price_monthly as number) || 0);
    }, 0);

  const payingUsers = subsList.filter((s) => {
    const plan = s.plan as Record<string, unknown> | null;
    return entitled(s.status as string) && plan?.slug !== "gratuit";
  }).length;

  const arpu = payingUsers > 0 ? Math.round(currentMrr / payingUsers) : 0;
  const monthlyChurnRate = churn30 / 100;
  const estimatedLtv = monthlyChurnRate > 0 ? Math.round(arpu / monthlyChurnRate) : null;

  // ============================================================
  // 5. Cohortes mensuelles — rétention à 1, 3, 6 mois
  //    Une cohorte = users inscrits au mois M
  //    Rétention M+N = % encore "entitled" N mois plus tard
  // ============================================================
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, created_at")
    .in("role", ["owner", "agency", "syndic"]);

  const profilesList = (profiles || []) as Array<Record<string, unknown>>;
  const subByOwner = new Map<string, Record<string, unknown>>();
  subsList.forEach((s) => subByOwner.set(s.owner_id as string, s));

  const cohorts: Array<{
    cohort_month: string;
    signups: number;
    retained_m1: number;
    retained_m3: number;
    retained_m6: number;
  }> = [];
  for (let i = 5; i >= 0; i--) {
    const cohortStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const cohortEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
    const label = cohortStart.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
    const cohortUsers = profilesList.filter((p) => {
      const createdAt = new Date((p.created_at as string) || 0);
      return createdAt >= cohortStart && createdAt <= cohortEnd;
    });
    const m1 = new Date(cohortStart.getFullYear(), cohortStart.getMonth() + 1, 0);
    const m3 = new Date(cohortStart.getFullYear(), cohortStart.getMonth() + 3, 0);
    const m6 = new Date(cohortStart.getFullYear(), cohortStart.getMonth() + 6, 0);
    const checkRetained = (asOf: Date) => {
      if (asOf > now) return -1; // pas encore évaluable
      return cohortUsers.filter((p) => {
        const sub = subByOwner.get(p.id as string);
        if (!sub) return false; // pas d'abonnement = pas retenu "payant"
        const createdAt = new Date((sub.created_at as string) || 0);
        const canceledAt = sub.canceled_at ? new Date(sub.canceled_at as string) : null;
        if (createdAt > asOf) return false;
        if (canceledAt && canceledAt <= asOf) return false;
        return entitled(sub.status as string);
      }).length;
    };
    cohorts.push({
      cohort_month: label,
      signups: cohortUsers.length,
      retained_m1: checkRetained(m1),
      retained_m3: checkRetained(m3),
      retained_m6: checkRetained(m6),
    });
  }

  return NextResponse.json({
    mrr_history: mrrByMonth,
    current_mrr: currentMrr,
    arr: currentMrr * 12,
    arpu,
    paying_users: payingUsers,
    estimated_ltv: estimatedLtv,
    churn: {
      last_30_days: churn30,
      last_90_days: churn90,
      canceled_30_days: cancel30,
      canceled_90_days: cancel90,
      active_at_30d_start: active30,
      active_at_90d_start: active90,
    },
    churn_by_plan: Object.entries(churnByPlan)
      .map(([slug, v]) => ({ plan_slug: slug, ...v }))
      .sort((a, b) => b.active - a.active),
    cohorts,
  });
}

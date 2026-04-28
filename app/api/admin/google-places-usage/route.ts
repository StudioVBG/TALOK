export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// =====================================================
// API: Statistiques d'utilisation Google Places (admin)
// GET /api/admin/google-places-usage
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/helpers/auth-helper";
import { getServiceClient } from "@/lib/supabase/service-client";
import {
  GOOGLE_FREE_CREDIT_USD,
  type GooglePlacesEndpoint,
} from "@/lib/services/google-places-usage";

interface UsageRow {
  called_at: string;
  endpoint: GooglePlacesEndpoint;
  source: "google" | "cache" | "demo";
  status: "ok" | "error" | "zero_results";
  category: string | null;
  results_count: number;
  estimated_cost_cents: number;
  cache_hit: boolean;
}

export async function GET(request: NextRequest) {
  const adminCheck = await requireAdmin(request);
  if (adminCheck.error) {
    return NextResponse.json(
      { error: adminCheck.error.message },
      { status: adminCheck.error.status }
    );
  }

  const supabase = getServiceClient();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const dayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).toISOString();
  const last30Start = new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString();

  // 1. Stats du mois en cours
  const { data: monthRows, error: monthErr } = await supabase
    .from("google_places_usage")
    .select("endpoint, source, status, results_count, estimated_cost_cents, cache_hit, called_at")
    .gte("called_at", monthStart);

  if (monthErr) {
    console.error("[admin/google-places-usage] month query error:", monthErr);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }

  const monthRowsTyped = (monthRows ?? []) as UsageRow[];

  // 2. Stats du jour
  const dayRows = monthRowsTyped.filter((r) => r.called_at >= dayStart);

  // Agrégations
  const monthCalls = monthRowsTyped.length;
  const monthGoogleCalls = monthRowsTyped.filter((r) => r.source === "google").length;
  const monthCacheHits = monthRowsTyped.filter((r) => r.cache_hit).length;
  const monthDemo = monthRowsTyped.filter((r) => r.source === "demo").length;
  const monthErrors = monthRowsTyped.filter((r) => r.status === "error").length;
  const monthCostCents = monthRowsTyped.reduce(
    (sum, r) => sum + Number(r.estimated_cost_cents || 0),
    0
  );
  const monthCostUsd = monthCostCents / 100;
  const quotaPercent = (monthCostUsd / GOOGLE_FREE_CREDIT_USD) * 100;

  // Projection fin de mois (linéaire)
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const projectedCostUsd =
    dayOfMonth > 0 ? (monthCostUsd / dayOfMonth) * daysInMonth : monthCostUsd;

  // Répartition par endpoint
  const byEndpoint: Record<string, { calls: number; cost_usd: number }> = {};
  for (const r of monthRowsTyped) {
    if (!byEndpoint[r.endpoint]) {
      byEndpoint[r.endpoint] = { calls: 0, cost_usd: 0 };
    }
    byEndpoint[r.endpoint].calls += 1;
    byEndpoint[r.endpoint].cost_usd += Number(r.estimated_cost_cents || 0) / 100;
  }

  // Top catégories
  const byCategory: Record<string, number> = {};
  for (const r of monthRowsTyped) {
    if (!r.category) continue;
    byCategory[r.category] = (byCategory[r.category] || 0) + 1;
  }
  const topCategories = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([category, calls]) => ({ category, calls }));

  // 3. Série journalière sur 30 jours
  const { data: rangeRows } = await supabase
    .from("google_places_usage")
    .select("called_at, source, estimated_cost_cents")
    .gte("called_at", last30Start);

  const dailyMap = new Map<string, { calls: number; cost_usd: number; cache: number }>();
  for (const r of (rangeRows ?? []) as Array<{
    called_at: string;
    source: string;
    estimated_cost_cents: number;
  }>) {
    const day = r.called_at.slice(0, 10);
    if (!dailyMap.has(day)) {
      dailyMap.set(day, { calls: 0, cost_usd: 0, cache: 0 });
    }
    const entry = dailyMap.get(day)!;
    entry.calls += 1;
    entry.cost_usd += Number(r.estimated_cost_cents || 0) / 100;
    if (r.source === "cache") entry.cache += 1;
  }
  const dailySeries = Array.from(dailyMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, v]) => ({
      day,
      calls: v.calls,
      cost_usd: Math.round(v.cost_usd * 10000) / 10000,
      cache_hits: v.cache,
    }));

  // 4. 20 derniers appels (debug)
  const { data: recentRows } = await supabase
    .from("google_places_usage")
    .select(
      "called_at, endpoint, source, status, category, results_count, estimated_cost_cents, cache_hit"
    )
    .order("called_at", { ascending: false })
    .limit(20);

  return NextResponse.json({
    summary: {
      free_credit_usd: GOOGLE_FREE_CREDIT_USD,
      month_calls: monthCalls,
      month_google_calls: monthGoogleCalls,
      month_cache_hits: monthCacheHits,
      month_demo_calls: monthDemo,
      month_errors: monthErrors,
      month_cost_usd: Math.round(monthCostUsd * 10000) / 10000,
      quota_percent: Math.round(quotaPercent * 100) / 100,
      projected_cost_usd: Math.round(projectedCostUsd * 10000) / 10000,
      projected_quota_percent:
        Math.round((projectedCostUsd / GOOGLE_FREE_CREDIT_USD) * 10000) / 100,
      cache_hit_ratio:
        monthCalls === 0 ? 0 : Math.round((monthCacheHits / monthCalls) * 10000) / 100,
      day_calls: dayRows.length,
      day_cost_usd:
        Math.round(
          (dayRows.reduce(
            (s, r) => s + Number(r.estimated_cost_cents || 0),
            0
          ) /
            100) *
            10000
        ) / 10000,
      day_of_month: dayOfMonth,
      days_in_month: daysInMonth,
      api_key_configured: !!process.env.GOOGLE_PLACES_API_KEY,
    },
    by_endpoint: byEndpoint,
    top_categories: topCategories,
    daily_series: dailySeries,
    recent: recentRows ?? [],
  });
}

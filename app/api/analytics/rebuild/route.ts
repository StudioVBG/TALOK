export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST /api/analytics/rebuild - Recalculer les agrégats analytics
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id as any)
      .single();

    const profileData = profile as any;
    if (profileData?.role !== "admin") {
      return NextResponse.json(
        { error: "Seul l'admin peut recalculer les analytics" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { period, metrics } = body; // period: 'YYYY-MM' ou null pour tous

    // Calculer les métriques
    const aggregates = [];

    // 1. Total propriétés
    const { data: propertiesCount } = await supabase
      .from("properties")
      .select("id", { count: "exact", head: true });
    aggregates.push({
      metric_name: "total_properties",
      period: period || new Date().toISOString().substring(0, 7) + "-01",
      value: propertiesCount || 0,
      dimensions: {},
    });

    // 2. Total baux actifs
    const { data: leasesCount } = await supabase
      .from("leases")
      .select("id", { count: "exact", head: true })
      // @ts-ignore - Supabase typing issue
      .eq("statut", "active");
    aggregates.push({
      metric_name: "total_active_leases",
      period: period || new Date().toISOString().substring(0, 7) + "-01",
      value: leasesCount || 0,
      dimensions: {},
    });

    // 3. Âge moyen des propriétaires
    const { data: ownerAges } = await supabase
      .from("user_ages")
      .select("age")
      .in("profile_id", (
        // @ts-ignore - Supabase typing issue
        await supabase.from("profiles").select("id").eq("role", "owner")
      ).data?.map((p: any) => p.id) || []);

    const avgOwnerAge = ownerAges && ownerAges.length > 0
      ? ownerAges.reduce((sum: number, u: any) => sum + (u.age || 0), 0) / ownerAges.length
      : 0;

    aggregates.push({
      metric_name: "average_age_owners",
      period: period || new Date().toISOString().substring(0, 7) + "-01",
      value: avgOwnerAge,
      dimensions: {},
    });

    // 4. Âge moyen des locataires
    const { data: tenantAges } = await supabase
      .from("user_ages")
      .select("age")
      .in("profile_id", (
        // @ts-ignore - Supabase typing issue
        await supabase.from("profiles").select("id").eq("role", "tenant")
      ).data?.map((p: any) => p.id) || []);

    const avgTenantAge = tenantAges && tenantAges.length > 0
      ? tenantAges.reduce((sum: number, u: any) => sum + (u.age || 0), 0) / tenantAges.length
      : 0;

    aggregates.push({
      metric_name: "average_age_tenants",
      period: period || new Date().toISOString().substring(0, 7) + "-01",
      value: avgTenantAge,
      dimensions: {},
    });

    // Insérer ou mettre à jour les agrégats
    for (const agg of aggregates) {
      await supabase
        .from("analytics_aggregates")
        .upsert(agg as any, {
          onConflict: "metric_name,period,dimensions",
        } as any);
    }

    // Émettre un événement
    await supabase.from("outbox").insert({
      event_type: "Analytics.WidgetUpdated",
      payload: {
        action: "rebuild",
        period,
        metrics_count: aggregates.length,
      },
    } as any);

    return NextResponse.json({
      success: true,
      aggregates_count: aggregates.length,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}


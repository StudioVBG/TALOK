export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/admin/audit-logs/alerts - Récupérer les alertes d'audit (high + critical)
 * Endpoint dédié aux notifications de sécurité pour le tableau de bord admin
 */
export async function GET(request: NextRequest) {
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
        { error: "Seul l'admin peut voir les alertes d'audit" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const since = searchParams.get("since"); // ISO date string
    const limit = parseInt(searchParams.get("limit") || "50");

    // Récupérer les événements high + critical
    let query = supabase
      .from("audit_log")
      .select("*", { count: "exact" })
      .in("risk_level", ["high", "critical"])
      .order("created_at", { ascending: false })
      .limit(limit);

    if (since) {
      query = query.gte("created_at", since);
    }

    const { data: alerts, error, count } = await query;

    if (error) throw error;

    // Compter par niveau de risque
    const criticalCount = (alerts || []).filter(
      (a: any) => a.risk_level === "critical"
    ).length;
    const highCount = (alerts || []).filter(
      (a: any) => a.risk_level === "high"
    ).length;

    return NextResponse.json({
      alerts: alerts || [],
      total: count || 0,
      summary: {
        critical: criticalCount,
        high: highCount,
      },
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

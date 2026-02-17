export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/helpers/auth-helper";

interface IntegrityCheck {
  check_name: string;
  status: string;
  count: number;
  details: string;
}

interface IntegrityReport {
  timestamp: string;
  overall_status: "healthy" | "degraded" | "critical";
  total_issues: number;
  checks: IntegrityCheck[];
  repair_log_count: number;
}

/**
 * GET /api/health/integrity — Rapport complet d'intégrité relationnelle
 *
 * Appelle la fonction SQL check_data_integrity() et retourne un rapport JSON.
 * Nécessite une authentification admin.
 */
export async function GET(request: Request) {
  const { error, supabase } = await requireAdmin(request);

  if (error) {
    return NextResponse.json(
      { error: (error as any).message },
      { status: (error as any).status || 401 }
    );
  }

  if (!supabase) {
    return NextResponse.json(
      { error: "Client Supabase non disponible" },
      { status: 500 }
    );
  }

  try {
    // Call the check_data_integrity() function
    const { data: checks, error: rpcError } = await supabase.rpc(
      "check_data_integrity"
    );

    if (rpcError) {
      console.error("[GET /api/health/integrity] RPC error:", rpcError);
      return NextResponse.json(
        { error: "Fonction check_data_integrity() non disponible: " + rpcError.message },
        { status: 500 }
      );
    }

    // Count repair log entries
    const { count: repairLogCount } = await supabase
      .from("_repair_log")
      .select("id", { count: "exact", head: true });

    // Calculate overall status
    const checksArray = (checks || []) as IntegrityCheck[];
    const errorCount = checksArray.filter(
      (c) => c.status === "ERREUR"
    ).length;
    const warningCount = checksArray.filter(
      (c) => c.status === "ATTENTION"
    ).length;
    const totalIssues = checksArray
      .filter((c) => c.status !== "OK" && c.status !== "INFO" && c.status !== "N/A")
      .reduce((sum, c) => sum + c.count, 0);

    let overallStatus: "healthy" | "degraded" | "critical";
    if (errorCount > 0) {
      overallStatus = "critical";
    } else if (warningCount > 0) {
      overallStatus = "degraded";
    } else {
      overallStatus = "healthy";
    }

    const report: IntegrityReport = {
      timestamp: new Date().toISOString(),
      overall_status: overallStatus,
      total_issues: totalIssues,
      checks: checksArray,
      repair_log_count: repairLogCount ?? 0,
    };

    const httpStatus = overallStatus === "critical" ? 503 : 200;
    return NextResponse.json(report, { status: httpStatus });
  } catch (err) {
    console.error("[GET /api/health/integrity] Error:", err);
    return NextResponse.json(
      { error: "Erreur lors de la vérification d'intégrité" },
      { status: 500 }
    );
  }
}

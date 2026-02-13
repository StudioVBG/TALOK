/**
 * API Admin: Audit d'intégrité de la base de données
 *
 * GET  /api/admin/audit-integrity              - Rapport complet
 * GET  /api/admin/audit-integrity?mode=score   - Score de santé uniquement
 * GET  /api/admin/audit-integrity?mode=orphans - Orphelins uniquement
 * GET  /api/admin/audit-integrity?mode=duplicates - Doublons uniquement
 * GET  /api/admin/audit-integrity?mode=quality - Qualité des données
 * POST /api/admin/audit-integrity              - Nettoyage (dry_run par défaut)
 */

import { requireAdmin } from "@/lib/helpers/auth-helper";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET: Rapport d'audit d'intégrité
 */
export async function GET(request: Request) {
  try {
    const { error } = await requireAdmin(request);
    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode") || "full";

    const serviceClient = getServiceClient();

    // Score de santé
    if (mode === "score") {
      const { data, error: rpcError } = await serviceClient.rpc(
        "audit_health_score" as any
      );
      if (rpcError) {
        return NextResponse.json(
          { error: "Fonction audit_health_score non disponible", details: rpcError.message },
          { status: 500 }
        );
      }
      return NextResponse.json({ success: true, score: data });
    }

    // Orphelins
    if (mode === "orphans") {
      const { data, error: rpcError } = await serviceClient.rpc(
        "audit_orphan_records" as any
      );
      if (rpcError) {
        return NextResponse.json(
          { error: "Fonction audit_orphan_records non disponible", details: rpcError.message },
          { status: 500 }
        );
      }
      const issues = (data as any[] || []).filter(
        (r: any) => r.orphan_count > 0
      );
      return NextResponse.json({
        success: true,
        category: "orphans",
        issues,
        total: issues.length,
      });
    }

    // Doublons
    if (mode === "duplicates") {
      const { data, error: rpcError } = await serviceClient.rpc(
        "audit_duplicate_records" as any
      );
      if (rpcError) {
        return NextResponse.json(
          { error: "Fonction audit_duplicate_records non disponible", details: rpcError.message },
          { status: 500 }
        );
      }
      return NextResponse.json({
        success: true,
        category: "duplicates",
        issues: data || [],
        total: (data as any[] || []).length,
      });
    }

    // Qualité des données
    if (mode === "quality") {
      const { data, error: rpcError } = await serviceClient.rpc(
        "audit_data_quality" as any
      );
      if (rpcError) {
        return NextResponse.json(
          { error: "Fonction audit_data_quality non disponible", details: rpcError.message },
          { status: 500 }
        );
      }
      const issues = (data as any[] || []).filter(
        (r: any) => r.issue_count > 0
      );
      return NextResponse.json({
        success: true,
        category: "data_quality",
        issues,
        total: issues.length,
      });
    }

    // Rapport complet
    const results: Record<string, any> = {};

    // Score
    const { data: scoreData } = await serviceClient.rpc(
      "audit_health_score" as any
    );
    results.score = scoreData;

    // Rapport détaillé
    const { data: reportData } = await serviceClient.rpc(
      "audit_full_report" as any
    );

    // Regrouper par catégorie
    const grouped: Record<string, any[]> = {};
    for (const row of (reportData as any[] || [])) {
      const cat = row.category || "OTHER";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(row);
    }
    results.report = grouped;

    // Statistiques
    const allIssues = reportData as any[] || [];
    results.summary = {
      total_issues: allIssues.length,
      by_severity: {
        critical: allIssues.filter((r: any) => r.severity === "CRITICAL").length,
        high: allIssues.filter((r: any) => r.severity === "HIGH").length,
        medium: allIssues.filter((r: any) => r.severity === "MEDIUM").length,
        low: allIssues.filter((r: any) => r.severity === "LOW").length,
      },
      by_category: Object.fromEntries(
        Object.entries(grouped).map(([k, v]) => [k, v.length])
      ),
    };
    results.checked_at = new Date().toISOString();

    return NextResponse.json({ success: true, ...results });
  } catch (err: unknown) {
    console.error("[Audit Integrity] Erreur:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * POST: Exécuter le nettoyage avec archivage
 */
export async function POST(request: Request) {
  try {
    const { error, user } = await requireAdmin(request);
    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    const body = await request.json().catch(() => ({}));
    const dryRun = body.dry_run !== false; // true par défaut
    const severityFilter = body.severity || "ALL";

    const serviceClient = getServiceClient();

    // Appeler la fonction de nettoyage SAFE
    const { data, error: rpcError } = await serviceClient.rpc(
      "safe_cleanup_orphans" as any,
      {
        p_dry_run: dryRun,
        p_severity_filter: severityFilter,
      }
    );

    if (rpcError) {
      return NextResponse.json(
        {
          error: "Fonction safe_cleanup_orphans non disponible",
          details: rpcError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      dry_run: dryRun,
      severity_filter: severityFilter,
      results: data,
      executed_at: new Date().toISOString(),
      executed_by: user?.id,
    });
  } catch (err: unknown) {
    console.error("[Audit Cleanup] Erreur:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

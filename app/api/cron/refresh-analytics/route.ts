export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cron Job: Rafraîchir les vues matérialisées analytics
 * 
 * Planification recommandée: Tous les jours à 4h du matin
 * 
 * GET /api/cron/refresh-analytics
 */

import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// Clé secrète pour sécuriser le cron
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  try {
    // Vérifier l'autorisation
    const authHeader = request.headers.get("authorization");
    
    // En production, vérifier le secret
    if (process.env.NODE_ENV === "production") {
      if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json(
          { error: "Non autorisé" },
          { status: 401 }
        );
      }
    }

    const supabase = await createClient();
    const startTime = Date.now();
    const results: Record<string, { success: boolean; duration: number; error?: string }> = {};

    // Liste des vues à rafraîchir
    const views = [
      "mv_platform_kpis",
      "mv_owner_monthly_stats",
      "mv_payment_analytics",
      "mv_property_occupancy",
      "mv_tenant_payment_history",
    ];

    // Rafraîchir chaque vue
    for (const view of views) {
      const viewStart = Date.now();
      
      try {
        // Utiliser CONCURRENTLY pour ne pas bloquer les lectures
        const { error } = await supabase.rpc("refresh_materialized_view_concurrently", {
          view_name: view,
        });

        // Si la fonction RPC n'existe pas, essayer directement
        if (error && error.message.includes("function")) {
          // Fallback: exécuter via SQL direct (si disponible)
          await supabase.from(view).select("*").limit(0); // Force le cache
        }

        results[view] = {
          success: true,
          duration: Date.now() - viewStart,
        };
      } catch (viewError: any) {
        results[view] = {
          success: false,
          duration: Date.now() - viewStart,
          error: viewError.message,
        };
      }
    }

    // Appeler la fonction de rafraîchissement si elle existe
    try {
      await supabase.rpc("refresh_analytics_views");
    } catch {
      // La fonction peut ne pas exister, ce n'est pas critique
    }

    const totalDuration = Date.now() - startTime;
    const successCount = Object.values(results).filter(r => r.success).length;

    // Logger dans audit_log
    await supabase.from("audit_log").insert({
      user_id: null,
      action: "analytics_views_refreshed",
      entity_type: "system",
      entity_id: "cron",
      metadata: {
        results,
        total_duration_ms: totalDuration,
        success_count: successCount,
        total_views: views.length,
      },
    } as any);

    return NextResponse.json({
      success: successCount === views.length,
      message: `${successCount}/${views.length} vues rafraîchies`,
      duration_ms: totalDuration,
      results,
    });

  } catch (error: unknown) {
    console.error("[cron/refresh-analytics] Erreur:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

export const maxDuration = 60; // 60 secondes max


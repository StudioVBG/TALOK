export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

/**
 * GET /api/admin/subscriptions/stats
 * Récupère les statistiques globales des abonnements (admin only)
 */

import { requireAdmin } from "@/lib/helpers/auth-helper";
import { NextResponse } from "next/server";
import { getSubscriptionStats, getPlansDistribution } from "@/lib/subscriptions/subscription-service";

export async function GET(request: Request) {
  try {
    const { error: authError } = await requireAdmin(request);
    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: authError.status });
    }

    // Récupérer les stats
    const stats = await getSubscriptionStats();
    const distribution = await getPlansDistribution();

    return NextResponse.json({
      stats,
      distribution,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erreur serveur";
    console.error("[Admin Stats GET]", error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}


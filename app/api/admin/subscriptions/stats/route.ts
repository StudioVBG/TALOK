export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

/**
 * GET /api/admin/subscriptions/stats
 * Récupère les statistiques globales des abonnements (admin only)
 */

import { NextResponse } from "next/server";
import { getSubscriptionStats, getPlansDistribution } from "@/lib/subscriptions/subscription-service";
import { requireAdminPermissions, isAdminAuthError } from "@/lib/middleware/admin-rbac";

export async function GET(request: Request) {
  try {
    const auth = await requireAdminPermissions(request, ["admin.subscriptions.read"], {
      rateLimit: "adminStandard",
    });
    if (isAdminAuthError(auth)) return auth;

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


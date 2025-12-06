/**
 * GET /api/admin/subscriptions/stats
 * Récupère les statistiques globales des abonnements (admin only)
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getSubscriptionStats, getPlansDistribution } from "@/lib/subscriptions/subscription-service";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Vérifier le rôle admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
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


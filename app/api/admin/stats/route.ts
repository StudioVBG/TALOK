export const runtime = 'nodejs';

/**
 * API Route pour les statistiques admin
 * GET /api/admin/stats
 */

import { requireAdmin } from "@/lib/helpers/auth-helper";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { error: authError, supabase } = await requireAdmin(request);
    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: authError.status });
    }

    // Appeler la fonction RPC
    const { data, error } = await supabase.rpc("admin_dashboard_stats");

    if (error) {
      console.error("Erreur stats admin:", error);
      return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error("Erreur API admin stats:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

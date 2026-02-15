import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchTenantDashboard } from "@/app/tenant/_data/fetchTenantDashboard";

/**
 * GET /api/tenant/dashboard
 * 
 * Route API pour le refetch du dashboard locataire.
 * Utilisée par le TenantDataProvider pour rafraîchir les données
 * après une action (paiement, signature, upload, etc.)
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    // Vérifier le rôle
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.role !== "tenant") {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    const dashboardData = await fetchTenantDashboard(user.id);

    if (!dashboardData) {
      return NextResponse.json(
        { error: "Données introuvables" },
        { status: 404 }
      );
    }

    return NextResponse.json(dashboardData);
  } catch (error) {
    console.error("[API] /api/tenant/dashboard error:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}

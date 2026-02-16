import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
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

    // Vérifier le rôle - avec fallback service role en cas de blocage RLS
    let profile: { role: string } | null = null;
    const { data: directProfile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!profileError && directProfile) {
      profile = directProfile;
    } else {
      try {
        const serviceClient = getServiceClient();
        const { data: serviceProfile } = await serviceClient
          .from("profiles")
          .select("role")
          .eq("user_id", user.id)
          .single();
        profile = serviceProfile as { role: string } | null;
      } catch (e) {
        console.warn("[API tenant/dashboard] Service role fallback failed:", e);
      }
    }

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

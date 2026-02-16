export const runtime = 'nodejs';

/**
 * API Route pour le dashboard prestataire
 * GET /api/provider/dashboard
 */

import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";

export async function GET() {
  try {
    const supabase = await createRouteHandlerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    // Récupérer le profil prestataire - avec fallback service role en cas de blocage RLS
    let profile: { id: string; prenom: string | null; nom: string | null; role: string } | null = null;
    const { data: directProfile, error: profileError } = await supabase
      .from("profiles")
      .select("id, prenom, nom, role")
      .eq("user_id", user.id)
      .single();

    if (!profileError && directProfile) {
      profile = directProfile;
    } else {
      try {
        const serviceClient = getServiceClient();
        const { data: serviceProfile } = await serviceClient
          .from("profiles")
          .select("id, prenom, nom, role")
          .eq("user_id", user.id)
          .single();
        profile = serviceProfile as typeof profile;
      } catch (e) {
        console.warn("[API provider/dashboard] Service role fallback failed:", e);
      }
    }

    if (!profile) {
      return NextResponse.json(
        { error: "Profil non trouvé" },
        { status: 404 }
      );
    }

    if (profile.role !== "provider") {
      return NextResponse.json(
        { error: "Accès non autorisé - rôle prestataire requis" },
        { status: 403 }
      );
    }

    // Utiliser la RPC provider_dashboard avec fallback sur requêtes directes
    const { data, error } = await supabase.rpc("provider_dashboard", {
      p_user_id: user.id
    });

    if (error) {
      console.warn("[provider/dashboard] RPC failed, using direct queries fallback:", error.message);

      // Fallback: requêtes directes
      const [workOrdersResult, reviewsResult] = await Promise.allSettled([
        supabase
          .from("work_orders")
          .select("id, statut, cout_estime, date_intervention_prevue, created_at, ticket:tickets(titre, priorite), property:properties(adresse, ville)")
          .eq("provider_id", profile.id)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("provider_reviews")
          .select("id, rating_overall, comment, created_at, reviewer:profiles(prenom, nom)")
          .eq("provider_id", profile.id)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      const workOrders = workOrdersResult.status === "fulfilled" ? workOrdersResult.value.data || [] : [];
      const reviews = reviewsResult.status === "fulfilled" ? reviewsResult.value.data || [] : [];

      const totalInterventions = workOrders.length;
      const completedInterventions = workOrders.filter((wo: any) => wo.statut === "completed").length;
      const pendingInterventions = workOrders.filter((wo: any) => ["pending", "accepted", "scheduled"].includes(wo.statut)).length;
      const totalRevenue = workOrders
        .filter((wo: any) => wo.statut === "completed")
        .reduce((sum: number, wo: any) => sum + (wo.cout_estime || 0), 0);
      const ratings = reviews.map((r: any) => r.rating_overall).filter(Boolean);
      const avgRating = ratings.length > 0 ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length : null;

      const fallbackData = {
        profile_id: profile.id,
        stats: {
          total_interventions: totalInterventions,
          completed_interventions: completedInterventions,
          pending_interventions: pendingInterventions,
          total_revenue: totalRevenue,
          avg_rating: avgRating,
          total_reviews: reviews.length,
        },
        pending_orders: workOrders
          .filter((wo: any) => ["pending", "accepted", "scheduled"].includes(wo.statut))
          .slice(0, 5),
        recent_reviews: reviews.slice(0, 5),
      };

      return NextResponse.json(fallbackData);
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error("Erreur API provider dashboard:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}








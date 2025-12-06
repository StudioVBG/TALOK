/**
 * API Route pour le dashboard prestataire
 * GET /api/provider/dashboard
 */

import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createRouteHandlerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    // Récupérer le profil prestataire
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, prenom, nom, role")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
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

    // Récupérer le profil prestataire
    const { data: providerProfile } = await supabase
      .from("provider_profiles")
      .select("*")
      .eq("profile_id", profile.id)
      .single();

    // Récupérer les work_orders assignés au prestataire
    const { data: workOrders, error: workOrdersError } = await supabase
      .from("work_orders")
      .select(`
        id,
        statut,
        cout_estime,
        cout_final,
        date_intervention_prevue,
        created_at
      `)
      .eq("provider_id", profile.id);

    // Stats par défaut si pas de données
    const orders = workOrders || [];
    const stats = {
      total_missions: orders.length,
      missions_pending: orders.filter(o => o.statut === "assigned" || o.statut === "scheduled").length,
      missions_completed: orders.filter(o => o.statut === "done").length,
      missions_cancelled: orders.filter(o => o.statut === "cancelled").length,
      total_revenue: orders.filter(o => o.statut === "done").reduce((sum, o) => sum + (o.cout_final || o.cout_estime || 0), 0),
    };

    // Prochaines interventions
    const now = new Date().toISOString();
    const upcomingMissions = orders
      .filter(o => o.date_intervention_prevue && o.date_intervention_prevue >= now && o.statut !== "done" && o.statut !== "cancelled")
      .sort((a, b) => (a.date_intervention_prevue || "").localeCompare(b.date_intervention_prevue || ""))
      .slice(0, 5);

    return NextResponse.json({
      profile: {
        id: profile.id,
        prenom: profile.prenom,
        nom: profile.nom,
      },
      provider: providerProfile || {
        status: "pending",
        kyc_status: "incomplete",
        compliance_score: 0,
      },
      stats,
      upcoming_missions: upcomingMissions,
      recent_activity: [],
    });
  } catch (error: any) {
    console.error("Erreur API provider dashboard:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}








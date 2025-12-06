/**
 * GET /api/subscriptions/recommend
 * Obtient une recommandation de plan basée sur l'usage et le profil
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getRecommendedPlan } from "@/lib/subscriptions/ai/plan-recommender.graph";
import { PLANS, type PlanSlug, getUsagePercentage } from "@/lib/subscriptions/plans";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Récupérer le profil
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // Récupérer l'abonnement actuel
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("plan_slug, status")
      .eq("user_id", user.id)
      .single();

    const currentPlan = (subscription?.plan_slug || "starter") as PlanSlug;

    // Compter les propriétés
    const { count: propertiesCount } = await supabase
      .from("properties")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", profile.id);

    // Compter les baux actifs
    const { count: leasesCount } = await supabase
      .from("leases")
      .select("id", { count: "exact", head: true })
      .in("statut", ["active", "pending_signature"]);

    // Récupérer l'owner_profile pour plus d'infos
    const { data: ownerProfile } = await supabase
      .from("owner_profiles")
      .select("type")
      .eq("profile_id", profile.id)
      .single();

    // Récupérer l'usage des signatures ce mois
    const periodStart = new Date();
    periodStart.setDate(1);
    periodStart.setHours(0, 0, 0, 0);

    const { data: usage } = await supabase
      .from("subscription_usage")
      .select("signatures_used_this_month")
      .eq("user_id", user.id)
      .gte("period_start", periodStart.toISOString())
      .single();

    // Calculer les revenus mensuels estimés (somme des loyers)
    const { data: leases } = await supabase
      .from("leases")
      .select("loyer, charges_forfaitaires")
      .eq("statut", "active");

    const monthlyRevenue = (leases || []).reduce(
      (sum, lease) => sum + (lease.loyer || 0) + (lease.charges_forfaitaires || 0),
      0
    );

    // Préparer les données pour le recommender
    const limits = PLANS[currentPlan].limits;
    const signaturesUsed = usage?.signatures_used_this_month || 0;

    const recommendation = await getRecommendedPlan({
      userId: user.id,
      currentPlan,
      propertiesCount: propertiesCount || 0,
      projectedProperties: Math.ceil((propertiesCount || 0) * 1.2), // Estimation: +20% sur 1 an
      leasesCount: leasesCount || 0,
      monthlyRevenue,
      signaturesPerMonth: signaturesUsed,
      needsMultiUsers: false, // TODO: Déterminer via un questionnaire
      needsAdvancedFeatures: (propertiesCount || 0) > 3,
      isProfessional: ownerProfile?.type === "societe",
      propertiesUsagePercent: getUsagePercentage(propertiesCount || 0, limits.max_properties),
      signaturesUsagePercent: getUsagePercentage(signaturesUsed, limits.max_signatures_monthly),
    });

    return NextResponse.json({
      recommendation,
      context: {
        properties_count: propertiesCount,
        leases_count: leasesCount,
        monthly_revenue: monthlyRevenue,
        is_professional: ownerProfile?.type === "societe",
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erreur serveur";
    console.error("[Recommend GET]", error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}


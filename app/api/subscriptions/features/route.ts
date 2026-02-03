export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/subscriptions/features
 * Vérifie si l'utilisateur a accès à une ou plusieurs features
 * 
 * Query params:
 * - feature: feature unique à vérifier
 * - features: liste de features (comma-separated)
 */

import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { PLANS, type PlanSlug, type FeatureKey } from "@/lib/subscriptions/plans";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const singleFeature = searchParams.get("feature") as FeatureKey | null;
    const multipleFeatures = searchParams.get("features")?.split(",") as FeatureKey[] | undefined;

    // Récupérer le profil
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    // Récupérer l'abonnement via owner_id
    const { data: subscription } = profile ? await supabase
      .from("subscriptions")
      .select("plan_slug, status")
      .eq("owner_id", profile.id)
      .maybeSingle() : { data: null };

    const planSlug = (subscription?.plan_slug || 'starter') as PlanSlug;
    const status = subscription?.status || 'active';
    const planFeatures = PLANS[planSlug].features;

    // Vérifier si l'abonnement est actif
    const isActive = ["active", "trialing"].includes(status);

    // Si une seule feature demandée
    if (singleFeature) {
      const hasAccess = isActive && planFeatures[singleFeature] === true;
      return NextResponse.json({
        feature: singleFeature,
        has_access: hasAccess,
        plan: planSlug,
        status,
      });
    }

    // Si plusieurs features demandées
    if (multipleFeatures && multipleFeatures.length > 0) {
      const results: Record<string, boolean> = {};
      for (const feat of multipleFeatures) {
        results[feat] = isActive && planFeatures[feat as FeatureKey] === true;
      }
      return NextResponse.json({
        features: results,
        plan: planSlug,
        status,
      });
    }

    // Si aucune feature spécifiée, retourner toutes les features
    const allFeatures: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(planFeatures)) {
      allFeatures[key] = isActive && Boolean(value);
    }

    return NextResponse.json({
      features: allFeatures,
      plan: planSlug,
      status,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erreur serveur";
    console.error("[Features GET]", error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}


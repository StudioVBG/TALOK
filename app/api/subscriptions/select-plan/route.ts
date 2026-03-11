export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/subscriptions/select-plan
 *
 * Met a jour la subscription d'un proprietaire vers le plan choisi.
 * Utilise principalement lors de l'inscription quand l'utilisateur choisit
 * le forfait gratuit (les forfaits payants passent par Stripe Checkout).
 *
 * Body: { plan_slug: 'gratuit' | 'starter' | 'confort' | 'pro' | ... }
 */

import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { isValidPlanSlug, type PlanSlug } from "@/lib/subscriptions/plans";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
    }

    const body = await request.json();
    const { plan_slug } = body;

    if (!plan_slug || !isValidPlanSlug(plan_slug)) {
      return NextResponse.json(
        { error: "plan_slug invalide" },
        { status: 400 }
      );
    }

    // Recuperer le profil
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.role !== "owner") {
      return NextResponse.json(
        { error: "Seuls les proprietaires peuvent choisir un forfait" },
        { status: 403 }
      );
    }

    const serviceClient = createServiceRoleClient();

    // Recuperer le plan cible
    const { data: plan, error: planError } = await serviceClient
      .from("subscription_plans")
      .select("id, slug, price_monthly")
      .eq("slug", plan_slug)
      .eq("is_active", true)
      .single();

    if (planError || !plan) {
      return NextResponse.json(
        { error: "Plan non trouve" },
        { status: 404 }
      );
    }

    // Pour les plans payants (prix > 0), rediriger vers Stripe Checkout
    if (plan.price_monthly > 0) {
      return NextResponse.json(
        {
          error: "Les forfaits payants doivent passer par Stripe Checkout",
          redirect: "/api/subscriptions/checkout",
        },
        { status: 400 }
      );
    }

    // Mettre a jour ou creer la subscription vers le plan choisi
    const { error: upsertError } = await serviceClient
      .from("subscriptions")
      .upsert(
        {
          owner_id: profile.id,
          plan_id: plan.id,
          plan_slug: plan.slug,
          status: "active",
          billing_cycle: "monthly",
          current_period_start: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "owner_id" }
      );

    if (upsertError) {
      console.error("[select-plan] Upsert error:", upsertError);
      return NextResponse.json(
        { error: "Erreur lors de la mise a jour de l'abonnement" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      plan_slug: plan.slug,
      status: "active",
    });
  } catch (error: unknown) {
    console.error("[select-plan] Error:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

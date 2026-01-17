export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClientFromRequest } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/subscriptions - Récupérer l'abonnement actuel (alias de /current)
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClientFromRequest(request);
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

    // Récupérer l'abonnement avec le plan
    const { data: subscription, error: subError } = await supabase
      .from("subscriptions")
      .select(`
        *,
        plan:subscription_plans(*)
      `)
      .eq("owner_id", profile.id)
      .maybeSingle();

    if (subError && subError.code !== "PGRST116") {
      console.error("[GET /api/subscriptions] Error:", subError);
      throw subError;
    }

    // Récupérer les add-ons souscrits
    let addonSubscriptions = [];
    if (subscription) {
      const { data: addons } = await supabase
        .from("subscription_addon_subscriptions")
        .select(`
          *,
          addon:subscription_addons(*)
        `)
        .eq("subscription_id", subscription.id)
        .eq("status", "active");
      
      addonSubscriptions = addons || [];
    }

    return NextResponse.json({ 
      subscription,
      addon_subscriptions: addonSubscriptions
    });
  } catch (error: unknown) {
    console.error("[GET /api/subscriptions]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
  }
}

/**
 * POST /api/subscriptions - Créer ou mettre à jour un abonnement
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClientFromRequest(request);
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

    const body = await request.json();
    const { plan_slug, billing_cycle = "monthly" } = body;

    if (!plan_slug) {
      return NextResponse.json({ error: "plan_slug requis" }, { status: 400 });
    }

    // Vérifier que le plan existe
    const { data: plan, error: planError } = await supabase
      .from("subscription_plans")
      .select("id, slug, name")
      .eq("slug", plan_slug)
      .single();

    if (planError || !plan) {
      return NextResponse.json({ error: "Plan non trouvé" }, { status: 404 });
    }

    // Vérifier si un abonnement existe déjà
    const { data: existingSub } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("owner_id", profile.id)
      .maybeSingle();

    if (existingSub) {
      // Mettre à jour l'abonnement existant
      const { data: updated, error: updateError } = await supabase
        .from("subscriptions")
        .update({
          plan_id: plan.id,
          plan_slug: plan.slug,
          billing_cycle,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingSub.id)
        .select()
        .single();

      if (updateError) throw updateError;

      return NextResponse.json({ 
        subscription: updated,
        message: "Abonnement mis à jour"
      });
    }

    // Créer un nouvel abonnement
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + (billing_cycle === "yearly" ? 12 : 1));

    const { data: newSub, error: createError } = await supabase
      .from("subscriptions")
      .insert({
        owner_id: profile.id,
        plan_id: plan.id,
        plan_slug: plan.slug,
        status: "active",
        billing_cycle,
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
      })
      .select()
      .single();

    if (createError) throw createError;

    return NextResponse.json({ 
      subscription: newSub,
      message: "Abonnement créé"
    }, { status: 201 });

  } catch (error: unknown) {
    console.error("[POST /api/subscriptions]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
  }
}


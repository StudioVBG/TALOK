export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/subscriptions/current - Récupérer l'abonnement actuel de l'utilisateur
 */
export async function GET(request: Request) {
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

    // Récupérer l'abonnement avec le plan
    const { data: subscription, error: subError } = await supabase
      .from("subscriptions")
      .select(`
        *,
        plan:subscription_plans(*)
      `)
      .eq("owner_id", profile.id)
      .single();

    if (subError && subError.code !== "PGRST116") {
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
    console.error("[Current Subscription GET]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
  }
}


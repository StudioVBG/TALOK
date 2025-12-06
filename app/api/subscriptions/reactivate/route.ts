/**
 * POST /api/subscriptions/reactivate
 * Réactive un abonnement annulé
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { reactivateSubscription, logSubscriptionEvent } from "@/lib/subscriptions/subscription-service";

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Récupérer le profil
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // Vérifier que l'abonnement est bien annulé
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("status, cancel_at_period_end")
      .eq("owner_id", profile.id)
      .single();

    if (!subscription) {
      return NextResponse.json({ error: "Abonnement non trouvé" }, { status: 404 });
    }

    if (subscription.status !== "canceled" && !subscription.cancel_at_period_end) {
      return NextResponse.json({ error: "L'abonnement n'est pas annulé" }, { status: 400 });
    }

    // Réactiver l'abonnement
    const result = await reactivateSubscription(user.id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erreur serveur";
    console.error("[Reactivate POST]", error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}


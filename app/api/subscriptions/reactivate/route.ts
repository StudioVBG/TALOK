export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

/**
 * POST /api/subscriptions/reactivate
 * Réactive un abonnement annulé
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { reactivateSubscription, logSubscriptionEvent } from "@/lib/subscriptions/subscription-service";
import { applyRateLimit } from "@/lib/middleware/rate-limit";

export async function POST(request: Request) {
  // Rate limiting : 5 requêtes/minute par IP
  const rateLimitResponse = applyRateLimit(request, "payment");
  if (rateLimitResponse) return rateLimitResponse;

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


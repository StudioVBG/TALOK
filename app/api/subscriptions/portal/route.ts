export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

/**
 * POST /api/subscriptions/portal
 * Crée un lien vers le portail de gestion Stripe
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Récupérer le profil et l'abonnement
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("owner_id", profile.id)
      .single();

    if (!subscription?.stripe_customer_id) {
      return NextResponse.json(
        { error: "Pas d'abonnement actif" },
        { status: 404 }
      );
    }

    // Créer la session du portail
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/owner/settings/billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: unknown) {
    console.error("Erreur création portail:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}


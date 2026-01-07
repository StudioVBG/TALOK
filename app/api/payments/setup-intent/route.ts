export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new ApiError(401, "Non authentifié");
    }

    // Récupérer le profil pour obtenir le customer_id Stripe si existant
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, email, prenom, nom, stripe_customer_id")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      throw new ApiError(404, "Profil non trouvé");
    }

    let stripeCustomerId = profile.stripe_customer_id;

    // Créer un client Stripe si nécessaire
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: profile.email || user.email,
        name: `${profile.prenom || ""} ${profile.nom || ""}`.trim(),
        metadata: {
          profileId: profile.id,
          userId: user.id,
        },
      });
      stripeCustomerId = customer.id;

      // Mettre à jour le profil avec l'ID client Stripe
      await supabase
        .from("profiles")
        .update({ stripe_customer_id: stripeCustomerId })
        .eq("id", profile.id);
    }

    // Créer le SetupIntent
    const setupIntent = await stripe.setupIntents.create({
      customer: stripeCustomerId,
      payment_method_types: ["card", "sepa_debit"],
      metadata: {
        profileId: profile.id,
        userId: user.id,
      },
    });

    return NextResponse.json({
      clientSecret: setupIntent.client_secret,
      customerId: stripeCustomerId,
    });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}


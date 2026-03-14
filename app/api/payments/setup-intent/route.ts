export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe, isStripeServerConfigured } from "@/lib/stripe";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";

const setupIntentSchema = {
  parse(input: unknown): { payment_method_types: Array<"card" | "sepa_debit"> } {
    const body = (input ?? {}) as { payment_method_types?: unknown };
    const requested = Array.isArray(body.payment_method_types)
      ? body.payment_method_types.filter((value): value is "card" | "sepa_debit" => value === "card" || value === "sepa_debit")
      : (["card"] as Array<"card" | "sepa_debit">);
    return {
      payment_method_types:
        requested.length > 0 ? requested : (["card"] as Array<"card" | "sepa_debit">),
    };
  },
};

export async function POST(request: NextRequest) {
  try {
    if (!isStripeServerConfigured()) {
      throw new ApiError(503, "Stripe n'est pas configuré", "STRIPE_CONFIG_ERROR");
    }

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

    const body = await request.json().catch(() => ({}));
    const payload = setupIntentSchema.parse(body);

    // Créer le SetupIntent
    const setupIntent = await stripe.setupIntents.create({
      customer: stripeCustomerId,
      payment_method_types: payload.payment_method_types,
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


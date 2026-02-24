export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/owner/payment-methods/setup-intent
 * Crée un SetupIntent pour le customer Stripe du propriétaire (abonnement).
 * Utilisé par la page Moyens de paiement propriétaire pour ajouter une carte in-app.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new ApiError(401, "Non authentifié");
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role, email, prenom, nom")
      .eq("user_id", user.id)
      .single();

    if (!profile || (profile.role !== "owner" && profile.role !== "admin")) {
      throw new ApiError(403, "Accès réservé aux propriétaires");
    }

    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("id, stripe_customer_id")
      .eq("owner_id", profile.id)
      .maybeSingle();

    let stripeCustomerId = subscription?.stripe_customer_id ?? null;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: profile.email ?? user.email ?? undefined,
        name: [profile.prenom, profile.nom].filter(Boolean).join(" ") || undefined,
        metadata: { profile_id: profile.id, user_id: user.id },
      });
      stripeCustomerId = customer.id;
      await supabase
        .from("subscriptions")
        .upsert(
          {
            owner_id: profile.id,
            stripe_customer_id: stripeCustomerId,
            status: "incomplete",
          },
          { onConflict: "owner_id" }
        );
    }

    const setupIntent = await stripe.setupIntents.create({
      customer: stripeCustomerId,
      payment_method_types: ["card", "sepa_debit"],
      metadata: { profile_id: profile.id, user_id: user.id, context: "owner_subscription" },
    });

    return NextResponse.json({
      clientSecret: setupIntent.client_secret,
      customerId: stripeCustomerId,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

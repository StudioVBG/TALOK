export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/owner/payment-methods/setup-intent
 * Crée un SetupIntent pour le customer Stripe du propriétaire (abonnement).
 * Utilisé par la page Moyens de paiement propriétaire pour ajouter une carte in-app.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { stripe, isStripeServerConfigured } from "@/lib/stripe";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";

function parsePaymentMethodTypes(input: unknown): Array<"card" | "sepa_debit"> {
  const body = (input ?? {}) as { payment_method_types?: unknown };
  const requested = Array.isArray(body.payment_method_types)
    ? body.payment_method_types.filter((value): value is "card" | "sepa_debit" => value === "card" || value === "sepa_debit")
    : (["card"] as Array<"card" | "sepa_debit">);
  return requested.length > 0 ? requested : (["card"] as Array<"card" | "sepa_debit">);
}

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

    const serviceClient = createServiceRoleClient();
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role, email, prenom, nom")
      .eq("user_id", user.id)
      .single();

    if (!profile || (profile.role !== "owner" && profile.role !== "admin")) {
      throw new ApiError(403, "Accès réservé aux propriétaires");
    }

    const { data: subscription } = await serviceClient
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

    const body = await request.json().catch(() => ({}));
    const paymentMethodTypes = parsePaymentMethodTypes(body);

    const setupIntent = await stripe.setupIntents.create({
      customer: stripeCustomerId,
      payment_method_types: paymentMethodTypes,
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

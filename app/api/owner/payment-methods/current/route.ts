export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/owner/payment-methods/current
 * Retourne le moyen de paiement par défaut du propriétaire (pour l'abonnement).
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { stripe } from "@/lib/stripe";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import type Stripe from "stripe";

function mapBillingPaymentMethod(
  paymentMethod: Stripe.PaymentMethod,
  options: { isDefault: boolean; source: "default" | "attached_fallback" }
) {
  const card = paymentMethod.card;

  return {
    id: paymentMethod.id,
    brand: (card?.brand ?? "unknown") as "visa" | "mastercard" | "amex" | "discover" | "unknown",
    last4: card?.last4 ?? "",
    exp_month: card?.exp_month ?? 0,
    exp_year: card?.exp_year ?? 0,
    is_default: options.isDefault,
    source: options.source,
  };
}

export async function GET() {
  try {
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
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile || (profile.role !== "owner" && profile.role !== "admin")) {
      throw new ApiError(403, "Accès réservé aux propriétaires");
    }

    const { data: subscription } = await serviceClient
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("owner_id", profile.id)
      .maybeSingle();

    const stripeCustomerId = subscription?.stripe_customer_id;
    if (!stripeCustomerId) {
      return NextResponse.json({ payment_method: null });
    }

    const customer = await stripe.customers.retrieve(stripeCustomerId, {
      expand: ["invoice_settings.default_payment_method"],
    });

    if (customer.deleted) {
      return NextResponse.json({ payment_method: null });
    }

    const defaultPm = (customer as { invoice_settings?: { default_payment_method?: string | { id: string; card?: { brand: string; last4: string; exp_month: number; exp_year: number } } } })
      .invoice_settings?.default_payment_method;

    if (defaultPm) {
      const paymentMethod =
        typeof defaultPm === "string"
          ? await stripe.paymentMethods.retrieve(defaultPm)
          : (defaultPm as Stripe.PaymentMethod);

      return NextResponse.json({
        payment_method: mapBillingPaymentMethod(paymentMethod, {
          isDefault: true,
          source: "default",
        }),
      });
    }

    const attachedPaymentMethods = await stripe.paymentMethods.list({
      customer: stripeCustomerId,
      type: "card",
      limit: 1,
    });

    const fallbackPaymentMethod = attachedPaymentMethods.data[0];
    if (!fallbackPaymentMethod) {
      return NextResponse.json({ payment_method: null });
    }

    return NextResponse.json({
      payment_method: mapBillingPaymentMethod(fallbackPaymentMethod, {
        isDefault: false,
        source: "attached_fallback",
      }),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

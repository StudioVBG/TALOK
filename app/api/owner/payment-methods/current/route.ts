export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/owner/payment-methods/current
 * Retourne le moyen de paiement par défaut du propriétaire (pour l'abonnement).
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";

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

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile || (profile.role !== "owner" && profile.role !== "admin")) {
      throw new ApiError(403, "Accès réservé aux propriétaires");
    }

    const { data: subscription } = await supabase
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

    const defaultPm = (customer as { invoice_settings?: { default_payment_method?: { id: string; card?: { brand: string; last4: string; exp_month: number; exp_year: number } } } })
      .invoice_settings?.default_payment_method;

    if (!defaultPm || typeof defaultPm === "string") {
      return NextResponse.json({ payment_method: null });
    }

    const card = defaultPm.card;
    return NextResponse.json({
      payment_method: {
        id: defaultPm.id,
        brand: (card?.brand ?? "unknown") as "visa" | "mastercard" | "amex" | "discover" | "unknown",
        last4: card?.last4 ?? "",
        exp_month: card?.exp_month ?? 0,
        exp_year: card?.exp_year ?? 0,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

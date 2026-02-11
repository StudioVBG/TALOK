export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

/**
 * GET /api/subscriptions/payment-method
 * Récupère le moyen de paiement par défaut du client Stripe
 *
 * POST /api/subscriptions/payment-method
 * Crée une session portail Stripe pour gérer les moyens de paiement
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

async function getSubscriptionForUser(supabase: any, userId: string) {
  // Récupérer le profil
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", userId)
    .single();

  if (!profile) return null;

  // Récupérer l'abonnement via owner_id
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("id, stripe_customer_id, status")
    .eq("owner_id", profile.id)
    .single();

  return subscription;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const subscription = await getSubscriptionForUser(supabase, user.id);

    if (!subscription?.stripe_customer_id) {
      return NextResponse.json({ payment_method: null });
    }

    // Récupérer le moyen de paiement par défaut depuis Stripe
    const customer = await stripe.customers.retrieve(
      subscription.stripe_customer_id
    );

    if ((customer as any).deleted) {
      return NextResponse.json({ payment_method: null });
    }

    const defaultPaymentMethodId = (customer as any).invoice_settings
      ?.default_payment_method;

    if (!defaultPaymentMethodId) {
      // Tenter de récupérer via la subscription Stripe
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("stripe_subscription_id")
        .eq("id", subscription.id)
        .single();

      if (sub?.stripe_subscription_id) {
        try {
          const stripeSub = await stripe.subscriptions.retrieve(
            sub.stripe_subscription_id
          );
          const subPaymentMethod = (stripeSub as any).default_payment_method;
          if (subPaymentMethod) {
            const pm = await stripe.paymentMethods.retrieve(
              typeof subPaymentMethod === "string"
                ? subPaymentMethod
                : subPaymentMethod.id
            );
            return NextResponse.json({
              payment_method: formatPaymentMethod(pm),
            });
          }
        } catch {
          // Subscription might not exist on Stripe
        }
      }

      return NextResponse.json({ payment_method: null });
    }

    const pm = await stripe.paymentMethods.retrieve(defaultPaymentMethodId);

    return NextResponse.json({
      payment_method: formatPaymentMethod(pm),
    });
  } catch (error: unknown) {
    console.error("[payment-method GET]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const subscription = await getSubscriptionForUser(supabase, user.id);

    if (!subscription?.stripe_customer_id) {
      return NextResponse.json(
        { error: "Aucun abonnement actif" },
        { status: 404 }
      );
    }

    // Créer une session portail Stripe pour gérer le moyen de paiement
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/owner/settings/billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: unknown) {
    console.error("[payment-method POST]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

function formatPaymentMethod(pm: any) {
  if (pm.type === "card" && pm.card) {
    return {
      id: pm.id,
      type: "card" as const,
      brand: pm.card.brand || "unknown",
      last4: pm.card.last4,
      exp_month: pm.card.exp_month,
      exp_year: pm.card.exp_year,
    };
  }

  if (pm.type === "sepa_debit" && pm.sepa_debit) {
    return {
      id: pm.id,
      type: "sepa_debit" as const,
      brand: "sepa",
      last4: pm.sepa_debit.last4,
      exp_month: 0,
      exp_year: 0,
      bank_code: pm.sepa_debit.bank_code,
    };
  }

  return {
    id: pm.id,
    type: pm.type,
    brand: "unknown",
    last4: "****",
    exp_month: 0,
    exp_year: 0,
  };
}

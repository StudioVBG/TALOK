export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/subscriptions/webhook
 * Webhook Stripe pour les événements d'abonnement
 */

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { stripe } from "@/lib/stripe";
import { createServiceRoleClient } from "@/lib/supabase/server";
import Stripe from "stripe";

export async function POST(request: Request) {
  const body = await request.text();
  const headersList = await headers();
  const sig = headersList.get("stripe-signature");

  if (!sig) {
    return NextResponse.json(
      { error: "Signature manquante" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error("Erreur vérification webhook:", err.message);
    return NextResponse.json(
      { error: `Webhook Error: ${err.message}` },
      { status: 400 }
    );
  }

  const supabase = createServiceRoleClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(supabase, session);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(supabase, subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(supabase, subscription);
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaid(supabase, invoice);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoiceFailed(supabase, invoice);
        break;
      }

      default:
        console.log(`Événement non géré: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    console.error("Erreur traitement webhook:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Une erreur est survenue" },
      { status: 500 }
    );
  }
}

// ============================================
// HANDLERS
// ============================================

async function handleCheckoutCompleted(
  supabase: ReturnType<typeof createServiceRoleClient>,
  session: Stripe.Checkout.Session
) {
  const profileId = session.metadata?.profile_id;
  const planId = session.metadata?.plan_id;

  if (!profileId || !planId) {
    console.error("Métadonnées manquantes dans la session");
    return;
  }

  // Récupérer les détails de l'abonnement Stripe
  const subscriptionId = session.subscription as string;
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  // Créer ou mettre à jour l'abonnement dans la DB
  const { error } = await supabase.from("subscriptions").upsert(
    {
      owner_id: profileId,
      plan_id: planId,
      stripe_subscription_id: subscriptionId,
      stripe_customer_id: session.customer as string,
      status: subscription.status,
      billing_cycle: subscription.items.data[0].price.recurring?.interval === "year" ? "yearly" : "monthly",
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      trial_start: subscription.trial_start
        ? new Date(subscription.trial_start * 1000).toISOString()
        : null,
      trial_end: subscription.trial_end
        ? new Date(subscription.trial_end * 1000).toISOString()
        : null,
    },
    {
      onConflict: "owner_id",
    }
  );

  if (error) {
    console.error("Erreur création subscription:", error);
    throw error;
  }

  // Envoyer une notification
  await supabase.from("notifications").insert({
    user_id: profileId,
    type: "subscription_created",
    title: "Abonnement activé !",
    message: "Votre abonnement a été activé avec succès. Bienvenue !",
    data: { subscription_id: subscriptionId },
  });

  // Log d'audit
  await supabase.from("audit_log").insert({
    action: "subscription_created",
    entity_type: "subscription",
    entity_id: subscriptionId,
    metadata: {
      profile_id: profileId,
      plan_id: planId,
      status: subscription.status,
    },
  });
}

async function handleSubscriptionUpdated(
  supabase: ReturnType<typeof createServiceRoleClient>,
  subscription: Stripe.Subscription
) {
  const { error } = await supabase
    .from("subscriptions")
    .update({
      status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
      canceled_at: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000).toISOString()
        : null,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id);

  if (error) {
    console.error("Erreur mise à jour subscription:", error);
  }
}

async function handleSubscriptionDeleted(
  supabase: ReturnType<typeof createServiceRoleClient>,
  subscription: Stripe.Subscription
) {
  const { error } = await supabase
    .from("subscriptions")
    .update({
      status: "canceled",
      canceled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id);

  if (error) {
    console.error("Erreur annulation subscription:", error);
  }

  // Notification
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("owner_id")
    .eq("stripe_subscription_id", subscription.id)
    .single();

  if (sub) {
    await supabase.from("notifications").insert({
      user_id: sub.owner_id,
      type: "subscription_canceled",
      title: "Abonnement annulé",
      message: "Votre abonnement a été annulé. Vous passez au plan gratuit.",
    });
  }
}

async function handleInvoicePaid(
  supabase: ReturnType<typeof createServiceRoleClient>,
  invoice: Stripe.Invoice
) {
  if (!invoice.subscription) return;

  // Récupérer l'abonnement local
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("stripe_subscription_id", invoice.subscription as string)
    .single();

  if (!sub) return;

  // Enregistrer la facture
  await supabase.from("subscription_invoices").upsert(
    {
      subscription_id: sub.id,
      stripe_invoice_id: invoice.id,
      stripe_charge_id: invoice.charge as string,
      amount_due: invoice.amount_due,
      amount_paid: invoice.amount_paid,
      amount_remaining: invoice.amount_remaining,
      status: invoice.status || "paid",
      hosted_invoice_url: invoice.hosted_invoice_url,
      invoice_pdf: invoice.invoice_pdf,
      period_start: invoice.period_start
        ? new Date(invoice.period_start * 1000).toISOString()
        : null,
      period_end: invoice.period_end
        ? new Date(invoice.period_end * 1000).toISOString()
        : null,
      paid_at: invoice.status_transitions?.paid_at
        ? new Date(invoice.status_transitions.paid_at * 1000).toISOString()
        : new Date().toISOString(),
    },
    {
      onConflict: "stripe_invoice_id",
    }
  );
}

async function handleInvoiceFailed(
  supabase: ReturnType<typeof createServiceRoleClient>,
  invoice: Stripe.Invoice
) {
  if (!invoice.subscription) return;

  // Mettre à jour le statut
  await supabase
    .from("subscriptions")
    .update({ status: "past_due" })
    .eq("stripe_subscription_id", invoice.subscription as string);

  // Notification
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("owner_id")
    .eq("stripe_subscription_id", invoice.subscription as string)
    .single();

  if (sub) {
    await supabase.from("notifications").insert({
      user_id: sub.owner_id,
      type: "payment_failed",
      title: "Échec de paiement",
      message: "Le paiement de votre abonnement a échoué. Veuillez mettre à jour vos informations de paiement.",
      data: { invoice_id: invoice.id },
    });
  }
}


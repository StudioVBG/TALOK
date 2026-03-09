export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/subscriptions/webhook
 * Webhook Stripe pour les événements d'abonnement
 *
 * Fixes SOTA 2026:
 * - Déduplication par event.id (Stripe peut renvoyer le même event)
 * - plan_slug synchronisé dans handleCheckoutCompleted
 * - plan_id + plan_slug mis à jour dans handleSubscriptionUpdated
 * - Audit trail complet sur tous les handlers
 */

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { stripe } from "@/lib/stripe";
import { createServiceRoleClient } from "@/lib/supabase/server";
import Stripe from "stripe";
import { sendEmail } from "@/lib/emails/resend.service";
import { emailTemplates } from "@/lib/emails/templates";

// Cache en mémoire pour déduplication (TTL 5 min)
const processedEvents = new Map<string, number>();
const EVENT_TTL_MS = 5 * 60 * 1000;

function isEventAlreadyProcessed(eventId: string): boolean {
  const timestamp = processedEvents.get(eventId);
  if (!timestamp) return false;
  if (Date.now() - timestamp > EVENT_TTL_MS) {
    processedEvents.delete(eventId);
    return false;
  }
  return true;
}

function markEventProcessed(eventId: string): void {
  processedEvents.set(eventId, Date.now());
  // Cleanup old entries
  if (processedEvents.size > 1000) {
    const cutoff = Date.now() - EVENT_TTL_MS;
    for (const [key, ts] of processedEvents) {
      if (ts < cutoff) processedEvents.delete(key);
    }
  }
}

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

  // Déduplication : ignorer les events déjà traités
  if (isEventAlreadyProcessed(event.id)) {
    return NextResponse.json({ received: true, deduplicated: true });
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
        await handleSubscriptionUpdated(supabase, subscription, event.type);
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

    markEventProcessed(event.id);
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
// HELPERS
// ============================================

/**
 * Résout le plan_slug depuis un plan_id
 */
async function resolvePlanSlug(
  supabase: ReturnType<typeof createServiceRoleClient>,
  planId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("subscription_plans")
    .select("slug")
    .eq("id", planId)
    .single();
  return data?.slug || null;
}

/**
 * Résout le plan depuis les métadonnées Stripe (product.metadata.plan_slug)
 */
async function resolvePlanFromStripeSubscription(
  supabase: ReturnType<typeof createServiceRoleClient>,
  subscription: Stripe.Subscription
): Promise<{ plan_id: string; plan_slug: string } | null> {
  // Essayer d'abord via les métadonnées du produit Stripe
  const priceId = subscription.items.data[0]?.price?.id;
  if (priceId) {
    try {
      const price = await stripe.prices.retrieve(priceId, { expand: ["product"] });
      const product = price.product as Stripe.Product;
      const planSlug = product.metadata?.plan_slug;
      if (planSlug) {
        const { data: plan } = await supabase
          .from("subscription_plans")
          .select("id, slug")
          .eq("slug", planSlug)
          .single();
        if (plan) return { plan_id: plan.id, plan_slug: plan.slug };
      }
    } catch {
      // Fallback ci-dessous
    }
  }

  // Fallback : métadonnées de la subscription elle-même
  const metaSlug = subscription.metadata?.plan_slug;
  if (metaSlug) {
    const { data: plan } = await supabase
      .from("subscription_plans")
      .select("id, slug")
      .eq("slug", metaSlug)
      .single();
    if (plan) return { plan_id: plan.id, plan_slug: plan.slug };
  }

  return null;
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

  // Résoudre le plan_slug depuis le plan_id
  const planSlug = session.metadata?.plan_slug || await resolvePlanSlug(supabase, planId);

  // Récupérer les détails de l'abonnement Stripe
  const subscriptionId = session.subscription as string;
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  // Créer ou mettre à jour l'abonnement dans la DB
  const { error } = await supabase.from("subscriptions").upsert(
    {
      owner_id: profileId,
      plan_id: planId,
      plan_slug: planSlug,
      stripe_subscription_id: subscriptionId,
      stripe_customer_id: session.customer as string,
      status: subscription.status,
      billing_cycle: subscription.items.data[0].price.recurring?.interval === "year" ? "yearly" : "monthly",
      current_period_start: new Date((subscription as any).current_period_start * 1000).toISOString(),
      current_period_end: new Date((subscription as any).current_period_end * 1000).toISOString(),
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

  // Envoyer une notification in-app
  await supabase.from("notifications").insert({
    user_id: profileId,
    type: "subscription_created",
    title: "Abonnement activé !",
    message: "Votre abonnement a été activé avec succès. Bienvenue !",
    data: { subscription_id: subscriptionId, plan_slug: planSlug },
  });

  // Envoyer un email de confirmation
  const { data: ownerProfile } = await supabase
    .from("profiles")
    .select("prenom, user_id")
    .eq("id", profileId)
    .single();
  if (ownerProfile) {
    const { data: authUser } = await supabase.auth.admin.getUserById(ownerProfile.user_id);
    if (authUser?.user?.email) {
      const { data: planData } = await supabase
        .from("subscription_plans")
        .select("name, price_monthly, price_yearly")
        .eq("id", planId)
        .single();
      const billingCycle = subscription.items.data[0].price.recurring?.interval === "year" ? "yearly" : "monthly";
      const price = billingCycle === "yearly" ? (planData?.price_yearly || 0) : (planData?.price_monthly || 0);
      const emailData = emailTemplates.subscriptionActivated({
        userName: ownerProfile.prenom || "Propriétaire",
        planName: planData?.name || planSlug || "Starter",
        billingCycle: billingCycle === "yearly" ? "par an" : "par mois",
        price: `${(price / 100).toFixed(2)}€`,
        dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://app.talok.fr"}/owner/settings/billing`,
      });
      try {
        await sendEmail({ to: authUser.user.email, ...emailData });
      } catch (emailError) {
        console.error("Erreur envoi email subscription_activated:", emailError);
      }
    }
  }

  // Log d'audit
  await supabase.from("audit_log").insert({
    action: "subscription_created",
    entity_type: "subscription",
    entity_id: subscriptionId,
    metadata: {
      profile_id: profileId,
      plan_id: planId,
      plan_slug: planSlug,
      status: subscription.status,
      billing_cycle: subscription.items.data[0].price.recurring?.interval === "year" ? "yearly" : "monthly",
    },
  });
}

async function handleSubscriptionUpdated(
  supabase: ReturnType<typeof createServiceRoleClient>,
  subscription: Stripe.Subscription,
  eventType: string
) {
  // Résoudre le plan actuel depuis Stripe (pour les upgrades/downgrades)
  const planInfo = await resolvePlanFromStripeSubscription(supabase, subscription);

  // Préparer les champs à mettre à jour
  const updateData: Record<string, any> = {
    status: subscription.status,
    current_period_start: new Date((subscription as any).current_period_start * 1000).toISOString(),
    current_period_end: new Date((subscription as any).current_period_end * 1000).toISOString(),
    cancel_at_period_end: subscription.cancel_at_period_end,
    canceled_at: subscription.canceled_at
      ? new Date(subscription.canceled_at * 1000).toISOString()
      : null,
    billing_cycle: subscription.items.data[0]?.price.recurring?.interval === "year" ? "yearly" : "monthly",
    updated_at: new Date().toISOString(),
  };

  // Mettre à jour plan_id et plan_slug si on a pu résoudre le plan
  if (planInfo) {
    updateData.plan_id = planInfo.plan_id;
    updateData.plan_slug = planInfo.plan_slug;
  }

  const { error } = await supabase
    .from("subscriptions")
    .update(updateData)
    .eq("stripe_subscription_id", subscription.id);

  if (error) {
    console.error("Erreur mise à jour subscription:", error);
  }

  // Audit trail
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("owner_id")
    .eq("stripe_subscription_id", subscription.id)
    .single();

  if (sub) {
    await supabase.from("audit_log").insert({
      action: eventType === "customer.subscription.created" ? "subscription_stripe_created" : "subscription_updated",
      entity_type: "subscription",
      entity_id: subscription.id,
      user_id: sub.owner_id,
      metadata: {
        status: subscription.status,
        plan_slug: planInfo?.plan_slug || null,
        cancel_at_period_end: subscription.cancel_at_period_end,
        billing_cycle: updateData.billing_cycle,
      },
    });
  }
}

async function handleSubscriptionDeleted(
  supabase: ReturnType<typeof createServiceRoleClient>,
  subscription: Stripe.Subscription
) {
  // Récupérer l'owner avant la mise à jour
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("owner_id, plan_slug")
    .eq("stripe_subscription_id", subscription.id)
    .single();

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

  if (sub) {
    // Notification
    await supabase.from("notifications").insert({
      user_id: sub.owner_id,
      type: "subscription_canceled",
      title: "Abonnement annulé",
      message: "Votre abonnement a été annulé. Vous passez au plan gratuit.",
    });

    // Audit trail
    await supabase.from("audit_log").insert({
      action: "subscription_canceled",
      entity_type: "subscription",
      entity_id: subscription.id,
      user_id: sub.owner_id,
      metadata: {
        previous_plan_slug: sub.plan_slug,
        reason: subscription.cancellation_details?.reason || "unknown",
      },
    });
  }
}

async function handleInvoicePaid(
  supabase: ReturnType<typeof createServiceRoleClient>,
  invoice: Stripe.Invoice
) {
  if (!(invoice as any).subscription) return;

  // Récupérer l'abonnement local
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("id, owner_id")
    .eq("stripe_subscription_id", (invoice as any).subscription as string)
    .single();

  if (!sub) return;

  // Enregistrer la facture
  await supabase.from("subscription_invoices").upsert(
    {
      subscription_id: sub.id,
      stripe_invoice_id: invoice.id,
      stripe_charge_id: (invoice as any).charge as string,
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

  // Audit trail
  await supabase.from("audit_log").insert({
    action: "invoice_paid",
    entity_type: "subscription_invoice",
    entity_id: invoice.id,
    user_id: sub.owner_id,
    metadata: {
      amount_paid: invoice.amount_paid,
      currency: invoice.currency,
    },
  });
}

async function handleInvoiceFailed(
  supabase: ReturnType<typeof createServiceRoleClient>,
  invoice: Stripe.Invoice
) {
  if (!(invoice as any).subscription) return;

  // Mettre à jour le statut
  await supabase
    .from("subscriptions")
    .update({
      status: "past_due",
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", (invoice as any).subscription as string);

  // Notification
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("owner_id")
    .eq("stripe_subscription_id", (invoice as any).subscription as string)
    .single();

  if (sub?.owner_id) {
    await supabase.from("notifications").insert({
      user_id: sub.owner_id,
      type: "payment_failed",
      title: "Échec de paiement",
      message: "Le paiement de votre abonnement a échoué. Veuillez mettre à jour vos informations de paiement.",
      data: { invoice_id: invoice.id },
    });

    // Email d'alerte paiement échoué
    const { data: ownerProfile } = await supabase
      .from("profiles")
      .select("prenom, user_id")
      .eq("id", sub.owner_id)
      .single();
    if (ownerProfile) {
      const { data: authUser } = await supabase.auth.admin.getUserById(ownerProfile.user_id);
      if (authUser?.user?.email) {
        const { data: subData } = await supabase
          .from("subscriptions")
          .select("plan_slug")
          .eq("owner_id", sub.owner_id)
          .single();
        const emailData = emailTemplates.paymentFailed({
          userName: ownerProfile.prenom || "Propriétaire",
          planName: subData?.plan_slug || "votre plan",
          amount: `${(invoice.amount_due / 100).toFixed(2)}€`,
          billingUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://app.talok.fr"}/owner/settings/billing`,
        });
        try {
          await sendEmail({ to: authUser.user.email, ...emailData });
        } catch (emailError) {
          console.error("Erreur envoi email payment_failed:", emailError);
        }
      }
    }

    // Audit trail
    await supabase.from("audit_log").insert({
      action: "payment_failed",
      entity_type: "subscription_invoice",
      entity_id: invoice.id,
      user_id: sub.owner_id,
      metadata: {
        amount_due: invoice.amount_due,
        attempt_count: invoice.attempt_count,
      },
    });
  }
}

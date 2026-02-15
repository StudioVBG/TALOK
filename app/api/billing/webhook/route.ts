import { NextRequest, NextResponse } from "next/server";
import { getStripe, getWebhookSecret } from "@/lib/stripe-client";
import { createServiceRoleClient } from "@/lib/supabase/service-client";
import type Stripe from "stripe";

/**
 * Webhook Stripe — Gestion des evenements d'abonnement
 * Signature verifiee avec constructEvent() (HMAC-SHA256)
 * 10 events geres — chaque event logue dans audit_log
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Signature manquante" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(body, signature, getWebhookSecret());
  } catch {
    return NextResponse.json({ error: "Signature invalide" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  try {
    switch (event.type) {
      case "customer.subscription.created": {
        const sub = event.data.object as Stripe.Subscription;
        await handleSubscriptionCreated(supabase, sub);
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(supabase, sub);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(supabase, sub);
        break;
      }
      case "customer.subscription.paused": {
        const sub = event.data.object as Stripe.Subscription;
        await handleSubscriptionPaused(supabase, sub);
        break;
      }
      case "customer.subscription.resumed": {
        const sub = event.data.object as Stripe.Subscription;
        await handleSubscriptionResumed(supabase, sub);
        break;
      }
      case "invoice.created": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoiceCreated(supabase, invoice);
        break;
      }
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaid(supabase, invoice);
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(supabase, invoice);
        break;
      }
      case "customer.updated": {
        const customer = event.data.object as Stripe.Customer;
        await handleCustomerUpdated(supabase, customer);
        break;
      }
      case "price.updated": {
        const priceObj = event.data.object as { id?: string };
        await logAuditEvent(supabase, "system", "update", "price", priceObj?.id ?? event.id, {
          event_type: event.type,
        });
        break;
      }
      default:
        break;
    }

    await logAuditEvent(supabase, "system", "create", "webhook_event", event.id, {
      type: event.type,
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur webhook";
    const eventId = event?.id ?? "unknown";
    const eventType = event?.type ?? "unknown";
    await logAuditEvent(supabase, "system", "create", "webhook_error", eventId, {
      type: eventType,
      error: message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;

async function handleSubscriptionCreated(supabase: SupabaseClient, sub: Stripe.Subscription) {
  const userId = sub.metadata?.user_id;
  if (!userId) return;
  const stripeSub = sub as unknown as { current_period_start: number; current_period_end: number };

  await supabase.from("subscriptions").upsert({
    user_id: userId,
    stripe_subscription_id: sub.id,
    stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    status: sub.status,
    current_period_start: new Date(stripeSub.current_period_start * 1000).toISOString(),
    current_period_end: new Date(stripeSub.current_period_end * 1000).toISOString(),
    cancel_at_period_end: sub.cancel_at_period_end,
    trial_end: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "stripe_subscription_id" });

  await logAuditEvent(supabase, userId, "create", "subscription", sub.id, {
    status: sub.status,
  });
}

async function handleSubscriptionUpdated(supabase: SupabaseClient, sub: Stripe.Subscription) {
  await supabase
    .from("subscriptions")
    .update({
      status: sub.status,
      current_period_start: new Date((sub as unknown as { current_period_start: number }).current_period_start * 1000).toISOString(),
      current_period_end: new Date((sub as unknown as { current_period_end: number }).current_period_end * 1000).toISOString(),
      cancel_at_period_end: sub.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", sub.id);

  const userId = sub.metadata?.user_id || "system";
  await logAuditEvent(supabase, userId, "update", "subscription", sub.id, {
    status: sub.status,
    cancel_at_period_end: sub.cancel_at_period_end,
  });
}

async function handleSubscriptionDeleted(supabase: SupabaseClient, sub: Stripe.Subscription) {
  await supabase
    .from("subscriptions")
    .update({
      status: "canceled",
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", sub.id);

  const userId = sub.metadata?.user_id || "system";
  await logAuditEvent(supabase, userId, "update", "subscription", sub.id, {
    status: "canceled",
  });
}

async function handleSubscriptionPaused(supabase: SupabaseClient, sub: Stripe.Subscription) {
  await supabase
    .from("subscriptions")
    .update({
      status: "paused",
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", sub.id);

  const userId = sub.metadata?.user_id || "system";
  await logAuditEvent(supabase, userId, "update", "subscription", sub.id, {
    status: "paused",
  });
}

async function handleSubscriptionResumed(supabase: SupabaseClient, sub: Stripe.Subscription) {
  await supabase
    .from("subscriptions")
    .update({
      status: "active",
      pause_collection_until: null,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", sub.id);

  const userId = sub.metadata?.user_id || "system";
  await logAuditEvent(supabase, userId, "update", "subscription", sub.id, {
    status: "active",
    resumed: true,
  });
}

async function handleInvoiceCreated(supabase: SupabaseClient, invoice: Stripe.Invoice) {
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .single();

  if (!subscription?.user_id) return;

  await supabase.from("subscription_invoices").upsert({
    id: invoice.id,
    owner_id: subscription.user_id,
    stripe_invoice_id: invoice.id,
    invoice_number: invoice.number,
    subtotal: invoice.subtotal || 0,
    tax: (invoice as { tax?: number }).tax ?? 0,
    total: invoice.total || 0,
    status: invoice.status || "draft",
    invoice_pdf_url: invoice.invoice_pdf || null,
    hosted_invoice_url: invoice.hosted_invoice_url || null,
    period_start: invoice.period_start ? new Date(invoice.period_start * 1000).toISOString() : null,
    period_end: invoice.period_end ? new Date(invoice.period_end * 1000).toISOString() : null,
    created_at: new Date(invoice.created * 1000).toISOString(),
  }, { onConflict: "id" });

  await logAuditEvent(supabase, subscription.user_id, "create", "invoice", invoice.id, {
    number: invoice.number,
    total: invoice.total,
  });
}

async function handleInvoicePaid(supabase: SupabaseClient, invoice: Stripe.Invoice) {
  await supabase
    .from("subscription_invoices")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      invoice_pdf_url: invoice.invoice_pdf || null,
      hosted_invoice_url: invoice.hosted_invoice_url || null,
    })
    .eq("stripe_invoice_id", invoice.id);
}

async function handlePaymentFailed(supabase: SupabaseClient, invoice: Stripe.Invoice) {
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;

  await supabase
    .from("subscriptions")
    .update({
      status: "past_due",
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_customer_id", customerId);

  await supabase
    .from("subscription_invoices")
    .update({ status: "open" })
    .eq("stripe_invoice_id", invoice.id);
}

async function handleCustomerUpdated(supabase: SupabaseClient, customer: Stripe.Customer) {
  await logAuditEvent(supabase, "system", "update", "customer", customer.id, {
    email: customer.email,
  });
}

async function logAuditEvent(
  supabase: SupabaseClient,
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, unknown>
) {
  await supabase.from("audit_log").insert({
    user_id: userId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata,
    risk_level: action === "create" && entityType === "webhook_error" ? "high" : "low",
    success: true,
  }).catch(() => {});
}

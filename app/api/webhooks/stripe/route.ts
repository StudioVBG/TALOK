export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Webhook Stripe
 * 
 * Gère les événements Stripe pour synchroniser les paiements:
 * - checkout.session.completed : Paiement réussi
 * - payment_intent.succeeded : Paiement confirmé
 * - payment_intent.payment_failed : Paiement échoué
 * - invoice.paid : Abonnement payé
 * - customer.subscription.updated : Mise à jour abonnement
 * - customer.subscription.deleted : Annulation abonnement
 */

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { createServiceRoleClient } from "@/lib/supabase/service-client";
import type { Json } from "@/lib/supabase/database.types";
import { reconcileOwnerTransfer } from "@/lib/billing/owner-payout.service";
import { ensureReceiptDocument } from "@/lib/services/final-documents.service";
import { syncInvoiceStatusFromPayments } from "@/lib/services/invoice-status.service";
import { ensureSecurityDepositForInvoice } from "@/lib/services/security-deposit-sync.service";
import {
  handleRentPaymentSucceeded,
  handleRentPaymentFailed,
} from "@/lib/payments/rent-collection.service";
import { recordPromoCodeUse } from "@/lib/subscriptions/promo-codes.service";
import {
  buildSubscriptionUpdateFromStripe,
  resolvePlanIdentifiers,
} from "@/lib/subscriptions/market-standard";

// Initialiser Stripe de manière lazy pour éviter les erreurs au build
function getStripe(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  return new Stripe(secretKey, {
    apiVersion: "2024-10-28.acacia" as any,
  });
}

// Fonction utilitaire pour générer et sauvegarder la quittance de façon idempotente,
// puis envoyer la quittance PDF par email au locataire.
async function processReceiptGeneration(supabase: any, _invoiceId: string, paymentId: string, _amount: number) {
  try {
    const result = await ensureReceiptDocument(supabase, paymentId);

    // Envoyer la quittance par email au locataire (seulement si nouvelle)
    if (result?.created && result.pdfBytes && result.receiptMeta?.tenantEmail) {
      try {
        const { sendReceiptEmail } = await import("@/lib/emails/send-receipt-email");
        await sendReceiptEmail({
          tenantEmail: result.receiptMeta.tenantEmail,
          tenantName: result.receiptMeta.tenantName,
          period: result.receiptMeta.period,
          totalAmount: result.receiptMeta.totalAmount,
          propertyAddress: result.receiptMeta.propertyAddress,
          paymentDate: result.receiptMeta.paymentDate,
          paymentMethod: result.receiptMeta.paymentMethod,
          pdfBytes: result.pdfBytes,
          paymentId,
        });

        // Marquer la quittance comme envoyée
        await supabase
          .from("receipts")
          .update({ sent_at: new Date().toISOString() })
          .eq("payment_id", paymentId);
      } catch (emailError) {
        console.error("[Receipt] Email to tenant failed:", emailError);
      }
    }
  } catch (error) {
    console.error("[Receipt] Generation failed:", error);
  }
}

function getCanonicalAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") || null;
}

async function resolveSourceTransactionId(stripe: Stripe, paymentIntentId?: string | null) {
  if (!paymentIntentId) {
    return null;
  }

  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ["latest_charge"],
    });

    const latestCharge = paymentIntent.latest_charge;
    if (!latestCharge) {
      return null;
    }

    return typeof latestCharge === "string" ? latestCharge : latestCharge.id;
  } catch (error) {
    console.error("[Stripe Webhook] Unable to resolve source transaction:", error);
    return null;
  }
}

async function syncSubscriptionStateFromStripeSubscription(
  supabase: any,
  subscription: Stripe.Subscription,
  fallbackOwnerId?: string | null
) {
  const stripeSubscriptionId = subscription.id;
  const stripeCustomerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
  const baseUpdate = await buildSubscriptionUpdateFromStripe(supabase, subscription);

  let query = supabase
    .from("subscriptions")
    .update(baseUpdate)
    .eq("stripe_subscription_id", stripeSubscriptionId);

  const { data: updatedRows, error: updateError } = await query.select("id");
  if (!updateError && (updatedRows?.length ?? 0) > 0) {
    return;
  }

  if (stripeCustomerId) {
    const { data: fallbackRows, error: fallbackError } = await supabase
      .from("subscriptions")
      .update(baseUpdate)
      .eq("stripe_customer_id", stripeCustomerId)
      .select("id");

    if (!fallbackError && (fallbackRows?.length ?? 0) > 0) {
      return;
    }
  }

  const ownerId = fallbackOwnerId || subscription.metadata?.profile_id || null;
  if (!ownerId) {
    return;
  }

  await supabase.from("subscriptions").upsert(
    {
      owner_id: ownerId,
      ...baseUpdate,
      metadata: {
        ...(baseUpdate.metadata || {}),
        source: "stripe_webhook",
      },
    },
    { onConflict: "owner_id" }
  );
}

async function syncSubscriptionFromCheckoutSession(
  supabase: any,
  stripe: Stripe,
  session: Stripe.Checkout.Session
) {
  if (session.mode !== "subscription") {
    return;
  }

  const ownerId = session.metadata?.profile_id || null;
  const stripeSubscriptionId =
    typeof session.subscription === "string" ? session.subscription : session.subscription?.id || null;
  const stripeCustomerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id || null;

  if (!ownerId && !stripeCustomerId) {
    return;
  }

  const checkoutUpdate = {
    stripe_customer_id: stripeCustomerId,
    stripe_subscription_id: stripeSubscriptionId,
    status: session.payment_status === "paid" ? "active" : "incomplete",
    billing_cycle: session.metadata?.billing_cycle || null,
    plan_slug: session.metadata?.plan_slug || null,
    selected_plan_at: new Date().toISOString(),
    selected_plan_source: "signup_checkout",
  };

  if (ownerId) {
    const resolvedPlan = await resolvePlanIdentifiers(supabase, {
      planSlug: session.metadata?.plan_slug || null,
      planId: session.metadata?.plan_id || null,
    });
    await supabase.from("subscriptions").upsert(
      {
        owner_id: ownerId,
        ...checkoutUpdate,
        plan_id: resolvedPlan.id,
      },
      { onConflict: "owner_id" }
    );
  } else if (stripeCustomerId) {
    await supabase
      .from("subscriptions")
      .update(checkoutUpdate)
      .eq("stripe_customer_id", stripeCustomerId);
  }

  if (stripeSubscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    await syncSubscriptionStateFromStripeSubscription(supabase, subscription, ownerId);
  }
}

function getStripeInvoiceSubscriptionId(
  invoice: Stripe.Invoice & { subscription?: string | Stripe.Subscription | null }
) {
  return typeof invoice.subscription === "string"
    ? invoice.subscription
    : invoice.subscription?.id || null;
}

function getStripeInvoicePeriod(invoice: Stripe.Invoice) {
  const firstLine = invoice.lines?.data?.[0];
  return {
    current_period_start: firstLine?.period?.start
      ? new Date(firstLine.period.start * 1000).toISOString()
      : null,
    current_period_end: firstLine?.period?.end
      ? new Date(firstLine.period.end * 1000).toISOString()
      : null,
  };
}

async function resolveSubscriptionRecord(
  supabase: any,
  stripeCustomerId?: string | null,
  stripeSubscriptionId?: string | null
) {
  if (stripeSubscriptionId) {
    const bySubscription = await supabase
      .from("subscriptions")
      .select("id, owner_id")
      .eq("stripe_subscription_id", stripeSubscriptionId)
      .maybeSingle();

    if (bySubscription.data) {
      return bySubscription.data as { id: string; owner_id?: string | null };
    }
  }

  if (!stripeCustomerId) {
    return null;
  }

  const byCustomer = await supabase
    .from("subscriptions")
    .select("id, owner_id")
    .eq("stripe_customer_id", stripeCustomerId)
    .maybeSingle();

  return (byCustomer.data as { id: string; owner_id?: string | null } | null) ?? null;
}

async function upsertSubscriptionInvoiceRecord(
  supabase: any,
  subscriptionId: string,
  invoice: Stripe.Invoice,
  statusOverride?: string | null
) {
  await supabase.from("subscription_invoices").upsert(
    {
      subscription_id: subscriptionId,
      stripe_invoice_id: invoice.id,
      amount_due: invoice.amount_due || 0,
      amount_paid: invoice.amount_paid || 0,
      amount_remaining: invoice.amount_remaining || 0,
      status: statusOverride || invoice.status || "open",
      hosted_invoice_url: invoice.hosted_invoice_url,
      invoice_pdf: invoice.invoice_pdf,
      paid_at: invoice.status_transitions?.paid_at
        ? new Date(invoice.status_transitions.paid_at * 1000).toISOString()
        : null,
    },
    { onConflict: "stripe_invoice_id" }
  );
}

async function syncSubscriptionFromInvoiceEvent(
  supabase: any,
  stripe: Stripe,
  invoice: Stripe.Invoice & { subscription?: string | Stripe.Subscription | null },
  statusOverride?: string | null
) {
  const stripeCustomerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id || null;
  const stripeSubscriptionId = getStripeInvoiceSubscriptionId(invoice);

  if (stripeSubscriptionId) {
    try {
      const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
      await syncSubscriptionStateFromStripeSubscription(supabase, stripeSubscription);
    } catch (error) {
      console.error("[Stripe Webhook] Impossible de synchroniser l'abonnement depuis la facture:", error);
    }
  }

  const subscription = await resolveSubscriptionRecord(supabase, stripeCustomerId, stripeSubscriptionId);
  if (!subscription) {
    return null;
  }

  const invoicePeriod = getStripeInvoicePeriod(invoice);
  const updatePayload: Record<string, unknown> = {
    stripe_customer_id: stripeCustomerId,
    stripe_subscription_id: stripeSubscriptionId,
  };

  if (statusOverride) {
    updatePayload.status = statusOverride;
  }
  if (invoicePeriod.current_period_start) {
    updatePayload.current_period_start = invoicePeriod.current_period_start;
  }
  if (invoicePeriod.current_period_end) {
    updatePayload.current_period_end = invoicePeriod.current_period_end;
  }

  await supabase
    .from("subscriptions")
    .update(updatePayload)
    .eq("id", subscription.id);

  await upsertSubscriptionInvoiceRecord(supabase, subscription.id, invoice, statusOverride);

  return subscription;
}

async function upsertPaymentAttempt(
  supabase: any,
  params: {
    invoiceId: string;
    amount: number;
    method: string;
    providerRef: string;
    status: "pending" | "succeeded" | "failed";
    paidAt?: string | null;
  }
) {
  // Lit le statut actuel pour calculer newlySucceeded/newlyFailed.
  // La race condition ne porte plus sur l'INSERT (UNIQUE provider_ref +
  // upsert ON CONFLICT) ; ce SELECT sert uniquement à savoir si on
  // déclenche les side-effects post-paiement (compta, quittance, email).
  const { data: existingPayment } = await supabase
    .from("payments")
    .select("statut")
    .eq("provider_ref", params.providerRef)
    .maybeSingle();

  const existing = existingPayment as { statut?: string | null } | null;
  // `payments.date_paiement` est de type DATE — les callers passent souvent
  // `new Date().toISOString()` (timestamp ISO). On normalise vers YYYY-MM-DD
  // pour éviter la coercition silencieuse côté Postgres.
  const normalizedPaidAt = params.paidAt
    ? params.paidAt.slice(0, 10)
    : null;
  const payload = {
    invoice_id: params.invoiceId,
    montant: params.amount,
    moyen: params.method,
    provider_ref: params.providerRef,
    date_paiement: normalizedPaidAt,
    statut: params.status,
  };

  // Upsert atomique sur la contrainte UNIQUE (provider_ref) installée par
  // migration 20260504100000. Élimine la fenêtre TOCTOU entre SELECT et
  // INSERT qui permettait deux webhooks Stripe simultanés de créer deux
  // rows payments pour le même payment_intent.
  const { data: upsertedPayment } = await supabase
    .from("payments")
    .upsert(payload, { onConflict: "provider_ref" })
    .select("id")
    .single();

  return {
    paymentId: (upsertedPayment as { id?: string } | null)?.id ?? null,
    newlySucceeded:
      (existing?.statut ?? null) !== "succeeded" && params.status === "succeeded",
    newlyFailed:
      (existing?.statut ?? null) !== "failed" && params.status === "failed",
  };
}

async function upsertStripePayout(
  supabase: any,
  stripeAccountId: string | null | undefined,
  payout: Stripe.Payout,
  statusOverride?: "pending" | "paid" | "failed" | "canceled" | "in_transit"
) {
  if (!stripeAccountId) {
    return;
  }

  const { data: connectAccount } = await supabase
    .from("stripe_connect_accounts")
    .select("id")
    .eq("stripe_account_id", stripeAccountId)
    .maybeSingle();

  const connectAccountId = (connectAccount as { id?: string } | null)?.id;
  if (!connectAccountId) {
    return;
  }

  const status =
    statusOverride ??
    (payout.status === "paid"
      ? "paid"
      : payout.status === "failed"
        ? "failed"
        : payout.status === "canceled"
          ? "canceled"
          : payout.status === "in_transit"
            ? "in_transit"
            : "pending");

  await supabase.from("stripe_payouts").upsert(
    {
      connect_account_id: connectAccountId,
      stripe_payout_id: payout.id,
      stripe_balance_transaction_id:
        typeof payout.balance_transaction === "string"
          ? payout.balance_transaction
          : payout.balance_transaction?.id || null,
      amount: payout.amount,
      currency: payout.currency,
      status,
      arrival_date: payout.arrival_date ? new Date(payout.arrival_date * 1000).toISOString() : null,
      paid_at:
        status === "paid"
          ? new Date().toISOString()
          : null,
      failure_code: payout.failure_code || null,
      failure_message: payout.failure_message || null,
      metadata: payout.metadata || {},
    },
    { onConflict: "stripe_payout_id" }
  );
}

/**
 * ✅ SOTA 2026: Émettre un événement Payment.Succeeded dans l'outbox
 * pour les notifications et la traçabilité
 */
async function emitPaymentSucceededEvent(
  supabase: any, 
  paymentId: string, 
  invoiceId: string, 
  amount: number,
  options?: { invoiceSettled?: boolean; receiptGenerated?: boolean }
) {
  try {
    // Récupérer les infos du locataire et du propriétaire
    const { data: invoice } = await supabase
      .from("invoices")
      .select(`
        id,
        periode,
        owner_id,
        tenant_id,
        lease:leases (
          id,
          property:properties (
            adresse_complete,
            ville
          )
        )
      `)
      .eq("id", invoiceId)
      .single();

    if (!invoice) return;

    // Récupérer le user_id du locataire pour la notification
    const { data: tenantProfile } = await supabase
      .from("profiles")
      .select("user_id, prenom, nom")
      .eq("id", invoice.tenant_id)
      .single();

    // Récupérer le user_id du propriétaire pour la notification
    const { data: ownerProfile } = await supabase
      .from("profiles")
      .select("user_id, prenom, nom")
      .eq("id", invoice.owner_id)
      .single();

    const propertyAddress = invoice.lease?.property?.adresse_complete || 
                            invoice.lease?.property?.ville || 
                            "le logement";

    // Notifier le LOCATAIRE
    if (tenantProfile?.user_id) {
      await supabase.from("outbox").insert({
        event_type: "Payment.Succeeded",
        payload: {
          payment_id: paymentId,
          invoice_id: invoiceId,
          amount: amount,
          tenant_id: tenantProfile.user_id,
          tenant_name: `${tenantProfile.prenom || ""} ${tenantProfile.nom || ""}`.trim(),
          periode: invoice.periode,
          property_address: propertyAddress,
          type: "tenant_notification",
          invoice_settled: options?.invoiceSettled ?? false,
          receipt_generated: options?.receiptGenerated ?? false,
        },
      });
    }

    // Notifier le PROPRIÉTAIRE
    if (ownerProfile?.user_id) {
      await supabase.from("outbox").insert({
        event_type: "Payment.Received",
        payload: {
          payment_id: paymentId,
          invoice_id: invoiceId,
          amount: amount,
          owner_id: ownerProfile.user_id,
          tenant_name: `${tenantProfile?.prenom || ""} ${tenantProfile?.nom || ""}`.trim(),
          periode: invoice.periode,
          property_address: propertyAddress,
          type: "owner_notification",
          invoice_settled: options?.invoiceSettled ?? false,
        },
      });
    }

  } catch (error) {
    console.error("[Payment] Error emitting events:", error);
  }
}

/**
 * Sprint 0.d.1 — variant pour les paiements de régularisation des charges.
 *
 * Émet un event `ChargeRegularization.Paid` distinct de `Payment.Succeeded`
 * pour que les consumers email/notif sachent envoyer un message adapté
 * (« votre régul a été payée », pas « votre loyer a été payé »).
 *
 * Pas de génération de quittance loyer ni d'écriture comptable — l'écriture
 * a déjà été créée au settle dans /api/charges/regularization/[id]/apply.
 */
async function emitChargeRegularizationPaidEvent(
  supabase: any,
  args: {
    paymentId: string;
    invoiceId: string;
    regularizationId: string | null;
    amount: number;
  },
) {
  try {
    await supabase.from("outbox").insert({
      event_type: "ChargeRegularization.Paid",
      payload: {
        payment_id: args.paymentId,
        invoice_id: args.invoiceId,
        regularization_id: args.regularizationId,
        amount: args.amount,
      },
    });
  } catch (error) {
    console.error("[ChargeRegularization] Error emitting paid event:", error);
  }
}

/**
 * Gère les notifications et relances suite à un échec de paiement.
 * - Notifie le locataire et le propriétaire (notifications in-app)
 * - Envoie un email de rappel au locataire
 * - Programme les relances via outbox : J+1, J+3, J+7
 */
async function processPaymentFailedNotifications(
  supabase: any,
  invoiceId: string,
  paymentIntent: Stripe.PaymentIntent
) {
  // Récupérer les infos complètes de la facture
  const { data: invoice } = await supabase
    .from("invoices")
    .select(`
      id, montant_total, periode, date_echeance, owner_id, tenant_id,
      lease:leases(
        id,
        property:properties(
          adresse_complete, ville
        )
      )
    `)
    .eq("id", invoiceId)
    .single();

  if (!invoice) return;

  const [{ data: tenantProfile }, { data: ownerProfile }] = await Promise.all([
    supabase.from("profiles").select("id, prenom, nom, email, user_id").eq("id", invoice.tenant_id).single(),
    supabase.from("profiles").select("id, prenom, nom, email, user_id").eq("id", invoice.owner_id).single(),
  ]);

  const tenantName = `${tenantProfile?.prenom || ""} ${tenantProfile?.nom || ""}`.trim() || "Locataire";
  const propertyAddress = invoice.lease?.property?.adresse_complete || invoice.lease?.property?.ville || "le logement";
  const amount = (paymentIntent.amount / 100).toFixed(2);
  const failureMessage = paymentIntent.last_payment_error?.message || "Paiement refusé";

  // 1. Notification in-app au locataire
  if (tenantProfile?.user_id) {
    await supabase.rpc("create_notification", {
      p_recipient_id: tenantProfile.user_id,
      p_type: "alert",
      p_title: "Échec de paiement",
      p_message: `Votre paiement de ${amount}€ pour ${propertyAddress} a échoué. ${failureMessage}`,
      p_link: `/tenant/payments?invoice=${invoiceId}`,
      p_related_id: invoiceId,
      p_related_type: "invoice",
    });
  }

  // 2. Notification in-app au propriétaire
  if (ownerProfile?.user_id) {
    await supabase.rpc("create_notification", {
      p_recipient_id: ownerProfile.user_id,
      p_type: "alert",
      p_title: "Paiement locataire échoué",
      p_message: `Le paiement de ${amount}€ de ${tenantName} pour ${propertyAddress} a échoué.`,
      p_link: `/owner/money`,
      p_related_id: invoiceId,
      p_related_type: "invoice",
    });
  }

  // 3. Email de rappel au locataire
  if (tenantProfile?.email) {
    try {
      const { sendPaymentReminder } = await import("@/lib/emails/resend.service");
      const dueDate = invoice.date_echeance || invoice.periode;
      const now = new Date();
      const dueDateObj = new Date(dueDate);
      const daysLate = Math.max(0, Math.floor((now.getTime() - dueDateObj.getTime()) / (1000 * 60 * 60 * 24)));

      await sendPaymentReminder({
        tenantEmail: tenantProfile.email,
        tenantName,
        amount: paymentIntent.amount / 100,
        dueDate,
        daysLate,
        invoiceId,
      });
    } catch (emailErr) {
      console.error("[Payment Failed] Email reminder error:", emailErr);
    }
  }

  // 4. Programmer les relances automatiques via outbox (J+1, J+3, J+7)
  const retryDelays = [1, 3, 7]; // jours
  for (const delayDays of retryDelays) {
    const scheduledAt = new Date();
    scheduledAt.setDate(scheduledAt.getDate() + delayDays);

    await supabase.from("outbox").insert({
      event_type: "Payment.FailedRetry",
      payload: {
        invoice_id: invoiceId,
        tenant_id: invoice.tenant_id,
        owner_id: invoice.owner_id,
        amount: paymentIntent.amount / 100,
        retry_day: delayDays,
        property_address: propertyAddress,
        tenant_name: tenantName,
        tenant_email: tenantProfile?.email || null,
        failure_reason: failureMessage,
        stripe_payment_intent_id: paymentIntent.id,
      },
      scheduled_at: scheduledAt.toISOString(),
    });
  }
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  if (!webhookSecret) {
    console.error("[Stripe Webhook] STRIPE_WEBHOOK_SECRET is not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }
  
  let stripe: Stripe;
  try {
    stripe = getStripe();
  } catch (error) {
    console.error("[Stripe Webhook] Stripe not configured:", error);
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  if (!signature) {
    console.error("[Stripe Webhook] Missing signature");
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error("[Stripe Webhook] Signature verification failed:", err.message);
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${err.message}` },
      { status: 400 }
    );
  }

  const supabase = createServiceRoleClient();


  try {
    const { data: existingWebhook } = await supabase
      .from("webhook_logs")
      .select("id")
      .eq("provider", "stripe")
      .eq("event_id", event.id)
      .eq("status", "success")
      .maybeSingle();

    if ((existingWebhook as { id?: string } | null)?.id) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    switch (event.type) {
      // ===============================================
      // PAIEMENT DE LOYER RÉUSSI
      // ===============================================
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await syncSubscriptionFromCheckoutSession(supabase, stripe, session);

        // ── Promo code usage log ──
        // Enregistre l'utilisation d'un code promo Talok si la session en
        // embarquait un. Source de vérité = promo_code_uses. Le trigger
        // DB trg_promo_code_uses_increment bumpe promo_codes.uses_count.
        // Non bloquant : une erreur de log ne doit pas faire échouer le
        // webhook (Stripe ne réessaierait pas pour une raison métier).
        const promoCodeId = session.metadata?.promo_code_id;
        if (session.mode === "subscription" && promoCodeId) {
          try {
            const profileId = session.metadata?.profile_id;
            if (profileId) {
              const { data: profile } = await supabase
                .from("profiles")
                .select("user_id")
                .eq("id", profileId)
                .single();

              const userId = (profile as { user_id?: string } | null)?.user_id;
              if (userId) {
                const { data: sub } = await supabase
                  .from("subscriptions")
                  .select("id")
                  .eq("owner_id", profileId)
                  .maybeSingle();

                const amountSubtotal = session.amount_subtotal ?? 0;
                const amountTotal = session.amount_total ?? 0;
                await recordPromoCodeUse({
                  promo_code_id: promoCodeId,
                  user_id: userId,
                  subscription_id: (sub as { id?: string } | null)?.id ?? null,
                  original_amount: amountSubtotal,
                  final_amount: amountTotal,
                  discount_amount: amountSubtotal - amountTotal,
                  applied_plan_slug: session.metadata?.plan_slug ?? "",
                  applied_billing_cycle:
                    (session.metadata?.billing_cycle as "monthly" | "yearly") ?? "monthly",
                  stripe_session_id: session.id,
                });
              }
            }
          } catch (promoErr) {
            console.error("[stripe webhook] recordPromoCodeUse failed:", promoErr);
          }
        }

        // ── Add-on activation ──
        const addonId = session.metadata?.addon_id;
        if (addonId) {
          await supabase
            .from("subscription_addons")
            .update({
              status: "active",
              activated_at: new Date().toISOString(),
              stripe_invoice_id: typeof session.invoice === "string" ? session.invoice : session.invoice?.id || null,
              stripe_subscription_id: typeof session.subscription === "string" ? session.subscription : session.subscription?.id || null,
            })
            .eq("id", addonId);

          // For storage add-on subscriptions, store subscription_item_id
          const stripeSubId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
          if (stripeSubId) {
            try {
              const stripeSub = await stripe.subscriptions.retrieve(stripeSubId);
              const itemId = stripeSub.items?.data?.[0]?.id;
              if (itemId) {
                await supabase
                  .from("subscription_addons")
                  .update({ stripe_subscription_item_id: itemId })
                  .eq("id", addonId);
              }
            } catch (e) {
              console.error("[Stripe Webhook] Failed to retrieve addon subscription item:", e);
            }
          }
          break;
        }

        // Récupérer les métadonnées
        const invoiceId = session.metadata?.invoice_id;
        const leaseId = session.metadata?.lease_id;
        const tenantId = session.metadata?.tenant_id;
        
        if (invoiceId) {
          const providerRef = session.payment_intent as string;
          const paidAt = new Date().toISOString();
          const paymentResult = providerRef
            ? await upsertPaymentAttempt(supabase, {
                invoiceId,
                amount: (session.amount_total || 0) / 100,
                method: "cb",
                providerRef,
                status: "succeeded",
                paidAt,
              })
            : { paymentId: null, newlySucceeded: false };
          const paymentId = paymentResult.paymentId;

          await supabase
            .from("invoices")
            .update({
              stripe_payment_intent_id: providerRef,
              stripe_session_id: session.id,
            })
            .eq("id", invoiceId);

          const settlement = await syncInvoiceStatusFromPayments(supabase as any, invoiceId, paidAt);

          if (paymentId && paymentResult.newlySucceeded) {
            const sourceTransactionId = await resolveSourceTransactionId(stripe, providerRef);
            const receiptGenerated = !!settlement?.isSettled;
            if (settlement?.isSettled) {
              await processReceiptGeneration(
                supabase,
                invoiceId,
                paymentId,
                (session.amount_total || 0) / 100
              );
            }
            await emitPaymentSucceededEvent(supabase, paymentId, invoiceId, (session.amount_total || 0) / 100, {
              invoiceSettled: settlement?.isSettled ?? false,
              receiptGenerated,
            });

            await reconcileOwnerTransfer(supabase as any, {
              paymentId,
              invoiceId,
              paymentIntentId: providerRef,
              sourceTransactionId,
              amountCents: session.amount_total || 0,
              paymentMethod: session.payment_method_types?.[0] || "card",
            });
          }

          // Récupérer les infos pour la notification
          const { data: invoice } = await supabase
            .from("invoices")
            .select(`
              montant_total,
              periode,
              tenant:profiles!invoices_tenant_id_fkey(
                prenom,
                nom
              ),
              lease:leases(
                property:properties(
                  owner_id,
                  adresse_complete,
                  owner:profiles!properties_owner_id_fkey(
                    prenom,
                    nom,
                    email
                  )
                )
              )
            `)
            .eq("id", invoiceId)
            .single();

          // Notifier le propriétaire
          if (invoice?.lease?.property?.owner_id) {
            await supabase.rpc("create_notification", {
              p_recipient_id: invoice.lease.property.owner_id,
              p_type: "payment_received",
              p_title: "Paiement reçu !",
              p_message: `Paiement de ${((session.amount_total || 0) / 100).toFixed(2)}€ reçu pour ${invoice.lease.property.adresse_complete}`,
              p_link: `/owner/money`,
              p_related_id: invoiceId,
              p_related_type: "invoice",
            });

            // Envoyer l'email au propriétaire
            const { sendPaymentReceivedEmail } = await import("@/lib/services/email-service");
            const owner = invoice.lease.property.owner;
            const tenant = invoice.tenant;

            if (owner?.email) {
              const emailResult = await sendPaymentReceivedEmail(
                owner.email,
                `${owner.prenom} ${owner.nom}`,
                `${tenant?.prenom} ${tenant?.nom}`,
                (session.amount_total || 0) / 100,
                invoice.lease.property.adresse_complete,
                invoice.periode,
                new Date().toLocaleDateString("fr-FR"),
                `${process.env.NEXT_PUBLIC_APP_URL}/owner/money`
              );
              if (!emailResult.success) {
                console.error("[Stripe Webhook] Payment email failed:", emailResult.error);
              }
            }
          }

        }
        break;
      }

      // ===============================================
      // PAIEMENT CONFIRMÉ (pour les Payment Intents directs)
      // ===============================================
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const invoiceId = paymentIntent.metadata?.invoice_id;

        // Paiement d'intervention (work_order_payment) — parcours isolé :
        // aucun invoiceId, le flux est complètement séparé des loyers.
        if (paymentIntent.metadata?.type === "work_order_payment") {
          try {
            await handleWorkOrderPaymentSucceeded(supabase, paymentIntent);
          } catch (woErr) {
            console.error("[Stripe Webhook] work_order payment handling failed:", woErr);
          }
          // On sort ici : le reste du handler traite uniquement les invoices
          // (loyer / régul charges).
          return new Response(JSON.stringify({ received: true }), { status: 200 });
        }

        // Sync rent_payments if this is a Connect rent payment
        if (paymentIntent.metadata?.type === "rent") {
          try {
            const chargeId = typeof paymentIntent.latest_charge === "string"
              ? paymentIntent.latest_charge
              : (paymentIntent.latest_charge as any)?.id || null;
            const transferId = paymentIntent.transfer_data?.destination
              ? `tr_${paymentIntent.id}`
              : null;
            await handleRentPaymentSucceeded(paymentIntent.id, chargeId, transferId);
          } catch (rentErr) {
            console.error("[Stripe Webhook] rent_payments sync failed:", rentErr);
          }
        }

        if (invoiceId) {
          // Sprint 0.d.1 — route les side-effects spécifiques loyer pour
          // ne pas dupliquer l'écriture compta + ne pas générer une
          // quittance loyer + ne pas envoyer un email "loyer payé" alors
          // que c'est une régul charges.
          const isChargeRegularization =
            paymentIntent.metadata?.type === "charge_regularization";
          const paidAt = new Date().toISOString();
          const paymentMethod = paymentIntent.payment_method_types?.[0] || "cb";
          const paymentResult = await upsertPaymentAttempt(supabase, {
            invoiceId,
            amount: paymentIntent.amount / 100,
            method: paymentMethod === "sepa_debit" ? "prelevement" : "cb",
            providerRef: paymentIntent.id,
            status: "succeeded",
            paidAt,
          });
          const paymentId = paymentResult.paymentId;

          await supabase
            .from("invoices")
            .update({
              stripe_payment_intent_id: paymentIntent.id,
              paid_at: paidAt,
            })
            .eq("id", invoiceId);

          const settlement = await syncInvoiceStatusFromPayments(supabase as any, invoiceId, paidAt);

          // Marquer initial_payment_confirmed sur le bail si la facture est soldée
          if (settlement?.isSettled) {
            let targetLeaseId: string | undefined = paymentIntent.metadata?.lease_id;
            if (!targetLeaseId) {
              // Fallback: retrouver le lease_id via la facture
              const { data: inv } = await supabase
                .from("invoices")
                .select("lease_id")
                .eq("id", invoiceId)
                .maybeSingle();
              if (inv) {
                targetLeaseId = (inv as { lease_id?: string }).lease_id;
              }
            }
            if (targetLeaseId) {
              await supabase
                .from("leases")
                .update({
                  initial_payment_confirmed: true,
                  initial_payment_date: paidAt,
                  initial_payment_stripe_pi: paymentIntent.id,
                } as any)
                .eq("id", targetLeaseId)
                .eq("initial_payment_confirmed", false);
            }

            // Rattacher le dépôt de garantie à son suivi formel dès que la
            // facture initiale est soldée, sans attendre l'activation du
            // bail (le trigger SQL ne fire qu'à ce moment-là).
            if (!isChargeRegularization) {
              try {
                await ensureSecurityDepositForInvoice(supabase as any, {
                  invoiceId,
                  paidAt,
                  paymentMethod: paymentMethod === "sepa_debit" ? "sepa_debit" : "card",
                });
              } catch (depositSyncError) {
                console.error(
                  "[Stripe Webhook] security_deposits sync failed:",
                  depositSyncError,
                );
              }
            }
          }

          if (paymentId && paymentResult.newlySucceeded) {
            const sourceTransactionId = await resolveSourceTransactionId(stripe, paymentIntent.id);
            const receiptGenerated = !isChargeRegularization && !!settlement?.isSettled;
            // P2 — skip la quittance loyer pour les régul charges
            // (TODO Sprint 1 : générer un justificatif PDF spécifique régul)
            if (settlement?.isSettled && !isChargeRegularization) {
              // Fire-and-forget : ne pas bloquer la réponse webhook (200 immédiat)
              processReceiptGeneration(
                supabase,
                invoiceId,
                paymentId,
                paymentIntent.amount / 100
              ).catch((err) =>
                console.error("[receipt-gen] fire-and-forget failed:", err?.message ?? err)
              );
            }
            // P3 — event distinct pour les régul charges
            if (isChargeRegularization) {
              await emitChargeRegularizationPaidEvent(supabase, {
                paymentId,
                invoiceId,
                regularizationId: paymentIntent.metadata?.regularization_id ?? null,
                amount: paymentIntent.amount / 100,
              });
            } else {
              await emitPaymentSucceededEvent(supabase, paymentId, invoiceId, paymentIntent.amount / 100, {
                invoiceSettled: settlement?.isSettled ?? false,
                receiptGenerated,
              });
            }

            await reconcileOwnerTransfer(supabase as any, {
              paymentId,
              invoiceId,
              paymentIntentId: paymentIntent.id,
              sourceTransactionId,
              amountCents: paymentIntent.amount,
              paymentMethod: paymentIntent.payment_method_types?.[0] || "card",
            });
          }

          // P1 — Accounting auto-entry (non-blocking) — skip pour régul
          // charges car l'écriture a déjà été créée au settle via /apply.
          if (!isChargeRegularization) {
            try {
              const { createAutoEntry } = await import('@/lib/accounting/engine');
              const { getOrCreateCurrentExercise } = await import('@/lib/accounting/auto-exercise');

              // Resolve entity: invoice → lease → property → legal_entity_id
              const { data: invoiceForEntity } = await supabase
                .from('invoices')
                .select(`
                  lease:leases (
                    property:properties (
                      id,
                      legal_entity_id,
                      adresse_complete
                    )
                  ),
                  tenant:profiles!invoices_tenant_id_fkey (
                    prenom,
                    nom
                  )
                `)
                .eq('id', invoiceId)
                .maybeSingle();

              const entityId = invoiceForEntity?.lease?.property?.legal_entity_id;
              const propertyId = invoiceForEntity?.lease?.property?.id;

              // Si la property est sous mandat agence actif, l'écriture
              // rent_received côté propriétaire serait fausse : la
              // banque (512) du propriétaire n'a rien reçu, l'argent est
              // sur le compte mandant de l'agence (545). On skip donc
              // l'écriture côté owner — le revenu sera reconnu au
              // reversement effectif. Les écritures côté agence
              // (auto:agency_loyer_mandant + auto:agency_commission)
              // sont posées indépendamment juste après ce bloc.
              let ownerSkipReason: string | null = null;
              if (propertyId) {
                try {
                  const { isPropertyUnderActiveMandate } = await import(
                    '@/lib/accounting/mandant-payment-entry'
                  );
                  if (await isPropertyUnderActiveMandate(supabase, propertyId)) {
                    ownerSkipReason = 'under_active_mandate';
                  }
                } catch (mandateCheckErr) {
                  console.warn(
                    '[ACCOUNTING] mandate detection failed (continuing as owner-direct):',
                    mandateCheckErr,
                  );
                }
              }

              if (entityId && !ownerSkipReason) {
                const { getEntityAccountingConfig, shouldMarkInformational, markEntryInformational } =
                  await import('@/lib/accounting/entity-config');
                const config = await getEntityAccountingConfig(supabase, entityId);
                if (config?.accountingEnabled) {
                  const exercise = await getOrCreateCurrentExercise(supabase, entityId);
                  if (exercise) {
                    const { resolveSystemActorForEntity } = await import('@/lib/accounting/system-actor');
                    const actorUserId = await resolveSystemActorForEntity(supabase, entityId);
                    if (actorUserId) {
                      const tenantName = invoiceForEntity?.tenant
                        ? `${invoiceForEntity.tenant.prenom || ''} ${invoiceForEntity.tenant.nom || ''}`.trim()
                        : '';
                      const propertyAddress = invoiceForEntity?.lease?.property?.adresse_complete || '';

                      const entry = await createAutoEntry(supabase, 'rent_received', {
                        entityId,
                        exerciseId: exercise.id,
                        userId: actorUserId,
                        amountCents: paymentIntent.amount, // already in cents from Stripe
                        label: `Loyer ${tenantName}${tenantName && propertyAddress ? ' - ' : ''}${propertyAddress}`,
                        date: new Date().toISOString().split('T')[0],
                        reference: paymentIntent.id,
                      });

                      if (shouldMarkInformational(config)) {
                        await markEntryInformational(supabase, entry.id);
                      }
                    }
                  }
                }
              }
            } catch (accountingError) {
              console.error('[ACCOUNTING] Auto-entry failed (non-blocking):', accountingError);
              // Never throw — payment is already confirmed
            }

            // P0.5 — Flux mandat agence (Loi Hoguet).
            // Si la property est sous mandat actif, pose en parallèle
            // les écritures côté agence : loyer mandant (D 545 / C 467)
            // + commission (D 467 / C 706100). Ces écritures alimentent
            // les Sections 1 et 3 du CRG. Helper short-circuite
            // proprement si la property n'est pas sous mandat —
            // appelable inconditionnellement.
            try {
              const { ensureMandantPaymentEntries } = await import(
                "@/lib/accounting/mandant-payment-entry"
              );
              await ensureMandantPaymentEntries(supabase, paymentId, {
                amountCentsOverride: paymentIntent.amount,
              });
            } catch (mandantError) {
              console.error(
                "[ACCOUNTING] Mandant entries failed (non-blocking):",
                mandantError,
              );
            }
          }
        }
        break;
      }

      // ===============================================
      // PAIEMENT ÉCHOUÉ
      // ===============================================
      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const invoiceId = paymentIntent.metadata?.invoice_id;

        // Sync rent_payments failure
        if (paymentIntent.metadata?.type === "rent") {
          try {
            const failureReason = paymentIntent.last_payment_error?.message || "Paiement échoué";
            await handleRentPaymentFailed(paymentIntent.id, failureReason);
          } catch (rentErr) {
            console.error("[Stripe Webhook] rent_payments failure sync failed:", rentErr);
          }
        }

        if (invoiceId) {
          // `payments.moyen` CHECK ∈ (cb, virement, prelevement, especes,
          // cheque, autre). Stripe renvoie par ex. `card` ou `sepa_debit`
          // dans `payment_method_types[0]` — on les mappe vers nos valeurs
          // canoniques (tout ce qui n'est pas SEPA est stocké comme `cb`).
          const paymentMethod = paymentIntent.payment_method_types?.[0] || "cb";
          const paymentResult = await upsertPaymentAttempt(supabase, {
            invoiceId,
            amount: paymentIntent.amount / 100,
            method: paymentMethod === "sepa_debit" ? "prelevement" : "cb",
            providerRef: paymentIntent.id,
            status: "failed",
            paidAt: new Date().toISOString(),
          });

          await supabase
            .from("invoices")
            .update({ stripe_payment_intent_id: paymentIntent.id })
            .eq("id", invoiceId);

          await syncInvoiceStatusFromPayments(supabase as any, invoiceId, null);

          // Notifications et relances — seulement si c'est un nouvel échec
          if (paymentResult.newlyFailed) {
            try {
              await processPaymentFailedNotifications(supabase, invoiceId, paymentIntent);
            } catch (notifError) {
              console.error("[Stripe Webhook] Payment failed notifications error:", notifError);
            }
          }

          // --- Accounting auto-entry for SEPA rejection (non-blocking) ---
          try {
            const { createAutoEntry } = await import('@/lib/accounting/engine');
            const { getOrCreateCurrentExercise } = await import('@/lib/accounting/auto-exercise');

            // Resolve entity: invoice → lease → property → legal_entity_id
            const { data: invoiceForEntity } = await supabase
              .from('invoices')
              .select(`
                lease:leases (
                  property:properties (
                    legal_entity_id,
                    adresse_complete
                  )
                ),
                tenant:profiles!invoices_tenant_id_fkey (
                  prenom,
                  nom
                )
              `)
              .eq('id', invoiceId)
              .maybeSingle();

            const entityId = invoiceForEntity?.lease?.property?.legal_entity_id;
            if (entityId) {
              const { getEntityAccountingConfig, shouldMarkInformational, markEntryInformational } =
                await import('@/lib/accounting/entity-config');
              const config = await getEntityAccountingConfig(supabase, entityId);
              if (config?.accountingEnabled) {
                const exercise = await getOrCreateCurrentExercise(supabase, entityId);
                if (exercise) {
                  const { resolveSystemActorForEntity } = await import('@/lib/accounting/system-actor');
                  const actorUserId = await resolveSystemActorForEntity(supabase, entityId);
                  if (actorUserId) {
                    const tenantName = invoiceForEntity?.tenant
                      ? `${invoiceForEntity.tenant.prenom || ''} ${invoiceForEntity.tenant.nom || ''}`.trim()
                      : '';
                    const propertyAddress = invoiceForEntity?.lease?.property?.adresse_complete || '';

                    const entry = await createAutoEntry(supabase, 'sepa_rejected', {
                      entityId,
                      exerciseId: exercise.id,
                      userId: actorUserId,
                      amountCents: paymentIntent.amount,
                      label: `Rejet prelevement ${tenantName}${tenantName && propertyAddress ? ' - ' : ''}${propertyAddress}`,
                      date: new Date().toISOString().split('T')[0],
                      reference: paymentIntent.id,
                    });

                    if (shouldMarkInformational(config)) {
                      await markEntryInformational(supabase, entry.id);
                    }
                  }
                }
              }
            }
          } catch (accountingError) {
            console.error('[ACCOUNTING] sepa_rejected auto-entry failed (non-blocking):', accountingError);
            // Never throw — payment failure handling is already complete
          }
        }
        break;
      }

      // ===============================================
      // ABONNEMENT PAYÉ
      // ===============================================
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const stripeInvoice = invoice as Stripe.Invoice & {
          subscription?: string | Stripe.Subscription | null;
          payment_intent?: string | Stripe.PaymentIntent | null;
        };
        const stripeSubscriptionId = getStripeInvoiceSubscriptionId(stripeInvoice);

        // ── Rent invoice with lease_id metadata → generate receipt ──
        const rentInvoiceId = invoice.metadata?.invoice_id;
        const rentLeaseId = invoice.metadata?.lease_id;

        if (rentInvoiceId && rentLeaseId) {
          console.log(`[Stripe Webhook] invoice.paid for rent: invoice_id=${rentInvoiceId}, lease_id=${rentLeaseId}`);
          const piId = typeof stripeInvoice.payment_intent === "string"
            ? stripeInvoice.payment_intent
            : stripeInvoice.payment_intent?.id ?? null;
          const paidAt = new Date().toISOString();

          if (piId) {
            const paymentResult = await upsertPaymentAttempt(supabase, {
              invoiceId: rentInvoiceId,
              amount: (invoice.amount_paid || 0) / 100,
              method: "cb",
              providerRef: piId,
              status: "succeeded",
              paidAt,
            });
            const paymentId = paymentResult.paymentId;

            const settlement = await syncInvoiceStatusFromPayments(supabase as any, rentInvoiceId, paidAt);

            if (paymentId && paymentResult.newlySucceeded && settlement?.isSettled) {
              await processReceiptGeneration(supabase, rentInvoiceId, paymentId, (invoice.amount_paid || 0) / 100);
              console.log(`[Stripe Webhook] Receipt generated for rent invoice ${rentInvoiceId}`);
            }
          }
          break;
        }

        // ── Subscription invoice ──
        const { data: subscription } = await supabase
          .from("subscriptions")
          .select("id, owner_id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        if (subscription) {
          if (stripeSubscriptionId) {
            const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
            const subscriptionUpdate = await buildSubscriptionUpdateFromStripe(
              supabase as any,
              stripeSubscription
            );

            await supabase
              .from("subscriptions")
              .update(subscriptionUpdate as any)
              .eq("id", subscription.id);
          } else {
            await supabase
              .from("subscriptions")
              .update({
                status: "active",
                stripe_subscription_id: stripeSubscriptionId,
                current_period_start: invoice.period_start
                  ? new Date(invoice.period_start * 1000).toISOString()
                  : undefined,
                current_period_end: invoice.period_end
                  ? new Date(invoice.period_end * 1000).toISOString()
                  : undefined,
              })
              .eq("id", subscription.id);
          }

          const { data: upsertedInvoice } = await supabase
            .from("subscription_invoices")
            .upsert(
              {
                subscription_id: subscription.id,
                stripe_invoice_id: invoice.id,
                amount_due: invoice.amount_due || 0,
                amount_paid: invoice.amount_paid || 0,
                amount_remaining: invoice.amount_remaining || 0,
                status: invoice.status || "paid",
                hosted_invoice_url: invoice.hosted_invoice_url,
                invoice_pdf: invoice.invoice_pdf,
                paid_at: invoice.status_transitions?.paid_at
                  ? new Date(invoice.status_transitions.paid_at * 1000).toISOString()
                  : new Date().toISOString(),
              },
              { onConflict: "stripe_invoice_id" }
            )
            .select("id")
            .maybeSingle();

          // Accounting auto-entry for the paid subscription (non-blocking, idempotent,
          // gated by accounting_enabled on the owner's primary entity)
          const subscriptionInvoiceId = (upsertedInvoice as { id?: string } | null)?.id;
          if (subscriptionInvoiceId) {
            try {
              const { ensureSubscriptionPaidEntry } = await import(
                "@/lib/accounting/subscription-entry"
              );
              const result = await ensureSubscriptionPaidEntry(
                supabase,
                subscriptionInvoiceId,
              );
              if (result.skippedReason === "error") {
                console.error(
                  "[ACCOUNTING] subscription_paid failed:",
                  result.error,
                );
              }
            } catch (accountingError) {
              console.error(
                "[ACCOUNTING] subscription_paid hook exception (non-blocking):",
                accountingError,
              );
            }
          }
        }

        // Vérifier si cette invoice Stripe est aussi liée à une facture locative
        // (cas SEPA récurrent / subscriptions liées à un bail)
        const rentalInvoiceId = invoice.metadata?.invoice_id;
        if (rentalInvoiceId) {
          const paidAt = invoice.status_transitions?.paid_at
            ? new Date(invoice.status_transitions.paid_at * 1000).toISOString()
            : new Date().toISOString();

          const paymentResult = await upsertPaymentAttempt(supabase, {
            invoiceId: rentalInvoiceId,
            amount: (invoice.amount_paid || 0) / 100,
            // `payments.moyen` CHECK rejette 'sepa_debit' — la valeur
            // canonique pour un prélèvement SEPA est 'prelevement'.
            method: "prelevement",
            providerRef: invoice.id,
            status: "succeeded",
            paidAt,
          });

          if (paymentResult.paymentId) {
            await supabase
              .from("invoices")
              .update({
                stripe_invoice_id: invoice.id,
                stripe_payment_intent_id: ((invoice as any).payment_intent as string) || null,
              })
              .eq("id", rentalInvoiceId);

            const settlement = await syncInvoiceStatusFromPayments(
              supabase as any,
              rentalInvoiceId,
              paidAt
            );

            if (settlement?.isSettled && paymentResult.newlySucceeded) {
              await processReceiptGeneration(
                supabase,
                rentalInvoiceId,
                paymentResult.paymentId,
                (invoice.amount_paid || 0) / 100
              );
            }
          }
        }

        break;
      }

      case "invoice.payment_failed":
      case "invoice.payment_action_required": {
        const invoice = event.data.object as Stripe.Invoice & {
          subscription?: string | Stripe.Subscription | null;
        };
        const subscription = await syncSubscriptionFromInvoiceEvent(
          supabase,
          stripe,
          invoice,
          "past_due"
        );

        if (subscription?.owner_id) {
          await supabase.rpc("create_notification", {
            p_recipient_id: subscription.owner_id,
            p_type: "alert",
            p_title: "Probleme de paiement abonnement",
            p_message:
              event.type === "invoice.payment_action_required"
                ? "Votre abonnement requiert une action sur votre moyen de paiement."
                : "Le renouvellement de votre abonnement a echoue. Verifiez votre carte.",
            p_link: "/owner/money?tab=forfait",
          });

          // Notify admins
          import("@/lib/services/admin-notification.service").then(({ notifyAdmins }) =>
            notifyAdmins({
              type: "payment_failed",
              title: "Paiement echoue",
              body: `Abonnement ${subscription.owner_id} — ${event.type}`,
              actionUrl: "/admin/subscriptions",
              metadata: { owner_id: subscription.owner_id, event_type: event.type },
            })
          ).catch(() => {});
        }
        break;
      }

      // ===============================================
      // MISE À JOUR D'ABONNEMENT
      // ===============================================
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;

        await syncSubscriptionStateFromStripeSubscription(supabase, subscription);
        break;
      }

      // ===============================================
      // ANNULATION D'ABONNEMENT
      // ===============================================
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;

        // ── Check if this is an add-on subscription cancellation ──
        const { data: cancelledAddon } = await supabase
          .from("subscription_addons")
          .select("id")
          .eq("stripe_subscription_id", subscription.id)
          .maybeSingle();

        if (cancelledAddon) {
          await supabase
            .from("subscription_addons")
            .update({
              status: "cancelled",
              cancelled_at: new Date().toISOString(),
            })
            .eq("id", cancelledAddon.id);
          break;
        }

        // ── Main subscription cancellation ──
        const stripeCustomerId =
          typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id || null;

        const { data: sub } = await supabase
          .from("subscriptions")
          .select("id, owner_id")
          .eq("stripe_subscription_id", subscription.id)
          .maybeSingle();

        const resolvedSub =
          sub ?? (
            stripeCustomerId
              ? (
                  await supabase
                    .from("subscriptions")
                    .select("id, owner_id")
                    .eq("stripe_customer_id", stripeCustomerId)
                    .maybeSingle()
                ).data
              : null
          );

        if (resolvedSub) {
          const { data: currentSubscription } = await supabase
            .from("subscriptions")
            .select("id, owner_id, scheduled_plan_slug, scheduled_plan_id")
            .eq("id", resolvedSub.id)
            .maybeSingle();

          const typedCurrentSubscription = currentSubscription as
            | {
                id?: string | null;
                owner_id?: string | null;
                scheduled_plan_slug?: string | null;
                scheduled_plan_id?: string | null;
              }
            | null;

          if (typedCurrentSubscription?.scheduled_plan_slug === "gratuit") {
            const freePlan = await resolvePlanIdentifiers(supabase as any, {
              planSlug: "gratuit",
              planId: typedCurrentSubscription.scheduled_plan_id || null,
            });

            await supabase
              .from("subscriptions")
              .update({
                status: "active",
                plan_id: freePlan.id,
                plan_slug: freePlan.slug || "gratuit",
                stripe_subscription_id: null,
                stripe_subscription_schedule_id: null,
                cancel_at_period_end: false,
                canceled_at: null,
                current_period_start: new Date().toISOString(),
                current_period_end: null,
                scheduled_plan_id: null,
                scheduled_plan_slug: null,
                scheduled_plan_effective_at: null,
                updated_at: new Date().toISOString(),
              })
              .eq("id", resolvedSub.id);
          } else {
            await supabase
              .from("subscriptions")
              .update({
                status: "canceled",
                canceled_at: new Date().toISOString(),
                stripe_subscription_schedule_id: null,
              })
              .eq("id", resolvedSub.id);
          }

          // Notifier le propriétaire
          if (resolvedSub.owner_id) {
            await supabase.rpc("create_notification", {
              p_recipient_id: resolvedSub.owner_id,
              p_type: "alert",
              p_title: "Abonnement annulé",
              p_message: "Votre abonnement a été annulé. Vos données seront conservées.",
              p_link: "/settings/billing",
            });
          }

        }
        break;
      }

      case "customer.subscription.trial_will_end": {
        const subscription = event.data.object as Stripe.Subscription;
        await syncSubscriptionStateFromStripeSubscription(supabase, subscription);

        const resolvedSub = await resolveSubscriptionRecord(
          supabase,
          typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id || null,
          subscription.id
        );

        if (resolvedSub?.owner_id) {
          await supabase.rpc("create_notification", {
            p_recipient_id: resolvedSub.owner_id,
            p_type: "alert",
            p_title: "Fin d'essai imminente",
            p_message: "Votre periode d'essai arrive bientot a son terme. Verifiez votre carte pour eviter une interruption.",
            p_link: "/owner/money?tab=forfait",
          });
        }
        break;
      }

      // ===============================================
      // STRIPE CONNECT - COMPTE MIS À JOUR
      // ===============================================
      case "account.updated": {
        const account = event.data.object as Stripe.Account;

        // Mettre à jour le compte Connect en base
        const { data: connectAccount, error: findError } = await supabase
          .from("stripe_connect_accounts")
          .select("id, profile_id")
          .eq("stripe_account_id", account.id)
          .maybeSingle();

        if (connectAccount) {
          const { error: updateError } = await supabase
            .from("stripe_connect_accounts")
            .update({
              charges_enabled: account.charges_enabled,
              payouts_enabled: account.payouts_enabled,
              details_submitted: account.details_submitted,
              requirements_currently_due: account.requirements?.currently_due || [],
              requirements_eventually_due: account.requirements?.eventually_due || [],
              requirements_past_due: account.requirements?.past_due || [],
              requirements_disabled_reason: account.requirements?.disabled_reason,
              business_type: account.business_type,
              bank_account_last4: (account.external_accounts?.data[0] as any)?.last4,
              bank_account_bank_name: (account.external_accounts?.data[0] as any)?.bank_name,
              updated_at: new Date().toISOString(),
              onboarding_completed_at:
                account.charges_enabled && account.payouts_enabled && account.details_submitted
                  ? new Date().toISOString()
                  : null,
            })
            .eq("id", connectAccount.id as string);

          if (!updateError) {
            // Notifier le titulaire du compte si l'onboarding est terminé.
            // Le message + lien dépendent du rôle (owner / syndic / provider).
            if (account.charges_enabled && account.payouts_enabled && connectAccount.profile_id) {
              const { data: ownerProfile } = await supabase
                .from("profiles")
                .select("role")
                .eq("id", connectAccount.profile_id)
                .maybeSingle();
              const role = (ownerProfile as { role: string } | null)?.role;

              const notif =
                role === "provider"
                  ? {
                      message:
                        "Votre compte Stripe est actif. Vous recevrez vos paiements d'intervention directement.",
                      link: "/provider/settings/payouts",
                    }
                  : role === "syndic"
                    ? {
                        message:
                          "Votre compte Stripe est actif. Vous pourrez encaisser les charges de copropriété.",
                        link: "/syndic/settings/payouts",
                      }
                    : {
                        message:
                          "Votre compte Stripe est actif. Vous recevrez les loyers directement.",
                        link: "/owner/money?tab=banque",
                      };

              await supabase.rpc("create_notification", {
                p_recipient_id: connectAccount.profile_id,
                p_type: "success",
                p_title: "Compte de paiement activé !",
                p_message: notif.message,
                p_link: notif.link,
              });
            }
          }
        }
        break;
      }

      // ===============================================
      // STRIPE CONNECT - TRANSFERT CRÉÉ
      // ===============================================
      case "transfer.created": {
        const transfer = event.data.object as Stripe.Transfer;

        // Cas 1 : libération d'escrow work_order_payment.
        // releaseEscrowToProvider() a déjà fait l'UPDATE synchrone, le
        // webhook sert ici de filet de sécurité (idempotent).
        if (transfer.metadata?.type === "work_order_escrow_release") {
          const wopPaymentId = transfer.metadata?.payment_id;
          if (wopPaymentId) {
            await supabase
              .from("work_order_payments")
              .update({
                stripe_transfer_id: transfer.id,
                escrow_status: "released",
                escrow_released_at: new Date().toISOString(),
              })
              .eq("id", wopPaymentId)
              .neq("escrow_status", "released");
          }
        }

        // Cas 2 (legacy) : transfert flux rent — enregistrer dans stripe_transfers
        const { data: connectAccount } = await supabase
          .from("stripe_connect_accounts")
          .select("id")
          .eq("stripe_account_id", transfer.destination as string)
          .maybeSingle();

        if (connectAccount) {
          const { data: existingTransfer } = await supabase
            .from("stripe_transfers")
            .select("id")
            .eq("stripe_transfer_id", transfer.id)
            .maybeSingle();

          const existingTransferId = (existingTransfer as { id?: string } | null)?.id;

          if (existingTransferId) {
            await supabase
              .from("stripe_transfers")
              .update({
                status: "paid",
                stripe_source_transaction_id: transfer.source_transaction as string,
                description: transfer.description,
                metadata: transfer.metadata,
                completed_at: new Date().toISOString(),
              })
              .eq("id", existingTransferId);
          } else {
            await supabase.from("stripe_transfers").insert({
              connect_account_id: connectAccount.id,
              stripe_transfer_id: transfer.id,
              stripe_payment_intent_id:
                typeof transfer.metadata?.payment_intent_id === "string"
                  ? transfer.metadata.payment_intent_id
                  : null,
              stripe_source_transaction_id:
                typeof transfer.source_transaction === "string"
                  ? transfer.source_transaction
                  : typeof transfer.metadata?.source_transaction_id === "string"
                    ? transfer.metadata.source_transaction_id
                    : null,
              amount: transfer.amount,
              currency: transfer.currency,
              net_amount: transfer.amount,
              status: "paid",
              description: transfer.description,
              metadata: transfer.metadata,
              completed_at: new Date().toISOString(),
            });
          }

        }
        break;
      }

      // ===============================================
      // STRIPE CONNECT - TRANSFERT ÉCHOUÉ / REVERSED
      // ===============================================
      case "transfer.failed" as any:
      case "transfer.reversed" as any: {
        const transfer = (event as any).data.object as Stripe.Transfer;

        // Cas 1 : libération escrow work_order qui a échoué — on revient
        // à escrow_status='held' pour retry et on clear le stripe_transfer_id.
        if (transfer.metadata?.type === "work_order_escrow_release") {
          const wopPaymentId = transfer.metadata?.payment_id;
          if (wopPaymentId) {
            await supabase
              .from("work_order_payments")
              .update({
                escrow_status: "held",
                escrow_released_at: null,
                stripe_transfer_id: null,
                escrow_release_reason: `transfer_failed: ${event.type}`,
              })
              .eq("id", wopPaymentId);

            // Outbox : alerter pour intervention humaine
            await supabase.from("outbox").insert({
              event_type: "WorkOrder.EscrowReleaseFailed",
              payload: {
                payment_id: wopPaymentId,
                work_order_id: transfer.metadata?.work_order_id ?? null,
                stripe_transfer_id: transfer.id,
                stripe_event: event.type,
              },
            });
          }
        }

        // Cas 2 (legacy) : transferts rent
        await supabase
          .from("stripe_transfers")
          .update({
            status: event.type === "transfer.reversed" ? "reversed" : "failed",
            failure_reason:
              event.type === "transfer.reversed"
                ? "Transfer reversed"
                : "Transfer failed",
          })
          .eq("stripe_transfer_id", transfer.id);

        break;
      }

      // ===============================================
      // STRIPE CONNECT - PAYOUTS BANCAIRES
      // ===============================================
      case "payout.created": {
        const payout = event.data.object as Stripe.Payout;
        await upsertStripePayout(supabase, event.account, payout, "pending");
        break;
      }

      case "payout.updated": {
        const payout = event.data.object as Stripe.Payout;
        await upsertStripePayout(supabase, event.account, payout);
        break;
      }

      case "payout.paid": {
        const payout = event.data.object as Stripe.Payout;
        await upsertStripePayout(supabase, event.account, payout, "paid");
        break;
      }

      case "payout.failed": {
        const payout = event.data.object as Stripe.Payout;
        await upsertStripePayout(supabase, event.account, payout, "failed");
        break;
      }

      case "payout.canceled": {
        const payout = event.data.object as Stripe.Payout;
        await upsertStripePayout(supabase, event.account, payout, "canceled");
        break;
      }

      // ===============================================
      // CONTESTATION SEPA (DISPUTE)
      // ===============================================
      case "charge.dispute.created": {
        const dispute = event.data.object as Stripe.Dispute;
        const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id;
        const paymentIntentId = typeof dispute.payment_intent === "string"
          ? dispute.payment_intent
          : dispute.payment_intent?.id || null;

        // Logger la contestation
        await supabase.from("webhook_logs").insert({
          provider: "stripe",
          event_type: "charge.dispute.created",
          event_id: event.id,
          payload: {
            dispute_id: dispute.id,
            charge_id: chargeId,
            payment_intent_id: paymentIntentId,
            amount: dispute.amount,
            reason: dispute.reason,
            status: dispute.status,
          } as Json,
          processed_at: new Date().toISOString(),
          status: "success",
        });

        // Trouver le paiement lié
        if (paymentIntentId) {
          const { data: payment } = await supabase
            .from("payments")
            .select("id, invoice_id, invoice:invoices(owner_id, tenant_id, lease_id)")
            .eq("provider_ref", paymentIntentId)
            .maybeSingle();

          if (payment) {
            // Marquer le paiement comme contesté
            await supabase
              .from("payments")
              .update({ statut: "disputed" })
              .eq("id", payment.id);

            const invoice = payment.invoice as any;

            // Notifier le propriétaire
            if (invoice?.owner_id) {
              await supabase.rpc("create_notification", {
                p_recipient_id: invoice.owner_id,
                p_type: "alert",
                p_title: "Contestation de paiement",
                p_message: `Un prélèvement de ${(dispute.amount / 100).toFixed(2)}€ a été contesté par le locataire. Motif : ${dispute.reason || 'non spécifié'}.`,
                p_link: "/owner/money",
                p_related_id: payment.invoice_id,
                p_related_type: "invoice",
              });
            }
          }
        }

        // Cas work_order_payment : un dispute Stripe (chargeback bancaire)
        // sur la charge d'un paiement WO. On bloque la libération + crée
        // une ligne work_order_disputes pour audit + notif.
        if (chargeId) {
          const { data: woPayment } = await supabase
            .from("work_order_payments")
            .select("id, work_order_id, payer_profile_id, escrow_status")
            .eq("stripe_charge_id", chargeId)
            .maybeSingle();

          if (woPayment) {
            const wp = woPayment as {
              id: string;
              work_order_id: string;
              payer_profile_id: string;
              escrow_status: string;
            };

            // Bloquer la libération si encore possible
            if (["held", "released"].includes(wp.escrow_status)) {
              await supabase
                .from("work_order_payments")
                .update({ escrow_status: "disputed" })
                .eq("id", wp.id);
            }

            // Insérer un litige (idempotent via stripe_dispute_id ?
            // Pas de colonne dédiée, on utilise idempotency par
            // upsert sur (work_order_payment_id + reason='unauthorized'
            // + status='open') pour éviter doublon en cas de re-livraison
            // du webhook — best effort.
            const { data: existing } = await supabase
              .from("work_order_disputes")
              .select("id")
              .eq("work_order_payment_id", wp.id)
              .eq("status", "open")
              .maybeSingle();

            if (!existing) {
              await supabase.from("work_order_disputes").insert({
                work_order_payment_id: wp.id,
                work_order_id: wp.work_order_id,
                raised_by_profile_id: wp.payer_profile_id,
                reason: "unauthorized",
                description:
                  `Chargeback bancaire Stripe — motif: ${dispute.reason || "non spécifié"}. ` +
                  `Dispute ID: ${dispute.id}.`,
                status: "open",
              });
            }

            // Notifier l'admin via outbox
            await supabase.from("outbox").insert({
              event_type: "WorkOrder.StripeChargeback",
              payload: {
                work_order_payment_id: wp.id,
                work_order_id: wp.work_order_id,
                stripe_dispute_id: dispute.id,
                reason: dispute.reason,
                amount_cents: dispute.amount,
              },
            });
          }
        }
        break;
      }

      // ===============================================
      // CHARGE REFUNDED (manuel ou via dispute)
      // ===============================================
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;

        // Détecter si la charge appartient à un work_order_payment
        const { data: woPayment } = await supabase
          .from("work_order_payments")
          .select("id, work_order_id, gross_amount, escrow_status")
          .eq("stripe_charge_id", charge.id)
          .maybeSingle();

        if (woPayment) {
          const wp = woPayment as {
            id: string;
            work_order_id: string;
            gross_amount: number | string;
            escrow_status: string;
          };

          const refundedCents = charge.amount_refunded ?? 0;
          const grossCents = Math.round(Number(wp.gross_amount) * 100);
          const isFullRefund = refundedCents >= grossCents;

          await supabase
            .from("work_order_payments")
            .update({
              status: isFullRefund ? "refunded" : "succeeded",
              escrow_status: isFullRefund ? "refunded" : wp.escrow_status,
            })
            .eq("id", wp.id);

          // Si plein refund → revert le statut WO si tout est refundé
          if (isFullRefund) {
            await supabase
              .from("work_orders")
              .update({ statut: "cancelled" })
              .eq("id", wp.work_order_id);
          }
        }

        // Cas normal : paiement de loyer (table payments). Le payment_intent
        // d'origine est référencé par charge.payment_intent.
        // Bug pré-existant : ce cas n'était PAS traité, la facture restait
        // "paid" après remboursement et la compta divergeait.
        const paymentIntentId =
          typeof charge.payment_intent === "string"
            ? charge.payment_intent
            : charge.payment_intent?.id ?? null;

        if (paymentIntentId) {
          const { data: rentPayment } = await supabase
            .from("payments")
            .select("id, invoice_id, statut, montant")
            .eq("provider_ref", paymentIntentId)
            .maybeSingle();

          if (rentPayment) {
            const rp = rentPayment as {
              id: string;
              invoice_id: string | null;
              statut: string | null;
              montant: number | string | null;
            };

            const refundedCents = charge.amount_refunded ?? 0;
            const grossCents = Math.round(Number(rp.montant ?? 0) * 100);
            const isFullRefund = grossCents > 0 && refundedCents >= grossCents;

            await supabase
              .from("payments")
              .update({
                statut: isFullRefund ? "refunded" : rp.statut ?? "succeeded",
              })
              .eq("id", rp.id);

            if (rp.invoice_id) {
              // Recalcule le statut de la facture à partir des paiements
              // restants (paid → refunded ou partially_paid selon le solde).
              await syncInvoiceStatusFromPayments(
                supabase as any,
                rp.invoice_id,
                null
              );
            }
          }
        }
        break;
      }

      // ===============================================
      // AUTRES ÉVÉNEMENTS
      // ===============================================
      default:
    }

    // Enregistrer l'événement dans le log d'audit
    await supabase.from("webhook_logs").insert({
      provider: "stripe",
      event_type: event.type,
      event_id: event.id,
      payload: JSON.parse(JSON.stringify(event.data.object)) as Json,
      processed_at: new Date().toISOString(),
      status: "success",
    });

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    console.error("[Stripe Webhook] Error processing event:", error);

    // Log l'erreur
    await supabase.from("webhook_logs").insert({
      provider: "stripe",
      event_type: event.type,
      event_id: event.id,
      error: error instanceof Error ? error.message : "Une erreur est survenue",
      processed_at: new Date().toISOString(),
      status: "error",
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Une erreur est survenue" },
      { status: 500 }
    );
  }
}

// ============================================================================
// Work Order payment — handler dédié
// ============================================================================
// Déclenché quand un paiement Stripe Connect d'une intervention aboutit.
//
// Mode ESCROW (Separate charges and transfers) : la charge est encaissée sur
// le compte plateforme Talok et y reste jusqu'à libération explicite. Ce
// handler ne fait DONC PAS de Transfer vers le compte Connect du prestataire :
// il se contente de marquer le paiement 'succeeded' / escrow 'held' et
// d'avancer le statut WO. La libération (Transfer + déduction commission)
// est gérée par la route /api/work-orders/[id]/release-transfer (Sprint B)
// et le cron de libération automatique 7j après 'completed'.
// ============================================================================

async function handleWorkOrderPaymentSucceeded(
  supabase: any,
  paymentIntent: Stripe.PaymentIntent
) {
  const workOrderId = paymentIntent.metadata?.work_order_id;
  const paymentType = paymentIntent.metadata?.payment_type || "full";
  if (!workOrderId) {
    console.warn("[Stripe Webhook] work_order_payment: missing work_order_id in metadata");
    return;
  }

  // Marquer la ligne work_order_payments correspondante comme succeeded.
  // On matche par stripe_payment_intent_id (posé à la création de la session)
  // sinon fallback sur metadata.checkout_session_id.
  const { data: existing } = await supabase
    .from("work_order_payments")
    .select("id")
    .eq("work_order_id", workOrderId)
    .eq("stripe_payment_intent_id", paymentIntent.id)
    .maybeSingle();

  const chargeId =
    typeof paymentIntent.latest_charge === "string"
      ? paymentIntent.latest_charge
      : (paymentIntent.latest_charge as any)?.id || null;

  // Escrow held : fonds sur compte Talok, en attente de libération vers
  // le compte Connect du prestataire (Sprint B).
  const nowIso = new Date().toISOString();
  if (existing) {
    await supabase
      .from("work_order_payments")
      .update({
        status: "succeeded",
        escrow_status: "held",
        stripe_charge_id: chargeId,
        escrow_held_at: nowIso,
      })
      .eq("id", (existing as { id: string }).id);
  } else {
    // Fallback : la Checkout Session a été créée sans PaymentIntent connu,
    // on cherche par payment_type restant en 'pending'.
    await supabase
      .from("work_order_payments")
      .update({
        status: "succeeded",
        escrow_status: "held",
        stripe_payment_intent_id: paymentIntent.id,
        stripe_charge_id: chargeId,
        escrow_held_at: nowIso,
      })
      .eq("work_order_id", workOrderId)
      .eq("payment_type", paymentType)
      .eq("status", "pending");
  }

  // Avancer le statut du work_order :
  //   'deposit' → deposit_paid
  //   'balance' ou 'full' → fully_paid
  // Note : 'fully_paid' signifie ici "le proprio a tout payé", pas "les
  // fonds sont arrivés chez le prestataire". Le transfer effectif dépend
  // de la libération escrow (Sprint B).
  const nextStatut =
    paymentType === "deposit" ? "deposit_paid" : "fully_paid";
  await supabase
    .from("work_orders")
    .update({ statut: nextStatut })
    .eq("id", workOrderId);

  // Injection automatique dans charge_entries si is_tenant_chargeable=true
  // (idempotent côté helper). On le déclenche dès que le proprio a tout payé,
  // même si l'escrow n'est pas encore libéré côté prestataire — la dépense
  // est bien engagée pour le proprio.
  if (nextStatut === "fully_paid") {
    try {
      const { injectChargeEntryForWorkOrder } = await import(
        "@/lib/tickets/inject-charge-entry"
      );
      await injectChargeEntryForWorkOrder(supabase, workOrderId);
    } catch (err) {
      console.error(
        "[Stripe Webhook] work_order auto-inject charge failed:",
        err
      );
    }

    // Auto-génération de la facture prestataire à partir du devis accepté.
    // Idempotent (provider_quotes.converted_invoice_id) — peut être rappelé
    // sans dommage si Stripe rejoue le webhook.
    try {
      const { createInvoiceFromWorkOrder } = await import(
        "@/lib/work-orders/auto-invoice"
      );
      const result = await createInvoiceFromWorkOrder(supabase, workOrderId);
      if (result && !result.reused) {
        console.log(
          `[Stripe Webhook] Provider invoice ${result.invoice_number} auto-generated for work order ${workOrderId}`
        );
      }
    } catch (err) {
      console.error(
        "[Stripe Webhook] work_order auto-invoice creation failed:",
        err
      );
    }
  }

  // Résoudre la référence humaine du ticket lié pour l'email
  let ticketReference: string | null = null;
  try {
    const { data: woRow } = await supabase
      .from("work_orders")
      .select("ticket_id")
      .eq("id", workOrderId)
      .maybeSingle();
    const ticketId = (woRow as { ticket_id: string | null } | null)?.ticket_id ?? null;
    if (ticketId) {
      const { data: tRow } = await supabase
        .from("tickets")
        .select("reference")
        .eq("id", ticketId)
        .maybeSingle();
      ticketReference =
        (tRow as { reference: string | null } | null)?.reference ?? null;
    }
  } catch {
    /* non-blocking — just means the email won't carry the reference */
  }

  // Outbox : notifier le prestataire que le paiement est confirmé (mais
  // les fonds sont encore en escrow, ils seront transférés au démarrage
  // des travaux ou après le délai de contestation 7j).
  const payeeProfileId = paymentIntent.metadata?.payee_profile_id;
  if (payeeProfileId) {
    const { data: payeeProfile } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("id", payeeProfileId)
      .maybeSingle();
    const payeeUserId =
      (payeeProfile as { user_id: string | null } | null)?.user_id ?? null;

    if (payeeUserId) {
      await supabase.from("outbox").insert({
        event_type: "WorkOrder.PaymentReceived",
        payload: {
          work_order_id: workOrderId,
          payment_type: paymentType,
          amount_cents: paymentIntent.amount,
          escrow_status: "held",
          ticket_reference: ticketReference,
          recipient_user_id: payeeUserId,
        },
      });
    }
  }
}

// Note: Dans l'App Router (Next.js 13+), le body est automatiquement
// traité comme raw pour les routes POST. Pas besoin de config spéciale.
// L'ancien "export const config" est déprécié.


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
  const { data: existingPayment } = await supabase
    .from("payments")
    .select("id, statut")
    .eq("provider_ref", params.providerRef)
    .maybeSingle();

  const existing = existingPayment as { id?: string | null; statut?: string | null } | null;
  const payload = {
    invoice_id: params.invoiceId,
    montant: params.amount,
    moyen: params.method,
    provider_ref: params.providerRef,
    date_paiement: params.paidAt || null,
    statut: params.status,
  };

  if (existing?.id) {
    const { data: updatedPayment } = await supabase
      .from("payments")
      .update(payload)
      .eq("id", existing.id)
      .select("id")
      .single();

    return {
      paymentId: (updatedPayment as { id?: string } | null)?.id || existing.id,
      newlySucceeded: existing.statut !== "succeeded" && params.status === "succeeded",
      newlyFailed: existing.statut !== "failed" && params.status === "failed",
    };
  }

  const { data: createdPayment } = await supabase
    .from("payments")
    .insert(payload)
    .select("id")
    .single();

  return {
    paymentId: (createdPayment as { id?: string } | null)?.id || null,
    newlySucceeded: params.status === "succeeded",
    newlyFailed: params.status === "failed",
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

        if (invoiceId) {
          const paidAt = new Date().toISOString();
          const paymentResult = await upsertPaymentAttempt(supabase, {
            invoiceId,
            amount: paymentIntent.amount / 100,
            method: "cb",
            providerRef: paymentIntent.id,
            status: "succeeded",
            paidAt,
          });
          const paymentId = paymentResult.paymentId;

          await supabase
            .from("invoices")
            .update({
              stripe_payment_intent_id: paymentIntent.id,
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
          }

          if (paymentId && paymentResult.newlySucceeded) {
            const sourceTransactionId = await resolveSourceTransactionId(stripe, paymentIntent.id);
            const receiptGenerated = !!settlement?.isSettled;
            if (settlement?.isSettled) {
              await processReceiptGeneration(
                supabase,
                invoiceId,
                paymentId,
                paymentIntent.amount / 100
              );
            }
            await emitPaymentSucceededEvent(supabase, paymentId, invoiceId, paymentIntent.amount / 100, {
              invoiceSettled: settlement?.isSettled ?? false,
              receiptGenerated,
            });

            await reconcileOwnerTransfer(supabase as any, {
              paymentId,
              invoiceId,
              paymentIntentId: paymentIntent.id,
              sourceTransactionId,
              amountCents: paymentIntent.amount,
              paymentMethod: paymentIntent.payment_method_types?.[0] || "card",
            });
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

        if (invoiceId) {
          const paymentResult = await upsertPaymentAttempt(supabase, {
            invoiceId,
            amount: paymentIntent.amount / 100,
            method: paymentIntent.payment_method_types?.[0] || "cb",
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

          await supabase.from("subscription_invoices").upsert(
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
          );

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

            // Notifier le propriétaire si l'onboarding est terminé
            if (account.charges_enabled && account.payouts_enabled && connectAccount.profile_id) {
              await supabase.rpc("create_notification", {
                p_recipient_id: connectAccount.profile_id,
                p_type: "success",
                p_title: "Compte de paiement activé !",
                p_message: "Votre compte Stripe est maintenant actif. Vous recevrez les loyers directement.",
                p_link: "/owner/money?tab=banque",
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

        // Enregistrer le transfert en base
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
      // STRIPE CONNECT - TRANSFERT ÉCHOUÉ
      // ===============================================
      case "transfer.failed" as any: {
        const transfer = (event as any).data.object as Stripe.Transfer;

        // Mettre à jour le statut du transfert
        await supabase
          .from("stripe_transfers")
          .update({
            status: "failed",
            failure_reason: "Transfer failed",
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

// Note: Dans l'App Router (Next.js 13+), le body est automatiquement
// traité comme raw pour les routes POST. Pas besoin de config spéciale.
// L'ancien "export const config" est déprécié.


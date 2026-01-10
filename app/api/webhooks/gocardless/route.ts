/**
 * Webhook GoCardless SOTA 2026
 *
 * Gère les événements SEPA Direct Debit:
 * - Mandats (création, expiration, annulation)
 * - Paiements (succès, échec, remboursement)
 * - Charge-backs
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const gocardlessWebhookSecret = process.env.GOCARDLESS_WEBHOOK_SECRET;

interface GoCardlessEvent {
  id: string;
  created_at: string;
  action: string;
  resource_type: string;
  links: {
    mandate?: string;
    payment?: string;
    subscription?: string;
    customer?: string;
  };
  details?: {
    origin?: string;
    cause?: string;
    description?: string;
    scheme?: string;
    reason_code?: string;
  };
}

interface GoCardlessWebhookPayload {
  events: GoCardlessEvent[];
}

/**
 * Vérifie la signature du webhook GoCardless
 */
function verifyWebhookSignature(
  body: string,
  signature: string | null
): boolean {
  if (!gocardlessWebhookSecret || !signature) {
    console.warn("[GoCardless Webhook] Secret ou signature manquante");
    return false;
  }

  const expectedSignature = crypto
    .createHmac("sha256", gocardlessWebhookSecret)
    .update(body)
    .digest("hex");

  // Comparaison timing-safe
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

/**
 * POST /api/webhooks/gocardless
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.text();
    const signature = request.headers.get("webhook-signature");

    // Vérifier la signature
    if (process.env.NODE_ENV === "production") {
      if (!verifyWebhookSignature(body, signature)) {
        console.error("[GoCardless Webhook] Signature invalide");
        return NextResponse.json(
          { error: "Signature invalide" },
          { status: 401 }
        );
      }
    }

    const payload: GoCardlessWebhookPayload = JSON.parse(body);
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    // Traiter chaque événement
    for (const event of payload.events) {
      console.log(
        `[GoCardless Webhook] Traitement: ${event.resource_type}.${event.action}`,
        { eventId: event.id }
      );

      // Vérifier l'idempotence
      const { data: existing } = await serviceClient
        .from("webhook_events")
        .select("id")
        .eq("provider", "gocardless")
        .eq("provider_event_id", event.id)
        .maybeSingle();

      if (existing) {
        console.log(`[GoCardless Webhook] Événement déjà traité: ${event.id}`);
        continue;
      }

      // Enregistrer l'événement
      await serviceClient.from("webhook_events").insert({
        provider: "gocardless",
        provider_event_id: event.id,
        event_type: `${event.resource_type}.${event.action}`,
        payload: event,
        status: "processing",
      });

      try {
        await processEvent(serviceClient, event);

        // Marquer comme traité
        await serviceClient
          .from("webhook_events")
          .update({ status: "processed", processed_at: new Date().toISOString() })
          .eq("provider_event_id", event.id);
      } catch (error) {
        console.error(`[GoCardless Webhook] Erreur traitement:`, error);

        await serviceClient
          .from("webhook_events")
          .update({
            status: "failed",
            error_message: error instanceof Error ? error.message : "Unknown error",
          })
          .eq("provider_event_id", event.id);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[GoCardless Webhook] Terminé en ${duration}ms`);

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[GoCardless Webhook] Erreur globale:", error);
    return NextResponse.json(
      { error: "Erreur de traitement" },
      { status: 500 }
    );
  }
}

/**
 * Traite un événement GoCardless
 */
async function processEvent(
  serviceClient: ReturnType<typeof createClient>,
  event: GoCardlessEvent
): Promise<void> {
  const { resource_type, action, links, details } = event;

  switch (resource_type) {
    case "mandates":
      await processMandateEvent(serviceClient, action, links, details);
      break;

    case "payments":
      await processPaymentEvent(serviceClient, action, links, details, event.id);
      break;

    case "subscriptions":
      await processSubscriptionEvent(serviceClient, action, links, details);
      break;

    case "refunds":
      await processRefundEvent(serviceClient, action, links, details);
      break;

    default:
      console.log(`[GoCardless Webhook] Type non géré: ${resource_type}`);
  }
}

/**
 * Traite les événements de mandat SEPA
 */
async function processMandateEvent(
  serviceClient: ReturnType<typeof createClient>,
  action: string,
  links: GoCardlessEvent["links"],
  details?: GoCardlessEvent["details"]
): Promise<void> {
  const mandateId = links?.mandate;
  if (!mandateId) return;

  switch (action) {
    case "created":
    case "submitted":
    case "active":
      await serviceClient
        .from("sepa_mandates")
        .update({
          status: action === "active" ? "active" : "pending",
          updated_at: new Date().toISOString(),
        })
        .eq("provider_mandate_id", mandateId);
      break;

    case "cancelled":
    case "expired":
    case "failed":
      await serviceClient
        .from("sepa_mandates")
        .update({
          status: action,
          failure_reason: details?.description || details?.cause,
          updated_at: new Date().toISOString(),
        })
        .eq("provider_mandate_id", mandateId);

      // Notifier le propriétaire
      const { data: mandate } = await serviceClient
        .from("sepa_mandates")
        .select("lease_id, profiles!inner(id)")
        .eq("provider_mandate_id", mandateId)
        .single();

      if (mandate) {
        await serviceClient.from("notifications").insert({
          recipient_id: (mandate as any).profiles?.id,
          type: "alert",
          title: "Mandat SEPA " + (action === "cancelled" ? "annulé" : "expiré"),
          message: `Le mandat de prélèvement automatique a été ${action}. ${details?.description || ""}`,
          link: `/owner/leases/${(mandate as any).lease_id}`,
        });
      }
      break;
  }
}

/**
 * Traite les événements de paiement
 */
async function processPaymentEvent(
  serviceClient: ReturnType<typeof createClient>,
  action: string,
  links: GoCardlessEvent["links"],
  details?: GoCardlessEvent["details"],
  eventId?: string
): Promise<void> {
  const paymentId = links?.payment;
  if (!paymentId) return;

  // Récupérer le paiement existant
  const { data: existingPayment } = await serviceClient
    .from("payments")
    .select("id, invoice_id, montant, lease_id")
    .eq("provider_ref", paymentId)
    .maybeSingle();

  switch (action) {
    case "confirmed":
    case "paid_out":
      // Paiement réussi
      if (existingPayment) {
        await serviceClient
          .from("payments")
          .update({
            statut: "confirmed",
            confirmed_at: new Date().toISOString(),
          })
          .eq("id", existingPayment.id);

        // Mettre à jour la facture
        if (existingPayment.invoice_id) {
          await updateInvoiceStatus(
            serviceClient,
            existingPayment.invoice_id,
            existingPayment.montant
          );
        }

        // Émettre événement
        await serviceClient.from("outbox").insert({
          event_type: "Payment.Confirmed",
          payload: {
            payment_id: existingPayment.id,
            invoice_id: existingPayment.invoice_id,
            provider: "gocardless",
            provider_ref: paymentId,
          },
        });
      }
      break;

    case "failed":
    case "cancelled":
    case "charged_back":
      // Paiement échoué
      if (existingPayment) {
        await serviceClient
          .from("payments")
          .update({
            statut: action === "charged_back" ? "refunded" : "failed",
            failure_reason: details?.description || details?.cause,
            failure_code: details?.reason_code,
          })
          .eq("id", existingPayment.id);

        // Remettre la facture en impayé si nécessaire
        if (existingPayment.invoice_id) {
          await serviceClient
            .from("invoices")
            .update({ statut: "late" })
            .eq("id", existingPayment.invoice_id);
        }

        // Notifier
        await serviceClient.from("outbox").insert({
          event_type: "Payment.Failed",
          payload: {
            payment_id: existingPayment.id,
            invoice_id: existingPayment.invoice_id,
            reason: details?.description,
            reason_code: details?.reason_code,
          },
        });
      }
      break;

    case "late_failure_settled":
      // Défaut de paiement après contestation
      if (existingPayment) {
        await serviceClient
          .from("payments")
          .update({
            statut: "late_failure",
            failure_reason: "Contestation réglée - fonds non récupérés",
          })
          .eq("id", existingPayment.id);
      }
      break;
  }
}

/**
 * Met à jour le statut de la facture avec vérification du montant
 */
async function updateInvoiceStatus(
  serviceClient: ReturnType<typeof createClient>,
  invoiceId: string,
  paymentAmount: number
): Promise<void> {
  // Récupérer la facture et tous ses paiements
  const { data: invoice } = await serviceClient
    .from("invoices")
    .select("montant_total, statut")
    .eq("id", invoiceId)
    .single();

  if (!invoice) return;

  const { data: payments } = await serviceClient
    .from("payments")
    .select("montant")
    .eq("invoice_id", invoiceId)
    .eq("statut", "confirmed");

  const totalPaid = (payments || []).reduce((sum, p) => sum + (p.montant || 0), 0);

  // Déterminer le nouveau statut
  let newStatus: string;
  if (totalPaid >= invoice.montant_total) {
    newStatus = "paid";
  } else if (totalPaid > 0) {
    newStatus = "partial"; // Paiement partiel
  } else {
    return; // Pas de changement
  }

  await serviceClient
    .from("invoices")
    .update({
      statut: newStatus,
      paid_at: newStatus === "paid" ? new Date().toISOString() : null,
    })
    .eq("id", invoiceId);
}

/**
 * Traite les événements d'abonnement
 */
async function processSubscriptionEvent(
  serviceClient: ReturnType<typeof createClient>,
  action: string,
  links: GoCardlessEvent["links"],
  details?: GoCardlessEvent["details"]
): Promise<void> {
  const subscriptionId = links?.subscription;
  if (!subscriptionId) return;

  switch (action) {
    case "cancelled":
    case "finished":
      await serviceClient
        .from("autopay_subscriptions")
        .update({
          status: action,
          cancelled_at: new Date().toISOString(),
          cancellation_reason: details?.cause,
        })
        .eq("provider_subscription_id", subscriptionId);
      break;

    case "payment_created":
      // Un paiement a été créé par l'abonnement
      console.log(`[GoCardless] Paiement créé pour subscription ${subscriptionId}`);
      break;
  }
}

/**
 * Traite les événements de remboursement
 */
async function processRefundEvent(
  serviceClient: ReturnType<typeof createClient>,
  action: string,
  links: GoCardlessEvent["links"],
  details?: GoCardlessEvent["details"]
): Promise<void> {
  const paymentId = links?.payment;
  if (!paymentId) return;

  if (action === "created" || action === "paid") {
    // Enregistrer le remboursement
    const { data: payment } = await serviceClient
      .from("payments")
      .select("id, invoice_id, lease_id")
      .eq("provider_ref", paymentId)
      .single();

    if (payment) {
      await serviceClient
        .from("payments")
        .update({ statut: "refunded" })
        .eq("id", payment.id);

      // Émettre événement
      await serviceClient.from("outbox").insert({
        event_type: "Payment.Refunded",
        payload: {
          payment_id: payment.id,
          invoice_id: payment.invoice_id,
          lease_id: payment.lease_id,
        },
      });
    }
  }
}

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

// Initialiser Stripe de manière lazy pour éviter les erreurs au build
function getStripe(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  return new Stripe(secretKey, {
    apiVersion: "2024-10-28.acacia",
  });
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

  console.log(`[Stripe Webhook] Received event: ${event.type}`);

  try {
    switch (event.type) {
      // ===============================================
      // PAIEMENT DE LOYER RÉUSSI
      // ===============================================
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        
        // Récupérer les métadonnées
        const invoiceId = session.metadata?.invoice_id;
        const leaseId = session.metadata?.lease_id;
        const tenantId = session.metadata?.tenant_id;
        
        if (invoiceId) {
          console.log(`[Stripe Webhook] Processing payment for invoice: ${invoiceId}`);
          
          // Mettre à jour la facture
          const { error: invoiceError } = await supabase
            .from("invoices")
            .update({
              statut: "paid",
              date_paiement: new Date().toISOString(),
              stripe_payment_intent_id: session.payment_intent as string,
              stripe_session_id: session.id,
            })
            .eq("id", invoiceId);

          if (invoiceError) {
            console.error("[Stripe Webhook] Error updating invoice:", invoiceError);
            throw invoiceError;
          }

          // Créer l'enregistrement de paiement
          const { data: payment, error: paymentError } = await supabase
            .from("payments")
            .insert({
              invoice_id: invoiceId,
              montant: (session.amount_total || 0) / 100, // Convertir centimes en euros
              moyen: "cb",
              provider_ref: session.payment_intent as string,
              date_paiement: new Date().toISOString(),
              statut: "succeeded",
            })
            .select("id")
            .single();

          if (paymentError) {
            console.error("[Stripe Webhook] Error creating payment:", paymentError);
          }

          // Récupérer les infos pour la notification
          const { data: invoice } = await supabase
            .from("invoices")
            .select(`
              montant_total,
              lease:leases(
                property:properties(
                  owner_id,
                  adresse_complete
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
              p_link: `/app/owner/money`,
              p_related_id: invoiceId,
              p_related_type: "invoice",
            });
          }

          console.log(`[Stripe Webhook] Invoice ${invoiceId} marked as paid`);
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
          // Vérifier si le paiement n'a pas déjà été traité
          const { data: existingPayment } = await supabase
            .from("payments")
            .select("id")
            .eq("provider_ref", paymentIntent.id)
            .maybeSingle();

          if (!existingPayment) {
            // Mettre à jour la facture
            await supabase
              .from("invoices")
              .update({
                statut: "paid",
                date_paiement: new Date().toISOString(),
                stripe_payment_intent_id: paymentIntent.id,
              })
              .eq("id", invoiceId);

            // Créer le paiement
            await supabase.from("payments").insert({
              invoice_id: invoiceId,
              montant: paymentIntent.amount / 100,
              moyen: "cb",
              provider_ref: paymentIntent.id,
              date_paiement: new Date().toISOString(),
              statut: "succeeded",
            });

            console.log(`[Stripe Webhook] Payment intent ${paymentIntent.id} processed`);
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
          // Mettre à jour le statut de la facture
          await supabase
            .from("invoices")
            .update({ statut: "late" })
            .eq("id", invoiceId);

          // Enregistrer la tentative échouée
          await supabase.from("payments").insert({
            invoice_id: invoiceId,
            montant: paymentIntent.amount / 100,
            moyen: "cb",
            provider_ref: paymentIntent.id,
            date_paiement: new Date().toISOString(),
            statut: "failed",
          });

          console.log(`[Stripe Webhook] Payment failed for invoice ${invoiceId}`);
        }
        break;
      }

      // ===============================================
      // ABONNEMENT PAYÉ
      // ===============================================
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        // Trouver l'abonnement lié
        const { data: subscription } = await supabase
          .from("subscriptions")
          .select("id, owner_id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        if (subscription) {
          // Mettre à jour le statut
          await supabase
            .from("subscriptions")
            .update({
              status: "active",
              current_period_start: invoice.period_start
                ? new Date(invoice.period_start * 1000).toISOString()
                : undefined,
              current_period_end: invoice.period_end
                ? new Date(invoice.period_end * 1000).toISOString()
                : undefined,
            })
            .eq("id", subscription.id);

          // Créer une entrée dans l'historique des factures d'abonnement
          await supabase.from("subscription_invoices").insert({
            subscription_id: subscription.id,
            stripe_invoice_id: invoice.id,
            amount: (invoice.amount_paid || 0) / 100,
            status: "paid",
            invoice_pdf_url: invoice.invoice_pdf,
            created_at: new Date().toISOString(),
          });

          console.log(`[Stripe Webhook] Subscription invoice paid: ${invoice.id}`);
        }
        break;
      }

      // ===============================================
      // MISE À JOUR D'ABONNEMENT
      // ===============================================
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        
        // Mettre à jour en base
        const { error } = await supabase
          .from("subscriptions")
          .update({
            status: subscription.status as any,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
          })
          .eq("stripe_subscription_id", subscription.id);

        if (!error) {
          console.log(`[Stripe Webhook] Subscription updated: ${subscription.id}`);
        }
        break;
      }

      // ===============================================
      // ANNULATION D'ABONNEMENT
      // ===============================================
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;

        const { data: sub } = await supabase
          .from("subscriptions")
          .select("id, owner_id")
          .eq("stripe_subscription_id", subscription.id)
          .maybeSingle();

        if (sub) {
          await supabase
            .from("subscriptions")
            .update({
              status: "canceled",
              canceled_at: new Date().toISOString(),
            })
            .eq("id", sub.id);

          // Notifier le propriétaire
          if (sub.owner_id) {
            await supabase.rpc("create_notification", {
              p_recipient_id: sub.owner_id,
              p_type: "alert",
              p_title: "Abonnement annulé",
              p_message: "Votre abonnement a été annulé. Vos données seront conservées.",
              p_link: "/app/settings/billing",
            });
          }

          console.log(`[Stripe Webhook] Subscription canceled: ${subscription.id}`);
        }
        break;
      }

      // ===============================================
      // AUTRES ÉVÉNEMENTS
      // ===============================================
      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }

    // Enregistrer l'événement dans le log d'audit
    await supabase.from("webhook_logs").insert({
      provider: "stripe",
      event_type: event.type,
      event_id: event.id,
      payload: event.data.object,
      processed_at: new Date().toISOString(),
      status: "success",
    }).catch(() => {
      // Ignorer si la table n'existe pas
    });

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("[Stripe Webhook] Error processing event:", error);

    // Log l'erreur
    await supabase.from("webhook_logs").insert({
      provider: "stripe",
      event_type: event.type,
      event_id: event.id,
      error: error.message,
      processed_at: new Date().toISOString(),
      status: "error",
    }).catch(() => {});

    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// Note: Dans l'App Router (Next.js 13+), le body est automatiquement
// traité comme raw pour les routes POST. Pas besoin de config spéciale.
// L'ancien "export const config" est déprécié.


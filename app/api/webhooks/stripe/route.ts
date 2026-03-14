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

// Fonction utilitaire pour générer et sauvegarder la quittance de façon idempotente
async function processReceiptGeneration(supabase: any, _invoiceId: string, paymentId: string, _amount: number) {
  try {
    await ensureReceiptDocument(supabase, paymentId);
  } catch (error) {
    console.error("[Receipt] Generation failed:", error);
  }
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

    console.log(`[Payment] ✅ Events emitted for payment ${paymentId}`);
  } catch (error) {
    console.error("[Payment] Error emitting events:", error);
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

  console.log(`[Stripe Webhook] Received event: ${event.type}`);

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
        
        // Récupérer les métadonnées
        const invoiceId = session.metadata?.invoice_id;
        const leaseId = session.metadata?.lease_id;
        const tenantId = session.metadata?.tenant_id;
        
        if (invoiceId) {
          console.log(`[Stripe Webhook] Processing payment for invoice: ${invoiceId}`);
          const providerRef = session.payment_intent as string;
          const paidAt = new Date().toISOString();

          const { data: existingPayment } = await supabase
            .from("payments")
            .select("id")
            .eq("provider_ref", providerRef)
            .maybeSingle();

          let paymentId: string | null = null;
          if (existingPayment) {
            const { data: updatedPayment, error: paymentUpdateError } = await supabase
              .from("payments")
              .update({
                statut: "succeeded",
                date_paiement: paidAt,
              })
              .eq("id", existingPayment.id)
              .select("id")
              .single();

            if (paymentUpdateError) {
              console.error("[Stripe Webhook] Error updating payment:", paymentUpdateError);
            } else {
              paymentId = updatedPayment?.id || null;
            }
          } else {
            const { data: payment, error: paymentError } = await supabase
              .from("payments")
              .insert({
                invoice_id: invoiceId,
                montant: (session.amount_total || 0) / 100,
                moyen: "cb",
                provider_ref: providerRef,
                date_paiement: paidAt,
                statut: "succeeded",
              })
              .select("id")
              .single();

            if (paymentError) {
              console.error("[Stripe Webhook] Error creating payment:", paymentError);
            } else {
              paymentId = payment?.id || null;
            }
          }

          await supabase
            .from("invoices")
            .update({
              stripe_payment_intent_id: providerRef,
              stripe_session_id: session.id,
            })
            .eq("id", invoiceId);

          const settlement = await syncInvoiceStatusFromPayments(supabase as any, invoiceId, paidAt);

          if (paymentId) {
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
              await sendPaymentReceivedEmail(
                owner.email,
                `${owner.prenom} ${owner.nom}`,
                `${tenant?.prenom} ${tenant?.nom}`,
                (session.amount_total || 0) / 100,
                invoice.lease.property.adresse_complete,
                invoice.periode,
                new Date().toLocaleDateString("fr-FR"),
                `${process.env.NEXT_PUBLIC_APP_URL}/owner/money`
              );
            }
          }

          console.log(`[Stripe Webhook] Invoice ${invoiceId} payment synchronized`);
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
          const { data: existingPayment } = await supabase
            .from("payments")
            .select("id")
            .eq("provider_ref", paymentIntent.id)
            .maybeSingle();

          let paymentId: string | null = null;
          if (existingPayment) {
            const { data: updatedPayment } = await supabase
              .from("payments")
              .update({
                statut: "succeeded",
                date_paiement: paidAt,
              })
              .eq("id", existingPayment.id)
              .select("id")
              .single();
            paymentId = updatedPayment?.id || null;
          } else {
            const { data: newPayment } = await supabase.from("payments").insert({
              invoice_id: invoiceId,
              montant: paymentIntent.amount / 100,
              moyen: "cb",
              provider_ref: paymentIntent.id,
              date_paiement: paidAt,
              statut: "succeeded",
            }).select("id").single();
            paymentId = newPayment?.id || null;
          }

          await supabase
            .from("invoices")
            .update({
              stripe_payment_intent_id: paymentIntent.id,
            })
            .eq("id", invoiceId);

          const settlement = await syncInvoiceStatusFromPayments(supabase as any, invoiceId, paidAt);

          console.log(`[Stripe Webhook] Payment intent ${paymentIntent.id} processed`);
          if (paymentId) {
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
            current_period_start: new Date((subscription as any).current_period_start * 1000).toISOString(),
            current_period_end: new Date((subscription as any).current_period_end * 1000).toISOString(),
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
              p_link: "/settings/billing",
            });
          }

          console.log(`[Stripe Webhook] Subscription canceled: ${subscription.id}`);
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
            console.log(`[Stripe Webhook] Connect account updated: ${account.id}`);

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
                description: transfer.description,
                metadata: transfer.metadata,
                completed_at: new Date().toISOString(),
              })
              .eq("id", existingTransferId);
          } else {
            await supabase.from("stripe_transfers").insert({
              connect_account_id: connectAccount.id,
              stripe_transfer_id: transfer.id,
              stripe_payment_intent_id: transfer.source_transaction as string,
              amount: transfer.amount,
              currency: transfer.currency,
              net_amount: transfer.amount,
              status: "paid",
              description: transfer.description,
              metadata: transfer.metadata,
              completed_at: new Date().toISOString(),
            });
          }

          console.log(`[Stripe Webhook] Transfer created: ${transfer.id}`);
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

        console.log(`[Stripe Webhook] Transfer failed: ${transfer.id}`);
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


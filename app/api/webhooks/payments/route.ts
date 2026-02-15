export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature, formatAmountFromStripe, type PaymentMetadata } from "@/lib/stripe";
import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { sendPaymentConfirmation } from "@/lib/emails";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import Stripe from "stripe";

type SupabaseClient = ReturnType<typeof createServiceRoleClient>;

export async function POST(request: NextRequest) {
  const supabase = createServiceRoleClient();

  try {
    // Vérifier la signature du webhook
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      console.error("[webhook/payments] Signature manquante");
      return NextResponse.json({ error: "Signature manquante" }, { status: 400 });
    }

    let event: Stripe.Event;
    try {
      event = verifyWebhookSignature(body, signature);
    } catch (err: unknown) {
      console.error("[webhook/payments] Signature invalide:", err instanceof Error ? err.message : err);
      return NextResponse.json({ error: "Signature invalide" }, { status: 400 });
    }

    console.log(`[webhook/payments] Événement reçu: ${event.type}`);

    // Traiter les événements
    switch (event.type) {
      case "payment_intent.succeeded":
        await handlePaymentSucceeded(supabase, event.data.object as Stripe.PaymentIntent);
        break;

      case "payment_intent.payment_failed":
        await handlePaymentFailed(supabase, event.data.object as Stripe.PaymentIntent);
        break;

      case "payment_intent.canceled":
        await handlePaymentCanceled(supabase, event.data.object as Stripe.PaymentIntent);
        break;

      default:
        console.log(`[webhook/payments] Événement non géré: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    console.error("[webhook/payments] Erreur:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
  }
}

async function handlePaymentSucceeded(
  supabase: SupabaseClient,
  paymentIntent: Stripe.PaymentIntent
) {
  const metadata = paymentIntent.metadata as unknown as PaymentMetadata;
  const invoiceId = metadata?.invoiceId;
  const profileId = metadata?.profileId;

  if (!invoiceId || !profileId) {
    console.error("[webhook/payments] Metadata incomplète: invoiceId ou profileId manquant");
    return;
  }

  console.log(`[webhook/payments] Paiement réussi: ${paymentIntent.id}`);

  const amountCents = paymentIntent.amount ?? 0;

  // 1. Mettre à jour le paiement
  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .update({
      statut: "succeeded",
      date_paiement: new Date().toISOString().split("T")[0],
    })
    .eq("provider_ref", paymentIntent.id)
    .select()
    .single();

  if (paymentError) {
    console.error("[webhook/payments] Erreur mise à jour paiement:", paymentError);
    throw paymentError;
  }

  if (!payment) {
    console.error("[webhook/payments] Paiement non trouvé après mise à jour");
    return;
  }

  // 2. Vérifier si la facture est entièrement payée
  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, montant_total, periode")
    .eq("id", invoiceId)
    .single();

  if (invoice) {
    // Calculer le total payé
    const { data: payments } = await supabase
      .from("payments")
      .select("montant")
      .eq("invoice_id", invoiceId)
      .eq("statut", "succeeded");

    const totalPaid = (payments || []).reduce(
      (sum: number, p: { montant: number }) => sum + Number(p.montant),
      0
    );

    // Si entièrement payé, mettre à jour le statut de la facture
    if (totalPaid >= invoice.montant_total) {
      await supabase
        .from("invoices")
        .update({ statut: "paid" })
        .eq("id", invoiceId);

      console.log(`[webhook/payments] Facture ${invoiceId} marquée comme payée`);

      // 3. Générer la quittance
      await generateReceipt(supabase, invoiceId, payment.id);
    }
  }

  // 4. Envoyer une notification au propriétaire
  if (metadata.propertyId) {
    const { data: property } = await supabase
      .from("properties")
      .select("owner_id")
      .eq("id", metadata.propertyId)
      .single();

    if (property) {
      const msg = `Un paiement de ${formatAmountFromStripe(amountCents)}€ a été reçu.`;
      await supabase.from("notifications").insert({
        profile_id: property.owner_id,
        type: "payment_received",
        title: "Paiement reçu",
        body: msg,
        message: msg,
        data: { invoiceId, paymentId: payment.id },
      });
    }
  }

  // 5. Envoyer un email de confirmation au locataire
  try {
    const { data: tenantProfile } = await supabase
      .from("profiles")
      .select("prenom, nom, user_id")
      .eq("id", profileId)
      .single();

    if (tenantProfile) {
      // Récupérer l'email depuis auth.users
      const { data: authUser } = await supabase.auth.admin.getUserById(tenantProfile.user_id);
      
      if (authUser?.user?.email) {
        await sendPaymentConfirmation({
          tenantEmail: authUser.user.email,
          tenantName: `${tenantProfile.prenom || ""} ${tenantProfile.nom || ""}`.trim() || "Locataire",
          amount: formatAmountFromStripe(amountCents),
          paymentDate: format(new Date(), "d MMMM yyyy", { locale: fr }),
          paymentMethod: "Carte bancaire",
          period: invoice?.periode ?? "N/A",
          paymentId: payment.id,
        });
        console.log(`[webhook/payments] Email de confirmation envoyé à ${authUser.user.email}`);
      }
    }
  } catch (emailError) {
    // Ne pas bloquer si l'email échoue
    console.error("[webhook/payments] Erreur envoi email:", emailError);
  }
}

async function handlePaymentFailed(
  supabase: SupabaseClient,
  paymentIntent: Stripe.PaymentIntent
) {
  console.log(`[webhook/payments] Paiement échoué: ${paymentIntent.id}`);

  // Mettre à jour le statut du paiement
  const { error } = await supabase
    .from("payments")
    .update({ statut: "failed" })
    .eq("provider_ref", paymentIntent.id);

  if (error) {
    console.error("[webhook/payments] Erreur mise à jour paiement:", error);
    throw error;
  }

  // Notifier le locataire
  const metadata = paymentIntent.metadata as unknown as PaymentMetadata;
  const profileId = metadata?.profileId;
  if (profileId) {
    await supabase.from("notifications").insert({
      profile_id: profileId,
      type: "payment_failed",
      title: "Paiement échoué",
      body: "Votre paiement n'a pas pu être traité. Veuillez réessayer.",
      message: "Votre paiement n'a pas pu être traité. Veuillez réessayer.",
      data: { invoiceId: metadata?.invoiceId },
    });
  }
}

async function handlePaymentCanceled(
  supabase: SupabaseClient,
  paymentIntent: Stripe.PaymentIntent
) {
  console.log(`[webhook/payments] Paiement annulé: ${paymentIntent.id}`);

  // Supprimer ou annuler le paiement en attente
  await supabase
    .from("payments")
    .delete()
    .eq("provider_ref", paymentIntent.id)
    .eq("statut", "pending");
}

async function generateReceipt(
  supabase: SupabaseClient,
  invoiceId: string,
  paymentId: string
) {
  console.log(`[webhook/payments] Génération quittance pour facture ${invoiceId}`);

  // Récupérer les infos nécessaires
  const { data: invoice } = await supabase
    .from("invoices")
    .select(`
      *,
      leases(
        id,
        property_id,
        properties(adresse_complete, ville)
      )
    `)
    .eq("id", invoiceId)
    .single();

  if (!invoice) return;

  // Créer un document quittance
  const leaseData = invoice.leases as { property_id?: string } | null | undefined;
  const propertyId = leaseData?.property_id;

  const storagePath = `quittances/${invoice.tenant_id}/${invoiceId}.pdf`;
  const quittanceTitle = `Quittance ${invoice.periode}`;
  const { error } = await supabase.from("documents").insert({
    type: "quittance",
    owner_id: invoice.owner_id,
    tenant_id: invoice.tenant_id,
    property_id: propertyId ?? undefined,
    lease_id: invoice.lease_id,
    nom: quittanceTitle,
    url: storagePath,
    metadata: {
      invoiceId,
      paymentId,
      periode: invoice.periode,
      montant: invoice.montant_total,
      generated_at: new Date().toISOString(),
    },
    storage_path: storagePath,
  });

  if (error) {
    console.error("[webhook/payments] Erreur création quittance:", error);
  }

  // TODO: Générer le PDF réel via une Edge Function
}

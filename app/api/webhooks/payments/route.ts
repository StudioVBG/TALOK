export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { stripe, verifyWebhookSignature, formatAmountFromStripe, type PaymentMetadata } from "@/lib/stripe";
import { createClient as createServerClient } from "@supabase/supabase-js";
import { sendPaymentConfirmation, sendPaymentReminder } from "@/lib/emails";
import { sendPaymentReceivedEmail } from "@/lib/services/email-service";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import Stripe from "stripe";

// Utiliser le service role pour bypasser RLS
const supabase = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export async function POST(request: NextRequest) {
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
    } catch (err: any) {
      console.error("[webhook/payments] Signature invalide:", err.message);
      return NextResponse.json({ error: "Signature invalide" }, { status: 400 });
    }

    console.log(`[webhook/payments] Événement reçu: ${event.type}`);

    // Traiter les événements
    switch (event.type) {
      case "payment_intent.succeeded":
        await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;

      case "payment_intent.payment_failed":
        await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      case "payment_intent.canceled":
        await handlePaymentCanceled(event.data.object as Stripe.PaymentIntent);
        break;

      default:
        console.log(`[webhook/payments] Événement non géré: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("[webhook/payments] Erreur:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const metadata = paymentIntent.metadata as unknown as PaymentMetadata;
  const { invoiceId, profileId } = metadata;

  console.log(`[webhook/payments] Paiement réussi: ${paymentIntent.id}`);

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

  // 2. Vérifier si la facture est entièrement payée
  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, montant_total")
    .eq("id", invoiceId)
    .single();

  if (invoice) {
    // Calculer le total payé
    const { data: payments } = await supabase
      .from("payments")
      .select("montant")
      .eq("invoice_id", invoiceId)
      .eq("statut", "succeeded");

    const totalPaid = (payments || []).reduce((sum, p: any) => sum + Number(p.montant), 0);

    // Si entièrement payé, mettre à jour le statut de la facture
    if (totalPaid >= invoice.montant_total) {
      await supabase
        .from("invoices")
        .update({ statut: "paid" })
        .eq("id", invoiceId);

      console.log(`[webhook/payments] Facture ${invoiceId} marquée comme payée`);

      // 3. Générer la quittance
      await generateReceipt(invoiceId, payment.id);
    }
  }

  // 4. Envoyer une notification au propriétaire
  if (metadata.propertyId) {
    const { data: property } = await supabase
      .from("properties")
      .select(`
        owner_id,
        adresse_complete,
        owner:profiles!properties_owner_id_fkey(
          id, prenom, nom, user_id
        )
      `)
      .eq("id", metadata.propertyId)
      .single();

    if (property) {
      await supabase.from("notifications").insert({
        profile_id: property.owner_id,
        type: "payment_received",
        title: "Paiement reçu",
        message: `Un paiement de ${formatAmountFromStripe(paymentIntent.amount)}€ a été reçu.`,
        data: { invoiceId, paymentId: payment.id },
      });

      // Envoyer l'email de notification au propriétaire
      try {
        const ownerProfile = property.owner as any;
        if (ownerProfile?.user_id) {
          const { data: ownerAuth } = await supabase.auth.admin.getUserById(ownerProfile.user_id);

          if (ownerAuth?.user?.email) {
            // Récupérer les infos du locataire pour l'email
            const { data: tenantProfile } = await supabase
              .from("profiles")
              .select("prenom, nom")
              .eq("id", profileId)
              .single();

            const ownerName = `${ownerProfile.prenom || ""} ${ownerProfile.nom || ""}`.trim() || "Propriétaire";
            const tenantName = tenantProfile
              ? `${tenantProfile.prenom || ""} ${tenantProfile.nom || ""}`.trim() || "Locataire"
              : "Locataire";

            await sendPaymentReceivedEmail(
              ownerAuth.user.email,
              ownerName,
              tenantName,
              formatAmountFromStripe(paymentIntent.amount),
              property.adresse_complete || "Non spécifiée",
              invoice?.periode || "N/A",
              format(new Date(), "d MMMM yyyy", { locale: fr }),
              `${process.env.NEXT_PUBLIC_APP_URL}/owner/money`
            );
            console.log(`[webhook/payments] Email paiement reçu envoyé au propriétaire ${ownerAuth.user.email}`);
          }
        }
      } catch (ownerEmailError) {
        // Ne pas bloquer si l'email échoue
        console.error("[webhook/payments] Erreur envoi email propriétaire:", ownerEmailError);
      }
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
          amount: formatAmountFromStripe(paymentIntent.amount),
          paymentDate: format(new Date(), "d MMMM yyyy", { locale: fr }),
          paymentMethod: "Carte bancaire",
          period: invoice?.periode || "N/A",
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

async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
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
  if (metadata.profileId) {
    await supabase.from("notifications").insert({
      profile_id: metadata.profileId,
      type: "payment_failed",
      title: "Paiement échoué",
      message: "Votre paiement n'a pas pu être traité. Veuillez réessayer.",
      data: { invoiceId: metadata.invoiceId },
    });
  }
}

async function handlePaymentCanceled(paymentIntent: Stripe.PaymentIntent) {
  console.log(`[webhook/payments] Paiement annulé: ${paymentIntent.id}`);

  // Supprimer ou annuler le paiement en attente
  await supabase
    .from("payments")
    .delete()
    .eq("provider_ref", paymentIntent.id)
    .eq("statut", "pending");
}

async function generateReceipt(invoiceId: string, paymentId: string) {
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
  const { error } = await supabase.from("documents").insert({
    type: "quittance",
    owner_id: invoice.owner_id,
    tenant_id: invoice.tenant_id,
    property_id: (invoice.leases as any)?.property_id,
    lease_id: invoice.lease_id,
    title: `Quittance ${invoice.periode}`,
    metadata: {
      invoiceId,
      paymentId,
      periode: invoice.periode,
      montant: invoice.montant_total,
      generated_at: new Date().toISOString(),
    },
    storage_path: `quittances/${invoice.tenant_id}/${invoiceId}.pdf`,
  });

  if (error) {
    console.error("[webhook/payments] Erreur création quittance:", error);
  }

  // TODO: Générer le PDF réel via une Edge Function
}

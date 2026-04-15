export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getRateLimiterByUser, rateLimitPresets } from "@/lib/middleware/rate-limit";
import { stripe, formatAmountFromStripe } from "@/lib/stripe";
import { sendPaymentConfirmation } from "@/lib/services/email-service";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { z } from "zod";
import { ensureReceiptDocument } from "@/lib/services/final-documents.service";
import { syncInvoiceStatusFromPayments } from "@/lib/services/invoice-status.service";
import { getServiceClient } from "@/lib/supabase/service-client";
import { getTenantInvoicePaymentContext } from "@/lib/payments/tenant-payment-flow";

/**
 * Zod schema for payment confirmation
 * @version 2026-01-22 - Added Zod validation for security
 */
const confirmPaymentSchema = z.object({
  paymentIntentId: z.string().min(1, "paymentIntentId requis").regex(/^pi_/, "Format paymentIntentId invalide"),
  invoiceId: z.string().uuid("invoiceId doit être un UUID valide"),
});

/**
 * POST /api/payments/confirm - Route legacy de reconciliation post-paiement
 * @version 2026-03-13 - Restreinte au role de fallback; le flux canonique passe par le webhook Stripe
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const serviceClient = getServiceClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Rate limiting pour les paiements
    const limiter = getRateLimiterByUser(rateLimitPresets.payment);
    const limitResult = limiter(user.id);
    if (!limitResult.allowed) {
      return NextResponse.json(
        {
          error: "Trop de requêtes. Veuillez réessayer plus tard.",
          resetAt: limitResult.resetAt,
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": rateLimitPresets.payment.maxRequests.toString(),
            "X-RateLimit-Remaining": limitResult.remaining.toString(),
            "X-RateLimit-Reset": limitResult.resetAt.toString(),
          },
        }
      );
    }

    // Parse and validate request body with Zod
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
    }

    const parseResult = confirmPaymentSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation échouée", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { paymentIntentId, invoiceId } = parseResult.data;

    // Récupérer le profil utilisateur
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role, prenom, nom, email:user_id")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const paymentContext = await getTenantInvoicePaymentContext(invoiceId, profile.id);

    if (!paymentContext) {
      return NextResponse.json({ error: "Facture non trouvée" }, { status: 404 });
    }

    if (profile.role === "tenant" && !paymentContext.canTenantPay) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    // Vérifier le Payment Intent avec Stripe
    let paymentAmount = 0;
    let paymentStatus = "succeeded";
    let paymentMethod = "cb";

    if (process.env.STRIPE_SECRET_KEY) {
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        if (paymentIntent.status !== "succeeded") {
          return NextResponse.json(
            { error: `Paiement ${paymentIntent.status}` },
            { status: 400 }
          );
        }

        const metadataInvoiceId =
          paymentIntent.metadata?.invoice_id || paymentIntent.metadata?.invoiceId;
        const metadataProfileId =
          paymentIntent.metadata?.profile_id || paymentIntent.metadata?.profileId;
        const metadataUserId =
          paymentIntent.metadata?.user_id || paymentIntent.metadata?.userId;

        if (metadataInvoiceId && metadataInvoiceId !== invoiceId) {
          return NextResponse.json(
            { error: "Le paiement Stripe ne correspond pas a cette facture" },
            { status: 409 }
          );
        }

        if (profile.role === "tenant" && metadataProfileId && metadataProfileId !== profile.id) {
          return NextResponse.json(
            { error: "Le paiement Stripe ne correspond pas a ce locataire" },
            { status: 403 }
          );
        }

        if (metadataUserId && metadataUserId !== user.id) {
          return NextResponse.json(
            { error: "Le paiement Stripe ne correspond pas a cet utilisateur" },
            { status: 403 }
          );
        }

        paymentAmount = formatAmountFromStripe(paymentIntent.amount);
        paymentStatus = paymentIntent.status;
        
        // Déterminer la méthode de paiement
        if (paymentIntent.payment_method_types?.length > 0) {
          const methodType = paymentIntent.payment_method_types[0];
          paymentMethod = methodType === "card" ? "cb" : methodType;
        }
      } catch (stripeError: any) {
        console.error("[confirm] Erreur Stripe:", stripeError.message);
        return NextResponse.json(
          { error: "Erreur de vérification du paiement" },
          { status: 400 }
        );
      }
    } else {
      // Mode simulation si Stripe non configuré
      console.warn("[confirm] Stripe non configuré - Mode simulation");
      
      // Récupérer le montant depuis la facture
      const { data: invoice } = await supabase
        .from("invoices")
        .select("montant_total")
        .eq("id", invoiceId)
        .single();
      
      paymentAmount = invoice?.montant_total || 0;
    }

    if (paymentAmount > paymentContext.remainingAmount && paymentContext.remainingAmount > 0) {
      return NextResponse.json(
        { error: "Le montant confirme depasse le solde restant de la facture" },
        { status: 409 }
      );
    }

    // Mettre à jour le paiement existant ou en créer un nouveau
    const { data: existingPayment } = await serviceClient
      .from("payments")
      .select("id")
      .eq("provider_ref", paymentIntentId)
      .eq("invoice_id", invoiceId)
      .single();

    let payment;

    if (existingPayment) {
      // Mettre à jour le paiement existant
      const { data, error } = await supabase
        .from("payments")
        .update({
          statut: paymentStatus,
          date_paiement: new Date().toISOString().split("T")[0],
        })
        .eq("id", existingPayment.id)
        .select()
        .single();

      if (error) throw error;
      payment = data;
    } else {
      // Créer un nouvel enregistrement de paiement
      const { data, error } = await supabase
        .from("payments")
        .insert({
          invoice_id: invoiceId,
          montant: paymentAmount,
          moyen: paymentMethod,
          provider_ref: paymentIntentId,
          statut: paymentStatus,
          date_paiement: new Date().toISOString().split("T")[0],
        } as any)
        .select()
        .single();

      if (error) throw error;
      payment = data;
    }

    // Mettre à jour le statut de la facture
    const { data: invoice } = await serviceClient
      .from("invoices")
      .select("montant_total, periode")
      .eq("id", invoiceId)
      .single();

    if (invoice) {
      // `invoices.date_paiement` est de type DATE — on passe YYYY-MM-DD
      // plutôt qu'un timestamp ISO pour éviter une coercition silencieuse.
      const settlement = await syncInvoiceStatusFromPayments(
        serviceClient as any,
        invoiceId,
        new Date().toISOString().split("T")[0]
      );

      if (settlement?.isSettled && payment?.id) {
        try {
          await ensureReceiptDocument(serviceClient as any, payment.id);
        } catch (receiptError) {
          console.error("[confirm] Erreur génération quittance:", receiptError);
        }

        // Post the matching `rent_received` double-entry for off-Stripe
        // payments. Idempotent: skipped if an entry with
        // reference=payment_id already exists.
        try {
          const { ensureReceiptAccountingEntry } = await import(
            "@/lib/accounting/receipt-entry"
          );
          await ensureReceiptAccountingEntry(serviceClient as any, payment.id);
        } catch (entryError) {
          console.error(
            "[confirm] Écriture comptable (non bloquante):",
            entryError,
          );
        }
      }

      // Envoyer l'email de confirmation
      const paymentMethodLabel = {
        cb: "Carte bancaire",
        virement: "Virement",
        prelevement: "Prélèvement",
      }[paymentMethod] || "Carte bancaire";

      try {
        await sendPaymentConfirmation({
          tenantEmail: user.email!,
          tenantName: `${profile.prenom || ""} ${profile.nom || ""}`.trim() || "Locataire",
          amount: paymentAmount,
          paymentDate: format(new Date(), "d MMMM yyyy", { locale: fr }),
          paymentMethod: paymentMethodLabel,
          period: invoice.periode,
          paymentId: payment.id,
        });
      } catch (emailError) {
        // Ne pas bloquer si l'email échoue
        console.error("[confirm] Erreur envoi email:", emailError);
      }
    }

    return NextResponse.json({ 
      success: true, 
      payment,
      source: "legacy_confirm_route",
      message: "Paiement confirmé avec succès"
    });
  } catch (error: unknown) {
    console.error("[confirm] Erreur:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

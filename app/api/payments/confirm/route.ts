export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getRateLimiterByUser, rateLimitPresets } from "@/lib/middleware/rate-limit";
import { stripe, formatAmountFromStripe } from "@/lib/stripe";
import { sendPaymentConfirmation } from "@/lib/emails";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
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

    const body = await request.json();
    const { paymentIntentId, invoiceId } = body;

    if (!paymentIntentId || !invoiceId) {
      return NextResponse.json(
        { error: "paymentIntentId et invoiceId requis" },
        { status: 400 }
      );
    }

    // Récupérer le profil utilisateur
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, prenom, nom, email:user_id")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
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

    // Mettre à jour le paiement existant ou en créer un nouveau
    const { data: existingPayment } = await supabase
      .from("payments")
      .select("id")
      .eq("provider_ref", paymentIntentId)
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
    const { data: invoice } = await supabase
      .from("invoices")
      .select("montant_total, periode")
      .eq("id", invoiceId)
      .single();

    if (invoice) {
      // Vérifier le total payé
      const { data: payments } = await supabase
        .from("payments")
        .select("montant")
        .eq("invoice_id", invoiceId)
        .eq("statut", "succeeded");

      const totalPaid = (payments || []).reduce(
        (sum, p: any) => sum + Number(p.montant),
        0
      );

      if (totalPaid >= invoice.montant_total) {
        await supabase
          .from("invoices")
          .update({ statut: "paid" } as any)
          .eq("id", invoiceId as any);
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
      message: "Paiement confirmé avec succès"
    });
  } catch (error: any) {
    console.error("[confirm] Erreur:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

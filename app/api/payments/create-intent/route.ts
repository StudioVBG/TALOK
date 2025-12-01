// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe, formatAmountForStripe, type PaymentMetadata } from "@/lib/stripe";
import { z } from "zod";

const createIntentSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().default("eur"),
});

export async function POST(request: NextRequest) {
  try {
    // Authentification
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Récupérer le profil
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // Valider les données
    const body = await request.json();
    const { invoiceId, amount, currency } = createIntentSchema.parse(body);

    // Récupérer la facture pour vérifier les permissions
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("*, leases(property_id)")
      .eq("id", invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: "Facture non trouvée" }, { status: 404 });
    }

    // Vérifier que le locataire peut payer cette facture
    if (profile.role === "tenant" && invoice.tenant_id !== profile.id) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    // Créer le Payment Intent Stripe
    const metadata: PaymentMetadata = {
      invoiceId,
      userId: user.id,
      profileId: profile.id,
      leaseId: invoice.lease_id,
      propertyId: (invoice.leases as any)?.property_id,
      type: "rent",
    };

    const paymentIntent = await stripe.paymentIntents.create({
      amount: formatAmountForStripe(amount),
      currency,
      metadata: metadata as any,
      automatic_payment_methods: {
        enabled: true,
      },
      description: `Paiement facture ${invoiceId.slice(0, 8)}`,
    });

    // Créer un enregistrement de paiement en attente
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        invoice_id: invoiceId,
        montant: amount,
        moyen: "cb",
        provider_ref: paymentIntent.id,
        statut: "pending",
      })
      .select()
      .single();

    if (paymentError) {
      console.error("[create-intent] Erreur création paiement:", paymentError);
      // Annuler le Payment Intent si la DB échoue
      await stripe.paymentIntents.cancel(paymentIntent.id);
      return NextResponse.json({ error: "Erreur lors de la création du paiement" }, { status: 500 });
    }

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      paymentId: payment.id,
    });
  } catch (error: any) {
    console.error("[create-intent] Erreur:", error);
    
    if (error.name === "ZodError") {
      return NextResponse.json({ error: "Données invalides", details: error.errors }, { status: 400 });
    }
    
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

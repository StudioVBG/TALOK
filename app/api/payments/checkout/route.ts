export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";

/**
 * Zod schema for checkout session creation
 * @version 2026-01-22 - Added Zod validation for security
 */
const checkoutSchema = z.object({
  invoiceId: z.string().uuid("invoiceId doit être un UUID valide"),
});

/**
 * POST /api/payments/checkout - Créer une session Stripe Checkout
 * @version 2026-01-22 - Added Zod validation
 */
export async function POST(request: Request) {
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2024-10-28.acacia",
    });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Parse and validate request body with Zod
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
    }

    const parseResult = checkoutSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation échouée", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { invoiceId } = parseResult.data;

    // Récupérer les détails de la facture et du bien
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select(`
        *,
        lease:leases (
          id,
          property:properties (
            adresse_complete,
            ville
          )
        )
      `)
      .eq("id", invoiceId)
      .eq("tenant_id", (await supabase.from("profiles").select("id").eq("user_id", user.id).single()).data?.id)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: "Facture non trouvée ou accès refusé" }, { status: 404 });
    }

    if (invoice.statut === "paid") {
      return NextResponse.json({ error: "Cette facture est déjà payée" }, { status: 400 });
    }

    // Créer la session Stripe Checkout
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card", "sepa_debit"],
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: `Loyer ${invoice.periode}`,
              description: `Paiement pour le bien situé au ${invoice.lease.property.adresse_complete}, ${invoice.lease.property.ville}`,
            },
            unit_amount: Math.round(invoice.montant_total * 100), // Stripe utilise les centimes
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/tenant/payments?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/tenant/payments?canceled=true`,
      metadata: {
        invoice_id: invoiceId,
        lease_id: invoice.lease.id,
        tenant_id: invoice.tenant_id,
        type: "rent_payment",
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error: unknown) {
    console.error("[Stripe Checkout] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur lors de la création de la session de paiement" },
      { status: 500 }
    );
  }
}


export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";
import { isLegacyTenantPaymentRouteEnabled } from "@/lib/payments/tenant-payment-flow";

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
    if (!isLegacyTenantPaymentRouteEnabled()) {
      return NextResponse.json(
        {
          error:
            "Route legacy desactivee. Utilisez /api/payments/create-intent pour le flux canonique locataire.",
          deprecated: true,
          canonical_route: "/api/payments/create-intent",
        },
        {
          status: 410,
          headers: { "X-TALOK-Legacy-Route": "payments-checkout" },
        }
      );
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2024-10-28.acacia" as any,
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

    // Service-role pour la lecture : la RLS sur leases/properties cascadait
    // silencieusement et faisait apparaître les factures du locataire comme
    // "non trouvées" alors qu'il en était bien le tenant_id légitime.
    // La sécurité est garantie par le check explicite tenant_id ci-dessous.
    // Voir docs/audits/rls-cascade-audit.md.
    const serviceClient = getServiceClient();

    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }
    const profileData = profile as { id: string; role: string };

    const { data: invoice } = await serviceClient
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
      .maybeSingle();

    if (!invoice) {
      return NextResponse.json({ error: "Facture non trouvée" }, { status: 404 });
    }

    const invoiceData = invoice as Record<string, unknown> & {
      tenant_id?: string | null;
      statut?: string | null;
    };

    const isAdmin = profileData.role === "admin";
    const isTenant = invoiceData.tenant_id === profileData.id;
    if (!isAdmin && !isTenant) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    if (invoiceData.statut === "paid") {
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
              description: `Paiement pour le bien situé au ${invoice.lease.property?.adresse_complete}, ${invoice.lease.property?.ville}`,
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


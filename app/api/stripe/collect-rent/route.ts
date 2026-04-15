export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/stripe/collect-rent
 *
 * Déclenche un prélèvement SEPA pour un loyer dû.
 * Vérifie que le propriétaire a un plan avec hasRentCollection (tenant_payment_online).
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { sepaService } from "@/lib/stripe/sepa.service";
import { withFeatureAccess } from "@/lib/middleware/subscription-check";
import { z } from "zod";

const collectRentSchema = z.object({
  invoice_id: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    // Récupérer le profil propriétaire
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.role !== "owner") {
      return NextResponse.json(
        { error: "Seuls les propriétaires peuvent collecter les loyers" },
        { status: 403 }
      );
    }

    // Vérifier le plan — hasRentCollection (tenant_payment_online)
    const featureCheck = await withFeatureAccess(profile.id, "tenant_payment_online");
    if (!featureCheck.allowed) {
      return NextResponse.json(
        {
          error: featureCheck.message,
          code: "FEATURE_NOT_AVAILABLE",
          requiredPlan: featureCheck.requiredPlan,
          upgrade_url: "/owner/money?tab=forfait",
        },
        { status: 403 }
      );
    }

    // Valider les données
    const body = await request.json();
    const { invoice_id } = collectRentSchema.parse(body);

    const serviceClient = createServiceRoleClient();

    // Récupérer la facture et vérifier qu'elle appartient au propriétaire
    const { data: invoice, error: invoiceError } = await serviceClient
      .from("invoices")
      .select(`
        id, montant_total, statut, tenant_id, owner_id, lease_id, periode,
        lease:leases(
          id,
          property:properties(
            id, adresse_complete, owner_id
          )
        )
      `)
      .eq("id", invoice_id)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: "Facture non trouvée" }, { status: 404 });
    }

    if (invoice.owner_id !== profile.id) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    if (invoice.statut === "paid" || invoice.statut === "settled") {
      return NextResponse.json(
        { error: "Cette facture est déjà réglée" },
        { status: 409 }
      );
    }

    // Trouver le mandat SEPA actif du locataire pour ce bail
    const { data: mandate } = await serviceClient
      .from("sepa_mandates")
      .select("id, stripe_customer_id, stripe_payment_method_id, status")
      .eq("lease_id", invoice.lease_id)
      .eq("tenant_profile_id", invoice.tenant_id)
      .eq("status", "active")
      .maybeSingle();

    if (!mandate?.stripe_customer_id || !mandate?.stripe_payment_method_id) {
      return NextResponse.json(
        {
          error: "Aucun mandat SEPA actif pour ce locataire. Le locataire doit d'abord configurer son prélèvement.",
          code: "NO_ACTIVE_MANDATE",
        },
        { status: 409 }
      );
    }

    // Montant en centimes
    const amountCents = Math.round((invoice.montant_total || 0) * 100);
    if (amountCents <= 0) {
      return NextResponse.json({ error: "Montant invalide" }, { status: 400 });
    }

    // Créer le prélèvement SEPA
    const paymentResult = await sepaService.createSepaPayment({
      customerId: mandate.stripe_customer_id,
      paymentMethodId: mandate.stripe_payment_method_id,
      amount: amountCents,
      currency: "eur",
      description: `Loyer ${invoice.periode} — ${(invoice.lease as any)?.property?.adresse_complete || 'Logement'}`,
      metadata: {
        invoice_id: invoice.id,
        lease_id: invoice.lease_id || "",
        tenant_id: invoice.tenant_id || "",
        owner_id: profile.id,
        type: "rent",
      },
    });

    // Enregistrer le paiement en DB.
    // `payments.moyen` CHECK ∈ (cb, virement, prelevement, especes, cheque,
    // autre) — un prélèvement SEPA est stocké sous `'prelevement'`.
    // `payments.date_paiement` est de type DATE ; on passe YYYY-MM-DD (pas
    // un timestamp ISO complet).
    await serviceClient.from("payments").insert({
      invoice_id: invoice.id,
      montant: invoice.montant_total,
      moyen: "prelevement",
      provider_ref: paymentResult.id,
      statut: paymentResult.status === "succeeded" ? "succeeded" : "pending",
      date_paiement: new Date().toISOString().split("T")[0],
    });

    // Mettre à jour la facture avec la référence Stripe
    await serviceClient
      .from("invoices")
      .update({ stripe_payment_intent_id: paymentResult.id })
      .eq("id", invoice.id);

    return NextResponse.json({
      success: true,
      payment_intent_id: paymentResult.id,
      status: paymentResult.status,
      amount: paymentResult.amount,
    });
  } catch (error: unknown) {
    if ((error as any).name === "ZodError") {
      return NextResponse.json(
        { error: "Données invalides", details: (error as any).errors },
        { status: 400 }
      );
    }
    console.error("[collect-rent] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

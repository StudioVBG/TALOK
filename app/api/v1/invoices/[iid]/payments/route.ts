export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import {
  apiError,
  apiSuccess,
  requireAuth,
  validateBody,
  logAudit,
  checkIdempotency,
  storeIdempotency,
} from "@/lib/api/middleware";
import { CreatePaymentSchema } from "@/lib/api/schemas";
import { isLegacyTenantPaymentRouteEnabled } from "@/lib/payments/tenant-payment-flow";

interface RouteParams {
  params: Promise<{ iid: string }>;
}

/**
 * POST /api/v1/invoices/:iid/payments
 * Create payment intent for an invoice
 * Events: Payment.IntentCreated
 * Requires: Idempotency-Key header
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    if (!isLegacyTenantPaymentRouteEnabled()) {
      return NextResponse.json(
        {
          error:
            "API v1 gelee. Utilisez /api/payments/create-intent pour le flux canonique locataire.",
          deprecated: true,
          canonical_route: "/api/payments/create-intent",
        },
        {
          status: 410,
          headers: { "X-TALOK-Legacy-Route": "api-v1-invoice-payments" },
        }
      );
    }

    const { iid } = await params;
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;

    // Service-role pour la lecture : la cascade RLS invoices → leases →
    // properties faisait disparaître les factures du locataire légitime
    // (jointures !inner). Sécurité garantie par le check tenant_id /
    // owner / admin ci-dessous. Voir docs/audits/rls-cascade-audit.md.
    const supabase = getServiceClient();

    // Require idempotency key for payment operations
    const idempotencyKey = request.headers.get("Idempotency-Key");
    if (!idempotencyKey) {
      return apiError("Idempotency-Key header required for payment operations", 400, "IDEMPOTENCY_REQUIRED");
    }

    // Check idempotency
    const cached = await checkIdempotency(supabase, idempotencyKey, "payment");
    if (cached) {
      return new Response(JSON.stringify(cached.cached.response_body), {
        status: cached.cached.response_status,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get invoice (no !inner: keep the row even if RLS would have stripped
    // a child; the business check below validates access).
    const { data: invoice } = await supabase
      .from("invoices")
      .select(`
        *,
        leases(
          id,
          properties(adresse_complete, owner_id)
        )
      `)
      .eq("id", iid)
      .maybeSingle();

    if (!invoice) {
      return apiError("Facture non trouvée", 404);
    }

    // Explicit business check: tenant of the invoice, owner of the
    // underlying property, or admin.
    const isAdmin = auth.profile.role === "admin";
    const isTenant = invoice.tenant_id === auth.profile.id;
    const isOwner =
      invoice.leases?.properties?.owner_id === auth.profile.id;

    if (!isAdmin && !isTenant && !isOwner) {
      return apiError("Accès non autorisé", 403);
    }

    // Check invoice status
    if (invoice.statut === "paid") {
      return apiError("Cette facture est déjà payée", 400, "ALREADY_PAID");
    }

    const body = await request.json();
    const { data, error: validationError } = validateBody(CreatePaymentSchema, body);

    if (validationError) return validationError;

    // Calculate remaining amount
    const { data: existingPayments } = await supabase
      .from("payments")
      .select("montant")
      .eq("invoice_id", iid)
      .eq("statut", "succeeded");

    const paidAmount = (existingPayments || []).reduce(
      (sum, p) => sum + Number(p.montant || 0),
      0
    );
    const remainingAmount = Number(invoice.montant_total) - paidAmount;

    if (data.montant > remainingAmount) {
      return apiError(`Montant maximum: ${remainingAmount} €`, 400, "AMOUNT_EXCEEDS_DUE");
    }

    // Create payment record
    const { data: payment, error } = await supabase
      .from("payments")
      .insert({
        invoice_id: iid,
        montant: data.montant,
        moyen: data.moyen,
        statut: "pending",
      })
      .select()
      .single();

    if (error) {
      console.error("[POST /payments] Error:", error);
      return apiError("Erreur lors de la création", 500);
    }

    // TODO: Create Stripe/GoCardless payment intent
    // For now, simulate payment intent
    const providerIntentId = `pi_${crypto.randomUUID().replace(/-/g, "")}`;

    // Update payment with provider reference
    await supabase
      .from("payments")
      .update({ provider_ref: providerIntentId })
      .eq("id", payment.id);

    // Emit event
    await supabase.from("outbox").insert({
      event_type: "Payment.IntentCreated",
      payload: {
        payment_id: payment.id,
        invoice_id: iid,
        amount: data.montant,
        provider_intent_id: providerIntentId,
      },
    });

    // Audit log
    await logAudit(
      supabase,
      "payment.intent_created",
      "payments",
      payment.id,
      auth.user.id,
      null,
      payment
    );

    const response = {
      payment_id: payment.id,
      provider_intent_id: providerIntentId,
      amount: data.montant,
      status: "pending",
      // TODO: Add Stripe checkout URL or client secret
      checkout_url: data.return_url
        ? `${data.return_url}?payment_id=${payment.id}`
        : null,
    };

    // Store idempotency
    await storeIdempotency(supabase, idempotencyKey, "payment", response, 201);

    return apiSuccess(response, 201);
  } catch (error: unknown) {
    console.error("[POST /payments] Error:", error);
    return apiError("Erreur serveur", 500);
  }
}


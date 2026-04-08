export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import {
  createRentPaymentIntent,
  getOwnerConnectAccount,
} from "@/lib/payments/rent-collection.service";
import {
  getTenantInvoicePaymentContext,
  isInvoicePayableStatus,
} from "@/lib/payments/tenant-payment-flow";
import { withFeatureAccess, createSubscriptionErrorResponse } from "@/lib/middleware/subscription-check";
import type { PlanSlug } from "@/lib/subscriptions/plans";

const schema = z.object({
  invoiceId: z.string().uuid(),
  stripeCustomerId: z.string().min(1),
  stripePaymentMethodId: z.string().min(1),
});

/**
 * POST /api/payments/create-rent-intent
 *
 * Create a Stripe PaymentIntent for rent collection via Connect Express.
 * SEPA only. Requires tenant auth + active Connect account on owner side.
 */
export async function POST(request: NextRequest) {
  try {
    // Auth
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new ApiError(401, "Non authentifié");
    }

    const serviceClient = getServiceClient();

    // Profile
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      throw new ApiError(404, "Profil non trouvé");
    }

    const typedProfile = profile as { id: string; role: string };

    // Validate body
    const body = await request.json();
    const { invoiceId, stripeCustomerId, stripePaymentMethodId } =
      schema.parse(body);

    // Payment context (amounts, authorization)
    const paymentContext = await getTenantInvoicePaymentContext(
      invoiceId,
      typedProfile.id
    );

    if (!paymentContext) {
      throw new ApiError(404, "Facture non trouvée");
    }

    if (typedProfile.role === "tenant" && !paymentContext.canTenantPay) {
      throw new ApiError(403, "Accès non autorisé");
    }

    if (!isInvoicePayableStatus(paymentContext.status)) {
      throw new ApiError(409, "Cette facture n'est pas payable dans son état actuel");
    }

    if (paymentContext.isAlreadySettled || paymentContext.remainingAmount <= 0) {
      throw new ApiError(409, "Cette facture est déjà réglée");
    }

    // Get invoice details for owner
    const { data: invoice } = await serviceClient
      .from("invoices")
      .select("owner_id, lease_id")
      .eq("id", invoiceId)
      .single();

    if (!invoice) {
      throw new ApiError(404, "Facture non trouvée");
    }

    const typedInvoice = invoice as { owner_id: string; lease_id: string };

    // Feature gate: hasRentCollection
    const featureCheck = await withFeatureAccess(typedInvoice.owner_id, "tenant_payment_online");
    if (!featureCheck.allowed) {
      return createSubscriptionErrorResponse(featureCheck);
    }

    // Get owner's plan for commission calculation
    const { data: subscription } = await serviceClient
      .from("subscriptions")
      .select("plan_slug")
      .eq("owner_id", typedInvoice.owner_id)
      .maybeSingle();

    const ownerPlanSlug =
      ((subscription as { plan_slug?: string } | null)?.plan_slug as PlanSlug) || "gratuit";

    // Verify Connect account
    const connectAccount = await getOwnerConnectAccount(typedInvoice.owner_id);
    if (!connectAccount?.chargesEnabled) {
      throw new ApiError(
        422,
        "Le propriétaire n'a pas encore activé la collecte automatique des loyers"
      );
    }

    // Create rent payment intent (SEPA via Connect)
    const amountCents = Math.round(paymentContext.remainingAmount * 100);

    const result = await createRentPaymentIntent({
      invoiceId,
      leaseId: typedInvoice.lease_id,
      tenantId: typedProfile.id,
      ownerId: typedInvoice.owner_id,
      amountCents,
      stripeCustomerId,
      stripePaymentMethodId,
      ownerPlanSlug,
    });

    if (!result.success) {
      throw new ApiError(502, result.error || "Erreur lors de la création du paiement");
    }

    return NextResponse.json({
      paymentIntentId: result.paymentIntentId,
      clientSecret: result.clientSecret,
      rentPaymentId: result.rentPaymentId,
      commissionCents: result.commissionCents,
      ownerAmountCents: result.ownerAmountCents,
    });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getServiceClient } from "@/lib/supabase/service-client";
import { handleApiError } from "@/lib/helpers/api-error";
import { requireAdminPermissions, isAdminAuthError } from "@/lib/middleware/admin-rbac";
import { validateCsrfFromRequestDetailed, logCsrfFailure } from "@/lib/security/csrf";
import {
  refundDisputedPayment,
  releaseDisputedPayment,
  DisputeError,
} from "@/lib/work-orders/dispute";

/**
 * PATCH /api/admin/work-order-disputes/[id]
 *
 * Admin résout un litige.
 *   action='refund' (full ou partiel) — Stripe Refund au proprio
 *   action='release' — libération vers prestataire (le proprio est débouté)
 *
 * Permission: admin.moderation.write
 */

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("refund"),
    refund_amount_cents: z.number().int().positive().optional(), // si absent, full
    notes: z.string().optional(),
  }),
  z.object({
    action: z.literal("release"),
    notes: z.string().optional(),
  }),
]);

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const csrf = await validateCsrfFromRequestDetailed(request);
    if (!csrf.valid) {
      await logCsrfFailure(request, csrf.reason!, "admin.work_order_disputes.resolve");
      return NextResponse.json({ error: "Token CSRF invalide" }, { status: 403 });
    }

    const auth = await requireAdminPermissions(
      request,
      ["admin.moderation.write"],
      { rateLimit: "adminCritical", auditAction: "Litige work-order résolu" },
    );
    if (isAdminAuthError(auth)) return auth;

    const serviceClient = getServiceClient();
    const { id: disputeId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const input = schema.parse(body);

    if (input.action === "refund") {
      const result = await refundDisputedPayment(serviceClient, disputeId, {
        refundAmountCents: input.refund_amount_cents,
        resolvedByProfileId: auth.profile.id,
        notes: input.notes,
      });
      return NextResponse.json({
        success: true,
        stripe_refund_id: result.stripeRefundId,
        refund_amount_cents: result.refundAmountCents,
      });
    } else {
      const result = await releaseDisputedPayment(
        serviceClient,
        disputeId,
        auth.profile.id,
        input.notes,
      );
      return NextResponse.json({ success: true, payment_id: result.paymentId });
    }
  } catch (error) {
    if (error instanceof DisputeError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 },
      );
    }
    return handleApiError(error);
  }
}

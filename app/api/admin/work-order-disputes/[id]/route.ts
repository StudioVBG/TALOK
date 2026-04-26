export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { getServiceClient } from "@/lib/supabase/service-client";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { withSecurity } from "@/lib/api/with-security";
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

export const PATCH = withSecurity(
  async function PATCH(
    request: Request,
    context: { params: Promise<{ id: string }> },
  ) {
    try {
      const { user, error: authError } = await getAuthenticatedUser(request);
      if (authError) throw new ApiError(authError.status || 401, authError.message);
      if (!user) throw new ApiError(401, "Non authentifié");

      const serviceClient = getServiceClient();
      const { data: profile } = await serviceClient
        .from("profiles")
        .select("id, role")
        .eq("user_id", user.id)
        .maybeSingle();

      const profileRow = profile as { id: string; role: string } | null;
      if (!profileRow || profileRow.role !== "admin") {
        throw new ApiError(403, "Réservé aux admins");
      }

      const { id: disputeId } = await context.params;
      const body = await request.json().catch(() => ({}));
      const input = schema.parse(body);

      if (input.action === "refund") {
        const result = await refundDisputedPayment(serviceClient, disputeId, {
          refundAmountCents: input.refund_amount_cents,
          resolvedByProfileId: profileRow.id,
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
          profileRow.id,
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
  },
  {
    routeName: "PATCH /api/admin/work-order-disputes/[id]",
    csrf: true,
  },
);

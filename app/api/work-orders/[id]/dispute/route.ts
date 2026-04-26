export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { getServiceClient } from "@/lib/supabase/service-client";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { withSecurity } from "@/lib/api/with-security";
import { raiseDispute, withdrawDispute, DisputeError } from "@/lib/work-orders/dispute";

/**
 * POST /api/work-orders/[id]/dispute — owner conteste un paiement
 * DELETE /api/work-orders/[id]/dispute?dispute_id=xxx — owner retire sa contestation
 */

const raiseSchema = z.object({
  payment_id: z.string().uuid(),
  reason: z.enum([
    "work_not_done",
    "work_incomplete",
    "quality_issue",
    "wrong_amount",
    "unauthorized",
    "other",
  ]),
  description: z.string().min(20).max(2000),
  evidence_urls: z.array(z.string().url()).max(10).optional(),
});

export const POST = withSecurity(
  async function POST(
    request: Request,
    context: { params: Promise<{ id: string }> },
  ) {
    try {
      const { user, error: authError } = await getAuthenticatedUser(request);
      if (authError) throw new ApiError(authError.status || 401, authError.message);
      if (!user) throw new ApiError(401, "Non authentifié");

      const { id: workOrderId } = await context.params;
      const body = await request.json().catch(() => ({}));
      const input = raiseSchema.parse(body);

      const serviceClient = getServiceClient();

      // Vérif owner
      const { data: profile } = await serviceClient
        .from("profiles")
        .select("id, role")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!profile) throw new ApiError(404, "Profil non trouvé");
      const profileRow = profile as { id: string; role: string };

      const { data: wo } = await serviceClient
        .from("work_orders")
        .select("id, property_id")
        .eq("id", workOrderId)
        .maybeSingle();
      if (!wo) throw new ApiError(404, "Intervention introuvable");

      if (profileRow.role !== "admin") {
        const { data: property } = await serviceClient
          .from("properties")
          .select("owner_id")
          .eq("id", (wo as { property_id: string }).property_id)
          .maybeSingle();
        const ownerId = (property as { owner_id: string } | null)?.owner_id;
        if (ownerId !== profileRow.id) {
          throw new ApiError(403, "Seul le propriétaire peut contester ce paiement");
        }
      }

      // Vérif que le payment_id appartient bien à ce WO
      const { data: payment } = await serviceClient
        .from("work_order_payments")
        .select("id, work_order_id")
        .eq("id", input.payment_id)
        .maybeSingle();
      if (!payment || (payment as { work_order_id: string }).work_order_id !== workOrderId) {
        throw new ApiError(400, "Le paiement n'appartient pas à cette intervention");
      }

      const result = await raiseDispute(serviceClient, {
        workOrderPaymentId: input.payment_id,
        raisedByProfileId: profileRow.id,
        reason: input.reason,
        description: input.description,
        evidenceUrls: input.evidence_urls,
      });

      return NextResponse.json({ dispute_id: result.disputeId }, { status: 201 });
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
    routeName: "POST /api/work-orders/[id]/dispute",
    csrf: true,
  },
);

export const DELETE = withSecurity(
  async function DELETE(
    request: Request,
    _context: { params: Promise<{ id: string }> },
  ) {
    try {
      const { user, error: authError } = await getAuthenticatedUser(request);
      if (authError) throw new ApiError(authError.status || 401, authError.message);
      if (!user) throw new ApiError(401, "Non authentifié");

      const url = new URL(request.url);
      const disputeId = url.searchParams.get("dispute_id");
      if (!disputeId) throw new ApiError(400, "dispute_id requis");

      const serviceClient = getServiceClient();
      const { data: profile } = await serviceClient
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!profile) throw new ApiError(404, "Profil non trouvé");

      await withdrawDispute(
        serviceClient,
        disputeId,
        (profile as { id: string }).id,
      );

      return NextResponse.json({ success: true });
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
    routeName: "DELETE /api/work-orders/[id]/dispute",
    csrf: true,
  },
);

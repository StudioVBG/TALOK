export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { getServiceClient } from "@/lib/supabase/service-client";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { withSecurity } from "@/lib/api/with-security";

const bodySchema = z.object({
  reason: z.string().min(3).max(500).optional(),
});

/**
 * POST /api/work-orders/[id]/reject-booking
 *
 * Le propriétaire refuse une réservation self-service de son locataire.
 * Bascule :
 *   - owner_approval_status → 'rejected'
 *   - work_order.statut → 'cancelled'
 *   - ticket.statut → 'rejected'
 * Le locataire est notifié avec la raison donnée.
 */
export const POST = withSecurity(
  async function POST(
    request: Request,
    context: { params: Promise<{ id: string }> }
  ) {
    try {
      const { user, error: authError } = await getAuthenticatedUser(request);
      if (authError) throw new ApiError(authError.status || 401, authError.message);
      if (!user) throw new ApiError(401, "Non authentifié");

      const { id: workOrderId } = await context.params;
      const serviceClient = getServiceClient();

      let reason: string | undefined;
      try {
        const body = await request.json();
        const parsed = bodySchema.parse(body ?? {});
        reason = parsed.reason;
      } catch {
        reason = undefined;
      }

      const { data: profile } = await serviceClient
        .from("profiles")
        .select("id, role")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!profile) throw new ApiError(404, "Profil non trouvé");
      const profileData = profile as { id: string; role: string };

      const { data: workOrder } = await serviceClient
        .from("work_orders")
        .select("id, ticket_id, property_id, owner_approval_status, requester_role, title")
        .eq("id", workOrderId)
        .maybeSingle();

      if (!workOrder) throw new ApiError(404, "Intervention introuvable");

      const wo = workOrder as {
        id: string;
        ticket_id: string | null;
        property_id: string;
        owner_approval_status: string;
        requester_role: string | null;
        title: string | null;
      };

      if (wo.owner_approval_status !== "pending") {
        throw new ApiError(
          409,
          `Cette réservation n'est pas en attente de validation (statut : ${wo.owner_approval_status})`
        );
      }

      if (profileData.role !== "admin") {
        const { data: property } = await serviceClient
          .from("properties")
          .select("owner_id")
          .eq("id", wo.property_id)
          .maybeSingle();
        const ownerId = (property as { owner_id: string } | null)?.owner_id;
        if (ownerId !== profileData.id) {
          throw new ApiError(403, "Vous n'êtes pas propriétaire de ce bien");
        }
      }

      const now = new Date().toISOString();

      const { error: updateError } = await serviceClient
        .from("work_orders")
        .update({
          owner_approval_status: "rejected",
          owner_approval_decided_at: now,
          owner_approval_rejection_reason: reason ?? null,
          statut: "cancelled",
        })
        .eq("id", workOrderId);
      if (updateError) throw updateError;

      // Notifier le locataire créateur du ticket
      let tenantUserId: string | null = null;
      let ticketReference: string | null = null;
      if (wo.ticket_id) {
        await serviceClient
          .from("tickets")
          .update({ statut: "rejected", resolution_notes: reason ?? null })
          .eq("id", wo.ticket_id);

        const { data: ticketRow } = await serviceClient
          .from("tickets")
          .select("reference, created_by_profile_id")
          .eq("id", wo.ticket_id)
          .maybeSingle();
        const ticketData = ticketRow as
          | { reference: string | null; created_by_profile_id: string | null }
          | null;
        ticketReference = ticketData?.reference ?? null;

        if (ticketData?.created_by_profile_id) {
          const { data: tenantProfile } = await serviceClient
            .from("profiles")
            .select("user_id")
            .eq("id", ticketData.created_by_profile_id)
            .maybeSingle();
          tenantUserId =
            (tenantProfile as { user_id: string | null } | null)?.user_id ?? null;
        }
      }

      if (tenantUserId) {
        await serviceClient.from("outbox").insert({
          event_type: "TenantService.Rejected",
          payload: {
            ticket_id: wo.ticket_id,
            ticket_reference: ticketReference,
            work_order_id: wo.id,
            title: wo.title,
            reason: reason ?? null,
            recipient_user_id: tenantUserId,
          },
        } as any);
      }

      return NextResponse.json({
        work_order_id: wo.id,
        owner_approval_status: "rejected",
      });
    } catch (error) {
      return handleApiError(error);
    }
  },
  {
    routeName: "POST /api/work-orders/[id]/reject-booking",
    csrf: true,
  }
);

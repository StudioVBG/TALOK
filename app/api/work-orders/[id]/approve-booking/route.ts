export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { getServiceClient } from "@/lib/supabase/service-client";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { withSecurity } from "@/lib/api/with-security";

/**
 * POST /api/work-orders/[id]/approve-booking
 *
 * Le propriétaire valide une réservation initiée par son locataire en
 * self-service (cf. POST /api/tenant/services/request avec
 * requires_owner_approval=true). Une fois approuvé :
 *   - owner_approval_status passe à 'approved'
 *   - le ticket passe en 'assigned'
 *   - le prestataire reçoit la notification WorkOrder.AssignedToProvider
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

      const { data: profile } = await serviceClient
        .from("profiles")
        .select("id, role")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!profile) throw new ApiError(404, "Profil non trouvé");
      const profileData = profile as { id: string; role: string };

      const { data: workOrder } = await serviceClient
        .from("work_orders")
        .select(
          "id, ticket_id, property_id, provider_id, requester_role, owner_approval_status, title, category, date_intervention_prevue"
        )
        .eq("id", workOrderId)
        .maybeSingle();

      if (!workOrder) throw new ApiError(404, "Intervention introuvable");

      const wo = workOrder as {
        id: string;
        ticket_id: string | null;
        property_id: string;
        provider_id: string | null;
        requester_role: string | null;
        owner_approval_status: string;
        title: string | null;
        category: string | null;
        date_intervention_prevue: string | null;
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
          owner_approval_status: "approved",
          owner_approval_decided_at: now,
        })
        .eq("id", workOrderId);
      if (updateError) throw updateError;

      if (wo.ticket_id) {
        await serviceClient
          .from("tickets")
          .update({ statut: "assigned" })
          .eq("id", wo.ticket_id);
      }

      // Notifier le prestataire — ce qui n'avait pas été fait à la création
      // puisque la réservation était en attente.
      let providerUserId: string | null = null;
      if (wo.provider_id) {
        const { data: providerProfile } = await serviceClient
          .from("profiles")
          .select("user_id")
          .eq("id", wo.provider_id)
          .maybeSingle();
        providerUserId =
          (providerProfile as { user_id: string | null } | null)?.user_id ?? null;
      }

      let ticketReference: string | null = null;
      if (wo.ticket_id) {
        const { data: ticketRow } = await serviceClient
          .from("tickets")
          .select("reference")
          .eq("id", wo.ticket_id)
          .maybeSingle();
        ticketReference =
          (ticketRow as { reference: string | null } | null)?.reference ?? null;
      }

      if (providerUserId) {
        await serviceClient.from("outbox").insert({
          event_type: "WorkOrder.AssignedToProvider",
          payload: {
            ticket_id: wo.ticket_id,
            ticket_reference: ticketReference,
            work_order_id: wo.id,
            title: wo.title,
            category: wo.category,
            preferred_date: wo.date_intervention_prevue,
            recipient_user_id: providerUserId,
            via: "owner_approval",
          },
        } as any);
      }

      return NextResponse.json({
        work_order_id: wo.id,
        owner_approval_status: "approved",
      });
    } catch (error) {
      return handleApiError(error);
    }
  },
  {
    routeName: "POST /api/work-orders/[id]/approve-booking",
    csrf: true,
  }
);

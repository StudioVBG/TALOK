export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  apiError,
  apiSuccess,
  requireAuth,
  validateBody,
  logAudit,
} from "@/lib/api/middleware";
import { CreateWorkOrderFromTicketSchema } from "@/lib/api/schemas";

/**
 * POST /api/v1/tickets/[id]/create-work-order
 * Créer un ordre de travail depuis un ticket
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;

    const { id } = await params;
    const supabase = await createClient();
    const body = await request.json();
    const { data, error: validationError } = validateBody(CreateWorkOrderFromTicketSchema, body);
    if (validationError) return validationError;

    // Fetch ticket
    const { data: ticket } = await supabase
      .from("tickets")
      .select("*, property:properties(owner_id)")
      .eq("id", id)
      .single();

    if (!ticket) return apiError("Ticket non trouvé", 404);

    // Only owner or admin can create work orders
    const profileId = auth.profile.id;
    const isOwner = ticket.property?.owner_id === profileId || ticket.owner_id === profileId;
    const isAdmin = auth.profile.role === "admin";

    if (!isOwner && !isAdmin) {
      return apiError("Seul le propriétaire peut créer un ordre de travail", 403);
    }

    // Verify provider exists
    const { data: provider } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", data.provider_id)
      .single();

    if (!provider) return apiError("Prestataire non trouvé", 404);

    // Create work order
    const { data: workOrder, error } = await supabase
      .from("work_orders")
      .insert({
        ticket_id: id,
        provider_id: data.provider_id,
        date_intervention_prevue: data.date_intervention_prevue || null,
        cout_estime: data.cout_estime || null,
        statut: "assigned",
      })
      .select()
      .single();

    if (error) {
      console.error("[POST /tickets/:id/create-work-order] Error:", error);
      return apiError("Erreur lors de la création", 500);
    }

    // Update ticket with work_order_id and status
    await supabase
      .from("tickets")
      .update({
        work_order_id: workOrder.id,
        assigned_to: data.provider_id,
        statut: "in_progress",
      })
      .eq("id", id);

    // Emit event
    await supabase.from("outbox").insert({
      event_type: "WorkOrder.Created",
      payload: {
        work_order_id: workOrder.id,
        ticket_id: id,
        provider_id: data.provider_id,
      },
    });

    await logAudit(supabase, "work_order.created", "work_orders", workOrder.id, auth.user.id, null, workOrder);

    return apiSuccess({ work_order: workOrder }, 201);
  } catch (error) {
    console.error("[POST /tickets/:id/create-work-order] Error:", error);
    return apiError("Erreur serveur", 500);
  }
}

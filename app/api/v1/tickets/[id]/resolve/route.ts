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
import { ResolveTicketSchema } from "@/lib/api/schemas";

/**
 * POST /api/v1/tickets/[id]/resolve
 * Marquer un ticket comme résolu
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
    const body = await request.json().catch(() => ({}));
    const { data, error: validationError } = validateBody(ResolveTicketSchema, body);
    if (validationError) return validationError;

    const { data: ticket } = await supabase
      .from("tickets")
      .select("*, property:properties(owner_id)")
      .eq("id", id)
      .single();

    if (!ticket) return apiError("Ticket non trouvé", 404);

    // Can resolve: owner, assigned provider, admin
    const profileId = auth.profile.id;
    const isOwner = ticket.property?.owner_id === profileId || ticket.owner_id === profileId;
    const isAssigned = ticket.assigned_to === profileId;
    const isAdmin = auth.profile.role === "admin";

    if (!isOwner && !isAssigned && !isAdmin) {
      return apiError("Accès non autorisé", 403);
    }

    // Validate state transition
    const allowedFrom = ["open", "acknowledged", "assigned", "in_progress", "reopened"];
    if (!allowedFrom.includes(ticket.statut)) {
      return apiError(`Impossible de résoudre un ticket en statut "${ticket.statut}"`, 400);
    }

    const { data: updated, error } = await supabase
      .from("tickets")
      .update({
        statut: "resolved",
        resolved_at: new Date().toISOString(),
        resolution_notes: data.resolution_notes || null,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[POST /tickets/:id/resolve] Error:", error);
      return apiError("Erreur lors de la résolution", 500);
    }

    await supabase.from("outbox").insert({
      event_type: "Ticket.Resolved",
      payload: { ticket_id: id, resolved_by: profileId },
    });

    await logAudit(supabase, "ticket.resolved", "tickets", id, auth.user.id, ticket, updated);

    return apiSuccess({ ticket: updated });
  } catch (error) {
    console.error("[POST /tickets/:id/resolve] Error:", error);
    return apiError("Erreur serveur", 500);
  }
}

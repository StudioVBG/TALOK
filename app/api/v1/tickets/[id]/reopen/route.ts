export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  apiError,
  apiSuccess,
  requireAuth,
  logAudit,
} from "@/lib/api/middleware";

/**
 * POST /api/v1/tickets/[id]/reopen
 * Rouvrir un ticket résolu
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

    const { data: ticket } = await supabase
      .from("tickets")
      .select("*, property:properties(owner_id)")
      .eq("id", id)
      .single();

    if (!ticket) return apiError("Ticket non trouvé", 404);

    const profileId = auth.profile.id;
    const isOwner = ticket.property?.owner_id === profileId || ticket.owner_id === profileId;
    const isAdmin = auth.profile.role === "admin";
    const isCreator = ticket.created_by_profile_id === profileId;

    if (!isOwner && !isAdmin && !isCreator) {
      return apiError("Accès non autorisé", 403);
    }

    if (ticket.statut !== "resolved") {
      return apiError("Seul un ticket résolu peut être rouvert", 400);
    }

    const { data: updated, error } = await supabase
      .from("tickets")
      .update({
        statut: "reopened",
        resolved_at: null,
        resolution_notes: null,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[POST /tickets/:id/reopen] Error:", error);
      return apiError("Erreur lors de la réouverture", 500);
    }

    await supabase.from("outbox").insert({
      event_type: "Ticket.Reopened",
      payload: { ticket_id: id, reopened_by: profileId },
    });

    await logAudit(supabase, "ticket.reopened", "tickets", id, auth.user.id, ticket, updated);

    return apiSuccess({ ticket: updated });
  } catch (error) {
    console.error("[POST /tickets/:id/reopen] Error:", error);
    return apiError("Erreur serveur", 500);
  }
}

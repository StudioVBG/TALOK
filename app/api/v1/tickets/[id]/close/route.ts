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
 * POST /api/v1/tickets/[id]/close
 * Clôturer un ticket résolu
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
    const satisfactionRating = body.satisfaction_rating;

    const { data: ticket } = await supabase
      .from("tickets")
      .select("*, property:properties(owner_id)")
      .eq("id", id)
      .single();

    if (!ticket) return apiError("Ticket non trouvé", 404);

    // Only owner or admin can close
    const profileId = auth.profile.id;
    const isOwner = ticket.property?.owner_id === profileId || ticket.owner_id === profileId;
    const isAdmin = auth.profile.role === "admin";
    const isCreator = ticket.created_by_profile_id === profileId;

    if (!isOwner && !isAdmin && !isCreator) {
      return apiError("Seul le propriétaire ou le créateur peut clôturer", 403);
    }

    if (ticket.statut !== "resolved") {
      return apiError("Le ticket doit être résolu avant d'être clôturé", 400);
    }

    const updateData: Record<string, unknown> = {
      statut: "closed",
      closed_at: new Date().toISOString(),
    };

    if (satisfactionRating && satisfactionRating >= 1 && satisfactionRating <= 5) {
      updateData.satisfaction_rating = satisfactionRating;
    }

    const { data: updated, error } = await supabase
      .from("tickets")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[POST /tickets/:id/close] Error:", error);
      return apiError("Erreur lors de la clôture", 500);
    }

    await supabase.from("outbox").insert({
      event_type: "Ticket.Closed",
      payload: { ticket_id: id, closed_by: profileId },
    });

    await logAudit(supabase, "ticket.closed", "tickets", id, auth.user.id, ticket, updated);

    return apiSuccess({ ticket: updated });
  } catch (error) {
    console.error("[POST /tickets/:id/close] Error:", error);
    return apiError("Erreur serveur", 500);
  }
}

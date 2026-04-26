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
import { AssignTicketSchema } from "@/lib/api/schemas";
import {
  sendProviderMissionAssignedSms,
  sendProviderSmsBestEffort,
} from "@/lib/sms/provider-notifications";

/**
 * POST /api/v1/tickets/[id]/assign
 * Assigner un ticket à un prestataire ou propriétaire
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
    const { data, error: validationError } = validateBody(AssignTicketSchema, body);
    if (validationError) return validationError;

    // Fetch ticket
    const { data: ticket } = await supabase
      .from("tickets")
      .select("*, property:properties(owner_id, adresse_complete, ville)")
      .eq("id", id)
      .single();

    if (!ticket) return apiError("Ticket non trouvé", 404);

    // Only owner or admin can assign
    const isOwner = ticket.property?.owner_id === auth.profile.id || ticket.owner_id === auth.profile.id;
    const isAdmin = auth.profile.role === "admin";
    if (!isOwner && !isAdmin) {
      return apiError("Seul le propriétaire peut assigner un ticket", 403);
    }

    // Verify provider exists
    const { data: provider } = await supabase
      .from("profiles")
      .select("id, role, telephone")
      .eq("id", data.provider_id)
      .single();

    if (!provider) return apiError("Prestataire non trouvé", 404);

    // Update ticket
    const { data: updated, error } = await supabase
      .from("tickets")
      .update({
        assigned_to: data.provider_id,
        statut: "assigned",
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[POST /tickets/:id/assign] Error:", error);
      return apiError("Erreur lors de l'assignation", 500);
    }

    // Emit event
    await supabase.from("outbox").insert({
      event_type: "Ticket.Assigned",
      payload: {
        ticket_id: id,
        assigned_to: data.provider_id,
        assigned_by: auth.profile.id,
      },
    });

    await logAudit(supabase, "ticket.assigned", "tickets", id, auth.user.id, ticket, updated);

    // SMS prestataire (best-effort, non bloquant)
    if ((provider as { telephone?: string | null }).telephone) {
      const property = ticket.property as {
        adresse_complete?: string | null;
        ville?: string | null;
      } | null;
      // Adresse courte : "rue X, Ville" sans CP
      const shortAddress = property
        ? [property.adresse_complete, property.ville].filter(Boolean).join(", ")
        : null;

      sendProviderSmsBestEffort(
        () =>
          sendProviderMissionAssignedSms({
            phone: (provider as { telephone: string }).telephone,
            providerProfileId: data.provider_id,
            title: ticket.titre || "Nouvelle intervention",
            shortAddress,
            relatedId: id,
          }),
        "mission_assigned",
      );
    }

    return apiSuccess({ ticket: updated });
  } catch (error) {
    console.error("[POST /tickets/:id/assign] Error:", error);
    return apiError("Erreur serveur", 500);
  }
}

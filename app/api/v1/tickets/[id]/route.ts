export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";
import {
  apiError,
  apiSuccess,
  requireAuth,
  validateBody,
  logAudit,
} from "@/lib/api/middleware";
import { UpdateTicketSchema } from "@/lib/api/schemas";

/**
 * GET /api/v1/tickets/[id]
 * Détail d'un ticket avec relations
 *
 * Lecture via service-role pour éviter les blocages RLS récursifs sur la
 * jointure tickets↔properties↔leases. La sécurité est garantie par le check
 * métier explicite ci-dessous (creator / owner / assignee / admin).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;

    const { id } = await params;
    const supabase = createServiceRoleClient();

    const { data: ticket, error } = await supabase
      .from("tickets")
      .select(`
        *,
        property:properties(id, adresse_complete, ville, code_postal, owner_id),
        lease:leases(id, date_debut, date_fin, statut),
        creator:profiles!created_by_profile_id(id, nom, prenom, role, telephone),
        assignee:profiles!assigned_to(id, nom, prenom, role, telephone),
        work_orders!ticket_id(
          id, statut, date_intervention_prevue, date_intervention_reelle,
          cout_estime, cout_final,
          provider:profiles!provider_id(id, nom, prenom, telephone)
        ),
        ticket_comments(
          id, content, attachments, is_internal, created_at,
          author:profiles!author_id(id, nom, prenom, role)
        )
      `)
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("[GET /tickets/:id] DB error:", error);
      return apiError("Erreur serveur", 500);
    }
    if (!ticket) {
      return apiError("Ticket non trouvé", 404);
    }

    const profileId = auth.profile.id;
    const isAdmin = auth.profile.role === "admin";
    const isCreator = ticket.created_by_profile_id === profileId;
    const isOwner =
      ticket.property?.owner_id === profileId || ticket.owner_id === profileId;
    const isAssigned = ticket.assigned_to === profileId;

    if (!isAdmin && !isCreator && !isOwner && !isAssigned) {
      return apiError("Accès non autorisé", 403);
    }

    if (!isOwner && !isAdmin) {
      ticket.ticket_comments = ticket.ticket_comments?.filter(
        (c: any) => !c.is_internal
      );
    }

    return apiSuccess({ ticket });
  } catch (error) {
    console.error("[GET /tickets/:id] Error:", error);
    return apiError("Erreur serveur", 500);
  }
}

/**
 * PATCH /api/v1/tickets/[id]
 * Modifier un ticket
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;

    const { id } = await params;
    const supabase = createServiceRoleClient();
    const body = await request.json();
    const { data, error: validationError } = validateBody(UpdateTicketSchema, body);
    if (validationError) return validationError;

    const { data: existing } = await supabase
      .from("tickets")
      .select("*, property:properties(owner_id)")
      .eq("id", id)
      .maybeSingle();

    if (!existing) return apiError("Ticket non trouvé", 404);

    const profileId = auth.profile.id;
    const isAdmin = auth.profile.role === "admin";
    const isCreator = existing.created_by_profile_id === profileId;
    const isOwner =
      existing.property?.owner_id === profileId || existing.owner_id === profileId;

    if (!isAdmin && !isCreator && !isOwner) {
      return apiError("Accès non autorisé", 403);
    }

    const { data: updated, error } = await supabase
      .from("tickets")
      .update(data)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[PATCH /tickets/:id] Error:", error);
      return apiError("Erreur lors de la mise à jour", 500);
    }

    await logAudit(supabase, "ticket.updated", "tickets", id, auth.user.id, existing, updated);

    return apiSuccess({ ticket: updated });
  } catch (error) {
    console.error("[PATCH /tickets/:id] Error:", error);
    return apiError("Erreur serveur", 500);
  }
}

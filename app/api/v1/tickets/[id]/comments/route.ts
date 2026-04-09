export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  apiError,
  apiSuccess,
  requireAuth,
  validateBody,
  getPaginationParams,
} from "@/lib/api/middleware";
import { CreateTicketCommentSchema } from "@/lib/api/schemas";

/**
 * GET /api/v1/tickets/[id]/comments
 * Liste des commentaires d'un ticket
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;

    const { id } = await params;
    const supabase = await createClient();

    // Verify ticket exists and access
    const { data: ticket } = await supabase
      .from("tickets")
      .select("id, created_by_profile_id, assigned_to, owner_id, property:properties(owner_id)")
      .eq("id", id)
      .single();

    if (!ticket) return apiError("Ticket non trouvé", 404);

    const profileId = auth.profile.id;
    const isAdmin = auth.profile.role === "admin";
    const isOwner = ticket.property?.owner_id === profileId || ticket.owner_id === profileId;
    const isCreator = ticket.created_by_profile_id === profileId;
    const isAssigned = ticket.assigned_to === profileId;

    if (!isAdmin && !isOwner && !isCreator && !isAssigned) {
      return apiError("Accès non autorisé", 403);
    }

    let query = supabase
      .from("ticket_comments")
      .select(`
        *,
        author:profiles!author_id(id, nom, prenom, role, avatar_url)
      `)
      .eq("ticket_id", id)
      .order("created_at", { ascending: true });

    // Non-owners can't see internal comments
    if (!isOwner && !isAdmin) {
      query = query.eq("is_internal", false);
    }

    const { data: comments, error } = await query;

    if (error) {
      console.error("[GET /tickets/:id/comments] Error:", error);
      return apiError("Erreur lors de la récupération", 500);
    }

    return apiSuccess({ comments: comments || [] });
  } catch (error) {
    console.error("[GET /tickets/:id/comments] Error:", error);
    return apiError("Erreur serveur", 500);
  }
}

/**
 * POST /api/v1/tickets/[id]/comments
 * Ajouter un commentaire
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
    const { data, error: validationError } = validateBody(CreateTicketCommentSchema, body);
    if (validationError) return validationError;

    // Verify ticket exists and access
    const { data: ticket } = await supabase
      .from("tickets")
      .select("id, created_by_profile_id, assigned_to, owner_id, property:properties(owner_id)")
      .eq("id", id)
      .single();

    if (!ticket) return apiError("Ticket non trouvé", 404);

    const profileId = auth.profile.id;
    const isAdmin = auth.profile.role === "admin";
    const isOwner = ticket.property?.owner_id === profileId || ticket.owner_id === profileId;
    const isCreator = ticket.created_by_profile_id === profileId;
    const isAssigned = ticket.assigned_to === profileId;

    if (!isAdmin && !isOwner && !isCreator && !isAssigned) {
      return apiError("Accès non autorisé", 403);
    }

    // Only owner/admin can post internal comments
    if (data.is_internal && !isOwner && !isAdmin) {
      return apiError("Seul le propriétaire peut poster des commentaires internes", 403);
    }

    const { data: comment, error } = await supabase
      .from("ticket_comments")
      .insert({
        ticket_id: id,
        author_id: profileId,
        content: data.content,
        attachments: data.attachments || [],
        is_internal: data.is_internal || false,
      })
      .select(`
        *,
        author:profiles!author_id(id, nom, prenom, role, avatar_url)
      `)
      .single();

    if (error) {
      console.error("[POST /tickets/:id/comments] Error:", error);
      return apiError("Erreur lors de l'ajout du commentaire", 500);
    }

    // If ticket is open and owner acknowledges, update status
    if (isOwner && ticket.statut === "open") {
      await supabase
        .from("tickets")
        .update({ statut: "acknowledged" })
        .eq("id", id)
        .eq("statut", "open");
    }

    return apiSuccess({ comment }, 201);
  } catch (error) {
    console.error("[POST /tickets/:id/comments] Error:", error);
    return apiError("Erreur serveur", 500);
  }
}

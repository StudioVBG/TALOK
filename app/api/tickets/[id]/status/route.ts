export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * PATCH /api/tickets/[id]/status - Mettre à jour le statut d'un ticket (incluant paused)
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const { statut, reason } = body;

    if (!statut || !["open", "in_progress", "paused", "resolved", "closed"].includes(statut)) {
      return NextResponse.json(
        { error: "Statut invalide" },
        { status: 400 }
      );
    }

    // Récupérer le ticket
    const { data: ticket } = await supabase
      .from("tickets")
      .select(`
        id,
        statut,
        created_by_profile_id,
        property:properties!inner(owner_id),
        lease:leases(roommates(user_id))
      `)
      .eq("id", params.id as any)
      .single();

    if (!ticket) {
      return NextResponse.json(
        { error: "Ticket non trouvé" },
        { status: 404 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id as any)
      .single();

    const profileData = profile as any;

    const ticketData = ticket as any;
    const isAdmin = profileData?.role === "admin";
    const isOwner = ticketData.property?.owner_id === profileData?.id;
    const isCreator = ticketData.created_by_profile_id === profileData?.id;
    const isProvider = profileData?.role === "provider" && ticketData.work_orders?.some((wo: any) => wo.provider_id === profileData.id);
    const isTenant = ticketData.lease?.roommates?.some((r: any) => r.user_id === user.id);

    // Vérifier les permissions selon le statut
    let hasPermission = false;
    if (isAdmin) {
      hasPermission = true;
    } else if (statut === "paused" && isProvider) {
      // Seul le prestataire peut mettre en pause
      hasPermission = true;
    } else if (statut === "closed" && (isOwner || isAdmin)) {
      // Seul le propriétaire ou admin peut fermer
      hasPermission = true;
    } else if (["open", "in_progress", "resolved"].includes(statut) && (isOwner || isCreator || isProvider)) {
      hasPermission = true;
    }

    if (!hasPermission) {
      return NextResponse.json(
        { error: "Vous n'avez pas la permission de modifier ce statut" },
        { status: 403 }
      );
    }

    // Mettre à jour le statut
    const { data: updated, error } = await supabase
      .from("tickets")
      .update({ statut } as any)
      .eq("id", params.id as any)
      .select()
      .single();

    if (error) throw error;

    // Émettre un événement selon le statut
    let eventType: string;
    switch (statut) {
      case "paused":
        eventType = "Ticket.Paused";
        break;
      case "in_progress":
        eventType = "Ticket.InProgress";
        break;
      case "resolved":
        eventType = "Ticket.Resolved";
        break;
      case "closed":
        eventType = "Ticket.Closed";
        break;
      default:
        eventType = "Ticket.StatusUpdated";
    }

    await supabase.from("outbox").insert({
      event_type: eventType,
      payload: {
        ticket_id: params.id,
        old_status: ticketData.statut,
        new_status: statut,
        reason: reason || null,
      },
    } as any);

    // Journaliser
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "ticket_status_updated",
      entity_type: "ticket",
      entity_id: params.id,
      before_state: { statut: ticketData.statut },
      after_state: { statut },
      metadata: { reason },
    } as any);

    return NextResponse.json({ ticket: updated });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}






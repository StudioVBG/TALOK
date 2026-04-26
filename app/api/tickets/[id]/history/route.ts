/**
 * @version 2026-01-22 - Fix: Next.js 15 params Promise pattern
 */
export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";

/**
 * GET /api/tickets/[id]/history - Récupérer l'historique d'un ticket
 *
 * Retourne les événements de l'audit_log liés au ticket
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const supabase = await createClient();
    const serviceClient = getServiceClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { data: ticket, error: ticketError } = await serviceClient
      .from("tickets")
      .select(`
        id,
        owner_id,
        created_by_profile_id,
        assigned_to,
        created_at,
        updated_at,
        statut,
        priorite,
        property:properties(owner_id)
      `)
      .eq("id", id)
      .maybeSingle();

    if (ticketError || !ticket) {
      return NextResponse.json({ error: "Ticket non trouvé" }, { status: 404 });
    }

    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .maybeSingle();

    const profileId = profile?.id;
    const isAdmin = profile?.role === "admin";
    const isCreator = ticket.created_by_profile_id === profileId;
    const isOwner =
      ticket.property?.owner_id === profileId || ticket.owner_id === profileId;
    const isAssigned = ticket.assigned_to === profileId;

    if (!isAdmin && !isOwner && !isCreator && !isAssigned) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    const { data: auditLogs } = await serviceClient
      .from("audit_log")
      .select(`
        id,
        action,
        entity_type,
        metadata,
        created_at,
        user:profiles!audit_log_user_id_fkey(prenom, nom)
      `)
      .eq("entity_id", id)
      .eq("entity_type", "ticket")
      .order("created_at", { ascending: false })
      .limit(50);

    // Construire l'historique enrichi
    const history = [
      // Événement de création
      {
        id: `created_${ticket.id}`,
        type: "created",
        action: "Ticket créé",
        timestamp: ticket.created_at,
        actor: null,
        metadata: { status: "open" },
      },
      // Événements de l'audit_log
      ...(auditLogs || []).map((log: any) => ({
        id: log.id,
        type: mapActionToType(log.action),
        action: mapActionToLabel(log.action),
        timestamp: log.created_at,
        actor: log.user ? `${log.user.prenom} ${log.user.nom}` : null,
        metadata: log.metadata,
      })),
    ];

    // Ajouter un événement de mise à jour si différent de création
    if (ticket.updated_at && ticket.updated_at !== ticket.created_at) {
      const hasUpdateInLogs = history.some(h => 
        h.type === "status_changed" || h.type === "updated"
      );
      
      if (!hasUpdateInLogs) {
        history.push({
          id: `updated_${ticket.id}`,
          type: "updated",
          action: "Ticket mis à jour",
          timestamp: ticket.updated_at,
          actor: null,
          metadata: {},
        });
      }
    }

    // Trier par date décroissante
    history.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({ 
      history,
      ticket: {
        id: ticket.id,
        statut: ticket.statut,
        priorite: ticket.priorite,
        created_at: ticket.created_at,
        updated_at: ticket.updated_at,
      }
    });
  } catch (error: unknown) {
    console.error("[GET /api/tickets/[id]/history] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

// Helpers
function mapActionToType(action: string): string {
  const mapping: Record<string, string> = {
    "ticket_created": "created",
    "ticket_updated": "updated",
    "ticket_status_changed": "status_changed",
    "ticket_assigned": "assigned",
    "ticket_comment_added": "comment",
    "ticket_resolved": "resolved",
    "ticket_closed": "closed",
    "quote_submitted": "quote",
    "quote_accepted": "quote_accepted",
    "quote_rejected": "quote_rejected",
    "work_order_created": "work_order",
    "work_order_completed": "work_completed",
  };
  return mapping[action] || "other";
}

function mapActionToLabel(action: string): string {
  const mapping: Record<string, string> = {
    "ticket_created": "Ticket créé",
    "ticket_updated": "Ticket mis à jour",
    "ticket_status_changed": "Statut modifié",
    "ticket_assigned": "Prestataire assigné",
    "ticket_comment_added": "Commentaire ajouté",
    "ticket_resolved": "Ticket résolu",
    "ticket_closed": "Ticket fermé",
    "quote_submitted": "Devis reçu",
    "quote_accepted": "Devis accepté",
    "quote_rejected": "Devis refusé",
    "work_order_created": "Intervention planifiée",
    "work_order_completed": "Intervention terminée",
  };
  return mapping[action] || action;
}


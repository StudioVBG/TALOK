export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/tickets/[id]/history - Récupérer l'historique d'un ticket
 * 
 * Retourne les événements de l'audit_log liés au ticket
 */
export async function GET(
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

    // Vérifier l'accès au ticket
    const { data: ticket, error: ticketError } = await supabase
      .from("tickets")
      .select(`
        id,
        created_at,
        updated_at,
        statut,
        priorite,
        property:properties!inner(owner_id)
      `)
      .eq("id", params.id)
      .single();

    if (ticketError || !ticket) {
      return NextResponse.json({ error: "Ticket non trouvé" }, { status: 404 });
    }

    // Vérifier que l'utilisateur est le propriétaire
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (ticket.property?.owner_id !== profile?.id) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    // Récupérer l'historique depuis audit_log
    const { data: auditLogs, error: auditError } = await supabase
      .from("audit_log")
      .select(`
        id,
        action,
        entity_type,
        metadata,
        created_at,
        user:profiles!audit_log_user_id_fkey(prenom, nom)
      `)
      .eq("entity_id", params.id)
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


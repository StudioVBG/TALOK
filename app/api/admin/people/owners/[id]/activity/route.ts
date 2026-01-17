export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/helpers/auth-helper";
import { createServiceRoleClient } from "@/lib/supabase/server";

interface ActivityEvent {
  id: string;
  type: string;
  title: string;
  description?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

/**
 * GET /api/admin/people/owners/[id]/activity
 * Récupère l'historique d'activité d'un propriétaire
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: ownerId } = await params;
    const { error, user } = await requireAdmin(request);

    if (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: error.status });
    }

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const supabase = createServiceRoleClient();

    // Récupérer le profil pour obtenir le user_id
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, user_id")
      .eq("id", ownerId)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Propriétaire non trouvé" }, { status: 404 });
    }

    const activities: ActivityEvent[] = [];

    // 1. Récupérer les propriétés du propriétaire
    let { data: properties } = await supabase
      .from("properties")
      .select("id, adresse_complete, created_at, updated_at")
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false })
      .limit(20);

    if ((!properties || properties.length === 0) && profile.user_id) {
      const { data: propsByUser } = await supabase
        .from("properties")
        .select("id, adresse_complete, created_at, updated_at")
        .eq("owner_id", profile.user_id)
        .order("created_at", { ascending: false })
        .limit(20);
      properties = propsByUser;
    }

    // Ajouter les créations de propriétés
    properties?.forEach((prop) => {
      activities.push({
        id: `property-created-${prop.id}`,
        type: "property_created",
        title: "Nouveau bien ajouté",
        description: prop.adresse_complete,
        timestamp: prop.created_at,
      });
    });

    const propertyIds = properties?.map(p => p.id) || [];

    // 2. Récupérer les baux
    if (propertyIds.length > 0) {
      const { data: leases } = await supabase
        .from("leases")
        .select("id, type_bail, date_debut, statut, created_at, property:properties(adresse_complete)")
        .in("property_id", propertyIds)
        .order("created_at", { ascending: false })
        .limit(20);

      leases?.forEach((lease: any) => {
        activities.push({
          id: `lease-created-${lease.id}`,
          type: lease.statut === "active" ? "lease_signed" : "lease_created",
          title: lease.statut === "active" ? "Bail signé" : "Bail créé",
          description: `${lease.type_bail} - ${lease.property?.adresse_complete || ""}`,
          timestamp: lease.created_at,
        });
      });
    }

    // 3. Récupérer les factures et paiements
    const { data: invoices } = await supabase
      .from("invoices")
      .select("id, montant_total, statut, periode, created_at")
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false })
      .limit(30);

    invoices?.forEach((invoice) => {
      if (invoice.statut === "paid") {
        activities.push({
          id: `payment-${invoice.id}`,
          type: "payment_received",
          title: "Paiement reçu",
          description: `${invoice.montant_total}€ - Période ${invoice.periode}`,
          timestamp: invoice.created_at,
        });
      } else if (invoice.statut === "late") {
        activities.push({
          id: `payment-late-${invoice.id}`,
          type: "payment_late",
          title: "Paiement en retard",
          description: `${invoice.montant_total}€ - Période ${invoice.periode}`,
          timestamp: invoice.created_at,
        });
      }
    });

    // 4. Récupérer les tickets
    if (propertyIds.length > 0) {
      const { data: tickets } = await supabase
        .from("tickets")
        .select("id, titre, statut, created_at, updated_at")
        .in("property_id", propertyIds)
        .order("created_at", { ascending: false })
        .limit(20);

      tickets?.forEach((ticket) => {
        activities.push({
          id: `ticket-${ticket.id}`,
          type: ticket.statut === "closed" || ticket.statut === "resolved" ? "ticket_resolved" : "ticket_created",
          title: ticket.statut === "closed" || ticket.statut === "resolved" ? "Ticket résolu" : "Nouveau ticket",
          description: ticket.titre,
          timestamp: ticket.statut === "closed" || ticket.statut === "resolved" ? ticket.updated_at : ticket.created_at,
        });
      });
    }

    // 5. Récupérer les documents uploadés
    const { data: documents } = await supabase
      .from("documents")
      .select("id, type, created_at")
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false })
      .limit(20);

    documents?.forEach((doc) => {
      activities.push({
        id: `document-${doc.id}`,
        type: "document_uploaded",
        title: "Document uploadé",
        description: doc.type,
        timestamp: doc.created_at,
      });
    });

    // 6. Récupérer les logs d'audit si disponibles
    if (profile.user_id) {
      try {
        const { data: auditLogs } = await supabase
          .from("audit_log")
          .select("id, action, entity_type, metadata, created_at")
          .eq("user_id", profile.user_id)
          .order("created_at", { ascending: false })
          .limit(20);

        auditLogs?.forEach((log: any) => {
          if (log.action === "login") {
            activities.push({
              id: `login-${log.id}`,
              type: "login",
              title: "Connexion",
              timestamp: log.created_at,
            });
          } else if (log.action === "profile_updated") {
            activities.push({
              id: `profile-${log.id}`,
              type: "profile_updated",
              title: "Profil mis à jour",
              timestamp: log.created_at,
            });
          }
        });
      } catch {
        // Table might not exist
      }
    }

    // Trier par date décroissante
    activities.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Limiter à 50 événements
    const limitedActivities = activities.slice(0, 50);

    return NextResponse.json({
      activities: limitedActivities,
      total: activities.length,
    });
  } catch (error: unknown) {
    console.error("[GET /api/admin/people/owners/[id]/activity]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur serveur" }, { status: 500 });
  }
}


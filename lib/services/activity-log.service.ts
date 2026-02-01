/**
 * Service de journalisation des activités utilisateur
 * 
 * Enregistre toutes les actions importantes :
 * - Création/modification/suppression de biens
 * - Gestion des baux
 * - Paiements
 * - Tickets
 * - Documents
 */

import { createClient } from "@/lib/supabase/server";

// Types d'activités
export type ActivityType =
  | "property_created"
  | "property_updated"
  | "property_deleted"
  | "lease_created"
  | "lease_signed"
  | "lease_terminated"
  | "tenant_invited"
  | "tenant_joined"
  | "tenant_removed"
  | "payment_received"
  | "payment_reminder_sent"
  | "invoice_generated"
  | "invoice_sent"
  | "ticket_created"
  | "ticket_resolved"
  | "ticket_closed"
  | "document_uploaded"
  | "document_signed"
  | "inspection_created"
  | "inspection_completed"
  | "profile_updated"
  | "settings_changed"
  | "login"
  | "logout";

export type ActivityCategory = 
  | "property" 
  | "lease" 
  | "tenant" 
  | "payment" 
  | "ticket" 
  | "document" 
  | "inspection"
  | "account";

export interface ActivityLog {
  id: string;
  type: ActivityType;
  category: ActivityCategory;
  title: string;
  description?: string;
  profileId: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export interface CreateActivityParams {
  type: ActivityType;
  title: string;
  description?: string;
  profileId: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, any>;
}

// Mapping type -> catégorie
const TYPE_TO_CATEGORY: Record<ActivityType, ActivityCategory> = {
  property_created: "property",
  property_updated: "property",
  property_deleted: "property",
  lease_created: "lease",
  lease_signed: "lease",
  lease_terminated: "lease",
  tenant_invited: "tenant",
  tenant_joined: "tenant",
  tenant_removed: "tenant",
  payment_received: "payment",
  payment_reminder_sent: "payment",
  invoice_generated: "payment",
  invoice_sent: "payment",
  ticket_created: "ticket",
  ticket_resolved: "ticket",
  ticket_closed: "ticket",
  document_uploaded: "document",
  document_signed: "document",
  inspection_created: "inspection",
  inspection_completed: "inspection",
  profile_updated: "account",
  settings_changed: "account",
  login: "account",
  logout: "account",
};

// Labels français pour les types d'activité
export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  property_created: "Bien créé",
  property_updated: "Bien modifié",
  property_deleted: "Bien supprimé",
  lease_created: "Bail créé",
  lease_signed: "Bail signé",
  lease_terminated: "Bail résilié",
  tenant_invited: "Locataire invité",
  tenant_joined: "Locataire rejoint",
  tenant_removed: "Locataire retiré",
  payment_received: "Paiement reçu",
  payment_reminder_sent: "Relance envoyée",
  invoice_generated: "Facture générée",
  invoice_sent: "Facture envoyée",
  ticket_created: "Ticket créé",
  ticket_resolved: "Ticket résolu",
  ticket_closed: "Ticket fermé",
  document_uploaded: "Document uploadé",
  document_signed: "Document signé",
  inspection_created: "EDL créé",
  inspection_completed: "EDL terminé",
  profile_updated: "Profil mis à jour",
  settings_changed: "Paramètres modifiés",
  login: "Connexion",
  logout: "Déconnexion",
};

// Icônes pour chaque catégorie (noms pour lucide-react)
export const CATEGORY_ICONS: Record<ActivityCategory, string> = {
  property: "Building2",
  lease: "FileText",
  tenant: "Users",
  payment: "Euro",
  ticket: "Wrench",
  document: "File",
  inspection: "ClipboardCheck",
  account: "User",
};

/**
 * Enregistre une nouvelle activité
 */
export async function logActivity(params: CreateActivityParams): Promise<ActivityLog | null> {
  try {
    const supabase = await createClient();
    const category = TYPE_TO_CATEGORY[params.type];

    const activityData = {
      type: params.type,
      category,
      title: params.title,
      description: params.description,
      profile_id: params.profileId,
      entity_type: params.entityType,
      entity_id: params.entityId,
      metadata: params.metadata || {},
    };

    const { data, error } = await supabase
      .from("activity_logs")
      .insert(activityData)
      .select()
      .single();

    if (error) {
      // Si la table n'existe pas, log en console seulement
      console.log("[ActivityLog] Activité:", params.title);
      return null;
    }

    const row = data as Record<string, any>;
    return {
      id: row.id,
      type: row.type,
      category: row.category,
      title: row.title,
      description: row.description,
      profileId: row.profile_id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      metadata: row.metadata,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      createdAt: row.created_at,
    } as ActivityLog;
  } catch (error) {
    console.error("[ActivityLog] Erreur:", error);
    return null;
  }
}

/**
 * Récupère les activités d'un utilisateur
 */
export async function getActivities(
  profileId: string,
  options?: {
    category?: ActivityCategory;
    limit?: number;
    offset?: number;
    startDate?: Date;
    endDate?: Date;
  }
): Promise<{ activities: ActivityLog[]; total: number }> {
  try {
    const supabase = await createClient();
    const { category, limit = 50, offset = 0, startDate, endDate } = options || {};

    let query = supabase
      .from("activity_logs")
      .select("*", { count: "exact" })
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false });

    if (category) {
      query = query.eq("category", category);
    }

    if (startDate) {
      query = query.gte("created_at", startDate.toISOString());
    }

    if (endDate) {
      query = query.lte("created_at", endDate.toISOString());
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error("[ActivityLog] Erreur récupération:", error);
      return { activities: [], total: 0 };
    }

    const activities: ActivityLog[] = (data || []).map((row) => ({
      id: row.id,
      type: row.type,
      category: row.category,
      title: row.title,
      description: row.description,
      profileId: row.profile_id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      metadata: row.metadata,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      createdAt: row.created_at,
    }));

    return { activities, total: count || 0 };
  } catch (error) {
    console.error("[ActivityLog] Erreur:", error);
    return { activities: [], total: 0 };
  }
}

/**
 * Helper pour créer facilement des logs d'activité
 */
export const ActivityLogger = {
  propertyCreated: (profileId: string, propertyId: string, propertyName: string) =>
    logActivity({
      type: "property_created",
      title: `Bien "${propertyName}" créé`,
      profileId,
      entityType: "property",
      entityId: propertyId,
    }),

  propertyUpdated: (profileId: string, propertyId: string, propertyName: string) =>
    logActivity({
      type: "property_updated",
      title: `Bien "${propertyName}" modifié`,
      profileId,
      entityType: "property",
      entityId: propertyId,
    }),

  leaseCreated: (profileId: string, leaseId: string, tenantName: string) =>
    logActivity({
      type: "lease_created",
      title: `Bail créé pour ${tenantName}`,
      profileId,
      entityType: "lease",
      entityId: leaseId,
    }),

  paymentReceived: (profileId: string, paymentId: string, amount: number, tenantName: string) =>
    logActivity({
      type: "payment_received",
      title: `Paiement de ${amount}€ reçu`,
      description: `De ${tenantName}`,
      profileId,
      entityType: "payment",
      entityId: paymentId,
      metadata: { amount, tenant: tenantName },
    }),

  ticketCreated: (profileId: string, ticketId: string, ticketTitle: string) =>
    logActivity({
      type: "ticket_created",
      title: `Ticket "${ticketTitle}" créé`,
      profileId,
      entityType: "ticket",
      entityId: ticketId,
    }),

  documentUploaded: (profileId: string, documentId: string, documentName: string) =>
    logActivity({
      type: "document_uploaded",
      title: `Document "${documentName}" uploadé`,
      profileId,
      entityType: "document",
      entityId: documentId,
    }),
};

export default { logActivity, getActivities, ActivityLogger };


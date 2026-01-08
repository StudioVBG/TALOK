/**
 * Service d'alertes intelligentes
 * 
 * Gère la détection et la notification des événements importants :
 * - Loyers impayés
 * - Fins de bail approchantes
 * - Diagnostics expirant
 * - Révisions de loyer IRL
 * - Assurances à renouveler
 */

import { createClient } from "@/lib/supabase/server";

// Types d'alertes
export type AlertType = 
  | "unpaid_rent"
  | "lease_ending"
  | "diagnostic_expiring"
  | "rent_revision"
  | "insurance_expiring"
  | "document_missing"
  | "maintenance_due"
  | "tenant_notice";

export type AlertPriority = "low" | "medium" | "high" | "critical";

export interface Alert {
  id: string;
  type: AlertType;
  priority: AlertPriority;
  title: string;
  message: string;
  entityType: "property" | "lease" | "tenant" | "invoice";
  entityId: string;
  entityName?: string;
  actionUrl?: string;
  actionLabel?: string;
  dueDate?: string;
  amount?: number;
  createdAt: string;
  readAt?: string;
  dismissedAt?: string;
}

export interface AlertConfig {
  unpaidRentDays: number[]; // [5, 15, 30]
  leaseEndingDays: number[]; // [90, 60, 30]
  diagnosticExpiringDays: number; // 60
  insuranceExpiringDays: number; // 30
}

const DEFAULT_CONFIG: AlertConfig = {
  unpaidRentDays: [5, 15, 30],
  leaseEndingDays: [90, 60, 30],
  diagnosticExpiringDays: 60,
  insuranceExpiringDays: 30,
};

/**
 * Calcule la priorité en fonction du nombre de jours
 */
function getPriority(daysRemaining: number): AlertPriority {
  if (daysRemaining <= 0) return "critical";
  if (daysRemaining <= 7) return "high";
  if (daysRemaining <= 30) return "medium";
  return "low";
}

/**
 * Récupère les alertes de loyers impayés
 */
export async function getUnpaidRentAlerts(ownerId: string): Promise<Alert[]> {
  const supabase = await createClient();
  const alerts: Alert[] = [];
  
  const { data: invoices } = await supabase
    .from("invoices")
    .select(`
      id,
      periode,
      montant_total,
      statut,
      created_at,
      lease_id
    `)
    .eq("owner_id", ownerId)
    .in("statut", ["sent", "late"])
    .order("periode", { ascending: false });

  if (invoices) {
    const now = new Date();
    
    for (const invoice of invoices) {
      const invoiceDate = new Date(invoice.created_at);
      const daysSinceCreation = Math.floor((now.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // Alertes progressives
      let shouldAlert = false;
      let priority: AlertPriority = "medium";
      
      if (daysSinceCreation >= 30) {
        shouldAlert = true;
        priority = "critical";
      } else if (daysSinceCreation >= 15) {
        shouldAlert = true;
        priority = "high";
      } else if (daysSinceCreation >= 5) {
        shouldAlert = true;
        priority = "medium";
      }
      
      if (shouldAlert) {
        alerts.push({
          id: `unpaid-${invoice.id}`,
          type: "unpaid_rent",
          priority,
          title: `Loyer impayé - ${invoice.periode}`,
          message: `Le loyer de ${invoice.montant_total}€ est en attente depuis ${daysSinceCreation} jours`,
          entityType: "invoice",
          entityId: invoice.id,
          actionUrl: `/owner/money?invoice=${invoice.id}`,
          actionLabel: "Voir la facture",
          amount: invoice.montant_total,
          createdAt: invoice.created_at,
        });
      }
    }
  }
  
  return alerts;
}

/**
 * Récupère les alertes de fins de bail
 */
export async function getLeaseEndingAlerts(ownerId: string): Promise<Alert[]> {
  const supabase = await createClient();
  const alerts: Alert[] = [];
  
  const threeMonthsFromNow = new Date();
  threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);
  
  const { data: leases } = await supabase
    .from("leases")
    .select(`
      id,
      date_fin,
      statut,
      property:properties (
        id,
        adresse_complete,
        ville
      )
    `)
    .eq("owner_id", ownerId)
    .eq("statut", "active")
    .not("date_fin", "is", null)
    .lte("date_fin", threeMonthsFromNow.toISOString().split("T")[0]);

  if (leases) {
    const now = new Date();
    
    for (const lease of leases) {
      if (!lease.date_fin) continue;
      
      const endDate = new Date(lease.date_fin);
      const daysRemaining = Math.floor((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysRemaining <= 90) {
        const property = lease.property as any;
        
        alerts.push({
          id: `lease-ending-${lease.id}`,
          type: "lease_ending",
          priority: getPriority(daysRemaining),
          title: `Bail se terminant`,
          message: `Le bail du ${property?.adresse_complete || "bien"} expire dans ${daysRemaining} jours`,
          entityType: "lease",
          entityId: lease.id,
          entityName: property?.adresse_complete,
          actionUrl: `/owner/leases/${lease.id}`,
          actionLabel: "Voir le bail",
          dueDate: lease.date_fin,
          createdAt: new Date().toISOString(),
        });
      }
    }
  }
  
  return alerts;
}

/**
 * Récupère les alertes de diagnostics expirant
 */
export async function getDiagnosticAlerts(ownerId: string): Promise<Alert[]> {
  const supabase = await createClient();
  const alerts: Alert[] = [];
  
  // Les diagnostics DPE sont valides 10 ans
  // On alerte 60 jours avant expiration
  const alertDate = new Date();
  alertDate.setDate(alertDate.getDate() + 60);
  
  const { data: properties } = await supabase
    .from("properties")
    .select(`
      id,
      adresse_complete,
      ville,
      dpe_date,
      dpe_classe_energie
    `)
    .eq("owner_id", ownerId)
    .not("dpe_date", "is", null);

  if (properties) {
    const now = new Date();
    
    for (const property of properties) {
      if (!property.dpe_date) continue;
      
      // DPE valide 10 ans
      const dpeDate = new Date(property.dpe_date);
      const expirationDate = new Date(dpeDate);
      expirationDate.setFullYear(expirationDate.getFullYear() + 10);
      
      const daysRemaining = Math.floor((expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysRemaining <= 60) {
        alerts.push({
          id: `dpe-expiring-${property.id}`,
          type: "diagnostic_expiring",
          priority: getPriority(daysRemaining),
          title: `DPE à renouveler`,
          message: `Le diagnostic DPE du ${property.adresse_complete} expire dans ${daysRemaining} jours`,
          entityType: "property",
          entityId: property.id,
          entityName: property.adresse_complete,
          actionUrl: `/owner/properties/${property.id}?tab=diagnostics`,
          actionLabel: "Voir le bien",
          dueDate: expirationDate.toISOString(),
          createdAt: new Date().toISOString(),
        });
      }
    }
  }
  
  return alerts;
}

/**
 * Récupère les alertes de révision de loyer IRL
 */
export async function getRentRevisionAlerts(ownerId: string): Promise<Alert[]> {
  const supabase = await createClient();
  const alerts: Alert[] = [];
  
  const oneMonthFromNow = new Date();
  oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
  
  const { data: leases } = await supabase
    .from("leases")
    .select(`
      id,
      date_debut,
      loyer,
      indice_reference,
      next_indexation_date,
      property:properties (
        adresse_complete
      )
    `)
    .eq("owner_id", ownerId)
    .eq("statut", "active")
    .not("indice_reference", "is", null);

  if (leases) {
    const now = new Date();
    
    for (const lease of leases) {
      // Calculer la prochaine date de révision si non définie
      let nextRevisionDate: Date;
      
      if (lease.next_indexation_date) {
        nextRevisionDate = new Date(lease.next_indexation_date);
      } else {
        // Par défaut, révision annuelle à la date anniversaire
        const startDate = new Date(lease.date_debut);
        nextRevisionDate = new Date(startDate);
        nextRevisionDate.setFullYear(now.getFullYear());
        if (nextRevisionDate < now) {
          nextRevisionDate.setFullYear(now.getFullYear() + 1);
        }
      }
      
      const daysRemaining = Math.floor((nextRevisionDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysRemaining <= 30 && daysRemaining >= 0) {
        const property = lease.property as any;
        
        alerts.push({
          id: `revision-${lease.id}`,
          type: "rent_revision",
          priority: "medium",
          title: `Révision de loyer`,
          message: `La révision ${lease.indice_reference} du bail ${property?.adresse_complete || ""} est due dans ${daysRemaining} jours`,
          entityType: "lease",
          entityId: lease.id,
          entityName: property?.adresse_complete,
          actionUrl: `/owner/leases/${lease.id}?action=revision`,
          actionLabel: "Réviser le loyer",
          dueDate: nextRevisionDate.toISOString(),
          amount: lease.loyer,
          createdAt: new Date().toISOString(),
        });
      }
    }
  }
  
  return alerts;
}

/**
 * Récupère toutes les alertes pour un propriétaire
 */
export async function getAllAlerts(ownerId: string): Promise<Alert[]> {
  const [unpaidRent, leaseEnding, diagnostics, rentRevision] = await Promise.all([
    getUnpaidRentAlerts(ownerId),
    getLeaseEndingAlerts(ownerId),
    getDiagnosticAlerts(ownerId),
    getRentRevisionAlerts(ownerId),
  ]);
  
  // Combiner et trier par priorité
  const allAlerts = [...unpaidRent, ...leaseEnding, ...diagnostics, ...rentRevision];
  
  const priorityOrder: Record<AlertPriority, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  
  return allAlerts.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
}

/**
 * Compte les alertes par priorité
 */
export async function getAlertCounts(ownerId: string): Promise<Record<AlertPriority, number>> {
  const alerts = await getAllAlerts(ownerId);
  
  return alerts.reduce(
    (acc, alert) => {
      acc[alert.priority]++;
      return acc;
    },
    { critical: 0, high: 0, medium: 0, low: 0 } as Record<AlertPriority, number>
  );
}

export default {
  getAllAlerts,
  getAlertCounts,
  getUnpaidRentAlerts,
  getLeaseEndingAlerts,
  getDiagnosticAlerts,
  getRentRevisionAlerts,
};


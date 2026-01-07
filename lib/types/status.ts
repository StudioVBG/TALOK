/**
 * Types Status consolidés - SOTA 2026
 *
 * Ce fichier centralise tous les types de status pour éviter les doublons
 * et incohérences dans l'application.
 *
 * IMPORTANT: Utiliser ces types au lieu des définitions locales dispersées.
 */

// ============================================
// PROPERTY STATUS
// ============================================

/**
 * Statuts de propriété unifiés (anglais uniquement)
 */
export type PropertyStatus =
  | "draft"           // Brouillon
  | "pending_review"  // En attente de validation admin
  | "published"       // Publié / Approuvé
  | "rejected"        // Rejeté par admin
  | "archived";       // Archivé

/**
 * Statuts opérationnels de propriété (pour le propriétaire)
 */
export type PropertyOperationalStatus =
  | "vacant"          // Vacant, disponible à la location
  | "rented"          // Loué (bail actif)
  | "notice_period"   // En préavis
  | "incomplete";     // Dossier incomplet

// ============================================
// LEASE STATUS
// ============================================

/**
 * Statuts de bail - cycle de vie complet
 */
export type LeaseStatus =
  | "draft"                   // Brouillon
  | "pending_signature"       // En attente de signatures
  | "partially_signed"        // Partiellement signé
  | "fully_signed"            // Entièrement signé (avant EDL)
  | "active"                  // Bail actif
  | "notice_given"            // Congé donné (préavis en cours)
  | "terminated"              // Terminé
  | "archived";               // Archivé

// ============================================
// INVOICE STATUS
// ============================================

/**
 * Statuts de facture
 */
export type InvoiceStatus =
  | "draft"           // Brouillon
  | "sent"            // Envoyée
  | "viewed"          // Vue par le locataire
  | "partial"         // Partiellement payée
  | "paid"            // Payée
  | "late"            // En retard
  | "cancelled";      // Annulée

// ============================================
// PAYMENT STATUS
// ============================================

/**
 * Statuts de paiement
 */
export type PaymentStatus =
  | "pending"         // En attente
  | "processing"      // En cours de traitement
  | "succeeded"       // Réussi
  | "failed"          // Échoué
  | "refunded";       // Remboursé

// ============================================
// TICKET STATUS
// ============================================

/**
 * Statuts de ticket de maintenance
 */
export type TicketStatus =
  | "open"            // Ouvert
  | "in_progress"     // En cours
  | "paused"          // En pause
  | "resolved"        // Résolu
  | "closed";         // Clôturé

// ============================================
// WORK ORDER STATUS
// ============================================

/**
 * Statuts de commande de travaux
 */
export type WorkOrderStatus =
  | "assigned"        // Assigné
  | "scheduled"       // Planifié
  | "in_progress"     // En cours
  | "done"            // Terminé
  | "cancelled";      // Annulé

// ============================================
// SIGNATURE STATUS
// ============================================

/**
 * Statuts de signataire
 */
export type SignatureStatus =
  | "pending"         // En attente
  | "sent"            // Invitation envoyée
  | "opened"          // Document ouvert
  | "signed"          // Signé
  | "refused";        // Refusé

/**
 * Statuts de demande de signature
 */
export type SignatureRequestStatus =
  | "draft"           // Brouillon
  | "pending"         // En attente de signatures
  | "ongoing"         // En cours de signature
  | "done"            // Terminé
  | "expired"         // Expiré
  | "canceled"        // Annulé
  | "rejected";       // Refusé

// ============================================
// QUOTE STATUS
// ============================================

/**
 * Statuts de devis
 */
export type QuoteStatus =
  | "draft"           // Brouillon
  | "sent"            // Envoyé
  | "accepted"        // Accepté
  | "rejected"        // Refusé
  | "expired";        // Expiré

// ============================================
// EDL STATUS
// ============================================

/**
 * Statuts d'état des lieux
 */
export type EDLStatus =
  | "draft"           // Brouillon
  | "in_progress"     // En cours
  | "completed"       // Complété (non signé)
  | "signed"          // Signé
  | "disputed";       // Contesté

// ============================================
// DOCUMENT STATUS
// ============================================

/**
 * Statuts de document
 */
export type DocumentStatus =
  | "pending"         // En attente de validation
  | "valid"           // Validé
  | "expired"         // Expiré
  | "rejected";       // Rejeté

// ============================================
// SUBSCRIPTION STATUS
// ============================================

/**
 * Statuts d'abonnement
 */
export type SubscriptionStatus =
  | "trialing"        // Période d'essai
  | "active"          // Actif
  | "past_due"        // Paiement en retard
  | "canceled"        // Annulé
  | "unpaid"          // Impayé
  | "paused";         // En pause

// ============================================
// LABELS & DISPLAY HELPERS
// ============================================

export const PROPERTY_STATUS_LABELS: Record<PropertyStatus, string> = {
  draft: "Brouillon",
  pending_review: "En attente",
  published: "Publié",
  rejected: "Rejeté",
  archived: "Archivé",
};

export const LEASE_STATUS_LABELS: Record<LeaseStatus, string> = {
  draft: "Brouillon",
  pending_signature: "En attente de signature",
  partially_signed: "Partiellement signé",
  fully_signed: "Entièrement signé",
  active: "Actif",
  notice_given: "Préavis",
  terminated: "Terminé",
  archived: "Archivé",
};

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Brouillon",
  sent: "Envoyée",
  viewed: "Vue",
  partial: "Partielle",
  paid: "Payée",
  late: "En retard",
  cancelled: "Annulée",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: "En attente",
  processing: "En cours",
  succeeded: "Réussi",
  failed: "Échoué",
  refunded: "Remboursé",
};

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  open: "Ouvert",
  in_progress: "En cours",
  paused: "En pause",
  resolved: "Résolu",
  closed: "Clôturé",
};

export const EDL_STATUS_LABELS: Record<EDLStatus, string> = {
  draft: "Brouillon",
  in_progress: "En cours",
  completed: "Complété",
  signed: "Signé",
  disputed: "Contesté",
};

// ============================================
// COLOR HELPERS
// ============================================

export type StatusVariant = "default" | "success" | "warning" | "danger" | "info" | "muted";

export const PROPERTY_STATUS_VARIANTS: Record<PropertyStatus, StatusVariant> = {
  draft: "muted",
  pending_review: "warning",
  published: "success",
  rejected: "danger",
  archived: "muted",
};

export const LEASE_STATUS_VARIANTS: Record<LeaseStatus, StatusVariant> = {
  draft: "muted",
  pending_signature: "warning",
  partially_signed: "info",
  fully_signed: "info",
  active: "success",
  notice_given: "warning",
  terminated: "muted",
  archived: "muted",
};

export const INVOICE_STATUS_VARIANTS: Record<InvoiceStatus, StatusVariant> = {
  draft: "muted",
  sent: "info",
  viewed: "info",
  partial: "warning",
  paid: "success",
  late: "danger",
  cancelled: "muted",
};

export const TICKET_STATUS_VARIANTS: Record<TicketStatus, StatusVariant> = {
  open: "info",
  in_progress: "warning",
  paused: "muted",
  resolved: "success",
  closed: "muted",
};

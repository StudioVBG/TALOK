/**
 * Mapping centralisé des statuts de facture pour l'UI française.
 *
 * Source de vérité pour :
 * - Labels affichés (badges, timelines, listes)
 * - Type sémantique (couleur)
 * - Groupes logiques (payé / en attente / impayé)
 *
 * Utilisé par :
 * - features/billing/components/invoice-list-unified.tsx
 * - app/owner/money/FinancesClient.tsx (calcul KPI)
 * - app/owner/invoices/[id]/page.tsx (détail facture)
 */

export type InvoiceStatusType = "success" | "warning" | "error" | "neutral" | "info";

/**
 * Labels français pour les statuts de facture.
 * Inclut tous les statuts DB existants + variantes historiques.
 */
export const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  sent: "Envoyée",
  viewed: "Vue",
  pending: "En attente",
  partial: "Partielle",
  paid: "Payée",
  receipt_generated: "Quittance émise",
  succeeded: "Payée",
  late: "En retard",
  overdue: "En retard",
  unpaid: "Impayée",
  reminder_sent: "Relance envoyée",
  collection: "En recouvrement",
  cancelled: "Annulée",
};

/**
 * Couleur sémantique de badge par statut.
 */
export const INVOICE_STATUS_TYPES: Record<string, InvoiceStatusType> = {
  draft: "neutral",
  sent: "info",
  viewed: "info",
  pending: "info",
  partial: "warning",
  paid: "success",
  receipt_generated: "success",
  succeeded: "success",
  late: "error",
  overdue: "error",
  unpaid: "error",
  reminder_sent: "warning",
  collection: "error",
  cancelled: "neutral",
};

/**
 * Statuts considérés comme "impayés" (factures en retard ou en recouvrement).
 * Utilisé par les KPI finances et les requêtes de relance.
 */
export const UNPAID_STATUSES: readonly string[] = [
  "late",
  "overdue",
  "unpaid",
  "reminder_sent",
  "collection",
] as const;

/**
 * Statuts considérés comme "en attente de paiement" (envoyées mais pas encore payées).
 */
export const PENDING_STATUSES: readonly string[] = [
  "sent",
  "viewed",
  "pending",
  "partial",
] as const;

/**
 * Statuts considérés comme "payés" (paiement reçu).
 */
export const PAID_STATUSES: readonly string[] = [
  "paid",
  "receipt_generated",
  "succeeded",
] as const;

/**
 * Retourne le label français d'un statut de facture.
 * Fallback : le statut brut si inconnu.
 */
export function getInvoiceStatusLabel(statut: string | null | undefined): string {
  if (!statut) return "Inconnu";
  return INVOICE_STATUS_LABELS[statut] ?? statut;
}

/**
 * Retourne le type sémantique de badge pour un statut de facture.
 * Fallback : "neutral".
 */
export function getInvoiceStatusType(statut: string | null | undefined): InvoiceStatusType {
  if (!statut) return "neutral";
  return INVOICE_STATUS_TYPES[statut] ?? "neutral";
}

/**
 * Vérifie si un statut de facture est considéré comme "impayé".
 */
export function isUnpaidStatus(statut: string | null | undefined): boolean {
  if (!statut) return false;
  return UNPAID_STATUSES.includes(statut);
}

/**
 * Vérifie si un statut de facture est considéré comme "en attente".
 */
export function isPendingStatus(statut: string | null | undefined): boolean {
  if (!statut) return false;
  return PENDING_STATUSES.includes(statut);
}

/**
 * Vérifie si un statut de facture est considéré comme "payé".
 */
export function isPaidStatus(statut: string | null | undefined): boolean {
  if (!statut) return false;
  return PAID_STATUSES.includes(statut);
}

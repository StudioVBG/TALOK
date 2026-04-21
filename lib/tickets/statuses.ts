/**
 * Source de vérité unique pour les statuts tickets & work_orders.
 *
 * Avant : chaque composant redéfinissait son propre tableau/map, avec des
 * valeurs qui dérivaient (ex. "done" vs "work_completed" pour le même état
 * métier). Le mapping ticket ↔ work_order était implicite et cassait
 * régulièrement l'UI.
 *
 * Règle : toute nouvelle UI consomme ces enums et labels. Aucune chaîne
 * de statut hardcodée ailleurs.
 */

// ------------------------------------------------------------------
// TICKET STATUTS — 9 valeurs autorisées par tickets_statut_check
// (cf. migration 20260408140000_tickets_module_sota.sql)
// ------------------------------------------------------------------

export const TICKET_STATUSES = [
  "open",
  "acknowledged",
  "assigned",
  "in_progress",
  "resolved",
  "closed",
  "rejected",
  "reopened",
  "paused",
] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  open: "Ouvert",
  acknowledged: "Pris en compte",
  assigned: "Assigné",
  in_progress: "En cours",
  resolved: "Résolu",
  closed: "Clôturé",
  rejected: "Rejeté",
  reopened: "Rouvert",
  paused: "En pause",
};

/** États "ouverts" = le ticket requiert encore une action */
export const TICKET_OPEN_STATUSES: readonly TicketStatus[] = [
  "open",
  "acknowledged",
  "assigned",
  "reopened",
];

/** États terminaux = le ticket n'attend plus rien */
export const TICKET_TERMINAL_STATUSES: readonly TicketStatus[] = [
  "resolved",
  "closed",
  "rejected",
];

export function isTicketOpen(status: string): boolean {
  return (TICKET_OPEN_STATUSES as readonly string[]).includes(status);
}

export function isTicketTerminal(status: string): boolean {
  return (TICKET_TERMINAL_STATUSES as readonly string[]).includes(status);
}

export function getTicketStatusLabel(status: string): string {
  return TICKET_STATUS_LABELS[status as TicketStatus] ?? status;
}

// ------------------------------------------------------------------
// WORK_ORDER STATUTS — flux intervention SOTA (18 valeurs)
// (cf. migration 20251205800000_intervention_flow_complete.sql)
// ------------------------------------------------------------------

export const WORK_ORDER_STATUSES = [
  "assigned",
  "accepted",
  "refused",
  "visit_scheduled",
  "visit_completed",
  "quote_sent",
  "quote_accepted",
  "quote_refused",
  "deposit_pending",
  "deposit_paid",
  "work_scheduled",
  "in_progress",
  "work_completed",
  "balance_pending",
  "fully_paid",
  "pending_review",
  "closed",
  "cancelled",
  "disputed",
] as const;

export type WorkOrderStatus = (typeof WORK_ORDER_STATUSES)[number];

export const WORK_ORDER_STATUS_LABELS: Record<WorkOrderStatus, string> = {
  assigned: "Assigné",
  accepted: "Accepté",
  refused: "Refusé",
  visit_scheduled: "Visite planifiée",
  visit_completed: "Visite effectuée",
  quote_sent: "Devis envoyé",
  quote_accepted: "Devis accepté",
  quote_refused: "Devis refusé",
  deposit_pending: "Acompte en attente",
  deposit_paid: "Acompte payé",
  work_scheduled: "Travaux planifiés",
  in_progress: "En cours",
  work_completed: "Travaux terminés",
  balance_pending: "Solde en attente",
  fully_paid: "Soldé",
  pending_review: "À valider",
  closed: "Clôturé",
  cancelled: "Annulé",
  disputed: "Litige",
};

export function getWorkOrderStatusLabel(status: string): string {
  return WORK_ORDER_STATUS_LABELS[status as WorkOrderStatus] ?? status;
}

// ------------------------------------------------------------------
// MAPPING work_order -> ticket
// ------------------------------------------------------------------
// Le ticket reflète la visibilité "client" (locataire/propriétaire).
// Le work_order reflète le détail opérationnel (prestataire + paiements).
// Cette fonction renvoie le statut ticket correspondant à l'état actuel
// du work_order, pour garder les deux vues cohérentes.

export function mapWorkOrderStatusToTicketStatus(
  woStatus: WorkOrderStatus | string
): TicketStatus {
  switch (woStatus) {
    case "assigned":
    case "accepted":
    case "visit_scheduled":
    case "quote_sent":
    case "quote_accepted":
    case "deposit_pending":
    case "deposit_paid":
    case "work_scheduled":
      return "assigned";

    case "visit_completed":
    case "in_progress":
      return "in_progress";

    case "work_completed":
    case "balance_pending":
    case "pending_review":
      return "resolved";

    case "fully_paid":
    case "closed":
      return "closed";

    case "refused":
    case "quote_refused":
    case "cancelled":
      return "rejected";

    case "disputed":
      return "in_progress";

    default:
      return "open";
  }
}

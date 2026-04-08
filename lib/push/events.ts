/**
 * Push notification events — définitions des événements métier
 * qui déclenchent une notification push.
 *
 * Usage:
 *   import { pushEvents, sendPushEvent } from "@/lib/push/events";
 *   await sendPushEvent("rent_paid", ownerProfileId, { amount: "450 €", invoiceId: "xxx" });
 */

import { sendPushNotification, sendPushToMultipleProfiles } from "./send";

// =====================================================
// Event definitions
// =====================================================

export const pushEvents = {
  // --- Paiements ---
  rent_paid: {
    title: (vars: Record<string, string>) =>
      `Loyer reçu : ${vars.amount}`,
    body: (vars: Record<string, string>) =>
      vars.tenantName
        ? `${vars.tenantName} a payé son loyer`
        : "Un loyer a été encaissé",
    route: (vars: Record<string, string>) =>
      `/owner/invoices/${vars.invoiceId}`,
    target: "owner" as const,
  },

  rent_overdue: {
    title: () => "Loyer en retard",
    body: (vars: Record<string, string>) =>
      vars.propertyName
        ? `Loyer impayé pour ${vars.propertyName}`
        : "Un loyer est en retard de paiement",
    route: () => "/tenant/payment",
    target: "both" as const,
  },

  // --- Tickets / Incidents ---
  new_ticket: {
    title: (vars: Record<string, string>) =>
      `Incident signalé : ${vars.ticketTitle}`,
    body: (vars: Record<string, string>) =>
      vars.propertyName
        ? `Nouveau ticket pour ${vars.propertyName}`
        : "Un nouvel incident a été signalé",
    route: (vars: Record<string, string>) =>
      `/owner/tickets/${vars.ticketId}`,
    target: "owner" as const,
  },

  // --- Devis / Interventions ---
  quote_received: {
    title: (vars: Record<string, string>) =>
      `Devis reçu : ${vars.providerName}`,
    body: (vars: Record<string, string>) =>
      vars.amount
        ? `Montant : ${vars.amount}`
        : "Un nouveau devis est disponible",
    route: (vars: Record<string, string>) =>
      `/owner/work-orders/${vars.workOrderId}`,
    target: "owner" as const,
  },

  intervention_scheduled: {
    title: (vars: Record<string, string>) =>
      `Intervention le ${vars.date}`,
    body: (vars: Record<string, string>) =>
      vars.providerName
        ? `${vars.providerName} interviendra dans votre logement`
        : "Une intervention est planifiée dans votre logement",
    route: () => "/tenant/work-orders",
    target: "tenant" as const,
  },

  // --- Documents ---
  document_available: {
    title: () => "Nouvelle quittance",
    body: (vars: Record<string, string>) =>
      vars.period
        ? `Votre quittance ${vars.period} est disponible`
        : "Une quittance est disponible",
    route: () => "/tenant/documents",
    target: "tenant" as const,
  },

  // --- Baux ---
  lease_ready_to_sign: {
    title: () => "Bail prêt à signer",
    body: (vars: Record<string, string>) =>
      vars.propertyName
        ? `Le bail pour ${vars.propertyName} est prêt`
        : "Un bail est prêt à être signé",
    route: (vars: Record<string, string>) =>
      `/tenant/lease/${vars.leaseId}`,
    target: "tenant" as const,
  },

  // --- Copropriété ---
  fund_call: {
    title: (vars: Record<string, string>) =>
      `Appel de fonds T${vars.quarter}`,
    body: (vars: Record<string, string>) =>
      vars.amount
        ? `Montant : ${vars.amount}`
        : "Un nouvel appel de fonds est disponible",
    route: (vars: Record<string, string>) =>
      `/copro/${vars.coproId}/appels`,
    target: "copro" as const,
  },

  fund_call_reminder: {
    title: () => "Rappel : appel de fonds",
    body: (vars: Record<string, string>) =>
      vars.dueDate
        ? `Échéance le ${vars.dueDate}`
        : "Votre appel de fonds est en attente de paiement",
    route: (vars: Record<string, string>) =>
      `/copro/${vars.coproId}/appels`,
    target: "copro" as const,
  },
} as const;

export type PushEventKey = keyof typeof pushEvents;

// =====================================================
// Event sender
// =====================================================

/**
 * Envoie une notification push pour un événement métier.
 *
 * @param event - clé de l'événement (e.g. "rent_paid")
 * @param profileId - ID du profil destinataire (ou tableau de profils)
 * @param vars - variables pour construire le titre/body/route
 */
export async function sendPushEvent(
  event: PushEventKey,
  profileId: string | string[],
  vars: Record<string, string> = {}
) {
  const def = pushEvents[event];
  const title = def.title(vars);
  const body = def.body(vars);
  const route = def.route(vars);

  if (Array.isArray(profileId)) {
    return sendPushToMultipleProfiles(profileId, title, body, { route });
  }
  return sendPushNotification(profileId, title, body, { route });
}

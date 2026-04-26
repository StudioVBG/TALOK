/**
 * Templates SMS transactionnels Talok.
 * Chaque template renvoie un `body` prêt à passer à `sendSMS`.
 *
 * Longueur à surveiller : 160 caractères = 1 segment GSM-7,
 * 70 caractères = 1 segment UCS-2 (si caractères spéciaux).
 */

export type SmsTemplateKey =
  | 'payment_reminder'
  | 'payment_late'
  | 'ticket_urgent'
  | 'edl_reminder'
  | 'lease_expiring'
  | 'provider_mission_assigned'
  | 'provider_quote_approved'
  | 'provider_payment_received';

export interface TemplateData {
  amount?: string | number;
  dueDate?: string;
  daysLate?: number;
  title?: string;
  date?: string;
  time?: string;
  property?: string;
  daysLeft?: number;
  /** Reference visible (devis, facture). */
  reference?: string;
  /** Adresse courte du bien (sans CP/ville pour limiter la longueur). */
  shortAddress?: string;
}

export const SMS_TEMPLATES: Record<SmsTemplateKey, (data: TemplateData) => string> = {
  payment_reminder: (d) =>
    `[Talok] Rappel : votre loyer de ${d.amount}€ est dû le ${d.dueDate}. Réglez via votre espace locataire.`,
  payment_late: (d) =>
    `[Talok] URGENT : votre loyer de ${d.amount}€ est en retard de ${d.daysLate} jour(s). Merci de régulariser rapidement.`,
  ticket_urgent: (d) =>
    `[Talok] Incident urgent signalé : ${d.title}. Connectez-vous pour plus de détails.`,
  edl_reminder: (d) =>
    `[Talok] Rappel : état des lieux prévu le ${d.date} à ${d.time} pour ${d.property}.`,
  lease_expiring: (d) =>
    `[Talok] Votre bail pour ${d.property} expire dans ${d.daysLeft} jours. Contactez votre propriétaire.`,

  // Prestataires — sous 160 caracteres = 1 segment GSM-7
  provider_mission_assigned: (d) =>
    `[Talok] Nouvelle mission : ${d.title}${d.shortAddress ? ` à ${d.shortAddress}` : ''}${d.date ? ` le ${d.date}` : ''}. Voir le détail dans l'app.`,
  provider_quote_approved: (d) =>
    `[Talok] Devis ${d.reference} accepté pour ${d.amount}€. Vous pouvez planifier l'intervention.`,
  provider_payment_received: (d) =>
    `[Talok] Paiement reçu : ${d.amount}€ pour la facture ${d.reference}. Merci !`,
};

export function renderTemplate(key: SmsTemplateKey, data: TemplateData): string {
  const fn = SMS_TEMPLATES[key];
  if (!fn) throw new Error(`Template SMS inconnu : ${key}`);
  return fn(data);
}

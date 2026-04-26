/**
 * Helpers SMS Twilio pour les notifications prestataire.
 *
 * Wrap sendSMS + renderTemplate avec le bon SmsContext et les conversions
 * de format (montants, references). Best-effort par defaut : tout echec
 * est logge mais ne fait pas planter le flow appelant.
 */

import { sendSMS } from './send';
import { renderTemplate } from './templates';
import type { SendSmsResult } from './send';
import { logger } from '@/lib/monitoring';

function formatAmountFr(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

interface BaseProviderSmsContext {
  /** Telephone destinataire au format libre (sera normalise E.164). */
  phone: string;
  /** profile_id du prestataire (pour tracking sms_messages). */
  providerProfileId: string;
}

/**
 * SMS : nouvelle mission assignee.
 * Declenche par l'assignation d'un work_order ou ticket.
 */
export async function sendProviderMissionAssignedSms(
  data: BaseProviderSmsContext & {
    /** Titre court (ex : "Reparation fuite") */
    title: string;
    /** Adresse courte (rue + ville si possible). Optionnel. */
    shortAddress?: string | null;
    /** Date prevue formatee (ex : "12/05") — optionnelle. */
    date?: string | null;
    /** UUID du ticket / work_order pour tracking. */
    relatedId?: string;
  },
): Promise<SendSmsResult> {
  const body = renderTemplate('provider_mission_assigned', {
    title: data.title,
    shortAddress: data.shortAddress ?? undefined,
    date: data.date ?? undefined,
  });

  return sendSMS({
    to: data.phone,
    body,
    context: {
      profileId: data.providerProfileId,
      type: 'notification',
      relatedId: data.relatedId,
    },
  });
}

/**
 * SMS : devis accepte par le proprietaire.
 * Declenche par /api/provider/quotes/[id]/accept.
 */
export async function sendProviderQuoteApprovedSms(
  data: BaseProviderSmsContext & {
    quoteReference: string;
    /** Montant TTC en euros (sera formate "1 234,56"). */
    totalAmountEuros: number;
    quoteId: string;
  },
): Promise<SendSmsResult> {
  const body = renderTemplate('provider_quote_approved', {
    reference: data.quoteReference,
    amount: formatAmountFr(data.totalAmountEuros),
  });

  return sendSMS({
    to: data.phone,
    body,
    context: {
      profileId: data.providerProfileId,
      type: 'notification',
      relatedId: data.quoteId,
    },
  });
}

/**
 * SMS : paiement de facture recu.
 * Declenche par /api/provider/invoices/[id]/payments (POST mark as paid).
 */
export async function sendProviderPaymentReceivedSms(
  data: BaseProviderSmsContext & {
    invoiceReference: string;
    amountEuros: number;
    invoiceId: string;
  },
): Promise<SendSmsResult> {
  const body = renderTemplate('provider_payment_received', {
    reference: data.invoiceReference,
    amount: formatAmountFr(data.amountEuros),
  });

  return sendSMS({
    to: data.phone,
    body,
    context: {
      profileId: data.providerProfileId,
      type: 'notification',
      relatedId: data.invoiceId,
    },
  });
}

/**
 * Wrapper "best-effort" : log mais ne throw jamais. A utiliser dans les
 * routes API ou un echec SMS ne doit pas faire planter le flow.
 */
export async function sendProviderSmsBestEffort(
  fn: () => Promise<SendSmsResult>,
  label: string,
): Promise<void> {
  try {
    const result = await fn();
    if (!result.success) {
      logger.warn(`[provider-sms] ${label} failed: ${result.error || 'unknown'}`);
    }
  } catch (err) {
    logger.warn(`[provider-sms] ${label} threw:`, err);
  }
}

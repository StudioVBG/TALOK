/**
 * Envoi de SMS non-OTP (rappels, notifications, custom).
 *
 * Pour les OTP de vérification téléphone, utiliser lib/sms/verify.ts
 * (Twilio Verify Service, pas SMS direct).
 */

import { getTwilioClient, resolveTwilioCredentials } from './client';
import { normalizePhoneE164, maskPhone } from './phone';
import { recordSmsMessage, type SmsContext } from './logs';
import { logger } from '@/lib/monitoring';

export interface SendSmsParams {
  /** Numéro au format libre (sera normalisé en E.164). */
  to: string;
  /** Corps du message (max 1600 caractères, soit 10 segments). */
  body: string;
  /** Contexte applicatif obligatoire pour le tracking. */
  context: SmsContext;
}

export interface SendSmsResult {
  success: boolean;
  sid?: string;
  status?: string;
  error?: string;
  errorCode?: string | number;
  /** Numéro E.164 effectivement utilisé. */
  to?: string;
}

/**
 * Envoie un SMS transactionnel via Twilio et enregistre l'événement en DB.
 *
 * Rules:
 * - Ne throw pas sur échec Twilio : renvoie { success: false, ... }
 * - Throw uniquement sur données invalides (numéro non normalisable)
 * - Non-bloquant côté logs : l'écriture DB échoue silencieusement
 */
export async function sendSMS(params: SendSmsParams): Promise<SendSmsResult> {
  const e164 = normalizePhoneE164(params.to);

  let creds;
  try {
    creds = await resolveTwilioCredentials();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Twilio non configuré';
    logger.warn('sms.send.not_configured', { to_masked: maskPhone(e164) });
    await recordSmsMessage({
      sid: null,
      to: e164,
      body: params.body,
      status: 'failed',
      errorMessage: message,
      context: params.context,
    });
    return { success: false, error: message, to: e164 };
  }

  const client = await getTwilioClient();

  const statusCallback = buildStatusCallback();

  try {
    const msg = await client.messages.create({
      to: e164,
      body: params.body,
      ...(creds.messagingServiceSid
        ? { messagingServiceSid: creds.messagingServiceSid }
        : { from: creds.phoneNumber ?? undefined }),
      ...(statusCallback ? { statusCallback } : {}),
    });

    await recordSmsMessage({
      sid: msg.sid,
      to: e164,
      body: params.body,
      status: msg.status,
      context: params.context,
    });

    logger.info('sms.send.success', {
      sid: msg.sid,
      to_masked: maskPhone(e164),
      type: params.context.type,
    });

    return { success: true, sid: msg.sid, status: msg.status, to: e164 };
  } catch (err: any) {
    const errorCode = err?.code ? String(err.code) : undefined;
    const errorMessage = err?.message ?? 'Erreur Twilio';

    logger.error('sms.send.failed', {
      errorCode,
      error: errorMessage,
      to_masked: maskPhone(e164),
      type: params.context.type,
    });

    await recordSmsMessage({
      sid: null,
      to: e164,
      body: params.body,
      status: 'failed',
      errorCode,
      errorMessage,
      context: params.context,
    });

    return {
      success: false,
      error: errorMessage,
      errorCode,
      to: e164,
    };
  }
}

function buildStatusCallback(): string | null {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) return null;
  try {
    const url = new URL('/api/webhooks/twilio', appUrl);
    return url.toString();
  } catch {
    return null;
  }
}

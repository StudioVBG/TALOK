/**
 * Envoi de SMS non-OTP (rappels, notifications, custom).
 *
 * Pour les OTP de vérification téléphone, utiliser lib/sms/verify.ts
 * (Twilio Verify Service, pas SMS direct).
 */

import { getTwilioClient, resolveTwilioCredentials } from './client';
import { normalizePhoneE164, maskPhone } from './phone';
import { recordSmsMessage, type SmsContext } from './logs';
import { assertSmsQuota, SmsQuotaExceededError } from './usage';
import { translateTwilioError } from './errors';
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
  /** Code métier pour discriminer côté appelant. */
  code?: 'sms_quota_exceeded' | 'sms_not_configured' | 'twilio_error';
  /** Numéro E.164 effectivement utilisé. */
  to?: string;
  /** Quota state renvoyé en cas de blocage quota. */
  quota?: { current: number; limit: number; plan: string };
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

  // Hard monthly quota per plan (sms_quota_exceeded). Only applies to
  // contexts liés à un profil (profileId fourni) — les envois système
  // sans profil (ex: support admin) ne sont pas plafonnés ici.
  if (params.context.profileId) {
    try {
      await assertSmsQuota(params.context.profileId);
    } catch (err) {
      if (err instanceof SmsQuotaExceededError) {
        logger.warn('sms.send.quota_exceeded', {
          profileId: params.context.profileId,
          current: err.current,
          limit: err.limit,
          plan: err.plan,
          to_masked: maskPhone(e164),
        });
        await recordSmsMessage({
          sid: null,
          to: e164,
          body: params.body,
          status: 'failed',
          errorCode: 'sms_quota_exceeded',
          errorMessage: err.message,
          context: params.context,
        });
        return {
          success: false,
          code: 'sms_quota_exceeded',
          error: err.message,
          to: e164,
          quota: { current: err.current, limit: err.limit, plan: err.plan },
        };
      }
      // Erreur non-métier → on laisse passer (fail-open sur la lecture).
    }
  }

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
    return { success: false, code: 'sms_not_configured', error: message, to: e164 };
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
    const rawMessage = err?.message ?? 'Erreur Twilio';
    const translated = translateTwilioError(err?.code ?? null);

    logger.error('sms.send.failed', {
      errorCode,
      error: rawMessage,
      to_masked: maskPhone(e164),
      type: params.context.type,
    });

    await recordSmsMessage({
      sid: null,
      to: e164,
      body: params.body,
      status: 'failed',
      errorCode,
      // On conserve le message brut en DB pour le debug interne,
      // pas côté client.
      errorMessage: rawMessage,
      context: params.context,
    });

    return {
      success: false,
      code: 'twilio_error',
      error: translated.message,
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

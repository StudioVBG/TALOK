/**
 * OTP via Twilio Verify Service (géré côté Twilio : expiration,
 * max attempts, fraud detection, localisation).
 *
 * Aucun OTP n'est stocké côté Talok : Verify est la source de vérité.
 */

import { getTwilioClient, getVerifyServiceSid } from './client';
import { normalizePhoneE164, maskPhone, detectTerritory } from './phone';
import { translateTwilioError } from './errors';
import { trackSmsEvent } from './monitoring';
import { logger } from '@/lib/monitoring';

export type VerifyChannel = 'sms' | 'call';

export interface StartVerificationResult {
  success: boolean;
  status?: 'pending' | 'approved' | 'canceled' | string;
  sid?: string;
  /** Numéro E.164 effectivement utilisé. */
  e164?: string;
  error?: string;
  errorCode?: string | number;
}

export interface CheckVerificationResult {
  success: boolean;
  approved: boolean;
  status?: 'pending' | 'approved' | 'canceled' | string;
  error?: string;
  errorCode?: string | number;
}

/**
 * Déclenche l'envoi d'un OTP par SMS (ou voice) pour un numéro.
 *
 * @throws si le numéro est invalide (avant appel Twilio).
 */
export async function startVerification(
  phone: string,
  channel: VerifyChannel = 'sms',
): Promise<StartVerificationResult> {
  const e164 = normalizePhoneE164(phone);

  let serviceSid: string;
  try {
    serviceSid = getVerifyServiceSid();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Verify Service non configuré';
    return { success: false, error: message };
  }

  try {
    const client = await getTwilioClient();
    const v = await client.verify.v2
      .services(serviceSid)
      .verifications.create({
        to: e164,
        channel,
        locale: 'fr',
      });

    const territory = detectTerritory(e164);
    logger.info('sms.verify.start', {
      sid: v.sid,
      status: v.status,
      to_masked: maskPhone(e164),
      territory,
      channel,
    });
    trackSmsEvent('verify_start', { territory, contextType: 'otp' });

    return { success: true, status: v.status, sid: v.sid, e164 };
  } catch (err: any) {
    const errorCode = err?.code ? String(err.code) : undefined;
    const translated = translateTwilioError(err?.code ?? null);
    const territory = detectTerritory(e164);

    logger.error('sms.verify.start_failed', {
      errorCode,
      error: err?.message,
      to_masked: maskPhone(e164),
    });
    trackSmsEvent('verify_failed', {
      territory,
      errorCode: err?.code ?? null,
      contextType: 'otp',
    });

    return {
      success: false,
      error: translated.message,
      errorCode,
      e164,
    };
  }
}

/**
 * Vérifie un code OTP. Retourne `approved: true` si Twilio confirme.
 * Gère implicitement max attempts et expiration côté Twilio.
 */
export async function checkVerification(
  phone: string,
  code: string,
): Promise<CheckVerificationResult> {
  const e164 = normalizePhoneE164(phone);

  let serviceSid: string;
  try {
    serviceSid = getVerifyServiceSid();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Verify Service non configuré';
    return { success: false, approved: false, error: message };
  }

  try {
    const client = await getTwilioClient();
    const check = await client.verify.v2
      .services(serviceSid)
      .verificationChecks.create({ to: e164, code });

    const approved = check.status === 'approved';
    const territory = detectTerritory(e164);
    logger.info('sms.verify.check', {
      status: check.status,
      approved,
      to_masked: maskPhone(e164),
    });
    trackSmsEvent(approved ? 'verify_ok' : 'verify_failed', {
      territory,
      errorCode: approved ? null : check.status,
      contextType: 'otp',
    });

    return { success: true, approved, status: check.status };
  } catch (err: any) {
    const errorCode = err?.code ? String(err.code) : undefined;
    const translated = translateTwilioError(err?.code ?? null);

    // Code 20404 = verification not found (expiré ou déjà consommé)
    logger.warn('sms.verify.check_failed', {
      errorCode,
      error: err?.message,
      to_masked: maskPhone(e164),
    });
    trackSmsEvent('verify_failed', {
      territory: detectTerritory(e164),
      errorCode: err?.code ?? null,
      contextType: 'otp',
    });

    return {
      success: false,
      approved: false,
      error: translated.message,
      errorCode,
    };
  }
}

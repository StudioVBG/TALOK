/**
 * Guard cumulatif pour les flows SMS.
 *
 * Empile `perUser`, `perUserDaily`, `perDestination`, `perDestinationDaily`
 * et `perIp`. La 1re violation bloque l'appel et est retournée avec un
 * message FR + `retryAfterSec`.
 */

import { applyRateLimit, type RateLimitResult } from './upstash';
import { SMS_RATE_LIMITS } from './sms-presets';
import { trackSmsEvent } from '@/lib/sms/monitoring';

export interface SmsGuardInput {
  userId: string;
  destinationE164: string;
  ip: string;
}

export type SmsGuardResult =
  | { allowed: true }
  | {
      allowed: false;
      reason: string;
      reasonKey: 'user' | 'user_daily' | 'destination' | 'destination_daily' | 'ip';
      retryAfterSec: number;
      resetAt: number;
    };

const MESSAGES: Record<Exclude<SmsGuardResult, { allowed: true }>['reasonKey'], string> = {
  user: 'Trop de SMS envoyés récemment. Patientez quelques instants.',
  user_daily: "Limite quotidienne d'envois SMS atteinte. Réessayez demain.",
  destination: 'Ce numéro a déjà reçu plusieurs SMS à l\'instant. Patientez avant de réessayer.',
  destination_daily: 'Ce numéro a atteint sa limite journalière de SMS.',
  ip: 'Trop de requêtes depuis votre réseau. Réessayez dans quelques instants.',
};

/**
 * Applique la séquence de rate limits SMS. Renvoie la 1re violation.
 * En cas de succès, les 5 compteurs ont été incrémentés.
 */
export async function checkSmsRateLimit(input: SmsGuardInput): Promise<SmsGuardResult> {
  const stages = [
    { key: `sms:user:${input.userId}`, cfg: SMS_RATE_LIMITS.perUser, reasonKey: 'user' as const },
    {
      key: `sms:user-daily:${input.userId}`,
      cfg: SMS_RATE_LIMITS.perUserDaily,
      reasonKey: 'user_daily' as const,
    },
    {
      key: `sms:dest:${input.destinationE164}`,
      cfg: SMS_RATE_LIMITS.perDestination,
      reasonKey: 'destination' as const,
    },
    {
      key: `sms:dest-daily:${input.destinationE164}`,
      cfg: SMS_RATE_LIMITS.perDestinationDaily,
      reasonKey: 'destination_daily' as const,
    },
    { key: `sms:ip:${input.ip}`, cfg: SMS_RATE_LIMITS.perIp, reasonKey: 'ip' as const },
  ];

  for (const stage of stages) {
    const res: RateLimitResult = await applyRateLimit({ key: stage.key, ...stage.cfg });
    if (!res.allowed) {
      trackSmsEvent('rate_limited', {
        userId: input.userId,
        rateLimitReason: stage.reasonKey,
      });
      return {
        allowed: false,
        reason: MESSAGES[stage.reasonKey],
        reasonKey: stage.reasonKey,
        retryAfterSec: res.retryAfterSec ?? stage.cfg.windowSec,
        resetAt: res.resetAt,
      };
    }
  }

  return { allowed: true };
}

/**
 * Guard pour la vérification d'OTP (brute-force côté applicatif).
 * Même si Twilio Verify bloque nativement après N tentatives, on
 * veut éviter qu'un attaquant découvre ce seuil en tapant 100/min.
 */
export async function checkOtpVerifyRateLimit(userId: string): Promise<SmsGuardResult> {
  const res = await applyRateLimit({
    key: `sms:verify:${userId}`,
    ...SMS_RATE_LIMITS.verifyPerUser,
  });
  if (res.allowed) return { allowed: true };

  trackSmsEvent('rate_limited', { userId, rateLimitReason: 'verify' });
  return {
    allowed: false,
    reason: 'Trop de tentatives de vérification. Réessayez dans quelques minutes.',
    reasonKey: 'user',
    retryAfterSec: res.retryAfterSec ?? SMS_RATE_LIMITS.verifyPerUser.windowSec,
    resetAt: res.resetAt,
  };
}

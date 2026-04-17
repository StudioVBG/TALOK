/**
 * Presets cumulatifs pour les flows SMS / OTP.
 * Les 3 niveaux (user, destination, IP) sont évalués en série par
 * `checkSmsRateLimit` — la 1re violation bloque l'appel.
 */

export interface RateLimitPreset {
  limit: number;
  windowSec: number;
}

export const SMS_RATE_LIMITS = {
  /** Limite par user authentifié — court terme. */
  perUser: { limit: 5, windowSec: 60 } satisfies RateLimitPreset,
  /** Limite par user authentifié — journalier. */
  perUserDaily: { limit: 50, windowSec: 86_400 } satisfies RateLimitPreset,

  /** Limite par numéro destination — anti-spam d'un tiers. */
  perDestination: { limit: 3, windowSec: 60 } satisfies RateLimitPreset,
  /** Limite par numéro destination — journalier. */
  perDestinationDaily: { limit: 10, windowSec: 86_400 } satisfies RateLimitPreset,

  /** Limite par IP — défense anti-énumération. */
  perIp: { limit: 10, windowSec: 60 } satisfies RateLimitPreset,

  /** Limite stricte pour la vérification d'OTP (brute-force). */
  verifyPerUser: { limit: 5, windowSec: 15 * 60 } satisfies RateLimitPreset,
} as const;

export type SmsRateLimitKey = keyof typeof SMS_RATE_LIMITS;

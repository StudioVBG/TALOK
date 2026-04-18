/**
 * Monitoring SMS structuré (Sentry).
 *
 * Règles :
 * - Toujours un breadcrumb (catégorie `sms`) pour tracer le flow.
 * - `captureMessage` uniquement sur les événements actionnables
 *   (échec d'envoi / quota / rate-limit).
 * - Tags dédiés : `sms.error_code`, `sms.territory`, `sms.event` —
 *   facile à filtrer dans le dashboard Sentry.
 * - Aucun PII côté tags (pas de numéro brut, pas de user_id).
 */

import * as Sentry from '@sentry/nextjs';

export type SmsEvent =
  | 'sent'
  | 'failed'
  | 'verify_start'
  | 'verify_ok'
  | 'verify_failed'
  | 'quota_exceeded'
  | 'rate_limited'
  | 'webhook_invalid_signature';

export interface SmsEventData {
  /** profile_id (stocké en breadcrumb data, pas en tag Sentry). */
  userId?: string;
  /** Code ISO (FR, MQ, GP, ...) déjà masqué côté PII. */
  territory?: string | null;
  /** Code d'erreur Twilio ou code métier (sms_quota_exceeded, ...). */
  errorCode?: number | string | null;
  /** Latence Twilio en ms (mesurée côté app). */
  latencyMs?: number;
  /** Contexte applicatif — ex: `notification`, `otp`, `reminder`. */
  contextType?: string;
  /** Raison du rate-limit (user, destination, ip). */
  rateLimitReason?: string;
}

function shouldCapture(event: SmsEvent): boolean {
  return (
    event === 'failed' ||
    event === 'verify_failed' ||
    event === 'quota_exceeded' ||
    event === 'rate_limited' ||
    event === 'webhook_invalid_signature'
  );
}

function sentryLevel(event: SmsEvent): Sentry.SeverityLevel {
  if (event === 'quota_exceeded' || event === 'rate_limited') return 'warning';
  if (event === 'webhook_invalid_signature') return 'error';
  if (event.includes('fail')) return 'error';
  return 'info';
}

/**
 * Enregistre un événement SMS dans Sentry.
 * Ne throw jamais — l'instrumentation ne doit pas casser le flux.
 */
export function trackSmsEvent(event: SmsEvent, data: SmsEventData = {}): void {
  try {
    Sentry.addBreadcrumb({
      category: 'sms',
      level: sentryLevel(event),
      message: `sms.${event}`,
      data: {
        user_id: data.userId,
        territory: data.territory ?? null,
        twilio_error_code: data.errorCode ?? null,
        latency_ms: data.latencyMs ?? null,
        context_type: data.contextType ?? null,
        rate_limit_reason: data.rateLimitReason ?? null,
      },
    });

    if (shouldCapture(event)) {
      Sentry.captureMessage(`sms.${event}`, {
        level: sentryLevel(event),
        tags: {
          'sms.event': event,
          'sms.error_code': data.errorCode != null ? String(data.errorCode) : 'unknown',
          'sms.territory': data.territory ?? 'unknown',
          ...(data.contextType ? { 'sms.context': data.contextType } : {}),
          ...(data.rateLimitReason ? { 'sms.rl_reason': data.rateLimitReason } : {}),
        },
      });
    }
  } catch (err) {
    // Jamais bloquant. Logguer en console pour ne pas perdre complètement le signal.
    console.error('[sms.monitoring] trackSmsEvent error:', err);
  }
}

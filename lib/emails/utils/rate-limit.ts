/**
 * Rate limiting utility for email sending
 *
 * Protège contre l'envoi massif d'emails en limitant le nombre
 * d'emails par destinataire et globalement.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// Cache en mémoire pour le rate limiting
const rateLimitCache = new Map<string, RateLimitEntry>();

// Cleanup automatique toutes les 5 minutes
let cleanupInterval: NodeJS.Timeout | null = null;

function startCleanupInterval() {
  if (cleanupInterval) return;

  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitCache.entries()) {
      if (entry.resetAt < now) {
        rateLimitCache.delete(key);
      }
    }
  }, 5 * 60 * 1000);

  // Ne pas empêcher le process de se terminer
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }
}

export interface RateLimitConfig {
  /** Limite par destinataire par minute (défaut: 5) */
  perRecipientPerMinute?: number;
  /** Limite globale par minute (défaut: 100) */
  globalPerMinute?: number;
  /** Limite par destinataire par heure (défaut: 20) */
  perRecipientPerHour?: number;
  /** Limite globale par heure (défaut: 500) */
  globalPerHour?: number;
}

const DEFAULT_CONFIG: Required<RateLimitConfig> = {
  perRecipientPerMinute: 5,
  globalPerMinute: 100,
  perRecipientPerHour: 20,
  globalPerHour: 500,
};

export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  retryAfterMs?: number;
}

/**
 * Vérifie et met à jour le compteur de rate limit
 */
function checkAndIncrement(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const entry = rateLimitCache.get(key);

  // Pas d'entrée ou entrée expirée
  if (!entry || entry.resetAt < now) {
    rateLimitCache.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  // Vérifier la limite
  if (entry.count >= limit) {
    return {
      allowed: false,
      retryAfterMs: entry.resetAt - now,
    };
  }

  // Incrémenter le compteur
  entry.count++;
  return { allowed: true };
}

/**
 * Vérifie si un email peut être envoyé selon les limites configurées
 *
 * @param recipient - Adresse email du destinataire
 * @param config - Configuration des limites (optionnel)
 * @returns Résultat indiquant si l'envoi est autorisé
 *
 * @example
 * ```typescript
 * const result = checkRateLimit('user@example.com');
 * if (!result.allowed) {
 *   console.log(`Rate limit atteint: ${result.reason}`);
 *   console.log(`Réessayer dans ${result.retryAfterMs}ms`);
 * }
 * ```
 */
export function checkRateLimit(
  recipient: string,
  config: RateLimitConfig = {}
): RateLimitResult {
  startCleanupInterval();

  const opts = { ...DEFAULT_CONFIG, ...config };
  const normalizedRecipient = recipient.toLowerCase().trim();

  // 1. Vérifier la limite par destinataire (minute)
  const recipientMinuteKey = `recipient:minute:${normalizedRecipient}`;
  const recipientMinuteCheck = checkAndIncrement(
    recipientMinuteKey,
    opts.perRecipientPerMinute,
    60 * 1000
  );

  if (!recipientMinuteCheck.allowed) {
    return {
      allowed: false,
      reason: `Trop d'emails vers ${recipient} (limite: ${opts.perRecipientPerMinute}/min)`,
      retryAfterMs: recipientMinuteCheck.retryAfterMs,
    };
  }

  // 2. Vérifier la limite par destinataire (heure)
  const recipientHourKey = `recipient:hour:${normalizedRecipient}`;
  const recipientHourCheck = checkAndIncrement(
    recipientHourKey,
    opts.perRecipientPerHour,
    60 * 60 * 1000
  );

  if (!recipientHourCheck.allowed) {
    return {
      allowed: false,
      reason: `Trop d'emails vers ${recipient} (limite: ${opts.perRecipientPerHour}/heure)`,
      retryAfterMs: recipientHourCheck.retryAfterMs,
    };
  }

  // 3. Vérifier la limite globale (minute)
  const globalMinuteCheck = checkAndIncrement(
    'global:minute',
    opts.globalPerMinute,
    60 * 1000
  );

  if (!globalMinuteCheck.allowed) {
    return {
      allowed: false,
      reason: `Limite globale d'envoi atteinte (${opts.globalPerMinute}/min)`,
      retryAfterMs: globalMinuteCheck.retryAfterMs,
    };
  }

  // 4. Vérifier la limite globale (heure)
  const globalHourCheck = checkAndIncrement(
    'global:hour',
    opts.globalPerHour,
    60 * 60 * 1000
  );

  if (!globalHourCheck.allowed) {
    return {
      allowed: false,
      reason: `Limite globale d'envoi atteinte (${opts.globalPerHour}/heure)`,
      retryAfterMs: globalHourCheck.retryAfterMs,
    };
  }

  return { allowed: true };
}

/**
 * Vérifie les limites pour plusieurs destinataires
 */
export function checkRateLimitBatch(
  recipients: string[],
  config: RateLimitConfig = {}
): RateLimitResult {
  for (const recipient of recipients) {
    const result = checkRateLimit(recipient, config);
    if (!result.allowed) {
      return result;
    }
  }
  return { allowed: true };
}

/**
 * Réinitialise le cache de rate limit (utile pour les tests)
 */
export function resetRateLimitCache(): void {
  rateLimitCache.clear();
}

/**
 * Obtient les statistiques actuelles du rate limit
 */
export function getRateLimitStats(): {
  entriesCount: number;
  globalMinuteCount: number;
  globalHourCount: number;
} {
  const now = Date.now();
  const globalMinute = rateLimitCache.get('global:minute');
  const globalHour = rateLimitCache.get('global:hour');

  return {
    entriesCount: rateLimitCache.size,
    globalMinuteCount: globalMinute && globalMinute.resetAt > now ? globalMinute.count : 0,
    globalHourCount: globalHour && globalHour.resetAt > now ? globalHour.count : 0,
  };
}

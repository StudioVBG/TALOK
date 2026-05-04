/**
 * Rate limit centralisé pour les routes consommant l'API Google Places.
 *
 * Objectif : limiter le coût (~$17 / 1000 appels Place Details, $32 / 1000
 * Geocoding) et empêcher un user ou un script malveillant de cramer le
 * budget Google en quelques minutes.
 *
 * Strategie defense in depth :
 *   - Limite par user (auth) : 30/h et 200/jour
 *   - Limite par IP (anonyme ou non) : 60/h
 * Toutes ces limites sont independantes — la plus stricte s'applique.
 *
 * Configurable via env vars (defaut sain en l'absence) :
 *   GOOGLE_PLACES_LIMIT_PER_USER_HOUR (default 30)
 *   GOOGLE_PLACES_LIMIT_PER_USER_DAY  (default 200)
 *   GOOGLE_PLACES_LIMIT_PER_IP_HOUR   (default 60)
 */

import { applyRateLimit, extractClientIp, rateLimitHeaders, type RateLimitResult } from "./upstash";

const LIMITS = {
  perUserHour:  Number(process.env.GOOGLE_PLACES_LIMIT_PER_USER_HOUR ?? 30),
  perUserDay:   Number(process.env.GOOGLE_PLACES_LIMIT_PER_USER_DAY  ?? 200),
  perIpHour:    Number(process.env.GOOGLE_PLACES_LIMIT_PER_IP_HOUR   ?? 60),
};

const HOUR_SEC = 60 * 60;
const DAY_SEC  = 24 * 60 * 60;

export interface CheckOptions {
  /** Identifiant logique de la route (ex "nearby", "geocode", "place-details"). */
  scope: string;
  /** ID utilisateur authentifie. null si appel anonyme. */
  userId: string | null;
  /** Requete entrante pour extraire l'IP. */
  request: Request;
}

export interface CheckResult {
  allowed: boolean;
  /** Headers a renvoyer au client (toujours inclus, meme en succes). */
  headers: Record<string, string>;
  /** Premiere limite atteinte si !allowed. */
  hit?: { dimension: "user_hour" | "user_day" | "ip_hour"; result: RateLimitResult };
}

/**
 * Applique les 3 limites en sequence. Stoppe au premier echec et retourne le
 * resultat avec les headers de rate-limit standards (X-RateLimit-*, Retry-After).
 */
export async function checkGooglePlacesQuota(opts: CheckOptions): Promise<CheckResult> {
  const ip = extractClientIp(opts.request);
  type Dimension = "user_hour" | "user_day" | "ip_hour";
  const checks: Array<{ dimension: Dimension; key: string; limit: number; windowSec: number }> = [];

  if (opts.userId) {
    checks.push({
      dimension: "user_hour" as const,
      key: `gplaces:${opts.scope}:user:${opts.userId}:h`,
      limit: LIMITS.perUserHour,
      windowSec: HOUR_SEC,
    });
    checks.push({
      dimension: "user_day" as const,
      key: `gplaces:${opts.scope}:user:${opts.userId}:d`,
      limit: LIMITS.perUserDay,
      windowSec: DAY_SEC,
    });
  }

  checks.push({
    dimension: "ip_hour" as const,
    key: `gplaces:${opts.scope}:ip:${ip}:h`,
    limit: LIMITS.perIpHour,
    windowSec: HOUR_SEC,
  });

  for (const check of checks) {
    const result = await applyRateLimit({
      key: check.key,
      limit: check.limit,
      windowSec: check.windowSec,
    });
    if (!result.allowed) {
      return {
        allowed: false,
        headers: rateLimitHeaders(result),
        hit: { dimension: check.dimension, result },
      };
    }
  }

  return {
    allowed: true,
    headers: {},
  };
}

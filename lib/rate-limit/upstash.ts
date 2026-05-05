/**
 * Rate limiter distribué (Upstash Redis) — fenêtre fixe.
 *
 * Approche volontairement simple : un compteur `INCR` par bucket
 * `Math.floor(now / windowSec)`. Résolution = windowSec (pas de
 * sliding window), largement suffisant pour de l'anti-abus SMS.
 *
 * À utiliser pour les flux SMS / OTP qui doivent survivre en
 * environnement serverless multi-instances (Vercel).
 * Ne remplace pas lib/security/rate-limit.ts (route-level legacy).
 */

import { Redis } from '@upstash/redis';

let cachedRedis: Redis | null = null;

/**
 * Retourne un client Redis singleton depuis l'environnement.
 * `null` si UPSTASH_REDIS_REST_URL/TOKEN absent → fail-open (dev).
 */
export function getRedis(): Redis | null {
  if (cachedRedis) return cachedRedis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  cachedRedis = Redis.fromEnv();
  return cachedRedis;
}

export interface RateLimitConfig {
  /** Clé logique : ex `sms:user:{uuid}`, `sms:phone:{e164}`. */
  key: string;
  /** Nombre max de hits autorisés dans la fenêtre. */
  limit: number;
  /** Taille de la fenêtre, en secondes. */
  windowSec: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Quota restant dans la fenêtre courante. */
  remaining: number;
  /** Fin de la fenêtre en epoch seconds. */
  resetAt: number;
  /** Secondes à attendre avant le prochain essai autorisé. */
  retryAfterSec: number | null;
}

/**
 * Applique un rate limit et incrémente le compteur.
 *
 * Fail-open : si Redis est down, on laisse passer (on préfère
 * quelques SMS abusifs plutôt qu'un blocage total de l'app).
 * Le fail-open est loggué pour alerter l'équipe ops.
 */
export async function applyRateLimit(cfg: RateLimitConfig): Promise<RateLimitResult> {
  const nowSec = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(nowSec / cfg.windowSec);
  const resetAt = (bucket + 1) * cfg.windowSec;

  const redis = getRedis();
  if (!redis) {
    // Dev / absence de Redis : fail-open sans incrément.
    return {
      allowed: true,
      remaining: cfg.limit,
      resetAt,
      retryAfterSec: null,
    };
  }

  const redisKey = `rl:${cfg.key}:${bucket}`;
  let count: number;
  try {
    count = (await redis.incr(redisKey)) as number;
    if (count === 1) {
      // Expire juste après la fin de la fenêtre pour GC.
      await redis.expire(redisKey, cfg.windowSec + 5);
    }
  } catch (err) {
    console.error('[rate-limit] Redis error (fail-open):', err);
    return {
      allowed: true,
      remaining: cfg.limit,
      resetAt,
      retryAfterSec: null,
    };
  }

  const allowed = count <= cfg.limit;
  return {
    allowed,
    remaining: Math.max(0, cfg.limit - count),
    resetAt,
    retryAfterSec: allowed ? null : Math.max(1, resetAt - nowSec),
  };
}

/**
 * Construit les headers HTTP standards pour une réponse 429.
 */
export function rateLimitHeaders(r: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Remaining': String(r.remaining),
    'X-RateLimit-Reset': String(r.resetAt),
  };
  if (r.retryAfterSec !== null) {
    headers['Retry-After'] = String(r.retryAfterSec);
  }
  return headers;
}

/**
 * Extrait la première IP d'un header x-forwarded-for (ou x-real-ip).
 * Retourne "unknown" en fallback.
 */
export function extractClientIp(req: Request | { headers: Headers | { get(name: string): string | null } }): string {
  const get = (name: string): string | null => {
    const h = (req as any).headers;
    if (!h) return null;
    if (typeof h.get === 'function') return h.get(name);
    return null;
  };
  const fwd = get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]?.trim() || 'unknown';
  const real = get('x-real-ip');
  if (real) return real.trim();
  return 'unknown';
}

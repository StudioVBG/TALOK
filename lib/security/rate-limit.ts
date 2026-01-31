/**
 * Rate Limiting avec Redis (Upstash) pour production
 *
 * Fournit un rate limiting distribué qui fonctionne avec:
 * - Déploiements multi-instances (Vercel, K8s, etc.)
 * - Serverless functions
 * - Edge runtime
 *
 * Fallback en mémoire si Redis n'est pas disponible (développement)
 *
 * @module lib/security/rate-limit
 * @security CRITICAL - Protège contre les abus et DoS
 */

import { NextResponse } from "next/server";

// Type pour le client Redis
interface RedisClient {
  incr: (key: string) => Promise<number>;
  expire: (key: string, seconds: number) => Promise<number>;
  ttl: (key: string) => Promise<number>;
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, options?: { ex?: number }) => Promise<string | null>;
}

// Configuration des presets de rate limiting
export const rateLimitPresets = {
  // Limite stricte pour les paiements
  payment: {
    windowMs: 60 * 1000,
    maxRequests: 5,
  },
  // Limite pour les authentifications
  auth: {
    windowMs: 15 * 60 * 1000,
    maxRequests: 5,
  },
  // Limite pour les inscriptions
  signup: {
    windowMs: 60 * 60 * 1000,
    maxRequests: 3,
  },
  // Limite générale pour les API
  api: {
    windowMs: 60 * 1000,
    maxRequests: 60,
  },
  // Limite pour les uploads
  upload: {
    windowMs: 60 * 1000,
    maxRequests: 10,
  },
  // Limite pour les invitations de bail
  leaseInvite: {
    windowMs: 60 * 60 * 1000,
    maxRequests: 10,
  },
  // Limite pour les signatures
  signature: {
    windowMs: 60 * 1000,
    maxRequests: 10,
  },
  // Limite pour l'envoi d'emails
  email: {
    windowMs: 60 * 1000,
    maxRequests: 5,
  },
  // Limite pour les SMS (OTP)
  sms: {
    windowMs: 60 * 1000,
    maxRequests: 3,
  },
  // Limite pour la recherche
  search: {
    windowMs: 60 * 1000,
    maxRequests: 30,
  },
  // Limite pour les exports
  export: {
    windowMs: 5 * 60 * 1000,
    maxRequests: 5,
  },
  // Limite pour la génération de PDF
  pdf: {
    windowMs: 60 * 1000,
    maxRequests: 10,
  },
  // Limite pour les opérations CRUD sur les propriétés
  property: {
    windowMs: 60 * 1000,
    maxRequests: 30,
  },
  // Limite pour les opérations EDL
  edl: {
    windowMs: 60 * 1000,
    maxRequests: 10,
  },
  // Limite pour le scraping
  scrape: {
    windowMs: 60 * 1000,
    maxRequests: 10,
  },
  // Limite pour la revalidation
  revalidate: {
    windowMs: 60 * 1000,
    maxRequests: 30,
  },
};

// Store en mémoire (fallback pour développement)
interface MemoryStore {
  [key: string]: {
    count: number;
    resetAt: number;
  };
}
const memoryStore: MemoryStore = {};

// Client Redis singleton
let redisClient: RedisClient | null = null;
let redisInitialized = false;

/**
 * Initialise le client Redis Upstash
 */
async function getRedisClient(): Promise<RedisClient | null> {
  if (redisInitialized) return redisClient;
  redisInitialized = true;

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!redisUrl || !redisToken) {
    if (process.env.NODE_ENV === "production") {
      console.warn(
        "[RateLimit] Redis non configuré en production. " +
          "Utilisation du fallback mémoire (non recommandé)."
      );
    }
    return null;
  }

  try {
    // Import dynamique pour éviter les erreurs si @upstash/redis n'est pas installé
    const { Redis } = await import("@upstash/redis");
    redisClient = new Redis({
      url: redisUrl,
      token: redisToken,
    }) as unknown as RedisClient;

    console.log("[RateLimit] Client Redis Upstash initialisé");
    return redisClient;
  } catch (error) {
    console.error("[RateLimit] Erreur initialisation Redis:", error);
    return null;
  }
}

/**
 * Rate limiting avec Redis (sliding window)
 */
async function checkRateLimitRedis(
  key: string,
  windowMs: number,
  maxRequests: number,
  redis: RedisClient
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const windowSeconds = Math.ceil(windowMs / 1000);
  const now = Date.now();
  const redisKey = `ratelimit:${key}`;

  try {
    // Incrémenter le compteur
    const count = await redis.incr(redisKey);

    // Si c'est la première requête, définir l'expiration
    if (count === 1) {
      await redis.expire(redisKey, windowSeconds);
    }

    // Récupérer le TTL pour calculer resetAt
    const ttl = await redis.ttl(redisKey);
    const resetAt = now + ttl * 1000;

    if (count > maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt,
      };
    }

    return {
      allowed: true,
      remaining: maxRequests - count,
      resetAt,
    };
  } catch (error) {
    console.error("[RateLimit] Erreur Redis:", error);
    // En cas d'erreur Redis, utiliser le fallback mémoire
    return checkRateLimitMemory(key, windowMs, maxRequests);
  }
}

/**
 * Rate limiting en mémoire (fallback)
 */
function checkRateLimitMemory(
  key: string,
  windowMs: number,
  maxRequests: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const record = memoryStore[key];

  // Nettoyer l'entrée expirée
  if (record && record.resetAt < now) {
    delete memoryStore[key];
  }

  const current = memoryStore[key];

  if (!current) {
    memoryStore[key] = {
      count: 1,
      resetAt: now + windowMs,
    };
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetAt: now + windowMs,
    };
  }

  if (current.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: current.resetAt,
    };
  }

  current.count++;
  return {
    allowed: true,
    remaining: maxRequests - current.count,
    resetAt: current.resetAt,
  };
}

/**
 * Extrait l'identifiant client depuis la requête
 */
function getClientIdentifier(request: Request): string {
  // Priorité: X-Forwarded-For > X-Real-IP > inconnu
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    // Prendre la première IP (client original)
    return forwardedFor.split(",")[0].trim();
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  // Fallback: hash de l'user-agent pour différencier un minimum
  const userAgent = request.headers.get("user-agent") || "unknown";
  return `unknown-${hashString(userAgent)}`;
}

/**
 * Hash simple pour créer un identifiant
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Applique le rate limiting à une requête
 *
 * @param request - La requête HTTP
 * @param preset - Le preset de rate limiting à utiliser
 * @param identifier - Identifiant personnalisé (optionnel, sinon utilise l'IP)
 * @returns null si autorisé, Response 429 si limite atteinte
 */
export async function applyRateLimit(
  request: Request,
  preset: keyof typeof rateLimitPresets,
  identifier?: string
): Promise<Response | null> {
  const config = rateLimitPresets[preset];
  if (!config) {
    console.warn(`[RateLimit] Preset inconnu: ${preset}`);
    return null;
  }

  // Construire la clé unique
  const clientId = identifier || getClientIdentifier(request);
  const key = `${preset}:${clientId}`;

  // Essayer Redis d'abord
  const redis = await getRedisClient();
  const result = redis
    ? await checkRateLimitRedis(key, config.windowMs, config.maxRequests, redis)
    : checkRateLimitMemory(key, config.windowMs, config.maxRequests);

  if (!result.allowed) {
    const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);

    return new Response(
      JSON.stringify({
        error: "Trop de requêtes. Veuillez réessayer plus tard.",
        code: "RATE_LIMIT_EXCEEDED",
        resetAt: result.resetAt,
        retryAfter: retryAfter > 0 ? retryAfter : 1,
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "X-RateLimit-Limit": config.maxRequests.toString(),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": result.resetAt.toString(),
          "Retry-After": (retryAfter > 0 ? retryAfter : 1).toString(),
        },
      }
    );
  }

  return null;
}

/**
 * Vérifie le rate limit sans bloquer (pour logs/monitoring)
 */
export async function checkRateLimit(
  preset: keyof typeof rateLimitPresets,
  identifier: string
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const config = rateLimitPresets[preset];
  if (!config) {
    return { allowed: true, remaining: 999, resetAt: Date.now() + 60000 };
  }

  const key = `${preset}:${identifier}`;
  const redis = await getRedisClient();

  return redis
    ? await checkRateLimitRedis(key, config.windowMs, config.maxRequests, redis)
    : checkRateLimitMemory(key, config.windowMs, config.maxRequests);
}

/**
 * Wrapper pour les routes API avec rate limiting automatique
 */
export function withRateLimit(
  handler: (request: Request) => Promise<Response>,
  preset: keyof typeof rateLimitPresets
): (request: Request) => Promise<Response> {
  return async (request: Request) => {
    const rateLimitResponse = await applyRateLimit(request, preset);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }
    return handler(request);
  };
}

export default {
  applyRateLimit,
  checkRateLimit,
  withRateLimit,
  rateLimitPresets,
};

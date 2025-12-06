/**
 * Rate Limiter par plan d'abonnement
 * 
 * Limite les requêtes API selon le forfait de l'utilisateur.
 * Utilise un compteur en mémoire avec sliding window.
 * 
 * Limites par défaut:
 * - Gratuit: 100 req/min
 * - Starter: 300 req/min
 * - Confort: 600 req/min
 * - Pro: 1200 req/min
 * - Enterprise: 3000 req/min
 */

import { NextRequest, NextResponse } from "next/server";

// Types
export type PlanSlug = "gratuit" | "starter" | "confort" | "pro" | "enterprise" | "enterprise_s" | "enterprise_m" | "enterprise_l" | "enterprise_xl";

interface RateLimitConfig {
  requests: number;      // Nombre de requêtes
  windowMs: number;      // Fenêtre en millisecondes
  blockDurationMs: number; // Durée de blocage si dépassé
}

interface RateLimitEntry {
  count: number;
  windowStart: number;
  blocked: boolean;
  blockedUntil: number;
}

// Configuration par plan
const RATE_LIMITS: Record<PlanSlug, RateLimitConfig> = {
  gratuit: {
    requests: 100,
    windowMs: 60 * 1000, // 1 minute
    blockDurationMs: 5 * 60 * 1000, // 5 minutes
  },
  starter: {
    requests: 300,
    windowMs: 60 * 1000,
    blockDurationMs: 2 * 60 * 1000,
  },
  confort: {
    requests: 600,
    windowMs: 60 * 1000,
    blockDurationMs: 1 * 60 * 1000,
  },
  pro: {
    requests: 1200,
    windowMs: 60 * 1000,
    blockDurationMs: 30 * 1000,
  },
  enterprise: {
    requests: 3000,
    windowMs: 60 * 1000,
    blockDurationMs: 10 * 1000,
  },
  enterprise_s: {
    requests: 3000,
    windowMs: 60 * 1000,
    blockDurationMs: 10 * 1000,
  },
  enterprise_m: {
    requests: 5000,
    windowMs: 60 * 1000,
    blockDurationMs: 10 * 1000,
  },
  enterprise_l: {
    requests: 10000,
    windowMs: 60 * 1000,
    blockDurationMs: 5 * 1000,
  },
  enterprise_xl: {
    requests: 20000,
    windowMs: 60 * 1000,
    blockDurationMs: 5 * 1000,
  },
};

// Store en mémoire (remplacer par Redis en production pour multi-instances)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Nettoyage périodique des entrées expirées
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now - entry.windowStart > 5 * 60 * 1000) { // 5 minutes d'inactivité
      rateLimitStore.delete(key);
    }
  }
}, 60 * 1000); // Toutes les minutes

/**
 * Obtenir la clé de rate limiting pour un utilisateur
 */
function getRateLimitKey(userId: string, route?: string): string {
  return route ? `${userId}:${route}` : userId;
}

/**
 * Vérifier et mettre à jour le rate limit
 */
export function checkRateLimit(
  userId: string,
  plan: PlanSlug = "gratuit",
  route?: string
): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
} {
  const key = getRateLimitKey(userId, route);
  const config = RATE_LIMITS[plan] || RATE_LIMITS.gratuit;
  const now = Date.now();

  let entry = rateLimitStore.get(key);

  // Vérifier si bloqué
  if (entry?.blocked && entry.blockedUntil > now) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.blockedUntil,
      retryAfter: Math.ceil((entry.blockedUntil - now) / 1000),
    };
  }

  // Nouvelle fenêtre ou première requête
  if (!entry || now - entry.windowStart >= config.windowMs) {
    entry = {
      count: 1,
      windowStart: now,
      blocked: false,
      blockedUntil: 0,
    };
    rateLimitStore.set(key, entry);

    return {
      allowed: true,
      remaining: config.requests - 1,
      resetAt: now + config.windowMs,
    };
  }

  // Incrémenter le compteur
  entry.count++;

  // Vérifier si limite dépassée
  if (entry.count > config.requests) {
    entry.blocked = true;
    entry.blockedUntil = now + config.blockDurationMs;
    rateLimitStore.set(key, entry);

    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.blockedUntil,
      retryAfter: Math.ceil(config.blockDurationMs / 1000),
    };
  }

  rateLimitStore.set(key, entry);

  return {
    allowed: true,
    remaining: config.requests - entry.count,
    resetAt: entry.windowStart + config.windowMs,
  };
}

/**
 * Middleware de rate limiting pour les API routes
 */
export function withRateLimit(
  handler: (request: NextRequest) => Promise<NextResponse>,
  options?: {
    getUserId: (request: NextRequest) => Promise<string | null>;
    getPlan: (userId: string) => Promise<PlanSlug>;
    routeKey?: string;
  }
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      // Obtenir l'ID utilisateur
      const userId = options?.getUserId
        ? await options.getUserId(request)
        : request.headers.get("x-user-id");

      if (!userId) {
        // Pas d'utilisateur = rate limit anonyme (très restrictif)
        const ip = request.headers.get("x-forwarded-for") || "anonymous";
        const result = checkRateLimit(ip, "gratuit", options?.routeKey);

        if (!result.allowed) {
          return createRateLimitResponse(result);
        }

        return handler(request);
      }

      // Obtenir le plan
      const plan = options?.getPlan
        ? await options.getPlan(userId)
        : "gratuit";

      // Vérifier le rate limit
      const result = checkRateLimit(userId, plan, options?.routeKey);

      if (!result.allowed) {
        return createRateLimitResponse(result);
      }

      // Ajouter les headers de rate limit à la réponse
      const response = await handler(request);
      
      response.headers.set("X-RateLimit-Limit", String(RATE_LIMITS[plan].requests));
      response.headers.set("X-RateLimit-Remaining", String(result.remaining));
      response.headers.set("X-RateLimit-Reset", String(Math.ceil(result.resetAt / 1000)));

      return response;

    } catch (error) {
      console.error("[RateLimiter] Erreur:", error);
      // En cas d'erreur, laisser passer la requête
      return handler(request);
    }
  };
}

/**
 * Créer une réponse 429 Too Many Requests
 */
function createRateLimitResponse(result: {
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}): NextResponse {
  return NextResponse.json(
    {
      error: "Too Many Requests",
      message: "Vous avez dépassé la limite de requêtes. Veuillez réessayer plus tard.",
      retryAfter: result.retryAfter,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfter || 60),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
      },
    }
  );
}

/**
 * Obtenir les statistiques de rate limiting (pour monitoring)
 */
export function getRateLimitStats(): {
  activeEntries: number;
  blockedEntries: number;
  topConsumers: Array<{ key: string; count: number }>;
} {
  const entries = Array.from(rateLimitStore.entries());
  const now = Date.now();

  return {
    activeEntries: entries.length,
    blockedEntries: entries.filter(([_, e]) => e.blocked && e.blockedUntil > now).length,
    topConsumers: entries
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([key, entry]) => ({ key, count: entry.count })),
  };
}

export default {
  checkRateLimit,
  withRateLimit,
  getRateLimitStats,
  RATE_LIMITS,
};


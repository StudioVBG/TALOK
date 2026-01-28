/**
 * Rate limiting simple en mémoire
 * Pour la production, utiliser Redis ou un service dédié
 */

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetAt: number;
  };
}

const store: RateLimitStore = {};

interface RateLimitOptions {
  windowMs: number; // Fenêtre de temps en millisecondes
  maxRequests: number; // Nombre maximum de requêtes
}

export function rateLimit(options: RateLimitOptions) {
  const { windowMs, maxRequests } = options;

  return (identifier: string): { allowed: boolean; remaining: number; resetAt: number } => {
    const now = Date.now();
    const key = identifier;
    const record = store[key];

    // Nettoyer les anciennes entrées
    if (record && record.resetAt < now) {
      delete store[key];
    }

    const current = store[key];

    if (!current) {
      // Première requête
      store[key] = {
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
      // Limite atteinte
      return {
        allowed: false,
        remaining: 0,
        resetAt: current.resetAt,
      };
    }

    // Incrémenter le compteur
    current.count++;
    return {
      allowed: true,
      remaining: maxRequests - current.count,
      resetAt: current.resetAt,
    };
  };
}

/**
 * Rate limiter par IP
 */
export function getRateLimiterByIP(options: RateLimitOptions) {
  const limiter = rateLimit(options);
  return (request: Request) => {
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
    return limiter(ip);
  };
}

/**
 * Rate limiter par utilisateur
 */
export function getRateLimiterByUser(options: RateLimitOptions) {
  const limiter = rateLimit(options);
  return (userId: string) => {
    return limiter(`user:${userId}`);
  };
}

/**
 * Presets de rate limiting
 */
export const rateLimitPresets = {
  // Limite stricte pour les paiements
  payment: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 5,
  },
  // Limite pour les authentifications
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
  },
  // Limite pour les inscriptions
  signup: {
    windowMs: 60 * 60 * 1000, // 1 heure
    maxRequests: 3,
  },
  // Limite générale pour les API
  api: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60,
  },
  // Limite pour les uploads
  upload: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
  },
  // Limite pour les invitations de bail
  leaseInvite: {
    windowMs: 60 * 60 * 1000, // 1 heure
    maxRequests: 10,
  },
  // Limite pour les signatures
  signature: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
  },
  // Limite pour l'envoi d'emails
  email: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 5,
  },
  // Limite pour les SMS (OTP)
  sms: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 3,
  },
  // Limite pour la recherche
  search: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30,
  },
  // Limite pour les exports
  export: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 5,
  },
  // Limite pour la génération de PDF
  pdf: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
  },
  // Limite pour la génération de codes d'invitation
  invitation: {
    windowMs: 60 * 60 * 1000, // 1 heure
    maxRequests: 20, // 20 invitations par heure max
  },
  // Limite pour les opérations CRUD sur les propriétés
  property: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30,
  },
  // Limite pour les opérations EDL (création, validation, duplication)
  edl: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
  },
  // Limite stricte pour duplication EDL (opération lourde)
  edlDuplicate: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 5,
  },
};

/**
 * Helper pour appliquer le rate limiting dans une route API
 * @returns null si OK, Response si limite atteinte
 */
export function applyRateLimit(
  request: Request,
  preset: keyof typeof rateLimitPresets,
  identifier?: string
): Response | null {
  const options = rateLimitPresets[preset];
  const limiter = rateLimit(options);
  
  // Utiliser l'identifiant fourni ou l'IP
  const key = identifier || 
    request.headers.get("x-forwarded-for") || 
    request.headers.get("x-real-ip") || 
    "unknown";
  
  const result = limiter(key);
  
  if (!result.allowed) {
    return new Response(
      JSON.stringify({
        error: "Trop de requêtes. Veuillez réessayer plus tard.",
        resetAt: result.resetAt,
        retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "X-RateLimit-Limit": options.maxRequests.toString(),
          "X-RateLimit-Remaining": result.remaining.toString(),
          "X-RateLimit-Reset": result.resetAt.toString(),
          "Retry-After": Math.ceil((result.resetAt - Date.now()) / 1000).toString(),
        },
      }
    );
  }
  
  return null;
}


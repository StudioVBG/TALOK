/**
 * API Security Middleware SOTA 2026
 *
 * Combine CSRF, Rate Limiting, Audit et validation dans un wrapper unifié.
 * Usage: export const POST = withApiSecurity(handler, { rateLimit: 'api', csrf: true });
 */

import { NextRequest, NextResponse } from "next/server";
import { applyRateLimit, rateLimitPresets } from "./rate-limit";
import { validateCsrfToken } from "./csrf";

// Types
type RateLimitPreset = keyof typeof rateLimitPresets;

interface ApiSecurityOptions {
  /** Activer la protection CSRF (par défaut: true pour POST/PUT/DELETE) */
  csrf?: boolean;
  /** Preset de rate limiting à appliquer */
  rateLimit?: RateLimitPreset;
  /** Nécessite une authentification (par défaut: true) */
  requireAuth?: boolean;
  /** Rôles autorisés (vide = tous les rôles authentifiés) */
  allowedRoles?: string[];
  /** Identifiant personnalisé pour le rate limiting */
  rateLimitIdentifier?: (request: NextRequest) => string;
  /** Désactiver toutes les vérifications (pour webhooks) */
  skipAll?: boolean;
}

type ApiHandler = (
  request: NextRequest,
  context?: { params?: Record<string, string> }
) => Promise<NextResponse | Response>;

/**
 * Headers de sécurité à ajouter à toutes les réponses API
 */
const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

/**
 * Ajoute les headers de sécurité à une réponse
 */
function addSecurityHeaders(response: NextResponse | Response): NextResponse {
  const nextResponse = response instanceof NextResponse
    ? response
    : NextResponse.json(response);

  Object.entries(securityHeaders).forEach(([key, value]) => {
    nextResponse.headers.set(key, value);
  });

  return nextResponse;
}

/**
 * Extrait l'IP de la requête
 */
function getClientIP(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    request.ip ||
    "unknown"
  );
}

/**
 * Log d'audit pour les requêtes sensibles
 */
async function logSecurityEvent(
  request: NextRequest,
  event: string,
  details?: Record<string, unknown>
): Promise<void> {
  const logEntry = {
    timestamp: new Date().toISOString(),
    event,
    ip: getClientIP(request),
    method: request.method,
    path: request.nextUrl.pathname,
    userAgent: request.headers.get("user-agent"),
    ...details,
  };

  // En production, envoyer vers un service de logging
  if (process.env.NODE_ENV === "production") {
    // TODO: Intégrer avec service de logging (Datadog, Sentry, etc.)
    console.log("[SECURITY]", JSON.stringify(logEntry));
  } else {
    console.log("[SECURITY]", event, logEntry);
  }
}

/**
 * Wrapper de sécurité pour les routes API
 *
 * @example
 * // Route avec toutes les protections par défaut
 * export const POST = withApiSecurity(async (request) => {
 *   // Votre logique ici
 *   return NextResponse.json({ success: true });
 * });
 *
 * @example
 * // Route avec options personnalisées
 * export const POST = withApiSecurity(
 *   async (request) => { ... },
 *   { rateLimit: 'payment', allowedRoles: ['owner', 'admin'] }
 * );
 *
 * @example
 * // Webhook sans vérifications
 * export const POST = withApiSecurity(handler, { skipAll: true });
 */
export function withApiSecurity(
  handler: ApiHandler,
  options: ApiSecurityOptions = {}
): ApiHandler {
  return async (request: NextRequest, context?: { params?: Record<string, string> }) => {
    try {
      // Skip tout pour les webhooks
      if (options.skipAll) {
        const response = await handler(request, context);
        return addSecurityHeaders(response as NextResponse);
      }

      // 1. Rate Limiting
      if (options.rateLimit) {
        const identifier = options.rateLimitIdentifier
          ? options.rateLimitIdentifier(request)
          : getClientIP(request);

        const rateLimitResponse = applyRateLimit(
          request as unknown as Request,
          options.rateLimit,
          identifier
        );

        if (rateLimitResponse) {
          await logSecurityEvent(request, "RATE_LIMIT_EXCEEDED", {
            preset: options.rateLimit,
            identifier,
          });
          return addSecurityHeaders(
            new NextResponse(rateLimitResponse.body, {
              status: 429,
              headers: Object.fromEntries(rateLimitResponse.headers),
            })
          );
        }
      }

      // 2. CSRF Protection (par défaut pour méthodes non-sûres)
      const needsCsrf =
        options.csrf !== false &&
        ["POST", "PUT", "PATCH", "DELETE"].includes(request.method);

      if (needsCsrf) {
        const csrfResult = await validateCsrfToken(request);
        if (!csrfResult.valid) {
          await logSecurityEvent(request, "CSRF_VALIDATION_FAILED", {
            error: csrfResult.error,
          });
          return addSecurityHeaders(
            NextResponse.json(
              { error: csrfResult.error, code: "CSRF_ERROR" },
              { status: 403 }
            )
          );
        }
      }

      // 3. Exécuter le handler
      const response = await handler(request, context);

      // 4. Ajouter les headers de sécurité
      return addSecurityHeaders(response as NextResponse);
    } catch (error) {
      await logSecurityEvent(request, "API_ERROR", {
        error: error instanceof Error ? error.message : "Unknown error",
      });

      return addSecurityHeaders(
        NextResponse.json(
          { error: "Erreur serveur", code: "INTERNAL_ERROR" },
          { status: 500 }
        )
      );
    }
  };
}

/**
 * Presets de sécurité pour différents types de routes
 */
export const securityPresets = {
  /** Routes publiques (lecture seule, pas de CSRF) */
  public: { csrf: false, requireAuth: false } as ApiSecurityOptions,

  /** Routes authentifiées standard */
  authenticated: { rateLimit: "api" as const } as ApiSecurityOptions,

  /** Routes de paiement (strict) */
  payment: {
    rateLimit: "payment" as const,
    allowedRoles: ["owner", "tenant", "admin"],
  } as ApiSecurityOptions,

  /** Routes d'authentification */
  auth: {
    csrf: false, // Token CSRF pas encore disponible
    rateLimit: "auth" as const,
    requireAuth: false,
  } as ApiSecurityOptions,

  /** Routes d'upload */
  upload: { rateLimit: "upload" as const } as ApiSecurityOptions,

  /** Routes d'export */
  export: { rateLimit: "export" as const } as ApiSecurityOptions,

  /** Webhooks (skip tout) */
  webhook: { skipAll: true } as ApiSecurityOptions,

  /** Routes admin (strict) */
  admin: {
    rateLimit: "api" as const,
    allowedRoles: ["admin"],
  } as ApiSecurityOptions,
};

/**
 * Export des types pour usage externe
 */
export type { ApiSecurityOptions, RateLimitPreset };

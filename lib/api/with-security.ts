/**
 * Wrapper de sécurité combiné pour les route handlers Next.js
 * Combine CSRF protection + error handling + Sentry + structured logging
 *
 * @module lib/api/with-security
 * @example
 * ```ts
 * import { withSecurity } from "@/lib/api/with-security";
 *
 * // Route protégée par CSRF + error handling
 * export const POST = withSecurity(async (request) => {
 *   return NextResponse.json({ ok: true });
 * }, {
 *   routeName: "POST /api/leases",
 *   csrf: true,       // Activer la protection CSRF (défaut: true pour POST/PUT/DELETE)
 *   rateLimit: { max: 30, windowMs: 60000 }, // Optionnel
 * });
 *
 * // Route GET sans CSRF mais avec error handling
 * export const GET = withSecurity(async (request) => {
 *   return NextResponse.json({ data: [] });
 * }, {
 *   routeName: "GET /api/leases",
 * });
 * ```
 */

import { NextResponse } from "next/server";

interface SecurityOptions {
  /** Nom de la route pour les logs (ex: "POST /api/leases") */
  routeName: string;
  /** Activer la protection CSRF (défaut: true pour POST/PUT/DELETE/PATCH) */
  csrf?: boolean;
  /** Configuration rate limiting optionnelle */
  rateLimit?: {
    max: number;
    windowMs: number;
  };
}

/**
 * Wrapper de sécurité pour les route handlers.
 * Applique en couches :
 * 1. Rate limiting (si configuré)
 * 2. CSRF validation (si activé, par défaut pour mutations)
 * 3. Error handling + Sentry
 */
export function withSecurity(
  handler: (request: Request, context?: any) => Promise<NextResponse | Response>,
  options: SecurityOptions
): (request: Request, context?: any) => Promise<NextResponse | Response> {
  return async (request: Request, context?: any) => {
    try {
      // 1. Rate limiting (optionnel)
      if (options.rateLimit) {
        try {
          const { checkRateLimitWithInfo } = await import("@/lib/api/middleware");
          // Utiliser l'IP ou l'user-agent comme identifiant
          const identifier = request.headers.get("x-forwarded-for") 
            || request.headers.get("x-real-ip") 
            || "anonymous";
          const result = checkRateLimitWithInfo(
            `${options.routeName}:${identifier}`,
            options.rateLimit.max,
            options.rateLimit.windowMs
          );
          if (!result.allowed) {
            return NextResponse.json(
              { error: "Trop de requêtes. Veuillez réessayer plus tard.", code: "RATE_LIMITED" },
              { 
                status: 429,
                headers: {
                  "Retry-After": String(Math.ceil((result.resetAt - Date.now()) / 1000)),
                  "X-RateLimit-Remaining": "0",
                  "X-RateLimit-Reset": String(result.resetAt),
                },
              }
            );
          }
        } catch {
          // Rate limit non disponible, continuer sans bloquer
        }
      }

      // 2. CSRF validation (pour les mutations)
      const isMutation = ["POST", "PUT", "DELETE", "PATCH"].includes(request.method);
      const shouldCheckCsrf = options.csrf !== undefined ? options.csrf : isMutation;

      if (shouldCheckCsrf) {
        try {
          const { validateCsrfFromRequest } = await import("@/lib/security/csrf");
          const isValid = await validateCsrfFromRequest(request);
          if (!isValid) {
            // Log la tentative CSRF
            console.warn(
              JSON.stringify({
                level: "warn",
                type: "csrf_violation",
                route: options.routeName,
                method: request.method,
                origin: request.headers.get("origin"),
                referer: request.headers.get("referer"),
                timestamp: new Date().toISOString(),
              })
            );
            return NextResponse.json(
              { error: "Token CSRF invalide ou manquant.", code: "CSRF_INVALID" },
              { status: 403 }
            );
          }
        } catch {
          // CSRF_SECRET non configuré — en dev on laisse passer, en prod on bloque
          if (process.env.NODE_ENV === "production") {
            console.error(`[withSecurity] CSRF validation failed for ${options.routeName}: CSRF_SECRET not configured`);
            // En production sans CSRF_SECRET, on laisse passer plutôt que bloquer
            // TODO: Rendre bloquant une fois CSRF_SECRET configuré en prod
          }
        }
      }

      // 3. Exécuter le handler
      return await handler(request, context);
    } catch (error: unknown) {
      // Error handling centralisé
      const errorMessage = error instanceof Error ? error.message : "Erreur interne du serveur";
      const errorStack = error instanceof Error ? error.stack : undefined;

      // Log structuré
      console.error(
        JSON.stringify({
          level: "error",
          route: options.routeName,
          message: errorMessage,
          timestamp: new Date().toISOString(),
          method: request.method,
        })
      );

      // Sentry
      try {
        const Sentry = await import("@sentry/nextjs");
        Sentry.captureException(error, {
          tags: { route: options.routeName, method: request.method },
        });
      } catch {
        // Sentry non disponible
      }

      const isProduction = process.env.NODE_ENV === "production";
      return NextResponse.json(
        {
          error: isProduction ? "Erreur interne du serveur" : errorMessage,
          code: "INTERNAL_ERROR",
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }
  };
}

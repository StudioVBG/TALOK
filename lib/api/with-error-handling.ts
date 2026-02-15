/**
 * Wrapper HOF pour les route handlers Next.js
 * Centralise la gestion d'erreur, le logging et Sentry
 *
 * @module lib/api/with-error-handling
 * @example
 * ```ts
 * import { withErrorHandling } from "@/lib/api/with-error-handling";
 *
 * export const POST = withErrorHandling(async (request) => {
 *   // ... logique métier
 *   return NextResponse.json({ ok: true });
 * }, { routeName: "POST /api/leases" });
 * ```
 */

import { NextResponse } from "next/server";

interface ErrorHandlingOptions {
  /** Nom de la route pour les logs (ex: "POST /api/leases") */
  routeName: string;
  /** Autoriser les requêtes non authentifiées (défaut: false) */
  allowUnauthenticated?: boolean;
}

/**
 * Wrapper qui centralise la gestion d'erreur pour les route handlers.
 * - Capture les erreurs non gérées
 * - Log structuré avec le nom de la route
 * - Envoi vers Sentry en production
 * - Réponse d'erreur standardisée
 */
export function withErrorHandling(
  handler: (request: Request, context?: any) => Promise<NextResponse | Response>,
  options: ErrorHandlingOptions
): (request: Request, context?: any) => Promise<NextResponse | Response> {
  return async (request: Request, context?: any) => {
    try {
      return await handler(request, context);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erreur interne du serveur";
      const errorStack = error instanceof Error ? error.stack : undefined;

      // Log structuré
      console.error(
        JSON.stringify({
          level: "error",
          route: options.routeName,
          message: errorMessage,
          stack: errorStack,
          timestamp: new Date().toISOString(),
          method: request.method,
          url: request.url,
        })
      );

      // Sentry: capturer l'exception en production
      try {
        const Sentry = await import("@sentry/nextjs");
        Sentry.captureException(error, {
          tags: {
            route: options.routeName,
            method: request.method,
          },
          extra: {
            url: request.url,
          },
        });
      } catch {
        // Sentry non disponible (dev sans DSN), ignorer silencieusement
      }

      // Réponse standardisée — ne jamais exposer le stack trace en prod
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

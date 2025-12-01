/**
 * Configuration Sentry côté serveur
 * Capture les erreurs dans les API routes et Server Components
 */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Sampling pour le tracing
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Activer uniquement si DSN configuré
  enabled: !!(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN),

  // Environment
  environment: process.env.NODE_ENV,

  // Tags personnalisés
  initialScope: {
    tags: {
      app: "gestion-locative",
      side: "server",
    },
  },

  // Filtrer les erreurs non pertinentes
  ignoreErrors: [
    // Erreurs Supabase communes
    "Invalid login credentials",
    "Email not confirmed",
    // Erreurs réseau
    "ECONNREFUSED",
    "ETIMEDOUT",
  ],

  // Hooks avant envoi
  beforeSend(event, hint) {
    // Ne pas envoyer si pas de DSN
    if (!process.env.SENTRY_DSN && !process.env.NEXT_PUBLIC_SENTRY_DSN) {
      console.log("[Sentry Server] Event captured (not sent):", event.exception?.values?.[0]?.value);
      return null;
    }

    // Masquer les données sensibles
    if (event.request?.headers) {
      // Supprimer les headers sensibles
      const sensitiveHeaders = ["authorization", "cookie", "x-api-key"];
      sensitiveHeaders.forEach((header) => {
        if (event.request?.headers?.[header]) {
          event.request.headers[header] = "[REDACTED]";
        }
      });
    }

    // Masquer les données de body sensibles
    if (event.request?.data) {
      const sensitiveFields = ["password", "token", "secret", "apiKey", "api_key"];
      sensitiveFields.forEach((field) => {
        if (typeof event.request?.data === "object" && event.request.data[field]) {
          event.request.data[field] = "[REDACTED]";
        }
      });
    }

    return event;
  },
});


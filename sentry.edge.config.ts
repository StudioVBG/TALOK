/**
 * Configuration Sentry pour les Edge Runtime
 * Utilisé par les middleware et les routes edge
 */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Sampling réduit pour edge (plus de volume)
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.05 : 0.5,

  // Activer uniquement si DSN configuré
  enabled: !!(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN),

  // Environment
  environment: process.env.NODE_ENV,

  // Tags
  initialScope: {
    tags: {
      app: "gestion-locative",
      side: "edge",
    },
  },
});


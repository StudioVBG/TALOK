/**
 * Configuration Sentry côté client
 * Capture les erreurs JavaScript dans le navigateur
 */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Réduire le volume d'événements en production
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Capturer les replays pour faciliter le debug
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Activer uniquement en production (ou si DSN configuré en dev)
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Environment
  environment: process.env.NODE_ENV,

  // Tags personnalisés
  initialScope: {
    tags: {
      app: "gestion-locative",
      side: "client",
    },
  },

  // Ignorer certaines erreurs courantes non pertinentes
  ignoreErrors: [
    // Erreurs réseau communes
    "Network request failed",
    "Failed to fetch",
    "NetworkError",
    "AbortError",
    // Erreurs d'extensions navigateur
    "chrome-extension://",
    "moz-extension://",
    // Erreurs de script tiers
    "Script error",
    // ResizeObserver (bug navigateur connu)
    "ResizeObserver loop limit exceeded",
    "ResizeObserver loop completed with undelivered notifications",
  ],

  // Filtrer certaines URLs
  denyUrls: [
    // Extensions Chrome
    /extensions\//i,
    /^chrome:\/\//i,
    /^chrome-extension:\/\//i,
    // Firefox extensions
    /^moz-extension:\/\//i,
    // Safari extensions
    /^safari-extension:\/\//i,
  ],

  // Intégrations
  integrations: [
    Sentry.replayIntegration({
      // Masquer les données sensibles dans les replays
      maskAllText: false,
      maskAllInputs: true,
      blockAllMedia: false,
    }),
  ],

  // Hooks avant envoi
  beforeSend(event, hint) {
    // Ne pas envoyer en développement sans DSN
    if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
      console.log("[Sentry] Event captured (not sent - no DSN):", event.exception?.values?.[0]?.value);
      return null;
    }

    // Enrichir l'événement avec des informations contextuelles
    if (typeof window !== "undefined") {
      event.extra = {
        ...event.extra,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
        url: window.location.href,
      };
    }

    return event;
  },
});


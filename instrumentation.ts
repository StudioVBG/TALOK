/**
 * Instrumentation Next.js
 * Initialise Sentry et autres outils de monitoring au démarrage
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Initialiser Sentry côté serveur Node.js
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    // Initialiser Sentry pour Edge Runtime
    await import("./sentry.edge.config");
  }
}


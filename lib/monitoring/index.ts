/**
 * Monitoring et logging centralisé
 * Support pour Sentry et logging structuré
 */

// Configuration Sentry (optionnelle - à activer avec SENTRY_DSN)
const SENTRY_DSN = process.env.SENTRY_DSN;
const IS_PRODUCTION = process.env.NODE_ENV === "production";

interface LogContext {
  userId?: string;
  action?: string;
  resource?: string;
  [key: string]: any;
}

interface ErrorContext extends LogContext {
  error: Error | string;
  severity?: "error" | "warning" | "info";
}

/**
 * Logger structuré
 */
export const logger = {
  info: (message: string, context?: LogContext) => {
    if (IS_PRODUCTION) {
      console.log(JSON.stringify({ level: "info", message, ...context, timestamp: new Date().toISOString() }));
    } else {
      console.log(`[INFO] ${message}`, context || "");
    }
  },

  warn: (message: string, context?: LogContext) => {
    if (IS_PRODUCTION) {
      console.warn(JSON.stringify({ level: "warn", message, ...context, timestamp: new Date().toISOString() }));
    } else {
      console.warn(`[WARN] ${message}`, context || "");
    }
  },

  error: (message: string, context?: ErrorContext) => {
    const errorMessage = context?.error instanceof Error ? context.error.message : context?.error;
    const stack = context?.error instanceof Error ? context.error.stack : undefined;

    if (IS_PRODUCTION) {
      console.error(JSON.stringify({ 
        level: "error", 
        message, 
        error: errorMessage,
        stack,
        ...context, 
        timestamp: new Date().toISOString() 
      }));
    } else {
      console.error(`[ERROR] ${message}`, { error: errorMessage, ...context });
    }

    // Envoyer à Sentry si configuré
    if (SENTRY_DSN && context?.error) {
      captureException(context.error instanceof Error ? context.error : new Error(String(context.error)), {
        extra: context,
      });
    }
  },

  debug: (message: string, context?: LogContext) => {
    if (!IS_PRODUCTION) {
      console.debug(`[DEBUG] ${message}`, context || "");
    }
  },
};

/**
 * Capture une exception pour Sentry (stub - à remplacer par vraie intégration)
 */
export function captureException(error: Error, options?: { extra?: Record<string, any> }) {
  // Si Sentry est configuré, envoyer l'erreur
  // Pour l'instant, on log juste
  if (SENTRY_DSN) {
    // TODO: Intégrer @sentry/nextjs
    // Sentry.captureException(error, { extra: options?.extra });
    console.error("[Sentry] Would capture:", error.message, options?.extra);
  }
}

/**
 * Capture un message pour Sentry
 */
export function captureMessage(message: string, level: "info" | "warning" | "error" = "info") {
  if (SENTRY_DSN) {
    // TODO: Intégrer @sentry/nextjs
    // Sentry.captureMessage(message, level);
    console.log(`[Sentry] Would capture message (${level}):`, message);
  }
}

/**
 * Track un événement métier
 */
export function trackEvent(eventName: string, properties?: Record<string, any>) {
  logger.info(`Event: ${eventName}`, { event: eventName, properties });
  
  // Ici on pourrait envoyer à un service d'analytics
  // (Mixpanel, Amplitude, PostHog, etc.)
}

/**
 * Wrapper pour mesurer la durée d'une opération
 */
export async function withTiming<T>(
  operationName: string,
  operation: () => Promise<T>,
  context?: LogContext
): Promise<T> {
  const start = performance.now();
  try {
    const result = await operation();
    const duration = performance.now() - start;
    logger.info(`${operationName} completed`, { ...context, duration: `${duration.toFixed(2)}ms` });
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    logger.error(`${operationName} failed`, { 
      ...context, 
      error: error as Error, 
      duration: `${duration.toFixed(2)}ms` 
    });
    throw error;
  }
}

/**
 * Performance monitoring pour les API routes
 */
export function createApiMonitor(routeName: string) {
  return {
    start: () => {
      const startTime = performance.now();
      return {
        success: (statusCode: number = 200) => {
          const duration = performance.now() - startTime;
          logger.info(`API ${routeName}`, {
            route: routeName,
            status: statusCode,
            duration: `${duration.toFixed(2)}ms`,
          });
        },
        error: (error: Error, statusCode: number = 500) => {
          const duration = performance.now() - startTime;
          logger.error(`API ${routeName} failed`, {
            route: routeName,
            error,
            status: statusCode,
            duration: `${duration.toFixed(2)}ms`,
          });
        },
      };
    },
  };
}

export default logger;




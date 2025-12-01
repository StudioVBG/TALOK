/**
 * Service de reporting d'erreurs
 * 
 * Ce module centralise la gestion des erreurs pour faciliter
 * l'intégration avec Sentry ou un autre service de monitoring.
 * 
 * Pour activer Sentry :
 * 1. npm install @sentry/nextjs
 * 2. Configurer SENTRY_DSN dans .env
 * 3. Décommenter les imports Sentry ci-dessous
 */

// import * as Sentry from "@sentry/nextjs";

type ErrorSeverity = "fatal" | "error" | "warning" | "info" | "debug";

interface ErrorContext {
  userId?: string;
  userRole?: string;
  tags?: Record<string, string>;
  extra?: Record<string, any>;
}

interface ErrorReport {
  message: string;
  error?: Error;
  severity?: ErrorSeverity;
  context?: ErrorContext;
}

// Configuration
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

/**
 * Initialise le service de monitoring
 */
export function initErrorReporting() {
  if (!IS_PRODUCTION || !SENTRY_DSN) {
    console.log("[ErrorReporter] Monitoring désactivé (dev mode ou DSN manquant)");
    return;
  }

  // Sentry.init({
  //   dsn: SENTRY_DSN,
  //   tracesSampleRate: 0.1, // 10% des transactions
  //   replaysSessionSampleRate: 0.1,
  //   replaysOnErrorSampleRate: 1.0,
  //   environment: process.env.NODE_ENV,
  // });

  console.log("[ErrorReporter] Monitoring initialisé");
}

/**
 * Capture une erreur et l'envoie au service de monitoring
 */
export function captureError(report: ErrorReport) {
  const { message, error, severity = "error", context } = report;

  // Log local en dev
  if (!IS_PRODUCTION) {
    console.group(`[${severity.toUpperCase()}] ${message}`);
    if (error) console.error(error);
    if (context) console.log("Context:", context);
    console.groupEnd();
    return;
  }

  // Production : envoyer à Sentry
  // if (error) {
  //   Sentry.captureException(error, {
  //     level: severity,
  //     tags: context?.tags,
  //     extra: {
  //       ...context?.extra,
  //       userId: context?.userId,
  //       userRole: context?.userRole,
  //     },
  //   });
  // } else {
  //   Sentry.captureMessage(message, {
  //     level: severity,
  //     tags: context?.tags,
  //     extra: context?.extra,
  //   });
  // }
}

/**
 * Capture une exception avec contexte automatique
 */
export function captureException(error: Error, context?: ErrorContext) {
  captureError({
    message: error.message,
    error,
    severity: "error",
    context,
  });
}

/**
 * Log un message avec niveau de sévérité
 */
export function captureMessage(
  message: string,
  severity: ErrorSeverity = "info",
  context?: ErrorContext
) {
  captureError({
    message,
    severity,
    context,
  });
}

/**
 * Définit le contexte utilisateur pour les erreurs
 */
export function setUserContext(user: { id: string; email?: string; role?: string }) {
  if (!IS_PRODUCTION) return;

  // Sentry.setUser({
  //   id: user.id,
  //   email: user.email,
  //   role: user.role,
  // });
}

/**
 * Nettoie le contexte utilisateur (déconnexion)
 */
export function clearUserContext() {
  if (!IS_PRODUCTION) return;

  // Sentry.setUser(null);
}

/**
 * Ajoute un breadcrumb pour le tracking
 */
export function addBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, any>
) {
  if (!IS_PRODUCTION) {
    console.log(`[Breadcrumb] ${category}: ${message}`, data);
    return;
  }

  // Sentry.addBreadcrumb({
  //   message,
  //   category,
  //   data,
  //   level: "info",
  // });
}

/**
 * HOC pour capturer les erreurs dans les Server Actions
 */
export function withErrorReporting<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  actionName: string
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      captureException(error as Error, {
        tags: { action: actionName },
        extra: { args: JSON.stringify(args).slice(0, 500) },
      });
      throw error;
    }
  }) as T;
}

/**
 * Mesure la performance d'une opération
 */
export function measurePerformance<T>(
  name: string,
  fn: () => T | Promise<T>
): T | Promise<T> {
  const start = performance.now();
  
  const onComplete = (result: T) => {
    const duration = performance.now() - start;
    
    if (!IS_PRODUCTION) {
      console.log(`[Perf] ${name}: ${duration.toFixed(2)}ms`);
    } else {
      // Sentry.metrics.distribution("operation_duration", duration, {
      //   tags: { operation: name },
      //   unit: "millisecond",
      // });
    }
    
    return result;
  };

  const result = fn();
  
  if (result instanceof Promise) {
    return result.then(onComplete);
  }
  
  return onComplete(result);
}


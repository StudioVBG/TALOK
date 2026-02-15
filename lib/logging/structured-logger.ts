/**
 * Logger structuré pour les API routes et services
 *
 * Produit des logs JSON parsables par Datadog / CloudWatch / Netlify Logs.
 * Chaque log contient :
 * - timestamp ISO 8601
 * - level (debug/info/warn/error)
 * - message
 * - context (route, method, userId, correlationId)
 * - données additionnelles
 *
 * @module lib/logging/structured-logger
 * @example
 * ```ts
 * import { createLogger } from "@/lib/logging/structured-logger";
 *
 * const log = createLogger("POST /api/leases");
 * log.info("Bail créé", { leaseId: "abc", ownerId: "xyz" });
 * log.error("Erreur DB", { error: "timeout" });
 * ```
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  route?: string;
  method?: string;
  userId?: string;
  profileId?: string;
  correlationId?: string;
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  route?: string;
  correlationId?: string;
  [key: string]: unknown;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Niveau minimum de log (configurable via LOG_LEVEL env var)
 */
function getMinLevel(): LogLevel {
  const envLevel = process.env.LOG_LEVEL?.toLowerCase() as LogLevel | undefined;
  if (envLevel && envLevel in LOG_LEVELS) return envLevel;
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

/**
 * Génère un correlation ID court et unique
 */
function generateCorrelationId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Émet un log structuré JSON
 */
function emit(entry: LogEntry): void {
  const minLevel = getMinLevel();
  if (LOG_LEVELS[entry.level] < LOG_LEVELS[minLevel]) return;

  const output = JSON.stringify(entry);

  switch (entry.level) {
    case "error":
      console.error(output);
      break;
    case "warn":
      console.warn(output);
      break;
    case "debug":
      console.debug(output);
      break;
    default:
      console.log(output);
  }
}

export interface StructuredLogger {
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
  /** Met à jour le contexte (userId, profileId, etc.) */
  setContext(ctx: Partial<LogContext>): void;
  /** Retourne le correlationId pour le transmettre aux sous-services */
  getCorrelationId(): string;
  /** Log structuré de fin de requête avec durée */
  complete(success: boolean, data?: Record<string, unknown>): void;
}

/**
 * Crée un logger structuré pour une route/service donné
 *
 * @param routeName - Nom de la route ou du service (ex: "POST /api/leases")
 * @param request - (optionnel) Request pour extraire method, URL, IP
 */
export function createLogger(
  routeName: string,
  request?: Request
): StructuredLogger {
  const startTime = Date.now();
  const correlationId = generateCorrelationId();

  const context: LogContext = {
    route: routeName,
    correlationId,
  };

  if (request) {
    context.method = request.method;
    context.url = request.url;
    context.ip =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      undefined;
    context.userAgent = request.headers.get("user-agent") || undefined;
  }

  function log(
    level: LogLevel,
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      route: context.route,
      correlationId: context.correlationId,
      ...(context.userId && { userId: context.userId }),
      ...(context.profileId && { profileId: context.profileId }),
      ...data,
    };
    emit(entry);
  }

  return {
    debug: (message, data) => log("debug", message, data),
    info: (message, data) => log("info", message, data),
    warn: (message, data) => log("warn", message, data),
    error: (message, data) => log("error", message, data),

    setContext(ctx) {
      Object.assign(context, ctx);
    },

    getCorrelationId() {
      return context.correlationId || correlationId;
    },

    complete(success, data) {
      const durationMs = Date.now() - startTime;
      log(success ? "info" : "error", success ? "request_completed" : "request_failed", {
        durationMs,
        success,
        ...data,
      });
    },
  };
}

/**
 * Crée un logger enfant avec un sous-contexte
 * Utile pour les services appelés depuis un handler
 */
export function createChildLogger(
  parent: StructuredLogger,
  serviceName: string
): StructuredLogger {
  const childLogger = createLogger(serviceName);
  // Hériter du correlationId du parent
  childLogger.setContext({ correlationId: parent.getCorrelationId() });
  return childLogger;
}

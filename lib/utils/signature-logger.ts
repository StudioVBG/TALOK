/**
 * Logger structuré pour les opérations de signature.
 *
 * Centralise le logging avec :
 * - Correlation ID (pour traçabilité bout en bout)
 * - Données contextuelles structurées
 * - Niveaux de log normalisés
 *
 * @module lib/utils/signature-logger
 */

export type LogLevel = "info" | "warn" | "error" | "debug";

export interface SignatureLogContext {
  /** Identifiant de corrélation (unique par requête) */
  correlationId: string;
  /** Route source */
  route: string;
  /** ID utilisateur (auth.users) */
  userId?: string;
  /** ID profil */
  profileId?: string;
  /** ID de l'entité (bail, EDL) */
  entityId?: string;
  /** Type d'entité */
  entityType?: "lease" | "edl";
  /** Rôle du signataire */
  signerRole?: string;
  /** Durée de l'opération en ms */
  durationMs?: number;
}

/**
 * Génère un identifiant de corrélation unique.
 */
export function generateCorrelationId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  return `sig-${ts}-${rand}`;
}

/**
 * Crée un logger contextualisé pour une opération de signature.
 */
export function createSignatureLogger(route: string, entityId?: string) {
  const correlationId = generateCorrelationId();
  const startTime = Date.now();

  const context: SignatureLogContext = {
    correlationId,
    route,
    entityId,
  };

  function formatMessage(level: LogLevel, message: string, extra?: Record<string, unknown>): string {
    const elapsed = Date.now() - startTime;
    const payload = {
      level,
      correlationId: context.correlationId,
      route: context.route,
      entityId: context.entityId,
      entityType: context.entityType,
      userId: context.userId,
      profileId: context.profileId,
      signerRole: context.signerRole,
      elapsedMs: elapsed,
      message,
      ...extra,
    };
    return JSON.stringify(payload);
  }

  return {
    /** Met à jour le contexte (userId, profileId, etc.) */
    setContext(partial: Partial<SignatureLogContext>) {
      Object.assign(context, partial);
    },

    /** Retourne le correlation ID */
    getCorrelationId() {
      return correlationId;
    },

    info(message: string, extra?: Record<string, unknown>) {
      console.log(formatMessage("info", message, extra));
    },

    warn(message: string, extra?: Record<string, unknown>) {
      console.warn(formatMessage("warn", message, extra));
    },

    error(message: string, extra?: Record<string, unknown>) {
      console.error(formatMessage("error", message, extra));
    },

    debug(message: string, extra?: Record<string, unknown>) {
      if (process.env.NODE_ENV === "development") {
        console.debug(formatMessage("debug", message, extra));
      }
    },

    /** Log de fin d'opération avec durée totale */
    complete(success: boolean, extra?: Record<string, unknown>) {
      const elapsed = Date.now() - startTime;
      const level: LogLevel = success ? "info" : "error";
      console.log(
        formatMessage(level, success ? "Opération terminée avec succès" : "Opération échouée", {
          success,
          totalDurationMs: elapsed,
          ...extra,
        })
      );
    },
  };
}

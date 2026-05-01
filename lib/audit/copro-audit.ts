/**
 * Audit trail explicite pour les actions sensibles du module copropriété (syndic)
 *
 * Conformité Hoguet + RGPD Art. 30 (registre des activités de traitement) :
 * traçabilité fine des actions copro pour permettre les audits agréés.
 *
 * Utilise la table `audit_log` partagée avec `logAdminAction()` mais avec des
 * entity_type dédiés (copro_*) pour faciliter le filtrage côté admin.
 *
 * @example
 * import { logCoproAction } from "@/lib/audit/copro-audit";
 *
 * await logCoproAction({
 *   userId: user.id,
 *   profileId: profile.id,
 *   action: "create",
 *   entityType: "copro_charge_call",
 *   entityId: chargeCallId,
 *   siteId: site.id,
 *   metadata: { amount_cents: 12000, period: "2026-Q2" },
 *   request,
 * });
 */

import { createServiceRoleClient } from "@/lib/supabase/server";

export type CoproEntityType =
  | "copro_site"
  | "copro_assembly"
  | "copro_resolution"
  | "copro_council"
  | "copro_charge_call"
  | "copro_charge_allocation"
  | "copro_expense"
  | "copro_fonds_travaux"
  | "copro_mandate"
  | "copro_regularisation"
  | "copro_invitation"
  | "copro_accounting_close"
  | "copro_member";

export type CoproAction =
  | "create"
  | "update"
  | "delete"
  | "start" // ex: démarrer une AG en mode live
  | "close" // ex: clôturer une AG, clôturer un exercice
  | "send" // ex: envoyer convocation, envoyer régularisation
  | "vote"
  | "allocate"; // ex: répartition tantièmes

export type CoproRiskLevel = "low" | "medium" | "high" | "critical";

interface LogCoproActionParams {
  userId: string;
  profileId?: string;
  action: CoproAction;
  entityType: CoproEntityType;
  entityId?: string;
  /** Site (copropriété) concerné — toujours utile pour filtrage */
  siteId?: string;
  /** Métadonnées additionnelles (montants, ID liés, etc.) */
  metadata?: Record<string, unknown>;
  /** Request pour capturer IP + UA. Optionnel. */
  request?: Request;
  /** Override du risk level. Défaut : auto via determineCoproRiskLevel() */
  riskLevel?: CoproRiskLevel;
  /** Marque l'action comme échouée (pour les erreurs métier) */
  success?: boolean;
}

/**
 * Détermine le risk level d'une action copro.
 *
 * - critical : delete + actions irréversibles (clôture exercice, AG close)
 * - high : start AG, régularisation, répartition tantièmes (impact financier)
 * - medium : create / update standard
 * - low : send (notification), vote
 */
function determineCoproRiskLevel(
  action: CoproAction,
  entityType: CoproEntityType,
): CoproRiskLevel {
  if (action === "delete") return "critical";

  if (
    (action === "close" && entityType === "copro_accounting_close") ||
    (action === "close" && entityType === "copro_assembly") ||
    (action === "allocate" && entityType === "copro_charge_allocation")
  ) {
    return "high";
  }

  if (action === "start" || action === "send") {
    return entityType === "copro_regularisation" ? "high" : "low";
  }

  return "medium";
}

/**
 * Log une action copropriété dans la table audit_log partagée.
 *
 * Best-effort : ne throw jamais. Si l'insert audit échoue, l'opération
 * principale continue normalement (logging silencieux).
 */
export async function logCoproAction(params: LogCoproActionParams): Promise<void> {
  try {
    const supabase = createServiceRoleClient();

    const ipAddress = params.request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const userAgent = params.request?.headers.get("user-agent") || undefined;

    const riskLevel =
      params.riskLevel ?? determineCoproRiskLevel(params.action, params.entityType);

    const { error } = await supabase.from("audit_log").insert({
      user_id: params.userId,
      profile_id: params.profileId,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId,
      ip_address: ipAddress,
      user_agent: userAgent,
      risk_level: riskLevel,
      success: params.success ?? true,
      metadata: {
        site_id: params.siteId,
        ...(params.metadata ?? {}),
      },
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error("[CoproAudit] Insert failed:", error.message);
      return;
    }

    // Alerte simple sur outbox pour les actions critiques (consommée par cron)
    if (riskLevel === "critical" || riskLevel === "high") {
      await supabase
        .from("outbox")
        .insert({
          event_type: "Copro.SensitiveAction",
          payload: {
            action: params.action,
            entity_type: params.entityType,
            entity_id: params.entityId,
            site_id: params.siteId,
            user_id: params.userId,
            risk_level: riskLevel,
            timestamp: new Date().toISOString(),
          },
        })
        .then(({ error: outboxError }) => {
          if (outboxError) {
            console.error("[CoproAudit] Outbox alert failed:", outboxError.message);
          }
        });
    }
  } catch (err) {
    // Best-effort : on ne casse jamais le flux applicatif sur un audit raté
    console.error("[CoproAudit] Unexpected error:", err);
  }
}

/**
 * Helper : récupère les logs copro filtrés par site.
 * Utilisé par l'admin pour audits réglementaires.
 */
export async function getCoproAuditLogs(params: {
  siteId?: string;
  entityType?: CoproEntityType;
  riskLevel?: CoproRiskLevel;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}): Promise<{ logs: Array<Record<string, unknown>>; total: number }> {
  try {
    const supabase = createServiceRoleClient();

    let query = supabase
      .from("audit_log")
      .select("*", { count: "exact" })
      .like("entity_type", "copro_%");

    if (params.siteId) {
      query = query.eq("metadata->>site_id", params.siteId);
    }
    if (params.entityType) {
      query = query.eq("entity_type", params.entityType);
    }
    if (params.riskLevel) {
      query = query.eq("risk_level", params.riskLevel);
    }
    if (params.startDate) {
      query = query.gte("created_at", params.startDate.toISOString());
    }
    if (params.endDate) {
      query = query.lte("created_at", params.endDate.toISOString());
    }

    query = query
      .order("created_at", { ascending: false })
      .range(
        params.offset ?? 0,
        (params.offset ?? 0) + (params.limit ?? 50) - 1,
      );

    const { data, count, error } = await query;
    if (error) {
      console.error("[CoproAudit] getCoproAuditLogs error:", error.message);
      return { logs: [], total: 0 };
    }
    return { logs: data ?? [], total: count ?? 0 };
  } catch (err) {
    console.error("[CoproAudit] getCoproAuditLogs unexpected:", err);
    return { logs: [], total: 0 };
  }
}

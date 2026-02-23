/**
 * Service d'audit pour la traçabilité des accès aux données sensibles
 * 
 * SOTA 2026 - Audit Trail
 * =======================
 * 
 * Ce service enregistre tous les accès aux données sensibles :
 * - Lecture/Écriture d'IBAN
 * - Accès aux documents d'identité
 * - Modifications de profil
 * - Actions administratives
 * 
 * Conformité : RGPD Art. 30 (Registre des activités de traitement)
 */

import { createServiceRoleClient } from "@/lib/supabase/server";

// Types d'actions auditées
export type AuditAction =
  | "read"
  | "create"
  | "update"
  | "delete"
  | "export"
  | "decrypt"
  | "login"
  | "logout"
  | "failed_login"
  | "2fa_enabled"
  | "2fa_disabled"
  | "password_change"
  | "role_change"
  | "permission_grant"
  | "permission_revoke";

// Types d'entités sensibles
export type SensitiveEntityType =
  | "iban"
  | "identity_document"
  | "income_proof"
  | "tax_document"
  | "lease"
  | "profile"
  | "payment"
  | "api_key"
  | "subscription"
  | "admin_action";

// Niveau de risque
export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface AuditLogEntry {
  user_id: string;
  profile_id?: string;
  action: AuditAction;
  entity_type: SensitiveEntityType;
  entity_id?: string;
  ip_address?: string;
  user_agent?: string;
  risk_level: RiskLevel;
  metadata?: Record<string, unknown>;
  success: boolean;
  error_message?: string;
}

/**
 * Détermine le niveau de risque d'une action
 */
function determineRiskLevel(
  action: AuditAction,
  entityType: SensitiveEntityType
): RiskLevel {
  // Actions critiques
  if (
    action === "delete" ||
    action === "role_change" ||
    action === "permission_grant" ||
    action === "2fa_disabled"
  ) {
    return "critical";
  }

  // Accès aux données très sensibles
  if (
    entityType === "identity_document" ||
    entityType === "income_proof" ||
    entityType === "tax_document"
  ) {
    return action === "read" ? "medium" : "high";
  }

  // IBAN
  if (entityType === "iban") {
    return action === "decrypt" ? "high" : "medium";
  }

  // Actions admin
  if (entityType === "admin_action") {
    return "high";
  }

  // Échec de connexion (potentiel bruteforce)
  if (action === "failed_login") {
    return "medium";
  }

  return "low";
}

/**
 * Enregistre un événement d'audit
 * 
 * @param entry - Détails de l'événement
 */
export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  try {
    const supabase = createServiceRoleClient();
    
    const riskLevel = entry.risk_level || determineRiskLevel(entry.action, entry.entity_type);

    const { error } = await supabase.from("audit_log").insert({
      user_id: entry.user_id,
      profile_id: entry.profile_id,
      action: entry.action,
      entity_type: entry.entity_type,
      entity_id: entry.entity_id,
      ip_address: entry.ip_address,
      user_agent: entry.user_agent,
      risk_level: riskLevel,
      metadata: entry.metadata || {},
      success: entry.success,
      error_message: entry.error_message,
      created_at: new Date().toISOString(),
    });

    if (error) {
      // Log silencieux pour ne pas bloquer les opérations
      console.error("[Audit] Erreur lors de l'enregistrement:", error.message);
    }

    // Alerter pour les actions critiques et à haut risque
    if (riskLevel === "critical" || riskLevel === "high") {
      await alertCriticalAction(entry, riskLevel);
    }
  } catch (err) {
    console.error("[Audit] Erreur inattendue:", err);
  }
}

/**
 * Alerte pour les actions critiques — notifie tous les admins en in-app + outbox
 */
async function alertCriticalAction(
  entry: AuditLogEntry,
  riskLevel: RiskLevel
): Promise<void> {
  console.warn(`[SECURITY ALERT] ${riskLevel.toUpperCase()} risk action detected:`, {
    action: entry.action,
    entity_type: entry.entity_type,
    user_id: entry.user_id,
    ip: entry.ip_address,
    time: new Date().toISOString(),
  });

  try {
    const supabase = createServiceRoleClient();

    // 1. Récupérer tous les profils admin pour les notifier
    const { data: admins } = await supabase
      .from("profiles")
      .select("id, user_id")
      .eq("role", "admin");

    // 2. Créer une notification in-app pour chaque admin
    if (admins && admins.length > 0) {
      const actionLabels: Record<string, string> = {
        delete: "Suppression",
        role_change: "Changement de rôle",
        permission_grant: "Attribution de permission",
        permission_revoke: "Révocation de permission",
        "2fa_disabled": "2FA désactivé",
        decrypt: "Déchiffrement de données",
        export: "Export de données",
        failed_login: "Échec de connexion",
      };
      const label = actionLabels[entry.action] || entry.action;
      const isCritical = riskLevel === "critical";

      const notifications = admins.map((admin) => ({
        user_id: admin.user_id,
        profile_id: admin.id,
        type: isCritical ? "audit_critical" : "audit_high",
        title: isCritical
          ? `Alerte sécurité critique : ${label}`
          : `Activité à haut risque : ${label}`,
        body: `Action ${label} sur ${entry.entity_type}. Utilisateur: ${entry.user_id.slice(0, 8)}...${entry.ip_address ? ` | IP: ${entry.ip_address}` : ""}`,
        is_read: false,
        priority: isCritical ? "urgent" : "high",
        action_url: "/admin/audit-logs",
        metadata: {
          audit_action: entry.action,
          entity_type: entry.entity_type,
          entity_id: entry.entity_id,
          actor_user_id: entry.user_id,
          risk_level: riskLevel,
          ip_address: entry.ip_address,
          timestamp: new Date().toISOString(),
        },
      }));

      const { error: notifError } = await supabase
        .from("notifications")
        .insert(notifications);

      if (notifError) {
        console.error("[Audit] Erreur création notifications admin:", notifError.message);
      }
    }

    // 3. Envoyer dans l'outbox pour traitement asynchrone (email, etc.)
    await supabase.from("outbox").insert({
      event_type: "Security.CriticalAction",
      payload: {
        action: entry.action,
        entity_type: entry.entity_type,
        user_id: entry.user_id,
        risk_level: riskLevel,
        ip_address: entry.ip_address,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("[Audit] Erreur alertCriticalAction:", err);
  }
}

/**
 * Helper pour logger l'accès à un IBAN
 */
export async function logIBANAccess(params: {
  userId: string;
  profileId?: string;
  action: "read" | "update" | "decrypt";
  ownerProfileId: string;
  ipAddress?: string;
  userAgent?: string;
  success?: boolean;
}): Promise<void> {
  await logAuditEvent({
    user_id: params.userId,
    profile_id: params.profileId,
    action: params.action,
    entity_type: "iban",
    entity_id: params.ownerProfileId,
    ip_address: params.ipAddress,
    user_agent: params.userAgent,
    risk_level: params.action === "decrypt" ? "high" : "medium",
    success: params.success ?? true,
    metadata: {
      target_owner_id: params.ownerProfileId,
    },
  });
}

/**
 * Helper pour logger l'accès à un document d'identité
 */
export async function logIdentityDocAccess(params: {
  userId: string;
  profileId?: string;
  action: "read" | "create" | "delete";
  documentId: string;
  documentType: string;
  ipAddress?: string;
  userAgent?: string;
  success?: boolean;
}): Promise<void> {
  await logAuditEvent({
    user_id: params.userId,
    profile_id: params.profileId,
    action: params.action,
    entity_type: "identity_document",
    entity_id: params.documentId,
    ip_address: params.ipAddress,
    user_agent: params.userAgent,
    risk_level: "medium",
    success: params.success ?? true,
    metadata: {
      document_type: params.documentType,
    },
  });
}

/**
 * Helper pour logger une action administrative
 */
export async function logAdminAction(params: {
  adminUserId: string;
  adminProfileId?: string;
  action: AuditAction;
  targetUserId?: string;
  targetEntityType?: string;
  targetEntityId?: string;
  description: string;
  ipAddress?: string;
  userAgent?: string;
  success?: boolean;
}): Promise<void> {
  await logAuditEvent({
    user_id: params.adminUserId,
    profile_id: params.adminProfileId,
    action: params.action,
    entity_type: "admin_action",
    entity_id: params.targetEntityId,
    ip_address: params.ipAddress,
    user_agent: params.userAgent,
    risk_level: "high",
    success: params.success ?? true,
    metadata: {
      target_user_id: params.targetUserId,
      target_entity_type: params.targetEntityType,
      description: params.description,
    },
  });
}

/**
 * Récupère les logs d'audit pour un utilisateur (admin uniquement)
 */
export async function getAuditLogs(params: {
  userId?: string;
  entityType?: SensitiveEntityType;
  action?: AuditAction;
  riskLevel?: RiskLevel;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}): Promise<{
  logs: Array<Record<string, unknown>>;
  total: number;
}> {
  const supabase = createServiceRoleClient();
  
  let query = supabase
    .from("audit_log")
    .select("*", { count: "exact" });

  if (params.userId) {
    query = query.eq("user_id", params.userId);
  }
  if (params.entityType) {
    query = query.eq("entity_type", params.entityType);
  }
  if (params.action) {
    query = query.eq("action", params.action);
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
    .range(params.offset || 0, (params.offset || 0) + (params.limit || 50) - 1);

  const { data, count, error } = await query;

  if (error) {
    console.error("[Audit] Erreur récupération logs:", error);
    return { logs: [], total: 0 };
  }

  return {
    logs: data || [],
    total: count || 0,
  };
}

/**
 * Compte les échecs de connexion récents (pour détection bruteforce)
 * Alerte les admins si le seuil est dépassé (5 échecs en 15 min)
 */
export async function countRecentFailedLogins(
  userId: string,
  windowMinutes: number = 15
): Promise<number> {
  const supabase = createServiceRoleClient();

  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);

  const { count, error } = await supabase
    .from("audit_log")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("action", "failed_login")
    .gte("created_at", windowStart.toISOString());

  if (error) {
    console.error("[Audit] Erreur comptage échecs:", error);
    return 0;
  }

  const failCount = count || 0;

  // Alerte brute force si >= 5 tentatives dans la fenêtre
  if (failCount >= 5) {
    try {
      const { data: admins } = await supabase
        .from("profiles")
        .select("id, user_id")
        .eq("role", "admin");

      if (admins && admins.length > 0) {
        const notifications = admins.map((admin) => ({
          user_id: admin.user_id,
          profile_id: admin.id,
          type: "security_alert",
          title: "Alerte : tentative de brute force détectée",
          body: `${failCount} échecs de connexion en ${windowMinutes} min pour l'utilisateur ${userId.slice(0, 8)}...`,
          is_read: false,
          priority: "urgent",
          action_url: "/admin/audit-logs?action=failed_login",
          metadata: {
            alert_type: "brute_force",
            target_user_id: userId,
            fail_count: failCount,
            window_minutes: windowMinutes,
            timestamp: new Date().toISOString(),
          },
        }));

        await supabase.from("notifications").insert(notifications);
      }
    } catch (err) {
      console.error("[Audit] Erreur alerte brute force:", err);
    }
  }

  return failCount;
}

// ============================================
// EXPORT
// ============================================

export const auditService = {
  logAuditEvent,
  logIBANAccess,
  logIdentityDocAccess,
  logAdminAction,
  getAuditLogs,
  countRecentFailedLogins,
};

export default auditService;


/**
 * Audit Service - SOTA 2026
 * Gère la journalisation des actions sensibles (RGPD, Sécurité)
 */

import { createClient } from "@/lib/supabase/server";

export type AuditAction = 
  | "document_view" 
  | "document_download" 
  | "iban_update" 
  | "iban_view" 
  | "export_data" 
  | "profile_update";

export interface AuditPayload {
  action: AuditAction;
  entityType: string;
  entityId: string;
  metadata?: Record<string, any>;
}

/**
 * Enregistre une trace d'audit
 */
export async function logAudit(payload: AuditPayload) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    const { error } = await supabase.from("audit_log").insert({
      user_id: user.id,
      action: payload.action,
      entity_type: payload.entityType,
      entity_id: payload.entityId,
      metadata: {
        ...payload.metadata,
        timestamp: new Date().toISOString(),
        user_agent: typeof window !== "undefined" ? window.navigator.userAgent : "server",
      }
    });

    if (error) {
      console.error("[AuditService] Error logging audit:", error);
    }
  } catch (err) {
    console.error("[AuditService] Unexpected error:", err);
  }
}


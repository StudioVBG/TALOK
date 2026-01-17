/**
 * Middleware d'audit pour les accès aux données sensibles
 * 
 * SOTA 2026 - Audit Trail
 * =======================
 * 
 * Ce middleware intercepte les accès aux routes sensibles
 * et enregistre les événements dans le journal d'audit.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

// Routes sensibles à auditer
export const SENSITIVE_ROUTES = [
  // IBAN et données bancaires
  { pattern: /\/api\/owner-profiles\/.*\/iban/, entityType: "iban" },
  { pattern: /\/api\/payments\//, entityType: "payment" },
  { pattern: /\/api\/subscriptions\//, entityType: "subscription" },
  
  // Documents d'identité
  { pattern: /\/api\/documents\/.*\/(identity|cni|passport)/, entityType: "identity_document" },
  { pattern: /\/api\/tenant-applications\/.*\/files/, entityType: "identity_document" },
  
  // Justificatifs de revenus
  { pattern: /\/api\/documents\/.*\/(income|salary|tax)/, entityType: "income_proof" },
  
  // Actions administratives
  { pattern: /\/api\/admin\//, entityType: "admin_action" },
  
  // Profils et données personnelles
  { pattern: /\/api\/profiles\//, entityType: "profile" },
];

// Extraire les infos de la requête
function extractRequestInfo(request: NextRequest) {
  const ip = 
    request.headers.get("x-forwarded-for")?.split(",")[0] ||
    request.headers.get("x-real-ip") ||
    "unknown";
  
  const userAgent = request.headers.get("user-agent") || "unknown";
  
  return { ip, userAgent };
}

// Déterminer le type d'action depuis la méthode HTTP
function getActionFromMethod(method: string): string {
  switch (method) {
    case "GET": return "read";
    case "POST": return "create";
    case "PUT":
    case "PATCH": return "update";
    case "DELETE": return "delete";
    default: return "read";
  }
}

// Vérifier si la route correspond à un pattern sensible
function matchSensitiveRoute(pathname: string): { entityType: string } | null {
  for (const route of SENSITIVE_ROUTES) {
    if (route.pattern.test(pathname)) {
      return { entityType: route.entityType };
    }
  }
  return null;
}

/**
 * Middleware pour auditer les accès aux données sensibles
 * À intégrer dans le middleware.ts principal
 */
export async function auditSensitiveAccess(
  request: NextRequest,
  userId: string | null,
  profileId: string | null
): Promise<void> {
  const pathname = request.nextUrl.pathname;
  
  // Vérifier si c'est une route sensible
  const match = matchSensitiveRoute(pathname);
  if (!match) return;
  
  const { ip, userAgent } = extractRequestInfo(request);
  const action = getActionFromMethod(request.method);
  
  try {
    const supabase = createServiceRoleClient();
    
    // Extraire l'entity_id du pathname si possible
    const pathParts = pathname.split("/");
    const entityId = pathParts.find((part) => 
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(part)
    );
    
    // Déterminer le niveau de risque
    let riskLevel = "low";
    if (match.entityType === "identity_document" || match.entityType === "income_proof") {
      riskLevel = "medium";
    }
    if (match.entityType === "iban" && action !== "read") {
      riskLevel = "high";
    }
    if (match.entityType === "admin_action") {
      riskLevel = "high";
    }
    
    // Enregistrer l'événement d'audit
    await supabase.from("audit_log").insert({
      user_id: userId || "anonymous",
      profile_id: profileId,
      action,
      entity_type: match.entityType,
      entity_id: entityId,
      ip_address: ip,
      user_agent: userAgent.slice(0, 500), // Limiter la taille
      risk_level: riskLevel,
      metadata: {
        pathname,
        method: request.method,
        query: Object.fromEntries(request.nextUrl.searchParams),
      },
      success: true, // Sera mis à jour en cas d'erreur
    });
  } catch (error) {
    // Log silencieux pour ne pas bloquer la requête
    console.error("[Audit Middleware] Error:", error);
  }
}

/**
 * Helper pour wrapper une route API avec audit automatique
 */
export function withAudit<T>(
  handler: (request: NextRequest, context: T) => Promise<NextResponse>,
  entityType: string
) {
  return async (request: NextRequest, context: T): Promise<NextResponse> => {
    const startTime = Date.now();
    let success = true;
    let errorMessage: string | undefined;
    
    try {
      const response = await handler(request, context);
      
      // Considérer les erreurs HTTP comme des échecs
      if (response.status >= 400) {
        success = false;
        const body = await response.clone().json().catch(() => ({}));
        errorMessage = body.error || `HTTP ${response.status}`;
      }
      
      return response;
    } catch (error: unknown) {
      success = false;
      errorMessage = error.message;
      throw error;
    } finally {
      // Log asynchrone après la réponse
      const duration = Date.now() - startTime;
      
      logAuditAsync(request, entityType, success, errorMessage, duration).catch(
        (err) => console.error("[Audit] Async log failed:", err)
      );
    }
  };
}

async function logAuditAsync(
  request: NextRequest,
  entityType: string,
  success: boolean,
  errorMessage: string | undefined,
  durationMs: number
): Promise<void> {
  try {
    const supabase = createServiceRoleClient();
    const { ip, userAgent } = extractRequestInfo(request);
    const action = getActionFromMethod(request.method);
    
    await supabase.from("audit_log").insert({
      user_id: request.headers.get("x-user-id") || "unknown",
      action,
      entity_type: entityType,
      ip_address: ip,
      user_agent: userAgent.slice(0, 500),
      risk_level: success ? "low" : "medium",
      metadata: {
        pathname: request.nextUrl.pathname,
        duration_ms: durationMs,
      },
      success,
      error_message: errorMessage,
    });
  } catch {
    // Ignorer silencieusement
  }
}

export default auditSensitiveAccess;


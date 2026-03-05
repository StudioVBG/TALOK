/**
 * Middleware RBAC granulaire pour les routes admin
 *
 * Permet de proteger les endpoints admin avec des permissions fines
 * au lieu du simple check binaire admin/non-admin.
 *
 * Permissions disponibles:
 * - admin.users.read / admin.users.write
 * - admin.properties.read / admin.properties.write
 * - admin.subscriptions.read / admin.subscriptions.write
 * - admin.plans.read / admin.plans.write
 * - admin.integrations.read / admin.integrations.write
 * - admin.moderation.read / admin.moderation.write
 * - admin.compliance.read / admin.compliance.write
 * - admin.templates.read / admin.templates.write
 * - admin.blog.read / admin.blog.write
 * - admin.reports.read
 * - admin.reports.export
 * - admin.impersonate
 * - admin.broadcast
 * - admin.privacy.anonymize
 * - admin.privacy.export
 */

import { createClient } from "@/lib/supabase/server";
import { getServerProfile } from "@/lib/helpers/auth-helper";
import { NextResponse } from "next/server";
import { logAdminAction } from "@/lib/security/audit.service";
import { applyRateLimit, type rateLimitPresets } from "@/lib/security/rate-limit";

// Types
export type AdminPermission =
  | "admin.users.read"
  | "admin.users.write"
  | "admin.properties.read"
  | "admin.properties.write"
  | "admin.subscriptions.read"
  | "admin.subscriptions.write"
  | "admin.plans.read"
  | "admin.plans.write"
  | "admin.integrations.read"
  | "admin.integrations.write"
  | "admin.moderation.read"
  | "admin.moderation.write"
  | "admin.compliance.read"
  | "admin.compliance.write"
  | "admin.templates.read"
  | "admin.templates.write"
  | "admin.blog.read"
  | "admin.blog.write"
  | "admin.reports.read"
  | "admin.reports.export"
  | "admin.impersonate"
  | "admin.broadcast"
  | "admin.privacy.anonymize"
  | "admin.privacy.export"
  | "admin.accounting.read"
  | "admin.accounting.write";

type AdminRole = "admin" | "platform_admin";

// Mapping role -> permissions
const ADMIN_ROLE_PERMISSIONS: Record<AdminRole, AdminPermission[]> = {
  platform_admin: [
    "admin.users.read", "admin.users.write",
    "admin.properties.read", "admin.properties.write",
    "admin.subscriptions.read", "admin.subscriptions.write",
    "admin.plans.read", "admin.plans.write",
    "admin.integrations.read", "admin.integrations.write",
    "admin.moderation.read", "admin.moderation.write",
    "admin.compliance.read", "admin.compliance.write",
    "admin.templates.read", "admin.templates.write",
    "admin.blog.read", "admin.blog.write",
    "admin.reports.read", "admin.reports.export",
    "admin.impersonate",
    "admin.broadcast",
    "admin.privacy.anonymize", "admin.privacy.export",
    "admin.accounting.read", "admin.accounting.write",
  ],
  admin: [
    "admin.users.read", "admin.users.write",
    "admin.properties.read", "admin.properties.write",
    "admin.subscriptions.read", "admin.subscriptions.write",
    "admin.plans.read", "admin.plans.write",
    "admin.integrations.read",
    "admin.moderation.read", "admin.moderation.write",
    "admin.compliance.read", "admin.compliance.write",
    "admin.templates.read", "admin.templates.write",
    "admin.blog.read", "admin.blog.write",
    "admin.reports.read", "admin.reports.export",
    "admin.accounting.read",
    // admin standard n'a PAS: impersonate, broadcast, integrations.write, accounting.write, privacy.*
  ],
};

/**
 * Verifie si un role admin possede une permission donnee
 */
export function adminHasPermission(
  role: string,
  permission: AdminPermission
): boolean {
  const perms = ADMIN_ROLE_PERMISSIONS[role as AdminRole];
  if (!perms) return false;
  return perms.includes(permission);
}

/**
 * Recupere toutes les permissions d'un role admin
 */
export function getAdminPermissions(role: string): AdminPermission[] {
  return ADMIN_ROLE_PERMISSIONS[role as AdminRole] || [];
}

// Info utilisateur authentifie
interface AdminAuthResult {
  user: { id: string; email?: string };
  profile: { id: string; role: string };
  permissions: AdminPermission[];
}

/**
 * Verifie l'authentification et les permissions admin pour une route API.
 *
 * @param request - La requete HTTP
 * @param requiredPermissions - Les permissions requises (toutes doivent etre presentes)
 * @param options - Options supplementaires
 * @returns AdminAuthResult si autorise, NextResponse 401/403 sinon
 */
export async function requireAdminPermissions(
  request: Request,
  requiredPermissions: AdminPermission[],
  options?: {
    rateLimit?: keyof typeof rateLimitPresets;
    auditAction?: string;
  }
): Promise<AdminAuthResult | NextResponse> {
  // Rate limiting
  if (options?.rateLimit) {
    const rateLimitResponse = await applyRateLimit(request, options.rateLimit);
    if (rateLimitResponse) return rateLimitResponse as unknown as NextResponse;
  }

  // Auth
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Non authentifie" },
      { status: 401 }
    );
  }

  // Profile + role
  const { profile } = await getServerProfile<{ id: string; role: string }>(
    user.id,
    "id, role"
  );

  if (!profile || !["admin", "platform_admin"].includes(profile.role)) {
    return NextResponse.json(
      { error: "Acces refuse - privileges admin requis" },
      { status: 403 }
    );
  }

  // Verifier les permissions granulaires
  const userPermissions = getAdminPermissions(profile.role);
  const missingPermissions = requiredPermissions.filter(
    (p) => !userPermissions.includes(p)
  );

  if (missingPermissions.length > 0) {
    // Audit l'acces refuse
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
    await logAdminAction({
      adminUserId: user.id,
      adminProfileId: profile.id,
      action: "read",
      description: `Permission refusee: ${missingPermissions.join(", ")}`,
      ipAddress: ip,
      success: false,
    }).catch(() => {});

    return NextResponse.json(
      {
        error: "Permissions insuffisantes",
        required: missingPermissions,
      },
      { status: 403 }
    );
  }

  // Audit si demande
  if (options?.auditAction) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
    const userAgent = request.headers.get("user-agent") || "unknown";
    logAdminAction({
      adminUserId: user.id,
      adminProfileId: profile.id,
      action: request.method === "GET" ? "read" : request.method === "DELETE" ? "delete" : "update",
      description: options.auditAction,
      ipAddress: ip,
      userAgent,
      success: true,
    }).catch(() => {});
  }

  return {
    user,
    profile,
    permissions: userPermissions,
  };
}

/**
 * Helper pour verifier si le resultat est une erreur
 */
export function isAdminAuthError(
  result: AdminAuthResult | NextResponse
): result is NextResponse {
  return result instanceof NextResponse;
}

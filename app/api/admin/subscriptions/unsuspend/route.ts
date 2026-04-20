export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

/**
 * POST /api/admin/subscriptions/unsuspend
 * Réactive un compte suspendu (admin only)
 */

import { NextResponse } from "next/server";
import { adminUnsuspendAccount } from "@/lib/subscriptions/subscription-service";
import { z } from "zod";
import { requireAdminPermissions, isAdminAuthError } from "@/lib/middleware/admin-rbac";
import { validateCsrfFromRequest } from "@/lib/security/csrf";

const unsuspendSchema = z.object({
  user_id: z.string().uuid(),
  reason: z.string().min(3),
  notify_user: z.boolean().default(false),
});

export async function POST(request: Request) {
  try {
    // CSRF validation
    try {
      const csrfValid = await validateCsrfFromRequest(request);
      if (!csrfValid) {
        return NextResponse.json({ error: "Token CSRF invalide" }, { status: 403 });
      }
    } catch {
      // CSRF_SECRET not configured — degrade gracefully
    }

    // RBAC + rate limit + audit
    const auth = await requireAdminPermissions(request, ["admin.subscriptions.write"], {
      rateLimit: "adminCritical",
      auditAction: "Reactivation de compte suspendu",
    });
    if (isAdminAuthError(auth)) return auth;

    const user = auth.user;

    const body = await request.json();
    const parsed = unsuspendSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const { user_id, reason, notify_user } = parsed.data;

    const result = await adminUnsuspendAccount(
      user.id,
      user_id,
      reason,
      notify_user
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erreur serveur";
    console.error("[Admin Unsuspend POST]", error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}


export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

/**
 * POST /api/admin/subscriptions/override
 * Force un changement de plan (admin only)
 */

import { NextResponse } from "next/server";
import { adminOverridePlan } from "@/lib/subscriptions/subscription-service";
import { z } from "zod";
import { requireAdminPermissions, isAdminAuthError } from "@/lib/middleware/admin-rbac";

const overrideSchema = z.object({
  user_id: z.string().uuid(),
  target_plan: z.enum(["gratuit", "starter", "confort", "pro", "enterprise_s", "enterprise_m", "enterprise_l", "enterprise_xl"]),
  reason: z.string().min(3),
  notify_user: z.boolean().default(false),
});

export async function POST(request: Request) {
  try {
    // RBAC + rate limit + audit
    const auth = await requireAdminPermissions(request, ["admin.subscriptions.write"], {
      rateLimit: "adminCritical",
      auditAction: "Override de plan utilisateur",
    });
    if (isAdminAuthError(auth)) return auth;

    const user = auth.user;

    const body = await request.json();
    const parsed = overrideSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const { user_id, target_plan, reason, notify_user } = parsed.data;

    const result = await adminOverridePlan(
      user.id,
      user_id,
      target_plan,
      reason,
      notify_user
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erreur serveur";
    console.error("[Admin Override POST]", error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}


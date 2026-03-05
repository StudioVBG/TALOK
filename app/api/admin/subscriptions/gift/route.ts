export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

/**
 * POST /api/admin/subscriptions/gift
 * Offre des jours gratuits à un utilisateur (admin only)
 */

import { NextResponse } from "next/server";
import { adminGiftDays } from "@/lib/subscriptions/subscription-service";
import { z } from "zod";
import { requireAdminPermissions, isAdminAuthError } from "@/lib/middleware/admin-rbac";

const giftSchema = z.object({
  user_id: z.string().uuid(),
  days: z.number().min(1).max(365),
  reason: z.string().min(3),
  notify_user: z.boolean().default(false),
});

export async function POST(request: Request) {
  try {
    // RBAC + rate limit + audit
    const auth = await requireAdminPermissions(request, ["admin.subscriptions.write"], {
      rateLimit: "adminCritical",
      auditAction: "Gift de jours gratuits",
    });
    if (isAdminAuthError(auth)) return auth;

    const user = auth.user;

    const body = await request.json();
    const parsed = giftSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const { user_id, days, reason, notify_user } = parsed.data;

    const result = await adminGiftDays(
      user.id,
      user_id,
      days,
      reason,
      notify_user
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erreur serveur";
    console.error("[Admin Gift POST]", error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}


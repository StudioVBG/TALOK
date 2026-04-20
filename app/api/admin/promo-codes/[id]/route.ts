export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireAdminPermissions, isAdminAuthError } from "@/lib/middleware/admin-rbac";

/**
 * PATCH /api/admin/promo-codes/[id]
 * Met à jour un code promo (activer/désactiver, changer limite, etc.).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminPermissions(request, ["admin.plans.write"], {
    rateLimit: "adminStandard",
    auditAction: "promo_code_updated",
  });
  if (isAdminAuthError(auth)) return auth;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const updates: Record<string, unknown> = {};
  const allowed = [
    "name",
    "description",
    "discount_value",
    "applicable_plans",
    "min_billing_cycle",
    "first_subscription_only",
    "max_uses",
    "max_uses_per_user",
    "valid_until",
    "is_active",
  ] as const;

  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Aucune modification fournie" }, { status: 400 });
  }

  if (
    updates.discount_value !== undefined &&
    typeof updates.discount_value === "number" &&
    updates.discount_value <= 0
  ) {
    return NextResponse.json({ error: "La remise doit être positive" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("promo_codes")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[admin/promo-codes PATCH]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ code: data });
}

/**
 * DELETE /api/admin/promo-codes/[id]
 * Supprime un code promo.
 * Conserve l'historique des usages (promo_code_uses) grâce à ON DELETE.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminPermissions(request, ["admin.plans.write"], {
    rateLimit: "adminCritical",
    auditAction: "promo_code_deleted",
  });
  if (isAdminAuthError(auth)) return auth;

  const { id } = await params;

  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("promo_codes").delete().eq("id", id);

  if (error) {
    console.error("[admin/promo-codes DELETE]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

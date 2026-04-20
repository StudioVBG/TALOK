export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireAdminPermissions, isAdminAuthError } from "@/lib/middleware/admin-rbac";

const ALLOWED_SEVERITIES = ["info", "success", "warning", "critical"] as const;
const ALLOWED_ROLES = ["owner", "tenant", "provider", "agency", "guarantor", "syndic"] as const;

/**
 * PATCH /api/admin/broadcasts/[id]
 * Met à jour un broadcast (activer/désactiver, éditer contenu).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminPermissions(request, ["admin.broadcast"], {
    rateLimit: "adminStandard",
    auditAction: "broadcast_updated",
  });
  if (isAdminAuthError(auth)) return auth;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const updates: Record<string, unknown> = {};
  if (typeof body.title === "string" && body.title.trim()) updates.title = body.title.trim();
  if (typeof body.body === "string" && body.body.trim()) updates.body = body.body.trim();
  if (body.severity !== undefined) {
    if (!ALLOWED_SEVERITIES.includes(body.severity)) {
      return NextResponse.json({ error: "Sévérité invalide" }, { status: 400 });
    }
    updates.severity = body.severity;
  }
  if (body.target_role !== undefined) {
    if (body.target_role !== null && !ALLOWED_ROLES.includes(body.target_role)) {
      return NextResponse.json({ error: "Rôle cible invalide" }, { status: 400 });
    }
    updates.target_role = body.target_role;
  }
  if (body.cta_label !== undefined) updates.cta_label = body.cta_label || null;
  if (body.cta_url !== undefined) {
    if (body.cta_url && !/^(https?:\/\/|\/)/.test(body.cta_url)) {
      return NextResponse.json({ error: "URL CTA invalide" }, { status: 400 });
    }
    updates.cta_url = body.cta_url || null;
  }
  if (body.starts_at !== undefined) updates.starts_at = body.starts_at;
  if (body.ends_at !== undefined) updates.ends_at = body.ends_at;
  if (body.active !== undefined) updates.active = Boolean(body.active);
  if (body.dismissible !== undefined) updates.dismissible = Boolean(body.dismissible);

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Aucune modification fournie" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("platform_broadcasts")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[admin/broadcasts PATCH]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ broadcast: data });
}

/**
 * DELETE /api/admin/broadcasts/[id]
 * Supprime définitivement un broadcast.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminPermissions(request, ["admin.broadcast"], {
    rateLimit: "adminBroadcast",
    auditAction: "broadcast_deleted",
  });
  if (isAdminAuthError(auth)) return auth;

  const { id } = await params;

  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("platform_broadcasts").delete().eq("id", id);

  if (error) {
    console.error("[admin/broadcasts DELETE]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

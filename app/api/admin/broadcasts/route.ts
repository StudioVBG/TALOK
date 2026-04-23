export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireAdminPermissions, isAdminAuthError } from "@/lib/middleware/admin-rbac";
import { validateCsrfFromRequestDetailed, logCsrfFailure } from "@/lib/security/csrf";

const ALLOWED_SEVERITIES = ["info", "success", "warning", "critical"] as const;
const ALLOWED_ROLES = ["owner", "tenant", "provider", "agency", "guarantor", "syndic"] as const;

/**
 * GET /api/admin/broadcasts
 * Liste TOUS les broadcasts (actifs + inactifs) — admin only.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdminPermissions(request, ["admin.broadcast"], {
    rateLimit: "adminStandard",
  });
  if (isAdminAuthError(auth)) return auth;

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("platform_broadcasts")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[admin/broadcasts GET]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ broadcasts: data || [] });
}

/**
 * POST /api/admin/broadcasts
 * Crée un nouveau broadcast.
 */
export async function POST(request: NextRequest) {
  const csrf = await validateCsrfFromRequestDetailed(request);
  if (!csrf.valid) {
    await logCsrfFailure(request, csrf.reason!, "admin.broadcasts.create");
    return NextResponse.json({ error: "Token CSRF invalide" }, { status: 403 });
  }

  const auth = await requireAdminPermissions(request, ["admin.broadcast"], {
    rateLimit: "adminBroadcast",
    auditAction: "broadcast_created",
  });
  if (isAdminAuthError(auth)) return auth;

  const body = await request.json().catch(() => ({}));
  const {
    title,
    body: message,
    severity = "info",
    target_role = null,
    cta_label = null,
    cta_url = null,
    starts_at = null,
    ends_at = null,
    dismissible = true,
  } = body;

  if (!title || typeof title !== "string" || title.trim().length === 0) {
    return NextResponse.json({ error: "Titre requis" }, { status: 400 });
  }
  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return NextResponse.json({ error: "Message requis" }, { status: 400 });
  }
  if (!ALLOWED_SEVERITIES.includes(severity)) {
    return NextResponse.json({ error: "Sévérité invalide" }, { status: 400 });
  }
  if (target_role !== null && !ALLOWED_ROLES.includes(target_role)) {
    return NextResponse.json({ error: "Rôle cible invalide" }, { status: 400 });
  }
  if (cta_url && typeof cta_url === "string" && !/^(https?:\/\/|\/)/.test(cta_url)) {
    return NextResponse.json({ error: "URL CTA invalide (https:// ou /)" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("platform_broadcasts")
    .insert({
      title: title.trim(),
      body: message.trim(),
      severity,
      target_role,
      cta_label: cta_label || null,
      cta_url: cta_url || null,
      starts_at: starts_at || new Date().toISOString(),
      ends_at: ends_at || null,
      dismissible: Boolean(dismissible),
      created_by: auth.user.id,
      active: true,
    })
    .select()
    .single();

  if (error) {
    console.error("[admin/broadcasts POST]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ broadcast: data }, { status: 201 });
}

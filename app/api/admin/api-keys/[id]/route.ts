export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { requireAdminPermissions, isAdminAuthError } from "@/lib/middleware/admin-rbac";

/**
 * DELETE /api/admin/api-keys/[id] - Supprimer ou désactiver une clé API
 *
 * @version 2026-01-22 - Fix: Next.js 15 params Promise pattern
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminPermissions(request, ["admin.integrations.write"], {
      rateLimit: "adminStandard",
      auditAction: "Delete API key",
    });
    if (isAdminAuthError(auth)) return auth;

    const { id } = await params;
    const supabase = await createClient();
    const user = auth.user;

    // Désactiver plutôt que supprimer (soft delete)
    const { error } = await supabase
      .from("api_credentials")
      .update({
        is_active: false,
        disabled_at: new Date().toISOString()
      } as any)
      .eq("id", id as any);

    if (error) throw error;

    // Journaliser
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "api_key_deleted",
      entity_type: "api_credential",
      entity_id: id,
    } as any);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/api-keys/[id] - Modifier une clé API
 *
 * @version 2026-01-22 - Fix: Next.js 15 params Promise pattern
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminPermissions(request, ["admin.integrations.write"], {
      rateLimit: "adminStandard",
      auditAction: "Update API key",
    });
    if (isAdminAuthError(auth)) return auth;

    const { id } = await params;
    const supabase = await createClient();
    const user = auth.user;

    const body = await request.json();
    const { name, is_active, permissions } = body;

    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (is_active !== undefined) {
      updates.is_active = is_active;
      if (is_active) {
        updates.disabled_at = null;
      } else {
        updates.disabled_at = new Date().toISOString();
      }
    }
    if (permissions !== undefined) updates.permissions = permissions;

    const { data: updated, error } = await supabase
      .from("api_credentials")
      .update(updates)
      .eq("id", id as any)
      .select()
      .single();

    if (error) throw error;

    // Journaliser
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "api_key_updated",
      entity_type: "api_credential",
      entity_id: id,
      metadata: updates,
    } as any);

    return NextResponse.json({ credential: updated });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}






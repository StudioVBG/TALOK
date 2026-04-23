export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { requireAdminPermissions, isAdminAuthError } from "@/lib/middleware/admin-rbac";
import { createClient } from "@/lib/supabase/server";
import { validateCsrfFromRequestDetailed, logCsrfFailure } from "@/lib/security/csrf";

/**
 * POST /api/admin/providers/[id]/suspend - Mettre un prestataire en standby
 *
 * @version 2026-01-22 - Fix: Next.js 15 params Promise pattern
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const csrf = await validateCsrfFromRequestDetailed(request);
    if (!csrf.valid) {
      await logCsrfFailure(request, csrf.reason!, "admin.providers.suspend");
      return NextResponse.json({ error: "Token CSRF invalide" }, { status: 403 });
    }

    const { id } = await params;
    const auth = await requireAdminPermissions(request, ["admin.users.write"], {
      rateLimit: "adminCritical",
      auditAction: "Suspension provider",
    });
    if (isAdminAuthError(auth)) return auth;
    const user = auth.user;
    const supabase = await createClient();

    const providerId = id;
    const body = await request.json();
    const { reason } = body;

    // Mettre à jour le statut du profil utilisateur (suspended)
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("id", providerId as any)
      .single();

    if (!profile) {
      return NextResponse.json(
        { error: "Profil non trouvé" },
        { status: 404 }
      );
    }

    const { error: suspendError } = await supabase
      .from("profiles")
      .update({
        suspended: true,
        suspended_at: new Date().toISOString(),
        suspended_by: user.id,
        suspension_reason: reason || "Mise en standby par l'administrateur",
      })
      .eq("id", providerId as any);

    if (suspendError) {
      console.error("Error suspending provider:", suspendError);
      return NextResponse.json(
        { error: suspendError.message || "Erreur lors de la mise en standby" },
        { status: 500 }
      );
    }

    // Journaliser
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "provider_suspended",
      entity_type: "provider_profile",
      entity_id: providerId,
      metadata: { reason: reason || "Mise en standby" },
    } as any);

    return NextResponse.json({ success: true, message: "Prestataire mis en standby" });
  } catch (error: unknown) {
    console.error("Error in POST /api/admin/providers/[id]/suspend:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/providers/[id]/suspend - Réactiver un prestataire
 *
 * @version 2026-01-22 - Fix: Next.js 15 params Promise pattern
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const csrf = await validateCsrfFromRequestDetailed(request);
    if (!csrf.valid) {
      await logCsrfFailure(request, csrf.reason!, "admin.providers.unsuspend");
      return NextResponse.json({ error: "Token CSRF invalide" }, { status: 403 });
    }

    const { id } = await params;
    const auth = await requireAdminPermissions(request, ["admin.users.write"], {
      rateLimit: "adminCritical",
      auditAction: "Réactivation provider suspendu",
    });
    if (isAdminAuthError(auth)) return auth;
    const user = auth.user;
    const supabase = await createClient();

    const providerId = id;

    const { error: unsuspendError } = await supabase
      .from("profiles")
      .update({
        suspended: false,
        suspended_at: null,
        suspended_by: null,
        suspension_reason: null,
      })
      .eq("id", providerId as any);

    if (unsuspendError) {
      console.error("Error unsuspending provider:", unsuspendError);
      return NextResponse.json(
        { error: unsuspendError.message || "Erreur lors de la réactivation" },
        { status: 500 }
      );
    }

    // Journaliser
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "provider_unsuspended",
      entity_type: "provider_profile",
      entity_id: providerId,
    } as any);

    return NextResponse.json({ success: true, message: "Prestataire réactivé" });
  } catch (error: unknown) {
    console.error("Error in DELETE /api/admin/providers/[id]/suspend:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}






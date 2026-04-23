export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { requireAdminPermissions, isAdminAuthError } from "@/lib/middleware/admin-rbac";
import { createClient } from "@/lib/supabase/server";
import { validateCsrfFromRequestDetailed, logCsrfFailure } from "@/lib/security/csrf";

/**
 * POST /api/admin/providers/[id]/approve - Approuver un prestataire
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
      await logCsrfFailure(request, csrf.reason!, "admin.providers.approve");
      return NextResponse.json({ error: "Token CSRF invalide" }, { status: 403 });
    }

    const { id } = await params;
    const auth = await requireAdminPermissions(request, ["admin.compliance.write"], {
      rateLimit: "adminCritical",
      auditAction: "Approbation provider",
    });
    if (isAdminAuthError(auth)) return auth;
    const user = auth.user;
    const supabase = await createClient();

    const profileId = id as any;

    // Vérifier que le prestataire existe et est en attente
    const { data: provider, error: providerError } = await supabase
      .from("provider_profiles")
      .select("profile_id, status")
      .eq("profile_id", profileId)
      .single();

    if (providerError || !provider) {
      return NextResponse.json(
        { error: "Prestataire non trouvé" },
        { status: 404 }
      );
    }

    if ((provider as any).status === "approved") {
      return NextResponse.json(
        { error: "Ce prestataire est déjà approuvé" },
        { status: 400 }
      );
    }

    // Mettre à jour le statut
    const { data: updated, error: updateError } = await supabase
      .from("provider_profiles")
      .update({
        status: "approved",
        validated_at: new Date().toISOString(),
        validated_by: user.id,
        rejection_reason: null,
      })
      .eq("profile_id", profileId)
      .select()
      .single();

    if (updateError) {
      console.error("Error approving provider:", updateError);
      return NextResponse.json(
        { error: updateError.message || "Erreur lors de l'approbation" },
        { status: 500 }
      );
    }

    // Émettre un événement dans l'outbox
    const { error: outboxError } = await supabase.from("outbox").insert({
      event_type: "provider.approved",
      payload: {
        profile_id: profileId,
        validated_by: user.id,
        validated_at: new Date().toISOString(),
      },
      status: "pending",
      scheduled_at: new Date().toISOString(),
    });

    if (outboxError) {
      console.error("Error inserting outbox event:", outboxError);
      // Ne pas échouer la requête si l'événement ne peut pas être inséré
    }

    // Log dans audit_log
    const { error: auditError } = await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "provider.approved",
      resource_type: "provider_profile",
      resource_id: profileId,
      metadata: {
        validated_by: user.id,
        validated_at: new Date().toISOString(),
      },
    });

    if (auditError) {
      console.error("Error inserting audit log:", auditError);
      // Ne pas échouer la requête si l'audit ne peut pas être inséré
    }

    return NextResponse.json({
      success: true,
      provider: updated,
    });
  } catch (error: unknown) {
    console.error("Error in POST /api/admin/providers/[id]/approve:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}






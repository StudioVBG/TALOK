export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  requireAdminPermissions,
  isAdminAuthError,
} from "@/lib/middleware/admin-rbac";
import { validateCsrfFromRequestDetailed, logCsrfFailure } from "@/lib/security/csrf";

/**
 * POST /api/admin/compliance/documents/notify
 * Notifie un prestataire que son document expire bientôt
 */
export async function POST(request: NextRequest) {
  try {
    const csrf = await validateCsrfFromRequestDetailed(request);
    if (!csrf.valid) {
      await logCsrfFailure(request, csrf.reason!, "admin.compliance.notify");
      return NextResponse.json({ error: "Token CSRF invalide" }, { status: 403 });
    }

    const auth = await requireAdminPermissions(
      request,
      ["admin.compliance.write"],
      { rateLimit: "adminStandard", auditAction: "compliance_notify_provider" }
    );
    if (isAdminAuthError(auth)) return auth;

    const supabase = await createClient();

    const body = await request.json();
    const {
      provider_profile_id,
      document_type,
      document_id,
      expiration_date,
    } = body;

    if (!provider_profile_id || !document_type || !document_id) {
      return NextResponse.json(
        { error: "Paramètres manquants: provider_profile_id, document_type et document_id requis" },
        { status: 400 }
      );
    }

    // Récupérer le user_id du prestataire
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("id", provider_profile_id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Prestataire non trouvé" },
        { status: 404 }
      );
    }

    // Créer la notification
    const { error: notifError } = await supabase
      .from("notifications")
      .insert({
        user_id: profile.user_id,
        type: "document_expiring",
        title: "Document bientôt expiré",
        body: `Votre document "${document_type}" expire le ${
          expiration_date
            ? new Date(expiration_date).toLocaleDateString("fr-FR")
            : "bientôt"
        }. Veuillez le renouveler.`,
        payload: {
          document_id,
          document_type,
          expiration_date,
        },
        channels: ["in_app", "email"],
      });

    if (notifError) {
      console.error("Error creating notification:", notifError);
      return NextResponse.json(
        { error: notifError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error(
      "Error in POST /api/admin/compliance/documents/notify:",
      error
    );
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

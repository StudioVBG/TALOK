export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getServiceClient } from "@/lib/supabase/service-client";
import { handleApiError } from "@/lib/helpers/api-error";
import { requireAdminPermissions, isAdminAuthError } from "@/lib/middleware/admin-rbac";
import { validateCsrfFromRequestDetailed, logCsrfFailure } from "@/lib/security/csrf";
import { sendPasswordResetEmail } from "@/lib/emails/resend.service";

/**
 * POST /api/admin/people/[id]/reset-password
 *
 * Admin déclenche un email de réinitialisation de mot de passe pour l'utilisateur ciblé.
 * - Génère un magic link Supabase (type=recovery)
 * - Envoie un email Resend avec le lien
 * - Audit log
 *
 * Permission: admin.users.write
 * Rate limit: adminCritical
 * CSRF: requis
 */

const bodySchema = z.object({
  reason: z.string().min(3, "Raison requise (≥ 3 caractères)").max(500),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const csrf = await validateCsrfFromRequestDetailed(request);
    if (!csrf.valid) {
      await logCsrfFailure(request, csrf.reason!, "admin.people.reset_password");
      return NextResponse.json({ error: "Token CSRF invalide" }, { status: 403 });
    }

    const auth = await requireAdminPermissions(
      request,
      ["admin.users.write"],
      {
        rateLimit: "adminCritical",
        auditAction: "Admin a déclenché un reset password",
      },
    );
    if (isAdminAuthError(auth)) return auth;

    const { id: targetProfileId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const { reason } = bodySchema.parse(body);

    // 1. Récupérer le profil cible (email + user_id Supabase auth)
    const serviceClient = getServiceClient();
    const { data: targetProfile, error: profileError } = await serviceClient
      .from("profiles")
      .select("id, user_id, email, prenom, nom, role")
      .eq("id", targetProfileId)
      .maybeSingle();

    if (profileError || !targetProfile) {
      return NextResponse.json(
        { error: "Utilisateur introuvable" },
        { status: 404 },
      );
    }

    if (!targetProfile.email) {
      return NextResponse.json(
        { error: "Cet utilisateur n'a pas d'email enregistré" },
        { status: 400 },
      );
    }

    // 2. Empêcher un admin de reset le password d'un autre admin (sécurité élémentaire)
    if (targetProfile.role === "admin" || targetProfile.role === "platform_admin") {
      return NextResponse.json(
        { error: "Impossible de réinitialiser le mot de passe d'un autre administrateur" },
        { status: 403 },
      );
    }

    // 3. Générer le magic link recovery via l'admin API Supabase
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.talok.fr";
    const { data: linkData, error: linkError } =
      await serviceClient.auth.admin.generateLink({
        type: "recovery",
        email: targetProfile.email,
        options: {
          redirectTo: `${appUrl}/auth/reset-password/callback`,
        },
      });

    if (linkError || !linkData?.properties?.action_link) {
      console.error("[admin.reset-password] generateLink failed:", linkError);
      return NextResponse.json(
        { error: "Impossible de générer le lien de réinitialisation" },
        { status: 500 },
      );
    }

    // 4. Envoyer l'email
    const userName =
      `${targetProfile.prenom ?? ""} ${targetProfile.nom ?? ""}`.trim() || "Utilisateur";
    const emailResult = await sendPasswordResetEmail({
      userEmail: targetProfile.email,
      userName,
      actionLink: linkData.properties.action_link,
      expiresIn: "1 heure",
    });

    // 5. Audit log explicite (en plus de l'audit auto via requireAdminPermissions)
    await serviceClient.from("audit_log").insert({
      actor_user_id: auth.user.id,
      actor_profile_id: auth.profile.id,
      action: "admin.user.password_reset_triggered",
      entity_type: "profile",
      entity_id: targetProfileId,
      risk_level: "high",
      metadata: {
        target_email: targetProfile.email,
        reason,
        email_sent: emailResult.success,
      },
    });

    return NextResponse.json({
      success: true,
      email_sent: emailResult.success,
      message: emailResult.success
        ? "Email de réinitialisation envoyé"
        : "Lien généré mais email non envoyé (vérifier la config Resend)",
    });
  } catch (error) {
    return handleApiError(error);
  }
}

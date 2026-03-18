export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { sendEmail } from "@/lib/services/email-service";
import { emailTemplates } from "@/lib/emails/templates";
import { getPasswordRecoveryCallbackUrl } from "@/lib/utils/redirect-url";
import { applyRateLimit } from "@/lib/security/rate-limit";
import { logAuditEvent } from "@/lib/security/audit.service";
import {
  createPasswordResetRequest,
  getRequestClientInfo,
  hashEmail,
  revokePasswordResetRequest,
} from "@/lib/auth/password-recovery.service";
import { passwordRecoveryRequestSchema } from "@/lib/validations/auth/password-recovery";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = passwordRecoveryRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ success: true });
    }

    const email = parsed.data.email;

    const ipRateLimit = await applyRateLimit(request, "email");
    if (ipRateLimit) {
      return ipRateLimit as NextResponse;
    }

    const identityRateLimit = await applyRateLimit(
      request,
      "email",
      `pw-reset:${hashEmail(email)}`
    );
    if (identityRateLimit) {
      return identityRateLimit as NextResponse;
    }

    const supabase = getServiceClient();
    const { ipAddress, userAgent } = getRequestClientInfo(request);

    // Construire l'URL de redirection via /auth/callback en neutralisant une base mal configurée.
    const requestId = crypto.randomUUID();
    const redirectTo = getPasswordRecoveryCallbackUrl(
      process.env.NEXT_PUBLIC_APP_URL ||
        request.headers.get("origin") ||
        "https://talok.fr",
      requestId
    );

    // Générer le lien de recovery via l'API admin
    const { data: linkData, error: linkError } =
      await supabase.auth.admin.generateLink({
        type: "recovery",
        email,
        options: {
          redirectTo,
        },
      });

    if (linkError) {
      console.error("[ForgotPassword] generateLink error:", linkError.message);
      // Ne pas révéler si l'email existe ou non (sécurité)
      return NextResponse.json({ success: true });
    }

    // Extraire les propriétés du lien généré
    const actionLink = linkData?.properties?.action_link;
    if (!actionLink || !linkData.user?.id) {
      console.error("[ForgotPassword] No action_link returned");
      return NextResponse.json({ success: true });
    }

    // Construire un lien direct vers /auth/callback avec le token_hash.
    // On bypass le redirect Supabase car generateLink() côté serveur ne pose
    // pas de code verifier PKCE dans le navigateur de l'utilisateur, ce qui
    // fait échouer exchangeCodeForSession() dans le callback.
    const actionUrl = new URL(actionLink);
    const tokenHash = actionUrl.searchParams.get("token");
    if (!tokenHash) {
      console.error("[ForgotPassword] No token in action_link");
      return NextResponse.json({ success: true });
    }

    const requestOrigin =
      process.env.NEXT_PUBLIC_APP_URL ||
      request.headers.get("origin") ||
      "https://talok.fr";
    const directResetUrl = new URL("/auth/callback", requestOrigin);
    directResetUrl.searchParams.set("token_hash", tokenHash);
    directResetUrl.searchParams.set("type", "recovery");
    directResetUrl.searchParams.set("flow", "pw-reset");
    directResetUrl.searchParams.set("rid", requestId);

    let resetRequestId: string | null = null;
    try {
      const resetRequest = await createPasswordResetRequest({
        requestId,
        userId: linkData.user.id,
        email,
        ipAddress,
        userAgent,
        metadata: {
          source: "forgot-password",
          redirect_to: redirectTo,
        },
      });
      resetRequestId = resetRequest.id;
    } catch (requestError) {
      console.error("[ForgotPassword] Password reset request creation failed:", requestError);
      return NextResponse.json({ success: true });
    }

    // Récupérer le prénom de l'utilisateur depuis le profil
    let userName = "cher utilisateur";
    const { data: profile } = await supabase
      .from("profiles")
      .select("prenom, nom")
      .eq("user_id", linkData.user.id)
      .maybeSingle();

    if (profile?.prenom) {
      userName = profile.prenom;
    } else if (profile?.nom) {
      userName = profile.nom;
    }

    // Générer l'email via le design system Talok (lib/emails/templates.ts)
    const template = emailTemplates.passwordReset({
      userName,
      resetUrl: directResetUrl.toString(),
      expiresIn: "1 heure",
    });

    // Envoyer via Resend
    const emailResult = await sendEmail({
      to: email,
      subject: template.subject,
      html: template.html,
    });

    if (!emailResult.success) {
      console.error("[ForgotPassword] Email send failed:", emailResult.error);
      if (resetRequestId) {
        await revokePasswordResetRequest(resetRequestId);
      }
    } else if (resetRequestId) {
      await logAuditEvent({
        user_id: linkData.user.id,
        action: "password_change",
        entity_type: "profile",
        entity_id: resetRequestId,
        ip_address: ipAddress || undefined,
        user_agent: userAgent || undefined,
        risk_level: "medium",
        success: true,
        metadata: {
          event: "password_reset_requested",
          source: "forgot-password",
        },
      });
    }

    // Toujours retourner success pour ne pas révéler l'existence d'un compte
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[ForgotPassword] Unexpected error:", error);
    return NextResponse.json({ success: true });
  }
}

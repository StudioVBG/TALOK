export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/services/email-service";
import { emailTemplates } from "@/lib/emails/templates";
import { applyRateLimit } from "@/lib/security/rate-limit";
import { logAuditEvent } from "@/lib/security/audit.service";
import { passwordRecoveryCompleteSchema } from "@/lib/validations/auth/password-recovery";
import {
  PASSWORD_RESET_COOKIE_NAME,
  getPasswordResetCookieOptions,
  getRequestClientInfo,
  markPasswordResetCompleted,
  validatePasswordResetAccess,
} from "@/lib/auth/password-recovery.service";
import { getServiceClient } from "@/lib/supabase/service-client";

export async function POST(request: NextRequest) {
  const { ipAddress, userAgent } = getRequestClientInfo(request);

  try {
    const rateLimitResponse = await applyRateLimit(request, "auth");
    if (rateLimitResponse) {
      return rateLimitResponse as NextResponse;
    }

    const body = await request.json();
    const parsed = passwordRecoveryCompleteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.errors.map((issue) => issue.message).join(", "),
        },
        {
          status: 400,
          headers: { "Cache-Control": "no-store" },
        }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Session de récupération invalide ou expirée." },
        {
          status: 401,
          headers: { "Cache-Control": "no-store" },
        }
      );
    }

    const validation = await validatePasswordResetAccess({
      requestId: parsed.data.requestId,
      userId: user.id,
      cookieToken: request.cookies.get(PASSWORD_RESET_COOKIE_NAME)?.value,
    });

    if (!validation.valid || !validation.request) {
      return NextResponse.json(
        { error: "Ce lien n'est plus valide. Veuillez effectuer une nouvelle demande." },
        {
          status: 403,
          headers: { "Cache-Control": "no-store" },
        }
      );
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: parsed.data.password,
    });

    if (updateError) {
      await logAuditEvent({
        user_id: user.id,
        action: "password_change",
        entity_type: "profile",
        entity_id: parsed.data.requestId,
        ip_address: ipAddress || undefined,
        user_agent: userAgent || undefined,
        risk_level: "high",
        success: false,
        error_message: updateError.message,
        metadata: {
          event: "password_reset_failed",
          stage: "update_user",
        },
      });

      return NextResponse.json(
        { error: updateError.message },
        {
          status: 400,
          headers: { "Cache-Control": "no-store" },
        }
      );
    }

    await markPasswordResetCompleted({
      requestId: parsed.data.requestId,
      completedIp: ipAddress,
    });

    const serviceClient = getServiceClient();
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("prenom, nom")
      .eq("user_id", user.id)
      .maybeSingle();

    const displayName =
      profile?.prenom ||
      profile?.nom ||
      user.email?.split("@")[0] ||
      "cher utilisateur";

    const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    const passwordChangedTemplate = emailTemplates.passwordChanged({
      userName: displayName,
      loginUrl: `${appBaseUrl}/auth/signin`,
    });

    const emailResult = await sendEmail({
      to: user.email || "",
      subject: passwordChangedTemplate.subject,
      html: passwordChangedTemplate.html,
      text: passwordChangedTemplate.text,
      idempotencyKey: `password-changed/${user.id}`,
      tags: [{ name: "type", value: "password_changed" }],
    });

    if (!emailResult.success) {
      console.error("[PasswordRecovery] Confirmation email failed:", emailResult.error);
    }

    await logAuditEvent({
      user_id: user.id,
      action: "password_change",
      entity_type: "profile",
      entity_id: parsed.data.requestId,
      ip_address: ipAddress || undefined,
      user_agent: userAgent || undefined,
      risk_level: "high",
      success: true,
      metadata: {
        event: "password_reset_completed",
      },
    });

    await supabase.auth.signOut();

    const response = NextResponse.json(
      {
        success: true,
        redirectTo: "/auth/signin?passwordChanged=1",
      },
      {
        headers: { "Cache-Control": "no-store" },
      }
    );

    response.cookies.set(PASSWORD_RESET_COOKIE_NAME, "", {
      ...getPasswordResetCookieOptions(new Date()),
      maxAge: 0,
      expires: new Date(0),
    });

    return response;
  } catch (error) {
    console.error("[PasswordRecovery] Unexpected error:", error);
    return NextResponse.json(
      {
        error: "Impossible de mettre à jour le mot de passe.",
      },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
}

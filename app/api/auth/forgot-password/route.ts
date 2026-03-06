export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { sendEmail } from "@/lib/services/email-service";
import { emailTemplates } from "@/lib/emails/templates";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = (body.email || "").trim().toLowerCase();

    if (!email) {
      return NextResponse.json(
        { error: "Adresse email requise" },
        { status: 400 }
      );
    }

    const supabase = getServiceClient();

    // Construire l'URL de redirection via /auth/callback
    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      request.headers.get("origin") ||
      "https://talok.fr";
    const redirectTo = `${origin}/auth/callback?next=/auth/reset-password`;

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
    if (!actionLink) {
      console.error("[ForgotPassword] No action_link returned");
      return NextResponse.json({ success: true });
    }

    // Récupérer le prénom de l'utilisateur depuis le profil
    let userName = "cher utilisateur";
    if (linkData.user?.id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("user_id", linkData.user.id)
        .maybeSingle();

      if (profile?.first_name) {
        userName = profile.first_name;
      } else if (profile?.last_name) {
        userName = profile.last_name;
      }
    }

    // Générer l'email via le design system Talok (lib/emails/templates.ts)
    const template = emailTemplates.passwordReset({
      userName,
      resetUrl: actionLink,
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
    }

    // Toujours retourner success pour ne pas révéler l'existence d'un compte
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[ForgotPassword] Unexpected error:", error);
    return NextResponse.json({ success: true });
  }
}

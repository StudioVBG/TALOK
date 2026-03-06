export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { sendEmail } from "@/lib/services/email-service";

const baseStyles = `
  body { font-family: 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f4f4f5; }
  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
  .header { background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
  .header h1 { margin: 0; font-size: 24px; }
  .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; }
  .footer { background: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none; }
  .button { display: inline-block; background: #3b82f6; color: white !important; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; }
`;

function buildResetEmailHtml(prenom: string, resetUrl: string): string {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>${baseStyles}</style></head>
<body>
<div class="container">
  <div class="header">
    <h1>Réinitialisation de mot de passe</h1>
  </div>
  <div class="content">
    <p>Bonjour ${prenom},</p>
    <p>Vous avez demandé la réinitialisation de votre mot de passe sur <strong>Talok</strong>.</p>
    <p>Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe :</p>
    <p style="text-align: center; margin: 30px 0;">
      <a href="${resetUrl}" class="button">Réinitialiser mon mot de passe</a>
    </p>
    <p style="font-size: 14px; color: #6b7280;">Ce lien expire dans 1 heure. Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet email — votre mot de passe ne sera pas modifié.</p>
    <p style="font-size: 12px; color: #9ca3af; margin-top: 20px;">Si le bouton ne fonctionne pas, copiez-collez ce lien dans votre navigateur :<br><a href="${resetUrl}" style="color: #3b82f6; word-break: break-all;">${resetUrl}</a></p>
  </div>
  <div class="footer">
    <p>&copy; ${year} Talok. Tous droits réservés.</p>
  </div>
</div>
</body>
</html>`;
}

function buildResetEmailText(prenom: string, resetUrl: string): string {
  return `Bonjour ${prenom},

Vous avez demandé la réinitialisation de votre mot de passe sur Talok.

Cliquez sur le lien suivant pour choisir un nouveau mot de passe :
${resetUrl}

Ce lien expire dans 1 heure.
Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.

L'équipe Talok`;
}

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
    let prenom = "cher utilisateur";
    if (linkData.user?.id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("user_id", linkData.user.id)
        .maybeSingle();

      if (profile?.first_name) {
        prenom = profile.first_name;
      } else if (profile?.last_name) {
        prenom = profile.last_name;
      }
    }

    // Envoyer l'email via Resend avec le template Talok
    const emailResult = await sendEmail({
      to: email,
      subject: "Réinitialisation de votre mot de passe Talok",
      html: buildResetEmailHtml(prenom, actionLink),
      text: buildResetEmailText(prenom, actionLink),
    });

    if (!emailResult.success) {
      console.error("[ForgotPassword] Email send failed:", emailResult.error);
      // On ne renvoie pas l'erreur exacte au client (sécurité)
    }

    // Toujours retourner success pour ne pas révéler l'existence d'un compte
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[ForgotPassword] Unexpected error:", error);
    return NextResponse.json({ success: true });
  }
}

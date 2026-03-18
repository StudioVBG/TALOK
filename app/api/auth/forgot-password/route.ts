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

    // Déterminer l'origin de production (ignorer localhost)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    const isLocalhost = appUrl && (appUrl.includes("localhost") || appUrl.includes("127.0.0.1"));
    const origin = (() => {
      if (appUrl && !isLocalhost) {
        return appUrl.replace(/\/+$/, "");
      }
      const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
      const proto = request.headers.get("x-forwarded-proto") || "https";
      if (host && !host.includes("localhost") && !host.includes("127.0.0.1")) {
        return `${proto}://${host}`;
      }
      return "https://talok.fr";
    })();

    // Générer le lien de recovery via l'API admin
    // Note : on n'utilise PAS l'action_link retournée (elle passe par Supabase
    // et casse le flux PKCE car pas de code_verifier côté client).
    // On extrait le hashed_token et on construit notre propre URL.
    const { data: linkData, error: linkError } =
      await supabase.auth.admin.generateLink({
        type: "recovery",
        email,
      });

    if (linkError) {
      console.error("[ForgotPassword] generateLink error:", linkError.message);
      return NextResponse.json({ success: true });
    }

    // Extraire le hashed_token pour vérification via verifyOtp côté callback
    const tokenHash = (linkData?.properties as any)?.hashed_token;
    if (!tokenHash) {
      console.error("[ForgotPassword] No hashed_token returned");
      return NextResponse.json({ success: true });
    }

    // Construire l'URL de reset qui passe par notre callback avec le token_hash
    // Le callback appellera verifyOtp() côté serveur → session créée → redirect vers reset-password
    const resetUrl = `${origin}/auth/callback?token_hash=${encodeURIComponent(tokenHash)}&type=recovery&next=${encodeURIComponent("/auth/reset-password")}`;
    console.log("[ForgotPassword] Using origin:", origin, "| resetUrl (token_hash approach)");

    // Récupérer le prénom de l'utilisateur depuis le profil
    let userName = "cher utilisateur";
    if (linkData.user?.id) {
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
    }

    // Générer l'email via le design system Talok (lib/emails/templates.ts)
    const template = emailTemplates.passwordReset({
      userName,
      resetUrl,
      expiresIn: "1 heure",
    });

    // Envoyer via Resend (forceSend pour bypasser la simulation en dev)
    const emailResult = await sendEmail({
      to: email,
      subject: template.subject,
      html: template.html,
      forceSend: true,
    });

    if (!emailResult.success) {
      console.error("[ForgotPassword] Email send failed:", emailResult.error);
    }
    if ((emailResult as any).simulated) {
      console.warn("[ForgotPassword] Email was SIMULATED, not actually sent! Set EMAIL_FORCE_SEND=true or check NODE_ENV.");
    }

    // Toujours retourner success pour ne pas révéler l'existence d'un compte
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[ForgotPassword] Unexpected error:", error);
    return NextResponse.json({ success: true });
  }
}

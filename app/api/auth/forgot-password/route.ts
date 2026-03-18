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
    // IMPORTANT : ignorer NEXT_PUBLIC_APP_URL si c'est localhost (dev local)
    // pour éviter que le lien dans l'email redirige vers localhost
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    const isLocalhost = appUrl && (appUrl.includes("localhost") || appUrl.includes("127.0.0.1"));
    const origin = (() => {
      if (appUrl && !isLocalhost) {
        return appUrl.replace(/\/+$/, "");
      }
      // Dériver l'origin depuis les headers de la requête (fiable en production)
      const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
      const proto = request.headers.get("x-forwarded-proto") || "https";
      if (host && !host.includes("localhost") && !host.includes("127.0.0.1")) {
        return `${proto}://${host}`;
      }
      return "https://talok.fr";
    })();
    const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent("/auth/reset-password")}`;
    console.log("[ForgotPassword] Using origin:", origin, "| redirectTo:", redirectTo);

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
    let actionLink = linkData?.properties?.action_link;
    if (!actionLink) {
      console.error("[ForgotPassword] No action_link returned");
      return NextResponse.json({ success: true });
    }

    // Sécurité : si l'action_link contient un redirect_to vers localhost,
    // le réécrire avec l'origin de production
    try {
      const linkUrl = new URL(actionLink);
      const embeddedRedirect = linkUrl.searchParams.get("redirect_to");
      if (embeddedRedirect && (embeddedRedirect.includes("localhost") || embeddedRedirect.includes("127.0.0.1"))) {
        console.warn("[ForgotPassword] action_link had localhost redirect_to, rewriting to:", redirectTo);
        linkUrl.searchParams.set("redirect_to", redirectTo);
        actionLink = linkUrl.toString();
      }
    } catch {
      // URL parsing failed, use actionLink as-is
    }

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
      resetUrl: actionLink,
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

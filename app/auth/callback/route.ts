export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getRoleDashboardUrl } from "@/lib/helpers/role-redirects";
import {
  PASSWORD_RESET_COOKIE_NAME,
  createPasswordResetCookieToken,
  getPasswordResetCookieOptions,
  validatePasswordResetRequestForCallback,
} from "@/lib/auth/password-recovery.service";

interface ProfilePartial {
  id?: string;
  role?: string;
  onboarding_completed_at?: string | null;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  // Utiliser l'origine de la requête (Vercel en production, localhost en dev)
  const origin = requestUrl.origin;

  const next = requestUrl.searchParams.get("next");
  const redirectParam = requestUrl.searchParams.get("redirect");
  const flow = requestUrl.searchParams.get("flow");
  const requestId = requestUrl.searchParams.get("rid");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("Error exchanging code for session:", error);
      return NextResponse.redirect(new URL("/auth/signin?error=invalid_code", origin));
    }

    if (flow === "pw-reset" && requestId && data.user) {
      const validation = await validatePasswordResetRequestForCallback({
        requestId,
        userId: data.user.id,
      });

      if (!validation.valid || !validation.request) {
        return NextResponse.redirect(new URL("/auth/forgot-password?error=invalid_reset_link", origin));
      }

      const response = NextResponse.redirect(new URL(`/recovery/password/${requestId}`, origin));
      response.cookies.set(
        PASSWORD_RESET_COOKIE_NAME,
        createPasswordResetCookieToken({
          requestId,
          userId: data.user.id,
          expiresAt: new Date(validation.request.expires_at).getTime(),
        }),
        getPasswordResetCookieOptions(validation.request.expires_at)
      );
      response.headers.set("Cache-Control", "no-store");
      return response;
    }

    // Si un paramètre "next" est présent (ex: /auth/reset-password), y rediriger directement
    // Cela permet au flux de réinitialisation de mot de passe de fonctionner correctement
    if (next && next.startsWith("/auth/reset-password")) {
      const legacyResponse = NextResponse.redirect(new URL("/auth/reset-password", origin));
      legacyResponse.headers.set("Cache-Control", "no-store");
      return legacyResponse;
    }

    // Vérifier si l'email est confirmé → rediriger vers le parcours onboarding
    if (data.user && !data.user.email_confirmed_at) {
      // Récupérer le rôle pour garder le contexte d'onboarding
      const { data: p } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", data.user.id)
        .maybeSingle();
      const profileRole = (p as ProfilePartial)?.role;
      const roleParam = profileRole ? `&role=${profileRole}` : "";
      return NextResponse.redirect(
        new URL(`/signup/verify-email?email=${encodeURIComponent(data.user.email || "")}${roleParam}`, origin)
      );
    }

    // Si l'email est confirmé, rediriger selon le rôle et le statut d'onboarding
    if (data.user && data.user.email_confirmed_at) {
      // Récupérer le profil pour obtenir le rôle et le statut d'onboarding
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, role, onboarding_completed_at")
        .eq("user_id", data.user.id)
        .maybeSingle();

      const profileData = profile as ProfilePartial | null;

      // Si pas de profil (ex: OAuth sans role), rediriger vers choix du rôle
      if (!profileData?.role) {
        return NextResponse.redirect(new URL("/signup/role", origin));
      }

      // Si onboarding non terminé, rediriger vers l'onboarding approprié
      if (!profileData?.onboarding_completed_at) {
        switch (profileData.role) {
          case "owner": {
            const ownerId = profileData.id;
            if (!ownerId) {
              return NextResponse.redirect(new URL("/signup/role", origin));
            }

            const { data: ownerSubscription } = await supabase
              .from("subscriptions")
              .select("selected_plan_at")
              .eq("owner_id", ownerId)
              .maybeSingle();

            if (!(ownerSubscription as { selected_plan_at?: string | null } | null)?.selected_plan_at) {
              return NextResponse.redirect(new URL("/signup/plan?role=owner", origin));
            }

            return NextResponse.redirect(new URL("/owner/onboarding/profile", origin));
          }
          case "tenant":
            return NextResponse.redirect(new URL("/tenant/onboarding/context", origin));
          case "provider":
            return NextResponse.redirect(new URL("/provider/onboarding/profile", origin));
          case "guarantor":
            return NextResponse.redirect(new URL("/guarantor/onboarding/context", origin));
          case "syndic":
            return NextResponse.redirect(new URL("/syndic/onboarding/profile", origin));
        }
      }

      // Onboarding terminé — rediriger vers la page demandée ou le dashboard
      const safeRedirect = redirectParam && redirectParam.startsWith("/") && !redirectParam.startsWith("//")
        ? redirectParam
        : null;
      const dashUrl = safeRedirect || getRoleDashboardUrl(profileData.role);
      return NextResponse.redirect(new URL(dashUrl, origin));
    }
  }

  // Aucun code fourni ou échange échoué — rediriger vers la connexion
  return NextResponse.redirect(new URL("/auth/signin", origin));
}

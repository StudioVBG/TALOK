export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import {
  getRoleDashboardUrl,
  getOnboardingStartPath,
  isPublicRole,
  type PublicRole,
} from "@/lib/helpers/role-redirects";
import {
  PASSWORD_RESET_COOKIE_NAME,
  createPasswordResetCookieToken,
  getPasswordResetCookieOptions,
  validatePasswordResetRequestForCallback,
} from "@/lib/auth/password-recovery.service";
import { sendWelcomeEmail } from "@/lib/services/email-service";

interface ProfilePartial {
  id?: string;
  role?: string;
  onboarding_completed_at?: string | null;
  prenom?: string | null;
  nom?: string | null;
}

function isValidRole(role: string | undefined | null): role is PublicRole {
  return isPublicRole(role);
}

function isSafeRelativePath(path: string | null | undefined): path is string {
  return !!path && path.startsWith("/") && !path.startsWith("//");
}

function fireWelcomeEmail(params: {
  userEmail: string | null | undefined;
  prenom: string | null | undefined;
  role: PublicRole;
}): void {
  if (!params.userEmail) return;
  const userName = (params.prenom || params.userEmail.split("@")[0] || "").trim();
  // Idempotent côté Resend grâce à idempotencyKey: welcome/<email>.
  sendWelcomeEmail({
    userEmail: params.userEmail,
    userName,
    role: params.role,
  }).catch((err) => {
    console.error("[auth/callback] sendWelcomeEmail failed:", err);
  });
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

  // Chemin 1 : Vérification directe par token_hash (liens email custom via generateLink)
  // generateLink() côté serveur ne pose pas de code verifier PKCE dans le navigateur,
  // donc on utilise verifyOtp() avec le token_hash au lieu de exchangeCodeForSession().
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");

  if (tokenHash && type) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as "recovery",
    });

    if (error || !data.user) {
      console.error("Error verifying OTP token:", error);
      if (flow === "pw-reset") {
        return NextResponse.redirect(new URL("/auth/forgot-password?error=invalid_reset_link", origin));
      }
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

    // Token vérifié mais pas un flow pw-reset : traiter comme une connexion normale
    // (fallthrough vers la logique de redirection par rôle ci-dessous)
    if (data.user && data.user.email_confirmed_at) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, role, onboarding_completed_at, prenom, nom")
        .eq("user_id", data.user.id)
        .maybeSingle();

      const profileData = profile as ProfilePartial | null;

      const metadataRole = data.user.user_metadata?.role as string | undefined;
      const role = isValidRole(profileData?.role)
        ? (profileData!.role as PublicRole)
        : isValidRole(metadataRole)
          ? metadataRole
          : null;

      console.log("[auth/callback] token_hash verified", {
        user_id: data.user.id,
        profile_role: profileData?.role,
        metadata_role: metadataRole,
        resolved_role: role,
        onboarding_completed: !!profileData?.onboarding_completed_at,
      });

      if (!role) {
        return NextResponse.redirect(new URL("/signup/role", origin));
      }

      fireWelcomeEmail({
        userEmail: data.user.email,
        prenom: profileData?.prenom ?? (data.user.user_metadata?.prenom as string | undefined),
        role,
      });

      if (profileData?.onboarding_completed_at) {
        return NextResponse.redirect(new URL(getRoleDashboardUrl(role), origin));
      }

      // Onboarding non terminé → première étape par rôle (pas le dashboard)
      return NextResponse.redirect(new URL(getOnboardingStartPath(role), origin));
    }

    return NextResponse.redirect(new URL("/auth/signin", origin));
  }

  // Chemin 2 : Échange de code PKCE (flux standard Supabase, rétrocompatibilité)
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

    // 1) Si un paramètre "next" est présent et pointe vers une route relative sûre,
    //    on le respecte (ex: /auth/reset-password, ou une deep-link interne).
    //    Cela permet aux flux spécifiques (reset-password, invitation, etc.) de
    //    reprendre exactement où ils étaient, sans passer par la logique rôle.
    if (isSafeRelativePath(next)) {
      const nextResponse = NextResponse.redirect(new URL(next, origin));
      nextResponse.headers.set("Cache-Control", "no-store");
      return nextResponse;
    }

    // 2) Après exchangeCodeForSession réussi sur un lien d'inscription, l'email
    //    est confirmé côté Supabase. On ne retombe JAMAIS sur /signup/verify-email
    //    (sinon la page qui attend reste figée en attendant une confirmation déjà
    //    faite). On déduit directement la cible à partir du profil, ou à défaut
    //    du user_metadata posé au signUp.
    if (data.user) {
      // Récupérer le profil pour obtenir le rôle et le statut d'onboarding
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, role, onboarding_completed_at, prenom, nom")
        .eq("user_id", data.user.id)
        .maybeSingle();

      const profileData = profile as ProfilePartial | null;

      // Rôle : priorité au profil DB, fallback sur user_metadata.role (posé au
      // signUp). Si rien, on envoie choisir un rôle.
      const metadataRole = data.user.user_metadata?.role as string | undefined;
      const role = isValidRole(profileData?.role)
        ? (profileData!.role as PublicRole)
        : isValidRole(metadataRole)
          ? metadataRole
          : null;

      console.log("[auth/callback] PKCE exchange OK", {
        user_id: data.user.id,
        profile_role: profileData?.role,
        metadata_role: metadataRole,
        resolved_role: role,
        onboarding_completed: !!profileData?.onboarding_completed_at,
      });

      if (!role) {
        return NextResponse.redirect(new URL("/signup/role", origin));
      }

      fireWelcomeEmail({
        userEmail: data.user.email,
        prenom: profileData?.prenom ?? (data.user.user_metadata?.prenom as string | undefined),
        role,
      });

      // Onboarding terminé → dashboard (ou redirect explicite)
      if (profileData?.onboarding_completed_at) {
        const dashUrl = isSafeRelativePath(redirectParam)
          ? redirectParam
          : getRoleDashboardUrl(role);
        return NextResponse.redirect(new URL(dashUrl, origin));
      }

      // Cas particulier owner : sauter l'étape plan si déjà sélectionné
      if (role === "owner" && profileData?.id) {
        const { data: ownerSubscription } = await supabase
          .from("subscriptions")
          .select("selected_plan_at")
          .eq("owner_id", profileData.id)
          .maybeSingle();

        if ((ownerSubscription as { selected_plan_at?: string | null } | null)?.selected_plan_at) {
          return NextResponse.redirect(new URL("/owner/onboarding/profile", origin));
        }
      }

      // Redirection directe vers la première étape d'onboarding du rôle, sans
      // repasser par /signup/verify-email.
      return NextResponse.redirect(new URL(getOnboardingStartPath(role), origin));
    }
  }

  // Aucun code fourni ou échange échoué — rediriger vers la connexion
  return NextResponse.redirect(new URL("/auth/signin", origin));
}

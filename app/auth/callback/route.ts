export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getRoleDashboardUrl } from "@/lib/helpers/role-redirects";
import { getServiceClient } from "@/lib/supabase/service-client";

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

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("Error exchanging code for session:", error);
      return NextResponse.redirect(new URL("/auth/signin?error=invalid_code", origin));
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

      // AUTO-LINK: Lier les lease_signers orphelins AVANT toute redirection
      // Doit s'exécuter pour TOUS les utilisateurs (y compris ceux en cours d'onboarding)
      // sinon un nouveau locataire invité n'est jamais lié à son bail
      if (data.user.email && profileData.id) {
        try {
          const serviceClient = getServiceClient();
          const { data: orphanSigners } = await serviceClient
            .from("lease_signers")
            .select("id")
            .ilike("invited_email", data.user.email)
            .is("profile_id", null);

          if (orphanSigners && orphanSigners.length > 0) {
            await serviceClient
              .from("lease_signers")
              .update({ profile_id: profileData.id } as Record<string, unknown>)
              .ilike("invited_email", data.user.email)
              .is("profile_id", null);
            console.log(`[auth/callback] ${orphanSigners.length} lease_signers auto-linked for ${data.user.email}`);
          }
        } catch (autoLinkErr) {
          // Non-bloquant : ne jamais empêcher la connexion
          console.error("[auth/callback] Auto-link error (non-blocking):", autoLinkErr);
        }
      }

      // Si onboarding non terminé, rediriger vers l'onboarding approprié
      if (!profileData?.onboarding_completed_at) {
        switch (profileData.role) {
          case "owner":
            return NextResponse.redirect(new URL("/signup/plan?role=owner", origin));
          case "tenant":
            return NextResponse.redirect(new URL("/tenant/onboarding/context", origin));
          case "provider":
            return NextResponse.redirect(new URL("/provider/onboarding/profile", origin));
          case "guarantor":
            return NextResponse.redirect(new URL("/guarantor/onboarding/context", origin));
        }
      }

      // Onboarding terminé — rediriger vers le dashboard approprié
      const dashUrl = getRoleDashboardUrl(profileData.role);
      return NextResponse.redirect(new URL(dashUrl, origin));
    }
  }

  // Aucun code fourni ou échange échoué — rediriger vers la connexion
  return NextResponse.redirect(new URL("/auth/signin", origin));
}

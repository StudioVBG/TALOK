export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

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
        .eq("user_id", data.user.id as any)
        .maybeSingle();
      const roleParam = (p as any)?.role ? `&role=${(p as any).role}` : "";
      return NextResponse.redirect(
        new URL(`/signup/verify-email?email=${encodeURIComponent(data.user.email || "")}${roleParam}`, origin)
      );
    }

    // Si l'email est confirmé, rediriger selon le rôle et le statut d'onboarding
    if (data.user && data.user.email_confirmed_at) {
      // Récupérer le profil pour obtenir le rôle et le statut d'onboarding
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, onboarding_completed_at")
        .eq("user_id", data.user.id as any)
        .maybeSingle();

      const profileData = profile as any;

      // Si pas de profil (ex: OAuth sans role), rediriger vers choix du rôle
      if (!profileData?.role) {
        return NextResponse.redirect(new URL("/signup/role", origin));
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
      // Utilise un mapping complet pour tous les rôles incluant copro, syndic, agency, platform_admin
      const roleDashboards: Record<string, string> = {
        admin: "/admin/dashboard",
        platform_admin: "/admin/dashboard",
        owner: "/owner/dashboard",
        tenant: "/tenant/dashboard",
        provider: "/provider/dashboard",
        guarantor: "/guarantor/dashboard",
        agency: "/agency/dashboard",
        syndic: "/syndic/dashboard",
        coproprietaire: "/copro/dashboard",
        coproprietaire_occupant: "/copro/dashboard",
        coproprietaire_bailleur: "/copro/dashboard",
        coproprietaire_nu: "/copro/dashboard",
        usufruitier: "/copro/dashboard",
        president_cs: "/copro/dashboard",
        conseil_syndical: "/copro/dashboard",
      };
      const dashUrl = roleDashboards[profileData.role] || "/dashboard";
      return NextResponse.redirect(new URL(dashUrl, origin));
    }
  }

  // Aucun code fourni ou échange échoué — rediriger vers la connexion
  return NextResponse.redirect(new URL("/auth/signin", origin));
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServerProfile } from "@/lib/helpers/auth-helper";

/**
 * Fonction centralisée : retourne l'URL du dashboard selon le rôle.
 * Gère tous les rôles existants, y compris les sous-rôles copro et platform_admin.
 */
export function getRoleDashboardUrl(role: string | null | undefined): string {
  if (!role) return "/auth/signin";

  switch (role) {
    case "admin":
    case "platform_admin":
      return "/admin/dashboard";
    case "owner":
      return "/owner/dashboard";
    case "tenant":
      return "/tenant/dashboard";
    case "provider":
      return "/provider/dashboard";
    case "agency":
      return "/agency/dashboard";
    case "syndic":
      return "/syndic/dashboard";
    case "guarantor":
      return "/guarantor/dashboard";
    // Tous les sous-rôles copropriété → espace copro
    case "coproprietaire":
    case "coproprietaire_occupant":
    case "coproprietaire_bailleur":
    case "coproprietaire_nu":
    case "usufruitier":
    case "president_cs":
    case "conseil_syndical":
      return "/copro/dashboard";
    default:
      // Si rôle inconnu, rediriger vers l'accueil
      return "/";
  }
}

/**
 * Page /dashboard - Redirection intelligente vers le dashboard du rôle
 *
 * Cette page détecte le rôle de l'utilisateur et le redirige vers
 * son dashboard spécifique. Gère tous les rôles et sous-rôles.
 */
export default async function DashboardRedirectPage() {
  const supabase = await createClient();

  // Vérifier l'authentification
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/auth/signin");
  }

  // Récupérer le profil (avec fallback service role en cas de récursion RLS)
  const { profile } = await getServerProfile<{ role: string }>(
    user.id,
    "role"
  );

  redirect(getRoleDashboardUrl(profile?.role));
}


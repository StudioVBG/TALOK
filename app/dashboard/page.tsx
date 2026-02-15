export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServerProfile } from "@/lib/helpers/auth-helper";
import { getRoleDashboardUrl } from "@/lib/helpers/role-redirects";

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


import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

/**
 * requireRoleServer — Vérifie le rôle de l'utilisateur dans les layouts serveur Node.js.
 *
 * Utilisé dans les layouts protégés (owner/layout.tsx, tenant/layout.tsx, etc.)
 * pour valider que l'utilisateur a bien le rôle requis pour accéder à cette section.
 *
 * @param allowedRoles - Liste des rôles autorisés pour cette section
 * @returns Le profil de l'utilisateur si autorisé
 */
export async function requireRoleServer(allowedRoles: string[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const headersList = await headers();
    const pathname = headersList.get("x-pathname") || "/";
    redirect(`/auth/signin?redirect=${encodeURIComponent(pathname)}`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, user_id, role, prenom, nom, email")
    .eq("user_id", user.id)
    .single();

  if (!profile) {
    redirect("/auth/signin?error=profile_not_found");
  }

  if (!allowedRoles.includes(profile.role)) {
    // Redirect to the user's appropriate dashboard based on their role
    const roleDashboards: Record<string, string> = {
      owner: "/owner/dashboard",
      tenant: "/tenant/lease",
      provider: "/provider/dashboard",
      syndic: "/syndic/dashboard",
      agency: "/agency/dashboard",
      admin: "/admin/dashboard",
      guarantor: "/guarantor/dashboard",
    };
    const dashboardPath = roleDashboards[profile.role] || "/dashboard";
    redirect(dashboardPath);
  }

  return profile;
}

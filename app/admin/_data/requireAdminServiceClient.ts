import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Vérifie que l'utilisateur courant est admin (ou platform_admin) via la
 * session SSR, puis retourne un client Supabase service-role pour les queries
 * métier côté serveur (bypass RLS).
 *
 * Retourne null si l'utilisateur n'est pas authentifié ou n'est pas admin,
 * afin que les fetchers puissent renvoyer un résultat vide sans lever.
 *
 * Usage :
 *   const serviceClient = await requireAdminServiceClient();
 *   if (!serviceClient) return { items: [], total: 0 };
 */
export async function requireAdminServiceClient() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (!profile || (profile.role !== "admin" && profile.role !== "platform_admin")) {
    return null;
  }

  return createServiceRoleClient();
}

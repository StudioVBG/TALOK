import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

export async function fetchAdminProperties(options: { status?: string; search?: string; limit?: number; offset?: number } = {}) {
  const supabase = await createClient();
  const { status, search, limit = 50, offset = 0 } = options;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { properties: [], total: 0 };

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (!adminProfile || (adminProfile.role !== "admin" && adminProfile.role !== "platform_admin")) {
    return { properties: [], total: 0 };
  }

  const serviceClient = createServiceRoleClient();

  let query = serviceClient
    .from("properties")
    .select("*, owner:profiles(id, prenom, nom)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status && status !== "all") {
    query = query.eq("statut", status);
  }

  if (search) {
    query = query.ilike("adresse_complete", `%${search}%`);
  }

  const { data, count, error } = await query;

  if (error) {
    console.error("Error fetching admin properties:", error);
    return { properties: [], total: 0 };
  }

  return { properties: data || [], total: count || 0 };
}

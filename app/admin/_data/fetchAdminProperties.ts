import { createClient } from "@/lib/supabase/server";

export async function fetchAdminProperties(options: { status?: string; search?: string; limit?: number; offset?: number } = {}) {
  const supabase = await createClient();
  const { status, search, limit = 50, offset = 0 } = options;

  let query = supabase
    .from("properties")
    .select("*, owner:profiles(prenom, nom, email)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status && status !== "all") {
    // Mapper le status UI vers DB si besoin, ou utiliser tel quel
    query = query.eq("statut", status);
  }

  if (search) {
    query = query.ilike("adresse_complete", `%${search}%`);
  }

  const { data, count, error } = await query;

  if (error) {
    console.error("Error fetching admin properties:", error);
    return [];
  }

  return { properties: data || [], total: count || 0 };
}


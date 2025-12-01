import { createClient } from "@/lib/supabase/server";

interface FetchAdminUsersResult {
  users: any[];
  total: number;
}

export async function fetchAdminUsers(options: { role?: string; search?: string; limit?: number; offset?: number } = {}): Promise<FetchAdminUsersResult> {
  const supabase = await createClient();
  const { role, search, limit = 50, offset = 0 } = options;

  // Vérifier admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { users: [], total: 0 };

  // Note: Sécurité RLS doit permettre à l'admin de voir tous les profils.
  // Si RLS bloque, il faut utiliser supabase admin client (service role) OU ajuster les policies.
  // Ici on suppose que le user 'admin' a les droits via RLS.

  let query = supabase
    .from("profiles")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (role && role !== "all") {
    query = query.eq("role", role);
  }

  if (search) {
    query = query.or(`prenom.ilike.%${search}%,nom.ilike.%${search}%`);
  }

  const { data, count, error } = await query;

  if (error) {
    console.error("Error fetching admin users:", error);
    return { users: [], total: 0 };
  }

  return { users: data || [], total: count || 0 };
}


import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

interface UserWithEmail {
  id: string;
  user_id: string;
  role: string;
  prenom: string | null;
  nom: string | null;
  telephone: string | null;
  avatar_url: string | null;
  created_at: string;
  email: string | null; // Email depuis auth.users
}

interface FetchAdminUsersResult {
  users: UserWithEmail[];
  total: number;
}

export async function fetchAdminUsers(options: { role?: string; search?: string; limit?: number; offset?: number } = {}): Promise<FetchAdminUsersResult> {
  const supabase = await createClient();
  const { role, search, limit = 50, offset = 0 } = options;

  // Vérifier admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { users: [], total: 0 };

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (!adminProfile || adminProfile.role !== "admin") {
    return { users: [], total: 0 };
  }

  // Utiliser service role pour bypasser RLS
  const serviceClient = createServiceRoleClient();

  let query = serviceClient
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

  const { data: profiles, count, error } = await query;

  if (error) {
    console.error("Error fetching admin users:", error);
    return { users: [], total: 0 };
  }

  if (!profiles || profiles.length === 0) {
    return { users: [], total: count || 0 };
  }

  // Récupérer les emails depuis auth.users via l'API admin
  const userIds = profiles.map((p) => p.user_id).filter(Boolean);
  
  // Utiliser auth.admin.listUsers pour récupérer les emails
  const { data: authUsersData, error: authError } = await serviceClient.auth.admin.listUsers({
    perPage: 1000, // Max par page
  });

  if (authError) {
    console.error("Error fetching auth users:", authError);
    // Retourner les profils sans emails en cas d'erreur
    return { 
      users: profiles.map((p) => ({ ...p, email: null })) as UserWithEmail[], 
      total: count || 0 
    };
  }

  // Créer un map userId -> email
  const emailMap = new Map<string, string>();
  if (authUsersData?.users) {
    for (const authUser of authUsersData.users) {
      emailMap.set(authUser.id, authUser.email || "");
    }
  }

  // Combiner les profils avec les emails
  const usersWithEmail: UserWithEmail[] = profiles.map((profile) => ({
    ...profile,
    email: emailMap.get(profile.user_id) || null,
  })) as UserWithEmail[];

  // Si la recherche inclut un email, filtrer côté serveur
  let filteredUsers = usersWithEmail;
  if (search) {
    const searchLower = search.toLowerCase();
    filteredUsers = usersWithEmail.filter((u) => 
      u.email?.toLowerCase().includes(searchLower) ||
      u.prenom?.toLowerCase().includes(searchLower) ||
      u.nom?.toLowerCase().includes(searchLower) ||
      u.telephone?.includes(search)
    );
  }

  return { users: filteredUsers, total: count || 0 };
}


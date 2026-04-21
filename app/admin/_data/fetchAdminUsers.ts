import { requireAdminServiceClient } from "./requireAdminServiceClient";

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
  const serviceClient = await requireAdminServiceClient();
  if (!serviceClient) return { users: [], total: 0 };

  const { role, search, limit = 50, offset = 0 } = options;

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

  // Récupérer les emails uniquement pour les profils de la page courante (pas les 1000)
  const userIds: string[] = profiles.map((p: Record<string, unknown>) => p.user_id as string).filter(Boolean);

  const emailMap = new Map<string, string>();

  // Récupérer les emails un par un (seulement pour la page courante, max ~50 users)
  const emailResults = await Promise.allSettled(
    userIds.map(async (userId: string) => {
      const { data } = await serviceClient.auth.admin.getUserById(userId);
      if (data?.user?.email) {
        emailMap.set(userId, data.user.email);
      }
    })
  );

  // Log errors silently
  const failures = emailResults.filter((r: PromiseSettledResult<void>) => r.status === "rejected");
  if (failures.length > 0) {
    console.warn(`[fetchAdminUsers] ${failures.length} email lookups failed`);
  }

  // Combiner les profils avec les emails
  const usersWithEmail: UserWithEmail[] = profiles.map((p: Record<string, unknown>) => ({
    ...p,
    email: emailMap.get(p.user_id as string) || null,
  })) as UserWithEmail[];

  return { users: usersWithEmail, total: count || 0 };
}


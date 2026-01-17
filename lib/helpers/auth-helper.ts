import { createClient, createClientFromRequest } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

/**
 * Helper pour récupérer l'utilisateur authentifié depuis les cookies ou le token Bearer
 */
export async function getAuthenticatedUser(request: Request) {
  // Utiliser createClientFromRequest pour les routes API afin d'avoir accès aux cookies de la requête
  const supabase = await createClientFromRequest(request);
  
  // Essayer d'abord avec les cookies
  let { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError) {
    // Log uniquement les erreurs réelles
    console.error("getAuthenticatedUser: Error from getUser():", authError.message);
  }
  
  // Si pas d'utilisateur, essayer avec le token dans les headers
  if (!user) {
    const authHeader = request.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      
      // Créer un nouveau client avec le token dans les headers
      const { createClient: createSupabaseClient } = await import("@supabase/supabase-js");
      const tokenClient = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        }
      );
      
      const { data: { user: userFromToken }, error: tokenError } = await tokenClient.auth.getUser();
      if (!tokenError && userFromToken) {
        user = userFromToken;
        authError = null;
        // Utiliser le client avec token pour les requêtes suivantes
        return { user, error: null, supabase: tokenClient };
      } else if (tokenError) {
        console.error("getAuthenticatedUser: Error from getUser(token):", tokenError.message);
      }
    }
  }

  return { user, error: authError, supabase };
}

/**
 * Helper pour vérifier que l'utilisateur est admin
 */
export async function requireAdmin(request: Request) {
  const { user, error, supabase } = await getAuthenticatedUser(request);

  if (error) {
    console.error("requireAdmin: Auth error:", error);
    return {
      error: { message: "Erreur d'authentification", details: error.message, status: 401 },
      user: null,
      profile: null,
      supabase: null,
    };
  }

  if (!user) {
    return {
      error: { message: "Non authentifié", status: 401 },
      user: null,
      profile: null,
      supabase: null,
    };
  }

  // Vérifier que l'utilisateur est admin
  // Utiliser le service role pour éviter les problèmes RLS dans les routes API admin
  const { createClient } = await import("@supabase/supabase-js");
  const { url, serviceRoleKey } = getSupabaseConfig();
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY n'est pas défini");
  }
  const serviceClient = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Déclarer profileData en dehors du try pour qu'elle soit accessible après
  let profileData: any = null;

  try {
    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("role, id")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      console.error("requireAdmin: Error fetching profile:", profileError);
      console.error("requireAdmin: Profile error details:", JSON.stringify(profileError, null, 2));
      return {
        error: { message: "Erreur lors de la vérification du profil", status: 500 },
        user: null,
        profile: null,
        supabase: null,
      };
    }

    profileData = profile as any;

    if (!profileData || profileData?.role !== "admin") {
      return {
        error: { message: "Accès non autorisé", status: 403 },
        user: null,
        profile: null,
        supabase: null,
      };
    }
  } catch (error: unknown) {
    console.error("requireAdmin: Unexpected error:", error);
    console.error("requireAdmin: Error stack:", error.stack);
    return {
      error: { message: error instanceof Error ? error.message : "Erreur inattendue lors de la vérification", status: 500 },
      user: null,
      profile: null,
      supabase: null,
    };
  }

  // Vérifier que profileData est bien défini avant de l'utiliser
  if (!profileData) {
    console.error("requireAdmin: profileData is null after try block");
    return {
      error: { message: "Erreur lors de la vérification du profil", status: 500 },
      user: null,
      profile: null,
      supabase: null,
    };
  }
  // Retourner le service client pour les requêtes suivantes (contourne RLS)
  return {
    error: null,
    user,
    profile: profileData,
    supabase: serviceClient as any,
  };
}


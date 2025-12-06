import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/supabase/database.types";
import { NextRequest } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

// Re-export du service client pour compatibilité
export { createServiceRoleClient } from "./service-client";

// Alias pour compatibilité avec les anciens imports (createRouteHandlerClient)
export const createRouteHandlerClient = async () => {
  return createClient();
};

// Alias pour compatibilité avec les anciens imports
export { createClient as createServerClient };

/**
 * Crée un client Supabase pour les Server Components
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabaseConfig();

  return createServerClient<Database>(
    url,
    anonKey,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options?: any) {
          try {
            cookieStore.set(name, value, options);
          } catch {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
        remove(name: string, options?: any) {
          try {
            cookieStore.set(name, "", { ...options, maxAge: 0 });
          } catch {
            // Ignore
          }
        },
      },
    }
  );
}

/**
 * Crée un client Supabase pour les routes API (utilise les cookies de la requête)
 */
export function createClientFromRequest(request: Request | NextRequest) {
  const cookieHeader = request.headers.get("cookie") || "";
  
  // Parser les cookies en gérant les valeurs URL-encodées
  const parsedCookies = new Map<string, string>();
  
  if (cookieHeader) {
    cookieHeader
      .split(";")
      .map((cookie) => cookie.trim())
      .filter(Boolean)
      .forEach((cookie) => {
        const separatorIndex = cookie.indexOf("=");
        if (separatorIndex === -1) return;
        
        const name = cookie.substring(0, separatorIndex).trim();
        let value = cookie.substring(separatorIndex + 1).trim();
        
        // Décoder les valeurs URL-encodées si nécessaire
        try {
          // Les cookies peuvent être encodés, mais on ne doit décoder que si nécessaire
          // car certaines valeurs peuvent contenir des caractères spéciaux légitimes
          if (value.includes("%")) {
            value = decodeURIComponent(value);
          }
        } catch {
          // Si le décodage échoue, garder la valeur originale
        }
        
        parsedCookies.set(name, value);
      });
  }

  const { url, anonKey } = getSupabaseConfig();

  return createServerClient<Database>(
    url,
    anonKey,
    {
      cookies: {
        get(name: string) {
          return parsedCookies.get(name);
        },
        set(name: string, value: string) {
          // Dans les routes API, on ne peut pas modifier les cookies de réponse
          // de cette manière. Les cookies sont gérés par le middleware.
        },
        remove(name: string) {
          // Dans les routes API, on ne peut pas modifier les cookies de réponse
          // de cette manière. Les cookies sont gérés par le middleware.
        },
      },
    }
  );
}


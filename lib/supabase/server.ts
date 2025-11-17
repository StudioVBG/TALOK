import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/supabase/database.types";
import { NextRequest } from "next/server";

/**
 * Crée un client Supabase pour les Server Components
 */
export async function createClient() {
  const cookieStore = await cookies();

  // Validation de l'URL Supabase
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is not set. Please configure it in your environment variables."
    );
  }

  if (supabaseUrl.includes("supabase.com/dashboard") || supabaseUrl.includes("/settings/api-keys")) {
    throw new Error(
      `Invalid NEXT_PUBLIC_SUPABASE_URL: "${supabaseUrl}". ` +
      `It should be your Supabase API URL (e.g., https://xxxxx.supabase.co), ` +
      `not the dashboard URL. Get it from: Supabase Dashboard → Settings → API → Project URL`
    );
  }

  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseAnonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY is not set. Please configure it in your environment variables."
    );
  }

  return createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
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
  console.log("createClientFromRequest: Cookie header length:", cookieHeader.length);
  
  // Parser les cookies correctement (gérer les valeurs qui contiennent =)
  const parseCookies = (cookieString: string): { name: string; value: string }[] => {
    const cookies: { name: string; value: string }[] = [];
    
    if (!cookieString) return cookies;
    
    // Split par ";" mais attention aux valeurs qui contiennent ";"
    cookieString.split(";").forEach((cookie) => {
      const trimmed = cookie.trim();
      if (!trimmed) return;
      
      const equalIndex = trimmed.indexOf("=");
      if (equalIndex === -1) return;
      
      const name = trimmed.substring(0, equalIndex).trim();
      const value = trimmed.substring(equalIndex + 1).trim();
      
      if (name) {
        cookies.push({ name, value });
      }
    });
    
    return cookies;
  };
  
  const parsedCookies = parseCookies(cookieHeader);
  console.log("createClientFromRequest: Parsed cookies count:", parsedCookies.length);
  if (parsedCookies.length > 0) {
    console.log("createClientFromRequest: Cookie names:", parsedCookies.map(c => c.name).join(", "));
  }
  
  // Validation de l'URL Supabase
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is not set. Please configure it in your environment variables."
    );
  }

  if (supabaseUrl.includes("supabase.com/dashboard") || supabaseUrl.includes("/settings/api-keys")) {
    throw new Error(
      `Invalid NEXT_PUBLIC_SUPABASE_URL: "${supabaseUrl}". ` +
      `It should be your Supabase API URL (e.g., https://xxxxx.supabase.co), ` +
      `not the dashboard URL. Get it from: Supabase Dashboard → Settings → API → Project URL`
    );
  }

  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseAnonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY is not set. Please configure it in your environment variables."
    );
  }

  return createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        get(name: string) {
          return parsedCookies.find(c => c.name === name)?.value;
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


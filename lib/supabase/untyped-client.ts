/**
 * Client Supabase Non Typé
 *
 * SOTA 2026 - Solution pour les tables dynamiques
 *
 * Ce fichier exporte des clients Supabase sans typage strict,
 * permettant d'accéder à n'importe quelle table sans erreurs TypeScript.
 *
 * À utiliser pour :
 * - Tables secondaires non définies dans database.types.ts
 * - Migrations et scripts d'administration
 * - Code legacy en cours de migration
 *
 * Pour les tables principales (properties, profiles, leases, etc.),
 * préférer les clients typés de ./server.ts et ./client.ts
 */

import { createClient as createSupabaseClient, SupabaseClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"

// ============================================
// TYPES
// ============================================

/** Client Supabase sans typage strict */
export type UntypedSupabaseClient = SupabaseClient<any, "public", any>

// ============================================
// SERVER CLIENTS
// ============================================

/**
 * Crée un client Supabase serveur non typé
 * Pour les routes API et Server Components
 */
export async function createUntypedServerClient(): Promise<UntypedSupabaseClient> {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Ignore errors in Server Components
          }
        },
      },
    }
  ) as UntypedSupabaseClient
}

/**
 * Crée un client Supabase non typé depuis une Request
 * Pour les routes API qui ont besoin des cookies de la requête
 */
export async function createUntypedClientFromRequest(request: Request): Promise<UntypedSupabaseClient> {
  const cookieHeader = request.headers.get("cookie") || ""
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          // Parse cookies from header for API routes
          const parsedCookies: { name: string; value: string }[] = []
          cookieHeader.split(";").forEach((cookie) => {
            const [name, ...rest] = cookie.trim().split("=")
            if (name) {
              parsedCookies.push({ name, value: rest.join("=") })
            }
          })
          return parsedCookies
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Ignore errors
          }
        },
      },
    }
  ) as UntypedSupabaseClient
}

/**
 * Crée un client Service Role non typé
 * ⚠️ Bypass RLS - À utiliser uniquement côté serveur
 */
export function createUntypedServiceClient(): UntypedSupabaseClient {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required")
  }

  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  ) as UntypedSupabaseClient
}

// ============================================
// BROWSER CLIENT
// ============================================

/**
 * Crée un client Supabase browser non typé
 * Pour les composants client
 */
export function createUntypedBrowserClient(): UntypedSupabaseClient {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ) as UntypedSupabaseClient
}

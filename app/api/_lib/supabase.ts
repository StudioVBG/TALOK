import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

export async function supabaseServer() {
  return await createClient();
}

/**
 * Client Supabase avec Service Role (bypass RLS)
 * Réutilise le singleton de service-client.ts pour éviter les instances multiples
 */
export function supabaseAdmin() {
  return createServiceRoleClient();
}


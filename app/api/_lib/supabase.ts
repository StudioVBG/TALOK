import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export async function supabaseServer() {
  return await createClient();
}

export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL n'est pas défini");
  }
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY n'est pas défini (requis pour supabaseAdmin)");
  }

  return createSupabaseClient(url, key, { auth: { persistSession: false } });
}


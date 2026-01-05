import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

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

/**
 * Vérifie le secret CRON pour sécuriser les endpoints automatisés.
 * IMPORTANT: Toujours configurer CRON_SECRET sur Netlify en production!
 *
 * @returns true si autorisé, false sinon
 */
export function verifyCronSecret(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // En production, CRON_SECRET est OBLIGATOIRE
  if (process.env.NODE_ENV === "production" && !cronSecret) {
    console.error("[SECURITY] CRON_SECRET non configuré en production! Route bloquée.");
    return false;
  }

  // En développement sans secret, autoriser (avec warning)
  if (!cronSecret) {
    console.warn("[DEV] CRON_SECRET non configuré - accès autorisé en développement");
    return process.env.NODE_ENV === "development";
  }

  return authHeader === `Bearer ${cronSecret}`;
}

/**
 * Réponse standard pour accès non autorisé aux routes protégées
 */
export function unauthorizedResponse(message = "Unauthorized") {
  return NextResponse.json({ error: message }, { status: 401 });
}

/**
 * Vérifie que la route n'est accessible qu'en développement
 */
export function isDevOnly(): boolean {
  return process.env.NODE_ENV !== "production";
}

/**
 * Réponse standard pour routes désactivées en production
 */
export function prodDisabledResponse() {
  return NextResponse.json(
    { error: "Cette route est désactivée en production" },
    { status: 403 }
  );
}


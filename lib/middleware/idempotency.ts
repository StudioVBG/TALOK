import { createClient } from "@/lib/supabase/server";
import { getTypedSupabaseClient } from "@/lib/helpers/supabase-client";

/**
 * Middleware pour gérer l'idempotence des requêtes (P2-1)
 * Utilise l'en-tête Idempotency-Key pour éviter les doublons
 */

interface IdempotencyResult {
  isDuplicate: boolean;
  cachedResponse?: any;
}

const idempotencyCache = new Map<string, { response: any; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 heures

export async function checkIdempotency(
  key: string
): Promise<IdempotencyResult> {
  if (!key) {
    return { isDuplicate: false };
  }

  // Vérifier dans le cache mémoire
  const cached = idempotencyCache.get(key);
  if (cached) {
    const age = Date.now() - cached.timestamp;
    if (age < CACHE_TTL) {
      return {
        isDuplicate: true,
        cachedResponse: cached.response,
      };
    } else {
      // Expiré, supprimer du cache
      idempotencyCache.delete(key);
    }
  }

  // Vérifier dans la base de données (table idempotency_keys)
  try {
    const supabase = await createClient();
    const supabaseClient = getTypedSupabaseClient(supabase);
    const { data: existing } = await supabaseClient
      .from("idempotency_keys")
      .select("*")
      .eq("key", key as any)
      .single();

    if (existing) {
      const age = Date.now() - new Date((existing as any).created_at).getTime();
      if (age < CACHE_TTL) {
        // Mettre en cache
        idempotencyCache.set(key, {
          response: (existing as any).response,
          timestamp: Date.now(),
        });

        return {
          isDuplicate: true,
          cachedResponse: (existing as any).response,
        };
      }
    }
  } catch (error) {
    // Si la table n'existe pas, continuer sans vérification DB
    console.warn("Table idempotency_keys non disponible:", error);
  }

  return { isDuplicate: false };
}

export async function storeIdempotency(
  key: string,
  response: any
): Promise<void> {
  if (!key) return;

  // Stocker dans le cache mémoire
  idempotencyCache.set(key, {
    response,
    timestamp: Date.now(),
  });

  // Stocker dans la base de données
  try {
    const supabase = await createClient();
    const supabaseClient = getTypedSupabaseClient(supabase);
    await supabaseClient.from("idempotency_keys").insert({
      key,
      response: JSON.stringify(response),
      created_at: new Date().toISOString(),
    } as any);
  } catch (error) {
    // Si la table n'existe pas, continuer sans stockage DB
    console.warn("Table idempotency_keys non disponible:", error);
  }
}

export function getIdempotencyKey(request: Request): string | null {
  return request.headers.get("Idempotency-Key") || null;
}






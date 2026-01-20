import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

/**
 * API Middleware utilities for v1 routes
 */

// Error response helper
export function apiError(
  message: string,
  status: number = 400,
  code?: string
): NextResponse {
  return NextResponse.json(
    {
      error: message,
      code: code || "ERROR",
      timestamp: new Date().toISOString(),
    },
    { status }
  );
}

// Success response helper
export function apiSuccess<T>(data: T, status: number = 200): NextResponse {
  return NextResponse.json(data, { status });
}

// Auth check middleware
export async function requireAuth(
  request: NextRequest
): Promise<{ user: any; profile: any } | NextResponse> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return apiError("Unauthorized", 401, "UNAUTHORIZED");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, user_id, role")
    .eq("user_id", user.id)
    .single();

  if (profileError || !profile) {
    return apiError("Profile not found", 401, "PROFILE_NOT_FOUND");
  }

  return { user, profile };
}

// Role check middleware
export function requireRole(profile: any, allowedRoles: string[]): NextResponse | null {
  if (!allowedRoles.includes(profile.role)) {
    return apiError("Forbidden", 403, "FORBIDDEN");
  }
  return null;
}

// Zod validation helper
export function validateBody<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { data: T; error?: undefined } | { data?: undefined; error: NextResponse } {
  const result = schema.safeParse(data);
  if (!result.success) {
    return {
      error: apiError(
        result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", "),
        400,
        "VALIDATION_ERROR"
      ),
    };
  }
  return { data: result.data };
}

// Idempotency key helper
export async function checkIdempotency(
  supabase: any,
  key: string | null,
  resourceType: string
): Promise<{ cached: any } | null> {
  if (!key) return null;

  const { data } = await supabase
    .from("idempotency_keys")
    .select("response_body, response_status")
    .eq("key", key)
    .eq("resource_type", resourceType)
    .single();

  if (data) {
    return { cached: data };
  }
  return null;
}

export async function storeIdempotency(
  supabase: any,
  key: string,
  resourceType: string,
  responseBody: any,
  responseStatus: number
): Promise<void> {
  await supabase.from("idempotency_keys").insert({
    key,
    resource_type: resourceType,
    response_body: responseBody,
    response_status: responseStatus,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24h
  });
}

// Pagination helper
export function getPaginationParams(searchParams: URLSearchParams): {
  page: number;
  limit: number;
  offset: number;
} {
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

// Audit log helper
export async function logAudit(
  supabase: any,
  action: string,
  resource: string,
  resourceId: string | null,
  actorId: string,
  before?: any,
  after?: any
): Promise<void> {
  try {
    await supabase.from("audit_log").insert({
      actor_type: "user",
      actor_id: actorId,
      action,
      resource,
      resource_id: resourceId,
      before: before ? JSON.stringify(before) : null,
      after: after ? JSON.stringify(after) : null,
    });
  } catch (error) {
    console.error("[audit_log] Failed to log:", error);
  }
}

// CORS headers for API routes
// Domaines autorisés pour les requêtes cross-origin
const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_APP_URL,
  process.env.NEXT_PUBLIC_SITE_URL,
  "https://talok.fr",
  "https://www.talok.fr",
  "https://app.talok.fr",
  // Domaines de développement
  ...(process.env.NODE_ENV === "development"
    ? ["http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000"]
    : []),
].filter(Boolean) as string[];

/**
 * Génère les headers CORS sécurisés en fonction de l'origine de la requête
 * @param requestOrigin - L'origine de la requête (header Origin)
 * @returns Headers CORS avec origine spécifique ou rejet
 */
export function getCorsHeaders(requestOrigin?: string | null): Record<string, string> {
  // Vérifier si l'origine est autorisée
  const origin = requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin)
    ? requestOrigin
    : ALLOWED_ORIGINS[0] || "";

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Idempotency-Key, X-Requested-With",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400", // Cache preflight pour 24h
  };
}

/**
 * @deprecated Utiliser getCorsHeaders(request.headers.get("origin")) à la place
 * Conservé pour rétrocompatibilité - sera retiré dans la prochaine version majeure
 */
export const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGINS[0] || "https://talok.fr",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Idempotency-Key",
};

/**
 * SOTA 2026: Check API access feature for v1 routes
 * Requires Pro plan or higher for api_access
 */
export async function requireApiAccess(
  profile: { id: string; role: string }
): Promise<NextResponse | null> {
  // Admins always have API access
  if (profile.role === "admin") {
    return null;
  }

  // Only owners need feature check
  if (profile.role !== "owner") {
    return apiError(
      "L'accès API n'est disponible que pour les propriétaires",
      403,
      "API_ACCESS_ROLE_REQUIRED"
    );
  }

  const supabase = await createClient();

  // Get subscription
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("plan_slug")
    .eq("owner_id", profile.id)
    .single();

  const planSlug = subscription?.plan_slug || "gratuit";

  // Plans with api_access: pro, enterprise_s, enterprise_m, enterprise_l, enterprise_xl
  const plansWithApiAccess = ["pro", "enterprise_s", "enterprise_m", "enterprise_l", "enterprise_xl", "enterprise"];

  if (!plansWithApiAccess.includes(planSlug)) {
    return apiError(
      "L'accès API requiert le forfait Pro ou supérieur. Passez à Pro pour débloquer l'API.",
      403,
      "API_ACCESS_REQUIRED"
    );
  }

  return null;
}

/**
 * Rate limiting avec stockage en mémoire
 *
 * ⚠️  LIMITATION: Ce rate limiter utilise un Map en mémoire, ce qui signifie:
 * - Non partagé entre les instances serverless (chaque instance a son propre compteur)
 * - Reset à chaque redéploiement ou cold start
 * - Non adapté pour une protection efficace en production à grande échelle
 *
 * TODO: Migrer vers une solution persistante pour la production:
 * - Option 1: Upstash Redis (@upstash/ratelimit) - Recommandé pour Vercel
 *   ```
 *   import { Ratelimit } from "@upstash/ratelimit";
 *   import { Redis } from "@upstash/redis";
 *   const ratelimit = new Ratelimit({
 *     redis: Redis.fromEnv(),
 *     limiter: Ratelimit.slidingWindow(100, "1 m"),
 *   });
 *   ```
 * - Option 2: Vercel KV (si déjà utilisé)
 * - Option 3: Supabase avec table rate_limits et fonction RPC
 *
 * Variables d'environnement requises pour Upstash:
 * - UPSTASH_REDIS_REST_URL
 * - UPSTASH_REDIS_REST_TOKEN
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

// Nettoyage périodique de la map pour éviter les fuites mémoire (toutes les 5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupExpiredEntries(): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;

  lastCleanup = now;
  for (const [key, record] of rateLimitMap.entries()) {
    if (record.resetAt < now) {
      rateLimitMap.delete(key);
    }
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Vérifie si une requête est autorisée selon le rate limit
 * @param identifier - Identifiant unique (user_id, IP, API key, etc.)
 * @param maxRequests - Nombre maximum de requêtes par fenêtre (défaut: 100)
 * @param windowMs - Durée de la fenêtre en ms (défaut: 60000 = 1 minute)
 * @returns true si la requête est autorisée, false sinon
 */
export function checkRateLimit(
  identifier: string,
  maxRequests: number = 100,
  windowMs: number = 60000
): boolean {
  const result = checkRateLimitWithInfo(identifier, maxRequests, windowMs);
  return result.allowed;
}

/**
 * Version enrichie du rate limiter avec informations détaillées
 * Utile pour ajouter les headers X-RateLimit-* dans la réponse
 */
export function checkRateLimitWithInfo(
  identifier: string,
  maxRequests: number = 100,
  windowMs: number = 60000
): RateLimitResult {
  cleanupExpiredEntries();

  const now = Date.now();
  const record = rateLimitMap.get(identifier);

  if (!record || record.resetAt < now) {
    const resetAt = now + windowMs;
    rateLimitMap.set(identifier, { count: 1, resetAt });
    return { allowed: true, remaining: maxRequests - 1, resetAt };
  }

  if (record.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: record.resetAt };
  }

  record.count++;
  return {
    allowed: true,
    remaining: maxRequests - record.count,
    resetAt: record.resetAt,
  };
}


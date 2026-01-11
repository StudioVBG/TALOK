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
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
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

// Rate limit check (basic implementation)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  identifier: string,
  maxRequests: number = 100,
  windowMs: number = 60000
): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);

  if (!record || record.resetAt < now) {
    rateLimitMap.set(identifier, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (record.count >= maxRequests) {
    return false;
  }

  record.count++;
  return true;
}


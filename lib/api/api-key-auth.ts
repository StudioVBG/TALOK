/**
 * API Key Authentication Middleware
 *
 * Authenticates third-party API requests using Bearer tokens (tlk_live_xxx).
 * Keys are stored as SHA-256 hashes — never in plaintext.
 *
 * Usage:
 *   const auth = await authenticateAPIKey(request);
 *   if (auth instanceof Response) return auth;
 *   // auth.apiKey, auth.profileId, auth.scopes, auth.permissions
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiError } from "./middleware";
import { checkRateLimitWithInfo } from "./middleware";

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export interface APIKeyAuth {
  apiKey: {
    id: string;
    profile_id: string;
    entity_id: string | null;
    name: string;
    key_prefix: string;
    permissions: string[];
    scopes: string[];
    rate_limit_per_hour: number;
    is_active: boolean;
    expires_at: string | null;
  };
  profileId: string;
  scopes: string[];
  permissions: string[];
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

/**
 * SHA-256 hash using Web Crypto API (works in Edge runtime)
 */
async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Generate a new API key with prefix tlk_live_
 * Returns { raw, prefix, hash } — raw is shown once to the user
 */
export async function generateAPIKey(): Promise<{
  raw: string;
  prefix: string;
  hash: string;
}> {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  const hex = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const raw = `tlk_live_${hex}`;
  const prefix = raw.slice(0, 16); // 'tlk_live_xxxxxxx'
  const hash = await sha256(raw);

  return { raw, prefix, hash };
}

/**
 * Get the current hour bucket for rate limiting (YYYY-MM-DD-HH)
 */
function currentHourBucket(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}-${String(now.getUTCHours()).padStart(2, "0")}`;
}

// --------------------------------------------------------------------------
// Main auth function
// --------------------------------------------------------------------------

/**
 * Authenticate an API request via Bearer token.
 *
 * Returns the resolved APIKeyAuth on success, or a NextResponse error.
 */
export async function authenticateAPIKey(
  request: NextRequest
): Promise<APIKeyAuth | NextResponse> {
  const auth = request.headers.get("Authorization");

  if (!auth?.startsWith("Bearer tlk_")) {
    return apiError(
      "Missing or invalid Authorization header. Expected: Bearer tlk_live_xxx",
      401,
      "UNAUTHORIZED"
    );
  }

  const key = auth.replace("Bearer ", "");
  const prefix = key.slice(0, 16);
  const hash = await sha256(key);

  const supabase = await createClient();

  const { data: apiKey, error } = await supabase
    .from("api_keys")
    .select(
      "id, profile_id, entity_id, name, key_prefix, permissions, scopes, rate_limit_per_hour, is_active, expires_at"
    )
    .eq("key_prefix", prefix)
    .eq("key_hash", hash)
    .eq("is_active", true)
    .single();

  if (error || !apiKey) {
    return apiError("Invalid API key", 401, "INVALID_API_KEY");
  }

  // Check expiry
  if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
    return apiError("API key has expired", 401, "API_KEY_EXPIRED");
  }

  // Rate limiting (in-memory, per-hour bucket)
  const rateLimitResult = checkRateLimitWithInfo(
    `apikey:${apiKey.id}:${currentHourBucket()}`,
    apiKey.rate_limit_per_hour,
    3600 * 1000 // 1 hour window
  );

  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      {
        error: "Rate limit exceeded",
        code: "RATE_LIMITED",
        retry_after: Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000),
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(
            Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)
          ),
          "X-RateLimit-Limit": String(apiKey.rate_limit_per_hour),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(
            Math.ceil(rateLimitResult.resetAt / 1000)
          ),
        },
      }
    );
  }

  // Update last_used_at (fire-and-forget)
  supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", apiKey.id)
    .then(() => {});

  // Log API call (fire-and-forget)
  logAPICall(supabase, apiKey.id, request).catch(() => {});

  return {
    apiKey,
    profileId: apiKey.profile_id,
    scopes: apiKey.scopes || ["properties"],
    permissions: apiKey.permissions || ["read"],
  };
}

// --------------------------------------------------------------------------
// Scope & Permission checks
// --------------------------------------------------------------------------

/**
 * Check if the API key has the required scope
 */
export function requireScope(
  auth: APIKeyAuth,
  scope: string
): NextResponse | null {
  if (!auth.scopes.includes(scope)) {
    return apiError(
      `API key missing required scope: ${scope}`,
      403,
      "INSUFFICIENT_SCOPE"
    );
  }
  return null;
}

/**
 * Check if the API key has the required permission
 */
export function requirePermission(
  auth: APIKeyAuth,
  permission: "read" | "write" | "delete"
): NextResponse | null {
  if (!auth.permissions.includes(permission)) {
    return apiError(
      `API key missing required permission: ${permission}`,
      403,
      "INSUFFICIENT_PERMISSION"
    );
  }
  return null;
}

// --------------------------------------------------------------------------
// Logging
// --------------------------------------------------------------------------

async function logAPICall(
  supabase: any,
  apiKeyId: string,
  request: NextRequest
): Promise<void> {
  try {
    const url = new URL(request.url);
    await supabase.from("api_logs").insert({
      api_key_id: apiKeyId,
      method: request.method,
      path: url.pathname,
      status_code: 200, // Will be updated by response interceptor if needed
      ip_address:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request.headers.get("x-real-ip") ||
        null,
      user_agent: request.headers.get("user-agent") || null,
    });
  } catch (err) {
    console.error("[api-key-auth] Failed to log API call:", err);
  }
}

/**
 * Add rate limit headers to a response
 */
export function addRateLimitHeaders(
  response: NextResponse,
  auth: APIKeyAuth
): NextResponse {
  const rateLimitResult = checkRateLimitWithInfo(
    `apikey:${auth.apiKey.id}:${currentHourBucket()}`,
    auth.apiKey.rate_limit_per_hour,
    3600 * 1000
  );

  response.headers.set(
    "X-RateLimit-Limit",
    String(auth.apiKey.rate_limit_per_hour)
  );
  response.headers.set(
    "X-RateLimit-Remaining",
    String(rateLimitResult.remaining)
  );
  response.headers.set(
    "X-RateLimit-Reset",
    String(Math.ceil(rateLimitResult.resetAt / 1000))
  );

  return response;
}

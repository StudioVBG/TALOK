export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  apiError,
  apiSuccess,
  requireAuth,
  requireRole,
  requireApiAccess,
  validateBody,
  getPaginationParams,
} from "@/lib/api/middleware";
import { CreateThirdPartyApiKeySchema } from "@/lib/api/schemas";
import { generateAPIKey } from "@/lib/api/api-key-auth";

/**
 * GET /api/v1/api-keys
 * List API keys for the authenticated owner (session auth)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;

    const roleCheck = requireRole(auth.profile, ["owner", "admin"]);
    if (roleCheck) return roleCheck;

    const apiAccessCheck = await requireApiAccess(auth.profile);
    if (apiAccessCheck) return apiAccessCheck;

    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const { page, limit, offset } = getPaginationParams(searchParams);

    const { data, error, count } = await supabase
      .from("api_keys")
      .select(
        "id, name, key_prefix, permissions, scopes, rate_limit_per_hour, last_used_at, expires_at, is_active, created_at",
        { count: "exact" }
      )
      .eq("profile_id", auth.profile.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("[GET /v1/api-keys] Error:", error);
      return apiError("Erreur lors de la récupération", 500);
    }

    return apiSuccess({
      api_keys: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error: unknown) {
    console.error("[GET /v1/api-keys] Error:", error);
    return apiError("Erreur serveur", 500);
  }
}

/**
 * POST /api/v1/api-keys
 * Create a new API key — returns the raw key ONCE
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;

    const roleCheck = requireRole(auth.profile, ["owner", "admin"]);
    if (roleCheck) return roleCheck;

    const apiAccessCheck = await requireApiAccess(auth.profile);
    if (apiAccessCheck) return apiAccessCheck;

    const supabase = await createClient();

    // Check key limit based on plan
    const { count: existingCount } = await supabase
      .from("api_keys")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", auth.profile.id);

    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("plan_slug")
      .eq("owner_id", auth.profile.id)
      .single();

    const planSlug = subscription?.plan_slug || "pro";
    const maxKeys = planSlug.startsWith("enterprise") ? 10 : 3;

    if ((existingCount || 0) >= maxKeys) {
      return apiError(
        `Limite de clés API atteinte (${maxKeys}). Passez à Enterprise pour plus.`,
        403,
        "API_KEY_LIMIT_REACHED"
      );
    }

    const body = await request.json();
    const validated = validateBody(CreateThirdPartyApiKeySchema, body);
    if (validated.error) return validated.error;
    const input = validated.data as { name: string; permissions: string[]; scopes: string[]; expires_in_days?: number };

    // Generate key
    const { raw, prefix, hash } = await generateAPIKey();

    // Calculate expiry
    let expiresAt: string | null = null;
    if (input.expires_in_days) {
      expiresAt = new Date(
        Date.now() + input.expires_in_days * 24 * 60 * 60 * 1000
      ).toISOString();
    } else if (!planSlug.startsWith("enterprise")) {
      // Pro plan: max 1 year
      expiresAt = new Date(
        Date.now() + 365 * 24 * 60 * 60 * 1000
      ).toISOString();
    }

    const { data: apiKey, error } = await supabase
      .from("api_keys")
      .insert({
        profile_id: auth.profile.id,
        name: input.name,
        key_hash: hash,
        key_prefix: prefix,
        permissions: input.permissions,
        scopes: input.scopes,
        expires_at: expiresAt,
      })
      .select("id, name, key_prefix, permissions, scopes, rate_limit_per_hour, expires_at, is_active, created_at")
      .single();

    if (error) {
      console.error("[POST /v1/api-keys] Error:", error);
      return apiError("Erreur lors de la création", 500);
    }

    // Return raw key ONCE — it cannot be retrieved later
    return apiSuccess(
      {
        api_key: apiKey,
        raw_key: raw,
        warning:
          "Copiez cette clé maintenant. Elle ne sera plus jamais affichée.",
      },
      201
    );
  } catch (error: unknown) {
    console.error("[POST /v1/api-keys] Error:", error);
    return apiError("Erreur serveur", 500);
  }
}

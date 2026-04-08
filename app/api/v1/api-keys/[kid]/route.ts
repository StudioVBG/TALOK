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
} from "@/lib/api/middleware";
import { UpdateThirdPartyApiKeySchema } from "@/lib/api/schemas";

/**
 * GET /api/v1/api-keys/[kid]
 * Get API key details with usage stats
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ kid: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;

    const roleCheck = requireRole(auth.profile, ["owner", "admin"]);
    if (roleCheck) return roleCheck;

    const { kid } = await params;
    const supabase = await createClient();

    const { data: apiKey, error } = await supabase
      .from("api_keys")
      .select(
        "id, name, key_prefix, permissions, scopes, rate_limit_per_hour, last_used_at, expires_at, is_active, created_at, updated_at"
      )
      .eq("id", kid)
      .eq("profile_id", auth.profile.id)
      .single();

    if (error || !apiKey) {
      return apiError("Clé API non trouvée", 404, "NOT_FOUND");
    }

    // Get usage stats (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: logs } = await supabase
      .from("api_logs")
      .select("method, path, status_code, response_time_ms, created_at")
      .eq("api_key_id", kid)
      .gte("created_at", thirtyDaysAgo)
      .order("created_at", { ascending: false })
      .limit(100);

    // Aggregate stats
    const totalCalls = logs?.length || 0;
    const errorCalls = logs?.filter((l: any) => l.status_code >= 400).length || 0;
    const avgResponseTime =
      totalCalls > 0
        ? Math.round(
            (logs || []).reduce((sum: number, l: any) => sum + (l.response_time_ms || 0), 0) /
              totalCalls
          )
        : 0;

    // Group by day for chart
    const dailyUsage = new Map<string, number>();
    for (const log of logs || []) {
      const day = log.created_at?.split("T")[0] || "";
      dailyUsage.set(day, (dailyUsage.get(day) || 0) + 1);
    }

    return apiSuccess({
      api_key: apiKey,
      usage: {
        total_calls_30d: totalCalls,
        error_calls_30d: errorCalls,
        avg_response_time_ms: avgResponseTime,
        daily: Array.from(dailyUsage.entries())
          .map(([date, count]) => ({ date, count }))
          .sort((a, b) => a.date.localeCompare(b.date)),
      },
      recent_logs: (logs || []).slice(0, 20),
    });
  } catch (error: unknown) {
    console.error("[GET /v1/api-keys/:id] Error:", error);
    return apiError("Erreur serveur", 500);
  }
}

/**
 * PATCH /api/v1/api-keys/[kid]
 * Update an API key (name, permissions, scopes, active status)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ kid: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;

    const roleCheck = requireRole(auth.profile, ["owner", "admin"]);
    if (roleCheck) return roleCheck;

    const apiAccessCheck = await requireApiAccess(auth.profile);
    if (apiAccessCheck) return apiAccessCheck;

    const { kid } = await params;
    const supabase = await createClient();

    // Verify ownership
    const { data: existing } = await supabase
      .from("api_keys")
      .select("id")
      .eq("id", kid)
      .eq("profile_id", auth.profile.id)
      .single();

    if (!existing) {
      return apiError("Clé API non trouvée", 404, "NOT_FOUND");
    }

    const body = await request.json();
    const validated = validateBody(UpdateThirdPartyApiKeySchema, body);
    if (validated.error) return validated.error;
    const patchData = validated.data as { name?: string; permissions?: string[]; scopes?: string[]; is_active?: boolean };

    const updateData: Record<string, unknown> = {};
    if (patchData.name !== undefined) updateData.name = patchData.name;
    if (patchData.permissions !== undefined) updateData.permissions = patchData.permissions;
    if (patchData.scopes !== undefined) updateData.scopes = patchData.scopes;
    if (patchData.is_active !== undefined) updateData.is_active = patchData.is_active;

    const { data: apiKey, error } = await supabase
      .from("api_keys")
      .update(updateData)
      .eq("id", kid)
      .select(
        "id, name, key_prefix, permissions, scopes, rate_limit_per_hour, last_used_at, expires_at, is_active, created_at, updated_at"
      )
      .single();

    if (error) {
      console.error("[PATCH /v1/api-keys/:id] Error:", error);
      return apiError("Erreur lors de la mise à jour", 500);
    }

    return apiSuccess({ api_key: apiKey });
  } catch (error: unknown) {
    console.error("[PATCH /v1/api-keys/:id] Error:", error);
    return apiError("Erreur serveur", 500);
  }
}

/**
 * DELETE /api/v1/api-keys/[kid]
 * Revoke (delete) an API key
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ kid: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;

    const roleCheck = requireRole(auth.profile, ["owner", "admin"]);
    if (roleCheck) return roleCheck;

    const { kid } = await params;
    const supabase = await createClient();

    const { error } = await supabase
      .from("api_keys")
      .delete()
      .eq("id", kid)
      .eq("profile_id", auth.profile.id);

    if (error) {
      console.error("[DELETE /v1/api-keys/:id] Error:", error);
      return apiError("Erreur lors de la suppression", 500);
    }

    return apiSuccess({ deleted: true });
  } catch (error: unknown) {
    console.error("[DELETE /v1/api-keys/:id] Error:", error);
    return apiError("Erreur serveur", 500);
  }
}

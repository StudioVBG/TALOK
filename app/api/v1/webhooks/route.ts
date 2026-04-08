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
import { CreateWebhookSchema } from "@/lib/api/schemas";

/**
 * GET /api/v1/webhooks
 * List webhooks for the authenticated owner (session-based auth)
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
      .from("api_webhooks")
      .select("id, url, events, description, is_active, last_triggered_at, last_status_code, failure_count, created_at", { count: "exact" })
      .eq("profile_id", auth.profile.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("[GET /v1/webhooks] Error:", error);
      return apiError("Erreur lors de la récupération", 500);
    }

    return apiSuccess({
      webhooks: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error: unknown) {
    console.error("[GET /v1/webhooks] Error:", error);
    return apiError("Erreur serveur", 500);
  }
}

/**
 * POST /api/v1/webhooks
 * Create a new webhook endpoint
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

    // Check webhook limit based on plan
    const { count: existingCount } = await supabase
      .from("api_webhooks")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", auth.profile.id);

    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("plan_slug")
      .eq("owner_id", auth.profile.id)
      .single();

    const planSlug = subscription?.plan_slug || "pro";
    const maxWebhooks = planSlug.startsWith("enterprise") ? 20 : 5;

    if ((existingCount || 0) >= maxWebhooks) {
      return apiError(
        `Limite de webhooks atteinte (${maxWebhooks}). Passez à Enterprise pour plus.`,
        403,
        "WEBHOOK_LIMIT_REACHED"
      );
    }

    const body = await request.json();
    const validated = validateBody(CreateWebhookSchema, body);
    if (validated.error) return validated.error;
    const input = validated.data as { url: string; events: string[]; description?: string };

    // Generate HMAC secret
    const secretBytes = new Uint8Array(32);
    crypto.getRandomValues(secretBytes);
    const secret = `whsec_${Array.from(secretBytes).map(b => b.toString(16).padStart(2, "0")).join("")}`;

    const { data: webhook, error } = await supabase
      .from("api_webhooks")
      .insert({
        profile_id: auth.profile.id,
        url: input.url,
        events: input.events,
        description: input.description || null,
        secret,
      })
      .select("id, url, events, description, is_active, secret, created_at")
      .single();

    if (error) {
      console.error("[POST /v1/webhooks] Error:", error);
      return apiError("Erreur lors de la création", 500);
    }

    // Return secret only on creation (shown once)
    return apiSuccess({ webhook }, 201);
  } catch (error: unknown) {
    console.error("[POST /v1/webhooks] Error:", error);
    return apiError("Erreur serveur", 500);
  }
}

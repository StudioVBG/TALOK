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
import { UpdateWebhookSchema } from "@/lib/api/schemas";

/**
 * GET /api/v1/webhooks/[wid]
 * Get webhook details with recent deliveries
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ wid: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;

    const roleCheck = requireRole(auth.profile, ["owner", "admin"]);
    if (roleCheck) return roleCheck;

    const { wid } = await params;
    const supabase = await createClient();

    const { data: webhook, error } = await supabase
      .from("api_webhooks")
      .select("id, url, events, description, is_active, last_triggered_at, last_status_code, failure_count, created_at, updated_at")
      .eq("id", wid)
      .eq("profile_id", auth.profile.id)
      .single();

    if (error || !webhook) {
      return apiError("Webhook non trouvé", 404, "NOT_FOUND");
    }

    // Get recent deliveries
    const { data: deliveries } = await supabase
      .from("api_webhook_deliveries")
      .select("id, event_type, status_code, response_time_ms, attempt, error, delivered_at")
      .eq("webhook_id", wid)
      .order("delivered_at", { ascending: false })
      .limit(20);

    return apiSuccess({
      webhook,
      recent_deliveries: deliveries || [],
    });
  } catch (error: unknown) {
    console.error("[GET /v1/webhooks/:id] Error:", error);
    return apiError("Erreur serveur", 500);
  }
}

/**
 * PATCH /api/v1/webhooks/[wid]
 * Update a webhook
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ wid: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;

    const roleCheck = requireRole(auth.profile, ["owner", "admin"]);
    if (roleCheck) return roleCheck;

    const apiAccessCheck = await requireApiAccess(auth.profile);
    if (apiAccessCheck) return apiAccessCheck;

    const { wid } = await params;
    const supabase = await createClient();

    // Verify ownership
    const { data: existing } = await supabase
      .from("api_webhooks")
      .select("id")
      .eq("id", wid)
      .eq("profile_id", auth.profile.id)
      .single();

    if (!existing) {
      return apiError("Webhook non trouvé", 404, "NOT_FOUND");
    }

    const body = await request.json();
    const validated = validateBody(UpdateWebhookSchema, body);
    if (validated.error) return validated.error;
    const patchData = validated.data as { url?: string; events?: string[]; description?: string; is_active?: boolean };

    const updateData: Record<string, unknown> = {};
    if (patchData.url !== undefined) updateData.url = patchData.url;
    if (patchData.events !== undefined) updateData.events = patchData.events;
    if (patchData.description !== undefined) updateData.description = patchData.description;
    if (patchData.is_active !== undefined) {
      updateData.is_active = patchData.is_active;
      // Reset failure count when re-enabling
      if (patchData.is_active) updateData.failure_count = 0;
    }

    const { data: webhook, error } = await supabase
      .from("api_webhooks")
      .update(updateData)
      .eq("id", wid)
      .select("id, url, events, description, is_active, last_triggered_at, failure_count, created_at, updated_at")
      .single();

    if (error) {
      console.error("[PATCH /v1/webhooks/:id] Error:", error);
      return apiError("Erreur lors de la mise à jour", 500);
    }

    return apiSuccess({ webhook });
  } catch (error: unknown) {
    console.error("[PATCH /v1/webhooks/:id] Error:", error);
    return apiError("Erreur serveur", 500);
  }
}

/**
 * DELETE /api/v1/webhooks/[wid]
 * Delete a webhook
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ wid: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;

    const roleCheck = requireRole(auth.profile, ["owner", "admin"]);
    if (roleCheck) return roleCheck;

    const { wid } = await params;
    const supabase = await createClient();

    const { error } = await supabase
      .from("api_webhooks")
      .delete()
      .eq("id", wid)
      .eq("profile_id", auth.profile.id);

    if (error) {
      console.error("[DELETE /v1/webhooks/:id] Error:", error);
      return apiError("Erreur lors de la suppression", 500);
    }

    return apiSuccess({ deleted: true });
  } catch (error: unknown) {
    console.error("[DELETE /v1/webhooks/:id] Error:", error);
    return apiError("Erreur serveur", 500);
  }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { requireAdminPermissions, isAdminAuthError } from "@/lib/middleware/admin-rbac";
import { z } from "zod";
import { extractErrorMessage } from "@/lib/helpers/extract-error-message";

const moderationQueueSchema = z.object({
  entity_type: z.string().min(1),
  entity_id: z.string().uuid(),
  rule_id: z.string().uuid().optional(),
  ai_score: z.number().min(0).max(1).optional(),
  ai_reasoning: z.string().optional(),
  ai_suggested_action: z.string().optional(),
  flagged_content: z.any().optional(),
  matched_patterns: z.array(z.string()).optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
});

/**
 * GET /api/admin/moderation/queue - Liste les éléments en file d'attente de modération
 */
export async function GET(request: Request) {
  try {
    const auth = await requireAdminPermissions(request, ["admin.moderation.read"], {
      rateLimit: "adminStandard",
    });
    if (isAdminAuthError(auth)) return auth;

    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "pending";
    const priority = searchParams.get("priority");
    const entityType = searchParams.get("entity_type");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    let query = supabase
      .from("moderation_queue")
      .select("*, rule:moderation_rules(id, name, flow_type)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status !== "all") {
      query = query.eq("status", status);
    }

    if (priority) {
      query = query.eq("priority", priority);
    }

    if (entityType) {
      query = query.eq("entity_type", entityType);
    }

    const { data: items, error, count } = await query;

    if (error) {
      console.error("[GET /api/admin/moderation/queue] Error:", error);
      // Si la table n'existe pas encore, retourner un tableau vide
      return NextResponse.json({ items: [], total: 0 });
    }

    return NextResponse.json({
      items: items || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (error: unknown) {
    console.error("[GET /api/admin/moderation/queue] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Erreur serveur";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

/**
 * POST /api/admin/moderation/queue - Ajoute un élément à la file de modération
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAdminPermissions(request, ["admin.moderation.write"], {
      rateLimit: "adminStandard",
      auditAction: "Ajout élément modération",
    });
    if (isAdminAuthError(auth)) return auth;

    const user = auth.user;
    const supabase = await createClient();

    const body = await request.json();
    const parsed = moderationQueueSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const {
      entity_type,
      entity_id,
      rule_id,
      ai_score,
      ai_reasoning,
      ai_suggested_action,
      flagged_content,
      matched_patterns,
      priority,
    } = parsed.data;

    const { data: item, error } = await supabase
      .from("moderation_queue")
      .insert({
        entity_type,
        entity_id,
        rule_id,
        ai_score,
        ai_reasoning,
        ai_suggested_action,
        flagged_content,
        matched_patterns: matched_patterns || [],
        priority,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      console.error("[POST /api/admin/moderation/queue] Error:", error);
      return NextResponse.json({ error: extractErrorMessage(error) }, { status: 500 });
    }

    // Journaliser l'action
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "moderation_item_created",
      entity_type: "moderation_queue",
      entity_id: item.id,
      metadata: { entity_type, priority },
    } as Record<string, unknown>);

    return NextResponse.json({ item });
  } catch (error: unknown) {
    console.error("[POST /api/admin/moderation/queue] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Erreur serveur";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/admin/moderation/queue - Liste les éléments en file d'attente de modération
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

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
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const {
      entity_type,
      entity_id,
      rule_id,
      ai_score,
      ai_reasoning,
      ai_suggested_action,
      flagged_content,
      matched_patterns,
      priority = "medium",
    } = body;

    if (!entity_type || !entity_id) {
      return NextResponse.json(
        { error: "entity_type et entity_id sont requis" },
        { status: 400 }
      );
    }

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
      return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
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

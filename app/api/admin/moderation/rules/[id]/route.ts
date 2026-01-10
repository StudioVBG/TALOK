export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/moderation/rules/[id] - Récupère une règle
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
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

    const { data: rule, error } = await supabase
      .from("moderation_rules")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      return NextResponse.json({ error: "Règle non trouvée" }, { status: 404 });
    }

    return NextResponse.json({ rule });
  } catch (error: unknown) {
    console.error("[GET /api/admin/moderation/rules/[id]] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Erreur serveur";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/moderation/rules/[id] - Met à jour une règle
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
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
      name,
      description,
      flow_type,
      ai_enabled,
      ai_model,
      ai_threshold,
      rule_config,
      auto_action,
      is_active,
      priority,
      escalation_delay_hours,
      notify_admin,
    } = body;

    const updateData: Record<string, unknown> = {
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (flow_type !== undefined) updateData.flow_type = flow_type;
    if (ai_enabled !== undefined) updateData.ai_enabled = ai_enabled;
    if (ai_model !== undefined) updateData.ai_model = ai_model;
    if (ai_threshold !== undefined) updateData.ai_threshold = ai_threshold;
    if (rule_config !== undefined) updateData.rule_config = rule_config;
    if (auto_action !== undefined) updateData.auto_action = auto_action;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (priority !== undefined) updateData.priority = priority;
    if (escalation_delay_hours !== undefined) updateData.escalation_delay_hours = escalation_delay_hours;
    if (notify_admin !== undefined) updateData.notify_admin = notify_admin;

    const { data: rule, error } = await supabase
      .from("moderation_rules")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[PATCH /api/admin/moderation/rules/[id]] Error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Journaliser
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "moderation_rule_updated",
      entity_type: "moderation_rule",
      entity_id: id,
      metadata: updateData,
    } as Record<string, unknown>);

    return NextResponse.json({ rule });
  } catch (error: unknown) {
    console.error("[PATCH /api/admin/moderation/rules/[id]] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Erreur serveur";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/moderation/rules/[id] - Supprime une règle
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
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

    // Vérifier si la règle a des éléments en attente
    const { count } = await supabase
      .from("moderation_queue")
      .select("id", { count: "exact", head: true })
      .eq("rule_id", id)
      .eq("status", "pending");

    if (count && count > 0) {
      return NextResponse.json(
        { error: `Cette règle a ${count} élément(s) en attente de modération. Traitez-les d'abord.` },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("moderation_rules")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Journaliser
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "moderation_rule_deleted",
      entity_type: "moderation_rule",
      entity_id: id,
    } as Record<string, unknown>);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("[DELETE /api/admin/moderation/rules/[id]] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Erreur serveur";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

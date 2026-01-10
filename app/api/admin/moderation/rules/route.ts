export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/admin/moderation/rules - Lister les règles de modération IA
 */
export async function GET() {
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

    // Récupérer les règles depuis la table moderation_rules
    const { data: rules, error } = await supabase
      .from("moderation_rules")
      .select("*")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.log("[GET /api/admin/moderation/rules] Table non trouvée:", error.message);
      return NextResponse.json({ rules: [] });
    }

    return NextResponse.json({ rules: rules || [] });
  } catch (error: unknown) {
    console.error("[GET /api/admin/moderation/rules] Erreur:", error);
    const errorMessage = error instanceof Error ? error.message : "Erreur serveur";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

/**
 * POST /api/admin/moderation/rules - Créer une règle de modération IA
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
      return NextResponse.json(
        { error: "Seul l'admin peut créer des règles de modération" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      name,
      description,
      flow_type,
      ai_enabled = true,
      ai_model = "gpt-4-turbo",
      ai_threshold = 0.75,
      rule_config = {},
      auto_action = "flag",
      is_active = true,
      priority = 50,
      escalation_delay_hours = 24,
      notify_admin = true,
    } = body;

    if (!name || !flow_type) {
      return NextResponse.json(
        { error: "name et flow_type sont requis" },
        { status: 400 }
      );
    }

    // Créer la règle dans la base
    const { data: rule, error } = await supabase
      .from("moderation_rules")
      .insert({
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
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error("[POST /api/admin/moderation/rules] Insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Émettre un événement
    await supabase.from("outbox").insert({
      event_type: "Moderation.RuleCreated",
      payload: {
        rule_id: rule.id,
        name,
        flow_type,
        ai_enabled,
      },
    } as Record<string, unknown>);

    // Journaliser
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "moderation_rule_created",
      entity_type: "moderation_rule",
      entity_id: rule.id,
      metadata: { name, flow_type, ai_enabled, priority },
    } as Record<string, unknown>);

    return NextResponse.json({ rule });
  } catch (error: unknown) {
    console.error("[POST /api/admin/moderation/rules] Erreur:", error);
    const errorMessage = error instanceof Error ? error.message : "Erreur serveur";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}


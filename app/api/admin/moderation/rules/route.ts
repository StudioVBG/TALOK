// @ts-nocheck
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/admin/moderation/rules - Lister les règles de modération
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
      .eq("user_id", user.id as any)
      .single();

    const profileData = profile as any;
    if (profileData?.role !== "admin") {
      return NextResponse.json(
        { error: "Accès refusé" },
        { status: 403 }
      );
    }

    // Récupérer les règles depuis la table moderation_rules
    const { data: rules, error } = await supabase
      .from("moderation_rules")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      // Table n'existe pas encore, retourner un tableau vide
      console.log("[GET /api/admin/moderation/rules] Table non trouvée, retour tableau vide");
      return NextResponse.json({ rules: [] });
    }

    return NextResponse.json({ rules: rules || [] });
  } catch (error: any) {
    console.error("[GET /api/admin/moderation/rules] Erreur:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/moderation/rules - Créer une règle de modération
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
      .eq("user_id", user.id as any)
      .single();

    const profileData = profile as any;
    if (profileData?.role !== "admin") {
      return NextResponse.json(
        { error: "Seul l'admin peut créer des règles de modération" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { flow_type, rule_config, is_active = true } = body;

    if (!flow_type || !rule_config) {
      return NextResponse.json(
        { error: "flow_type et rule_config requis" },
        { status: 400 }
      );
    }

    // Créer la règle (à stocker dans une table dédiée ou dans api_providers)
    // Pour l'instant, on simule
    const rule = {
      id: crypto.randomUUID(),
      flow_type,
      rule_config,
      is_active,
      created_by: user.id,
      created_at: new Date().toISOString(),
    };

    // Émettre un événement
    await supabase.from("outbox").insert({
      event_type: "Moderation.Actioned",
      payload: {
        action: "rule_created",
        flow_type,
        rule_config,
      },
    } as any);

    // Journaliser
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "moderation_rule_created",
      entity_type: "moderation_rule",
      metadata: { flow_type, rule_config },
    } as any);

    return NextResponse.json({ rule });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}


export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/moderation/queue/[id] - Récupère un élément de la file
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

    const { data: item, error } = await supabase
      .from("moderation_queue")
      .select("*, rule:moderation_rules(*)")
      .eq("id", id)
      .single();

    if (error) {
      return NextResponse.json({ error: "Élément non trouvé" }, { status: 404 });
    }

    return NextResponse.json({ item });
  } catch (error: unknown) {
    console.error("[GET /api/admin/moderation/queue/[id]] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Erreur serveur";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/moderation/queue/[id] - Met à jour un élément (modération)
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
      status,
      action_taken,
      review_notes,
      assigned_to,
      priority,
    } = body;

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (status) {
      updateData.status = status;
      // Si statut = approved/rejected, marquer comme reviewed
      if (["approved", "rejected"].includes(status)) {
        updateData.reviewed_by = user.id;
        updateData.reviewed_at = new Date().toISOString();
      }
    }

    if (action_taken) updateData.action_taken = action_taken;
    if (review_notes) updateData.review_notes = review_notes;
    if (assigned_to !== undefined) updateData.assigned_to = assigned_to;
    if (priority) updateData.priority = priority;

    const { data: item, error } = await supabase
      .from("moderation_queue")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[PATCH /api/admin/moderation/queue/[id]] Error:", error);
      return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
    }

    // Journaliser l'action
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: `moderation_${action_taken || status}`,
      entity_type: "moderation_queue",
      entity_id: id,
      metadata: { status, action_taken },
    } as Record<string, unknown>);

    // Si la règle a été déclenchée, mettre à jour ses stats
    if (item.rule_id && ["approved", "rejected"].includes(status || "")) {
      const isFalsePositive = status === "approved"; // Approuvé = l'IA s'est trompée

      await supabase.rpc("update_moderation_rule_stats", {
        p_rule_id: item.rule_id,
        p_is_false_positive: isFalsePositive,
      });
    }

    return NextResponse.json({ item });
  } catch (error: unknown) {
    console.error("[PATCH /api/admin/moderation/queue/[id]] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Erreur serveur";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/moderation/queue/[id] - Supprime un élément de la file
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

    const { error } = await supabase
      .from("moderation_queue")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("[DELETE /api/admin/moderation/queue/[id]] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Erreur serveur";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

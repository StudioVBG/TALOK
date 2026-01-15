export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * DELETE /api/admin/api-keys/[id] - Supprimer ou désactiver une clé API
 */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
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
        { error: "Seul l'admin peut supprimer des clés API" },
        { status: 403 }
      );
    }

    // Désactiver plutôt que supprimer (soft delete)
    const { error } = await supabase
      .from("api_credentials")
      .update({ 
        is_active: false, 
        disabled_at: new Date().toISOString() 
      } as any)
      .eq("id", params.id as any);

    if (error) throw error;

    // Journaliser
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "api_key_deleted",
      entity_type: "api_credential",
      entity_id: params.id,
    } as any);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/api-keys/[id] - Modifier une clé API
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
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
        { error: "Seul l'admin peut modifier des clés API" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, is_active, permissions } = body;

    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (is_active !== undefined) {
      updates.is_active = is_active;
      if (is_active) {
        updates.disabled_at = null;
      } else {
        updates.disabled_at = new Date().toISOString();
      }
    }
    if (permissions !== undefined) updates.permissions = permissions;

    const { data: updated, error } = await supabase
      .from("api_credentials")
      .update(updates)
      .eq("id", params.id as any)
      .select()
      .single();

    if (error) throw error;

    // Journaliser
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "api_key_updated",
      entity_type: "api_credential",
      entity_id: params.id,
      metadata: updates,
    } as any);

    return NextResponse.json({ credential: updated });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}






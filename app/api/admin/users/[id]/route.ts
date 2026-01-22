export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * PATCH /api/admin/users/[id] - Modifier un utilisateur (suspension, etc.) (BTN-A05)
 *
 * @version 2026-01-22 - Fix: Next.js 15 params Promise pattern
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Vérifier que l'utilisateur est admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id as any)
      .single();

    const profileData = profile as any;
    if (profileData?.role !== "admin") {
      return NextResponse.json(
        { error: "Seul l'admin peut modifier un utilisateur" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { suspended, reason, role } = body;

    // Vérifier que l'utilisateur cible existe
    const { data: targetProfile } = await supabase
      .from("profiles")
      .select("id, user_id, role")
      .eq("user_id", id as any)
      .single();

    if (!targetProfile) {
      return NextResponse.json(
        { error: "Utilisateur non trouvé" },
        { status: 404 }
      );
    }

    // Ne pas permettre de suspendre un autre admin
    const targetProfileData = targetProfile as any;
    if (suspended && targetProfileData?.role === "admin") {
      return NextResponse.json(
        { error: "Impossible de suspendre un administrateur" },
        { status: 400 }
      );
    }

    // Mettre à jour le profil
    const updates: any = {};
    if (suspended !== undefined) {
      // Mettre à jour le statut dans auth.users via Supabase Admin API
      // Pour l'instant, on stocke dans une colonne custom ou on utilise un flag
      // Note: La suspension réelle nécessite l'Admin API de Supabase
      updates.suspended = suspended;
      updates.suspended_at = suspended ? new Date().toISOString() : null;
      updates.suspended_by = suspended ? user.id : null;
      updates.suspension_reason = suspended ? reason : null;
    }
    if (role && role !== targetProfileData?.role) {
      updates.role = role;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "Aucune modification à effectuer" },
        { status: 400 }
      );
    }

    const { data: updated, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("user_id", id as any)
      .select()
      .single();

    if (error) throw error;

    // Si suspension, désactiver l'utilisateur dans auth.users (nécessite Admin API)
    if (suspended) {
      // TODO: Utiliser Supabase Admin API pour suspendre l'utilisateur
      // const { data: adminClient } = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      // await adminClient.auth.admin.updateUserById(id, { ban_duration: '876000h' });
    }

    // Émettre un événement
    await supabase.from("outbox").insert({
      event_type: suspended ? "User.Suspended" : "User.Updated",
      payload: {
        user_id: id,
        suspended,
        reason,
        updated_by: user.id,
      },
    } as any);

    // Journaliser
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: suspended ? "user_suspended" : "user_updated",
      entity_type: "user",
      entity_id: id,
      metadata: { suspended, reason, role },
    } as any);

    return NextResponse.json({ user: updated });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/users/[id] - Récupérer un utilisateur
 *
 * @version 2026-01-22 - Fix: Next.js 15 params Promise pattern
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Vérifier que l'utilisateur est admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id as any)
      .single();

    const profileData = profile as any;
    if (profileData?.role !== "admin") {
      return NextResponse.json(
        { error: "Seul l'admin peut consulter un utilisateur" },
        { status: 403 }
      );
    }

    // Récupérer le profil
    const { data: targetProfile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", id as any)
      .single();

    if (error) throw error;

    return NextResponse.json({ user: targetProfile });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}


export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";

/**
 * DELETE /api/agency/team/[id]
 *
 * Révoque un membre de l'équipe agence (soft-delete via is_active=false).
 * - Désactive l'enregistrement agency_managers (n'efface pas le profil utilisateur)
 * - Insère une ligne d'audit
 *
 * Si l'ID correspond à une invitation pending, elle est supprimée à la place.
 */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (
      !profile ||
      (profile.role !== "agency" &&
        profile.role !== "admin" &&
        profile.role !== "platform_admin")
    ) {
      return NextResponse.json({ error: "Réservé aux agences" }, { status: 403 });
    }

    const serviceClient = getServiceClient();

    // 1. L'ID correspond-il à un membre confirmé ?
    const { data: manager } = await serviceClient
      .from("agency_managers")
      .select("id, agency_profile_id, user_profile_id, is_active")
      .eq("id", id)
      .maybeSingle();

    if (manager) {
      if (manager.agency_profile_id !== profile.id && profile.role !== "platform_admin") {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }

      // Soft-delete pour conserver l'historique
      const { error: updateError } = await serviceClient
        .from("agency_managers")
        .update({ is_active: false })
        .eq("id", id);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      await serviceClient.from("audit_log").insert({
        actor_user_id: user.id,
        actor_profile_id: profile.id,
        action: "agency.team.member_revoked",
        entity_type: "agency_managers",
        entity_id: id,
        risk_level: "medium",
        metadata: { user_profile_id: manager.user_profile_id },
      });

      return NextResponse.json({ success: true, kind: "member_revoked" });
    }

    // 2. Sinon, est-ce une invitation pending ?
    const { data: invitation } = await serviceClient
      .from("agency_invitations")
      .select("id, agency_profile_id, status, email")
      .eq("id", id)
      .maybeSingle();

    if (invitation) {
      if (invitation.agency_profile_id !== profile.id && profile.role !== "platform_admin") {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }

      const { error: deleteError } = await serviceClient
        .from("agency_invitations")
        .delete()
        .eq("id", id);

      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
      }

      await serviceClient.from("audit_log").insert({
        actor_user_id: user.id,
        actor_profile_id: profile.id,
        action: "agency.team.invitation_canceled",
        entity_type: "agency_invitations",
        entity_id: id,
        risk_level: "low",
        metadata: { email: invitation.email },
      });

      return NextResponse.json({ success: true, kind: "invitation_canceled" });
    }

    return NextResponse.json({ error: "Membre ou invitation introuvable" }, { status: 404 });
  } catch (error) {
    console.error("[agency.team.DELETE] unexpected:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 },
    );
  }
}

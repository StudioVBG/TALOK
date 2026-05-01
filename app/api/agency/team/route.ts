export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";

/**
 * GET /api/agency/team
 *
 * Liste des membres de l'équipe agence (gestionnaires, assistants, comptables).
 * Lit la table agency_managers + jointure profiles pour les infos utilisateur.
 */
export async function GET() {
  try {
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

    // 1. Membres confirmés (agency_managers) avec leurs profils
    const { data: managers, error: managersError } = await serviceClient
      .from("agency_managers")
      .select(
        `
        id,
        role_agence,
        properties_assigned,
        can_sign_documents,
        is_active,
        created_at,
        user_profile:profiles!agency_managers_user_profile_id_fkey(
          id, prenom, nom, email, telephone, avatar_url
        )
      `,
      )
      .eq("agency_profile_id", profile.id)
      .order("created_at", { ascending: false });

    if (managersError) {
      console.error("[agency.team.GET] managers error:", managersError);
      return NextResponse.json({ error: managersError.message }, { status: 500 });
    }

    // 2. Invitations en attente
    const { data: pendingInvitations } = await serviceClient
      .from("agency_invitations")
      .select(
        "id, email, prenom, nom, telephone, role_agence, can_sign_documents, status, created_at, expires_at",
      )
      .eq("agency_profile_id", profile.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    const members = (managers ?? []).map((m: any) => ({
      id: m.id,
      kind: "member" as const,
      name: `${m.user_profile?.prenom ?? ""} ${m.user_profile?.nom ?? ""}`.trim() || "Sans nom",
      email: m.user_profile?.email ?? "",
      phone: m.user_profile?.telephone ?? "",
      avatar_url: m.user_profile?.avatar_url ?? null,
      role: m.role_agence,
      propertiesCount: Array.isArray(m.properties_assigned)
        ? m.properties_assigned.length
        : 0,
      status: m.is_active ? "active" : "inactive",
      can_sign_documents: m.can_sign_documents,
      since: m.created_at,
    }));

    const invitations = (pendingInvitations ?? []).map((inv: any) => ({
      id: inv.id,
      kind: "invitation" as const,
      name: `${inv.prenom ?? ""} ${inv.nom ?? ""}`.trim() || inv.email,
      email: inv.email,
      phone: inv.telephone ?? "",
      role: inv.role_agence,
      status: "pending",
      can_sign_documents: inv.can_sign_documents,
      since: inv.created_at,
      expires_at: inv.expires_at,
    }));

    return NextResponse.json({ members, invitations });
  } catch (error) {
    console.error("[agency.team.GET] unexpected:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 },
    );
  }
}

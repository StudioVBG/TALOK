/**
 * @version 2026-01-22 - Fix: Next.js 15 params Promise pattern
 */
export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getTypedSupabaseClient } from "@/lib/helpers/supabase-client";

/**
 * PATCH /api/units/[id]/members/[mid] - Changer le rôle d'un membre de la colocation
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; mid: string }> }
) {
  const { id, mid } = await params;
  try {
    const supabase = await createClient();
    const supabaseClient = getTypedSupabaseClient(supabase);
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const { role } = body;

    if (!role || !["principal", "tenant", "occupant", "garant"].includes(role)) {
      return NextResponse.json(
        { error: "Rôle invalide" },
        { status: 400 }
      );
    }

    // Récupérer le membre
    const { data: member } = await supabaseClient
      .from("roommates")
      .select(`
        *,
        lease:leases!inner(
          id,
          property:properties!inner(owner_id)
        )
      `)
      .eq("id", mid as any)
      .eq("lease_id", (await supabaseClient.from("units").select("property_id").eq("id", id as any).single()).data?.property_id)
      .single();

    if (!member) {
      return NextResponse.json(
        { error: "Membre non trouvé" },
        { status: 404 }
      );
    }

    // Vérifier que l'utilisateur est propriétaire
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("id")
      .eq("user_id", user.id as any)
      .single();

    const memberData = member as any;
    const profileData = profile as any;
    if (memberData.lease?.property?.owner_id !== profileData?.id) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    // Vérifier les contraintes (max 2 principaux)
    if (role === "principal") {
      const { data: principals } = await supabaseClient
        .from("roommates")
        .select("id")
        .eq("lease_id", memberData.lease_id)
        .eq("role", "principal" as any)
        .neq("id", mid)
        .is("left_on", null);

      if (principals && principals.length >= 2) {
        return NextResponse.json(
          { error: "Maximum 2 colocataires principaux autorisés" },
          { status: 400 }
        );
      }
    }

    // Mettre à jour le rôle
    const { data: updated, error } = await supabaseClient
      .from("roommates")
      .update({ role } as any)
      .eq("id", mid as any)
      .select()
      .single();

    if (error) throw error;

    // Émettre un événement
    await supabaseClient.from("outbox").insert({
      event_type: "Cohousing.RoleUpdated",
      payload: {
        roommate_id: mid,
        lease_id: memberData.lease_id,
        old_role: memberData.role,
        new_role: role,
      },
    } as any);

    // Journaliser
    await supabaseClient.from("audit_log").insert({
      user_id: user.id,
      action: "role_updated",
      entity_type: "roommate",
      entity_id: mid,
      before_state: { role: memberData.role },
      after_state: { role },
    } as any);

    return NextResponse.json({ member: updated });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}






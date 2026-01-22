export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * DELETE /api/properties/[id]/invitations/[iid] - Révoquer un code d'invitation
 * @version 2026-01-22 - Fix: Next.js 15 params Promise pattern
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; iid: string }> }
) {
  try {
    const { id, iid } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Vérifier que l'utilisateur est propriétaire
    const { data: property } = await supabase
      .from("properties")
      .select("id, owner_id")
      .eq("id", id as any)
      .single();

    if (!property) {
      return NextResponse.json(
        { error: "Logement non trouvé" },
        { status: 404 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id as any)
      .single();

    const propertyData = property as any;
    const profileData = profile as any;
    if (propertyData.owner_id !== profileData?.id) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    // Récupérer le code
    const { data: accessCode } = await supabase
      .from("unit_access_codes")
      .select("*")
      .eq("id", iid as any)
      .eq("property_id", id as any)
      .single();

    if (!accessCode) {
      return NextResponse.json(
        { error: "Code d'invitation non trouvé" },
        { status: 404 }
      );
    }

    const accessCodeData = accessCode as any;

    // Marquer comme révoqué (ne pas supprimer, code brûlé à vie)
    const { data: updated, error } = await supabase
      .from("unit_access_codes")
      .update({
        status: "revoked",
        retired_at: new Date().toISOString(),
        retired_reason: "Révoqué par le propriétaire",
      } as any)
      .eq("id", iid as any)
      .select()
      .single();

    if (error) throw error;

    // Émettre un événement
    await supabase.from("outbox").insert({
      event_type: "Property.InvitationRevoked",
      payload: {
        access_code_id: iid,
        property_id: id,
        code: accessCodeData.code,
      },
    } as any);

    // Journaliser
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "invitation_revoked",
      entity_type: "property",
      entity_id: id,
      metadata: { code_id: iid, code: accessCodeData.code },
    } as any);

    return NextResponse.json({ success: true, access_code: updated });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}






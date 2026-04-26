export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
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

    // Service-role + check explicite owner/admin
    // (cf. docs/audits/rls-cascade-audit.md)
    const serviceClient = getServiceClient();

    const { data: property } = await serviceClient
      .from("properties")
      .select("id, owner_id")
      .eq("id", id)
      .maybeSingle();

    if (!property) {
      return NextResponse.json(
        { error: "Logement non trouvé" },
        { status: 404 }
      );
    }

    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .maybeSingle();

    const propertyData = property as { owner_id?: string };
    const profileData = profile as { id: string; role: string } | null;
    const isAdmin = profileData?.role === "admin";
    const isOwner = propertyData.owner_id === profileData?.id;
    if (!isAdmin && !isOwner) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    const { data: accessCode } = await serviceClient
      .from("unit_access_codes")
      .select("*")
      .eq("id", iid)
      .eq("property_id", id)
      .maybeSingle();

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






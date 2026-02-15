export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";

/**
 * POST /api/inspections/[iid]/close - Clôturer un EDL
 * @version 2026-02-03 - Fix: use service client, handle EDLs without property_id
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ iid: string }> }
) {
  let iid = "unknown";

  try {
    const resolvedParams = await params;
    iid = resolvedParams.iid;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const serviceClient = getServiceClient();

    // Récupérer l'EDL sans !inner join (property_id peut être null pour les anciens EDL)
    const { data: edl, error: edlError } = await serviceClient
      .from("edl")
      .select(`
        id,
        status,
        property_id,
        lease_id,
        lease:leases(
          property_id,
          property:properties(owner_id)
        )
      `)
      .eq("id", iid)
      .single();

    if (edlError || !edl) {
      console.error(`[Close] EDL ${iid} error:`, edlError);
      return NextResponse.json(
        { error: "EDL non trouvé" },
        { status: 404 }
      );
    }

    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    const profileData = profile as any;
    const edlData = edl as any;
    const isAdmin = profileData?.role === "admin";

    // Résoudre le property owner_id via property_id direct ou via lease
    let ownerProfileId: string | null = null;
    const propId = edlData.property_id || edlData.lease?.property_id;
    if (propId) {
      const { data: property } = await serviceClient
        .from("properties")
        .select("owner_id")
        .eq("id", propId)
        .single();
      ownerProfileId = property?.owner_id || null;
    } else if (edlData.lease?.property?.owner_id) {
      ownerProfileId = edlData.lease.property.owner_id;
    }

    if (!isAdmin && ownerProfileId !== profileData?.id) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    if (edlData.status === "closed") {
      return NextResponse.json(
        { error: "L'EDL est déjà clôturé" },
        { status: 400 }
      );
    }

    // Vérifier que toutes les signatures sont présentes
    const { data: signatures } = await serviceClient
      .from("edl_signatures")
      .select("id")
      .eq("edl_id", iid);

    if (!signatures || signatures.length === 0) {
      return NextResponse.json(
        { error: "L'EDL doit être signé avant clôture" },
        { status: 400 }
      );
    }

    // Clôturer l'EDL
    const { data: updated, error } = await serviceClient
      .from("edl")
      .update({
        status: "closed",
        closed_at: new Date().toISOString(),
      } as any)
      .eq("id", iid)
      .select()
      .single();

    if (error) throw error;

    // Émettre un événement (non-blocking)
    try {
      await serviceClient.from("outbox").insert({
        event_type: "Inspection.Closed",
        payload: {
          edl_id: iid,
          closed_at: (updated as any)?.closed_at,
        },
      } as any);
    } catch (e) {
      console.error(`[Close ${iid}] Outbox error:`, e);
    }

    // Journaliser (non-blocking)
    try {
      await serviceClient.from("audit_log").insert({
        user_id: user.id,
        action: "edl_closed",
        entity_type: "edl",
        entity_id: iid,
      } as any);
    } catch (e) {
      console.error(`[Close ${iid}] Audit log error:`, e);
    }

    return NextResponse.json({ edl: updated });
  } catch (error: unknown) {
    console.error(`[POST /api/inspections/${iid}/close] Error:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}


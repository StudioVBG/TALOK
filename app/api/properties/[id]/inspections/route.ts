export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";
import { createEDL } from "@/lib/services/edl-creation.service";

/**
 * POST /api/properties/[id]/inspections - Schedule an EDL for a specific property
 *
 * This route resolves the lease from the request body or finds one for the property,
 * then delegates to the shared createEDL service.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: propertyId } = await params;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const serviceClient = getServiceClient();

    const body = await request.json();
    const { type, scheduled_at, lease_id, notes, general_notes, keys } = body;

    if (!type || !["entree", "sortie"].includes(type)) {
      return NextResponse.json(
        { error: "Type requis: 'entree' ou 'sortie'" },
        { status: 400 }
      );
    }

    if (!scheduled_at) {
      return NextResponse.json(
        { error: "Date de planification requise" },
        { status: 400 }
      );
    }

    // Resolve lease_id: either provided or find active lease for the property
    let resolvedLeaseId = lease_id;
    if (!resolvedLeaseId) {
      const { data: activeLease } = await serviceClient
        .from("leases")
        .select("id")
        .eq("property_id", propertyId)
        .in("statut", ["active", "fully_signed"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!activeLease) {
        return NextResponse.json(
          { error: "Aucun bail actif trouvé pour ce logement" },
          { status: 404 }
        );
      }
      resolvedLeaseId = activeLease.id;
    }

    // Resolve profile
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const result = await createEDL(serviceClient, {
      userId: user.id,
      profileId: (profile as Record<string, unknown>).id as string,
      profileRole: (profile as Record<string, unknown>).role as string,
      leaseId: resolvedLeaseId,
      propertyId,
      type,
      scheduledAt: scheduled_at,
      generalNotes: general_notes || notes || null,
      keys,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status || 500 }
      );
    }

    return NextResponse.json({ edl: result.edl });
  } catch (error: unknown) {
    console.error("[POST /api/properties/inspections] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

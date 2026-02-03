export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";

/**
 * POST /api/properties/[id]/inspections - Planifier un EDL
 * @version 2026-02-03 - Fix: use service client for EDL creation + signatures + outbox + audit_log
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let propertyId = "unknown";

  try {
    const { id } = await params;
    propertyId = id;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

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

    // Vérifier que l'utilisateur est propriétaire (via service client pour éviter récursion RLS)
    const { data: property } = await serviceClient
      .from("properties")
      .select("id, owner_id")
      .eq("id", id)
      .single();

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
      .single();

    const propertyData = property as any;
    const profileData = profile as any;
    const isAdmin = profileData?.role === "admin";

    if (!isAdmin && propertyData.owner_id !== profileData?.id) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    // Éviter les doublons d'EDL en brouillon/planifiés pour le même bail et même type
    if (lease_id) {
      const { data: existingEdl } = await serviceClient
        .from("edl")
        .select("*")
        .eq("lease_id", lease_id)
        .eq("type", type)
        .in("status", ["draft", "scheduled"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingEdl) {
        console.log(`[api/inspections] EDL existant trouvé pour bail ${lease_id}, réutilisation:`, existingEdl.id);
        return NextResponse.json({ edl: existingEdl });
      }
    }

    // Créer l'EDL via service client (bypass RLS)
    const scheduledDate = scheduled_at ? new Date(scheduled_at).toISOString().split("T")[0] : null;
    const { data: edl, error } = await serviceClient
      .from("edl")
      .insert({
        property_id: id,
        lease_id: lease_id || null,
        type,
        scheduled_at: scheduled_at,
        scheduled_date: scheduledDate,
        status: "scheduled",
        general_notes: general_notes || notes || null,
        keys: keys || [],
        created_by: user.id,
      } as any)
      .select()
      .single();

    if (error) {
      console.error(`[POST /api/properties/${propertyId}/inspections] DB Error:`, error);
      return NextResponse.json(
        { error: error.message || "Erreur lors de la création de l'EDL" },
        { status: 500 }
      );
    }

    const edlData = edl as any;

    // Injecter automatiquement les signataires du bail dans l'EDL
    if (lease_id) {
      try {
        const { data: leaseSigners } = await serviceClient
          .from("lease_signers")
          .select("profile_id, role")
          .eq("lease_id", lease_id);

        if (leaseSigners && leaseSigners.length > 0) {
          const edlSignatures = leaseSigners.map((ls: any) => ({
            edl_id: edlData.id,
            signer_user: null,
            signer_profile_id: ls.profile_id,
            signer_role: (ls.role === "proprietaire" || ls.role === "owner") ? "owner" : "tenant",
            invitation_token: crypto.randomUUID(),
          }));

          await serviceClient.from("edl_signatures").insert(edlSignatures as any);
          console.log(`[api/inspections] ${edlSignatures.length} signataires injectés depuis le bail`);
        }
      } catch (sigError) {
        // Non-blocking: log but don't fail EDL creation
        console.error(`[api/inspections] Erreur injection signataires:`, sigError);
      }
    }

    // Émettre un événement (non-blocking)
    await serviceClient.from("outbox").insert({
      event_type: "Inspection.Scheduled",
      payload: {
        edl_id: edlData.id,
        property_id: id,
        lease_id,
        type,
        scheduled_at,
      },
    } as any).catch((e: any) => console.error("[api/inspections] Outbox error:", e));

    // Journaliser (non-blocking)
    await serviceClient.from("audit_log").insert({
      user_id: user.id,
      action: "edl_scheduled",
      entity_type: "edl",
      entity_id: edlData.id,
      metadata: { type, scheduled_at },
    } as any).catch((e: any) => console.error("[api/inspections] Audit log error:", e));

    return NextResponse.json({ edl: edlData });
  } catch (error: unknown) {
    console.error(`[POST /api/properties/${propertyId}/inspections] Error:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}






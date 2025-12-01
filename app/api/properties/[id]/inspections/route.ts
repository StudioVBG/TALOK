// @ts-nocheck
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST /api/properties/[id]/inspections - Planifier un EDL
 */
export async function POST(
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

    const body = await request.json();
    const { type, scheduled_at, lease_id, notes } = body;

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

    // Vérifier que l'utilisateur est propriétaire
    const { data: property } = await supabase
      .from("properties")
      .select("id, owner_id")
      .eq("id", params.id as any)
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

    // Créer l'EDL
    const { data: edl, error } = await supabase
      .from("edl")
      .insert({
        property_id: params.id,
        lease_id: lease_id || null,
        type,
        scheduled_at,
        status: "scheduled",
        notes,
      } as any)
      .select()
      .single();

    if (error) throw error;

    const edlData = edl as any;

    // Émettre un événement
    await supabase.from("outbox").insert({
      event_type: "Inspection.Scheduled",
      payload: {
        edl_id: edlData.id,
        property_id: params.id as any,
        lease_id,
        type,
        scheduled_at,
      },
    } as any);

    // Journaliser
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "edl_scheduled",
      entity_type: "edl",
      entity_id: edlData.id,
      metadata: { type, scheduled_at },
    } as any);

    return NextResponse.json({ edl: edlData });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}






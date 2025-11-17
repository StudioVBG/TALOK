import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST /api/properties/[id]/meters - Associer un compteur à un logement
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
    const { type, reference, provider, is_connected = false, lease_id } = body;

    if (!type || !["electricite", "gaz", "eau"].includes(type)) {
      return NextResponse.json(
        { error: "Type requis: 'electricite', 'gaz' ou 'eau'" },
        { status: 400 }
      );
    }

    if (!reference) {
      return NextResponse.json(
        { error: "Référence du compteur requise" },
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

    // Créer le compteur
    const { data: meter, error } = await supabase
      .from("meters")
      .insert({
        property_id: params.id,
        lease_id: lease_id || null,
        type,
        reference,
        provider: provider || null,
        is_connected,
      } as any)
      .select()
      .single();

    if (error) throw error;

    const meterData = meter as any;

    // Journaliser
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "meter_added",
      entity_type: "meter",
      entity_id: meterData.id,
      metadata: { type, reference, is_connected },
    } as any);

    return NextResponse.json({ meter });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}






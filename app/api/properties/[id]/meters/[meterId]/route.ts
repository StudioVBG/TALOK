export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/properties/[id]/meters/[meterId] - Détails d'un compteur
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string; meterId: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { id: propertyId, meterId } = params;

    // Récupérer le compteur
    const { data: meter, error } = await supabase
      .from("meters")
      .select("*")
      .eq("id", meterId)
      .eq("property_id", propertyId)
      .single();

    if (error || !meter) {
      return NextResponse.json({ error: "Compteur non trouvé" }, { status: 404 });
    }

    // Récupérer les 10 derniers relevés
    const { data: readings } = await supabase
      .from("meter_readings")
      .select("*")
      .eq("meter_id", meterId)
      .order("reading_date", { ascending: false })
      .limit(10);

    return NextResponse.json({
      meter,
      readings: readings || [],
    });
  } catch (error: any) {
    console.error("[GET /api/properties/[id]/meters/[meterId]] Error:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/properties/[id]/meters/[meterId] - Modifier un compteur
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string; meterId: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { id: propertyId, meterId } = params;
    const body = await request.json();

    // Vérifier que l'utilisateur est propriétaire
    const { data: property } = await supabase
      .from("properties")
      .select("id, owner_id")
      .eq("id", propertyId)
      .single();

    if (!property) {
      return NextResponse.json({ error: "Logement non trouvé" }, { status: 404 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    const propertyData = property as any;
    const profileData = profile as any;

    if (propertyData.owner_id !== profileData?.id && profileData?.role !== "admin") {
      return NextResponse.json(
        { error: "Seul le propriétaire peut modifier les compteurs" },
        { status: 403 }
      );
    }

    // Vérifier que le compteur existe
    const { data: existingMeter } = await supabase
      .from("meters")
      .select("id")
      .eq("id", meterId)
      .eq("property_id", propertyId)
      .single();

    if (!existingMeter) {
      return NextResponse.json({ error: "Compteur non trouvé" }, { status: 404 });
    }

    // Préparer les champs à mettre à jour
    const allowedFields = ["serial_number", "location", "provider", "unit", "is_active", "is_connected"];
    const updates: Record<string, any> = {};

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
        // ✅ Sync meter_number if serial_number is updated
        if (field === 'serial_number') {
          updates['meter_number'] = body[field];
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "Aucun champ à mettre à jour" },
        { status: 400 }
      );
    }

    updates.updated_at = new Date().toISOString();

    // Mettre à jour le compteur
    const { data: meter, error } = await supabase
      .from("meters")
      .update(updates)
      .eq("id", meterId)
      .select()
      .single();

    if (error) throw error;

    // Journaliser
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "meter_updated",
      entity_type: "meter",
      entity_id: meterId,
      metadata: { updates, property_id: propertyId },
    });

    return NextResponse.json({ meter });
  } catch (error: any) {
    console.error("[PATCH /api/properties/[id]/meters/[meterId]] Error:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/properties/[id]/meters/[meterId] - Supprimer un compteur
 */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string; meterId: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { id: propertyId, meterId } = params;

    // Vérifier que l'utilisateur est propriétaire
    const { data: property } = await supabase
      .from("properties")
      .select("id, owner_id")
      .eq("id", propertyId)
      .single();

    if (!property) {
      return NextResponse.json({ error: "Logement non trouvé" }, { status: 404 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    const propertyData = property as any;
    const profileData = profile as any;

    if (propertyData.owner_id !== profileData?.id && profileData?.role !== "admin") {
      return NextResponse.json(
        { error: "Seul le propriétaire peut supprimer les compteurs" },
        { status: 403 }
      );
    }

    // Vérifier que le compteur existe et appartient au logement
    const { data: meter } = await supabase
      .from("meters")
      .select("id, type, serial_number")
      .eq("id", meterId)
      .eq("property_id", propertyId)
      .single();

    if (!meter) {
      return NextResponse.json({ error: "Compteur non trouvé" }, { status: 404 });
    }

    // Supprimer le compteur (les relevés seront conservés grâce à ON DELETE SET NULL si configuré)
    const { error } = await supabase
      .from("meters")
      .delete()
      .eq("id", meterId);

    if (error) throw error;

    // Journaliser
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "meter_deleted",
      entity_type: "meter",
      entity_id: meterId,
      metadata: { 
        type: (meter as any).type, 
        serial_number: (meter as any).serial_number,
        property_id: propertyId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[DELETE /api/properties/[id]/meters/[meterId]] Error:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}


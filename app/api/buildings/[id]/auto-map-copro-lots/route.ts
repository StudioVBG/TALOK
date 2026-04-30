export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/buildings/[id]/auto-map-copro-lots
 *
 * Tente de relier automatiquement les building_units du building aux
 * copro_lots de la copropriété liée (via building.site_id), en se basant
 * sur le lot_number ou la position (étage + position).
 *
 * Accessible à l'owner du building OU au syndic du site lié.
 * Ne touche que les unités sans mapping existant.
 */

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { getServiceClient } from "@/lib/supabase/service-client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id: buildingId } = await params;
    const { user, error: authError } = await getAuthenticatedUser(request);
    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const serviceClient = getServiceClient();

    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!profile) {
      return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });
    }
    const profileId = (profile as { id: string }).id;

    const { data: building } = await serviceClient
      .from("buildings")
      .select("id, owner_id, site_id, site_link_status")
      .eq("id", buildingId)
      .maybeSingle();
    if (!building) {
      return NextResponse.json({ error: "Immeuble introuvable" }, { status: 404 });
    }
    const b = building as { owner_id: string; site_id: string | null; site_link_status: string };

    if (!b.site_id || b.site_link_status !== "linked") {
      return NextResponse.json(
        { error: "Le building n'est pas rattaché à une copropriété Talok." },
        { status: 400 }
      );
    }

    // Vérifier accès : owner OU syndic du site
    const isOwner = b.owner_id === profileId;
    let isSyndic = false;
    const { data: site } = await serviceClient
      .from("sites")
      .select("syndic_profile_id, copro_entity_id")
      .eq("id", b.site_id)
      .maybeSingle();
    if (site) {
      isSyndic = (site as { syndic_profile_id: string }).syndic_profile_id === profileId;
    }
    if (!isOwner && !isSyndic) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const coproEntityId = (site as { copro_entity_id: string | null } | null)?.copro_entity_id;
    if (!coproEntityId) {
      return NextResponse.json(
        { error: "La copropriété n'a pas d'entité juridique associée." },
        { status: 400 }
      );
    }

    // Récupère les building_units pas encore mappées
    const { data: units } = await serviceClient
      .from("building_units")
      .select("id, floor, position, copro_lot_id, property_id, properties:properties(unique_code)")
      .eq("building_id", buildingId)
      .is("copro_lot_id", null);
    const targetUnits = (units ?? []) as Array<{
      id: string;
      floor: number;
      position: number;
      property_id: string | null;
      properties: { unique_code: string | null } | null;
    }>;

    if (targetUnits.length === 0) {
      return NextResponse.json({ mapped: 0, message: "Aucune unité à mapper." });
    }

    // Récupère tous les copro_lots de l'entité
    const { data: lots } = await serviceClient
      .from("copro_lots")
      .select("id, lot_number, surface_m2, is_active")
      .eq("copro_entity_id", coproEntityId)
      .eq("is_active", true);
    const targetLots = (lots ?? []) as Array<{
      id: string;
      lot_number: string;
      surface_m2: number | null;
    }>;

    // Lots déjà mappés à exclure
    const { data: alreadyMapped } = await serviceClient
      .from("building_units")
      .select("copro_lot_id")
      .not("copro_lot_id", "is", null);
    const usedLotIds = new Set(
      (alreadyMapped ?? []).map((m) => (m as { copro_lot_id: string }).copro_lot_id)
    );
    const availableLots = targetLots.filter((l) => !usedLotIds.has(l.id));

    // Auto-matching :
    // 1. lot_number == unique_code (case-insensitive, trim)
    // 2. lot_number == "{floor}-{position}" en fallback
    function normalize(s: string): string {
      return s.trim().toLowerCase().replace(/\s+/g, "");
    }

    const updates: Array<{ unit_id: string; lot_id: string }> = [];

    for (const unit of targetUnits) {
      const candidates: string[] = [];
      if (unit.properties?.unique_code) candidates.push(normalize(unit.properties.unique_code));
      candidates.push(`${unit.floor}-${unit.position}`);
      candidates.push(`${unit.floor}.${unit.position}`);

      const match = availableLots.find((lot) =>
        candidates.includes(normalize(lot.lot_number))
      );
      if (match) {
        updates.push({ unit_id: unit.id, lot_id: match.id });
        // Marque le lot comme utilisé pour ce run
        const idx = availableLots.findIndex((l) => l.id === match.id);
        if (idx >= 0) availableLots.splice(idx, 1);
      }
    }

    // Apply updates en batch
    let mappedCount = 0;
    for (const u of updates) {
      const { error } = await serviceClient
        .from("building_units")
        .update({ copro_lot_id: u.lot_id, updated_at: new Date().toISOString() })
        .eq("id", u.unit_id);
      if (!error) mappedCount += 1;
    }

    return NextResponse.json({
      mapped: mappedCount,
      total_units: targetUnits.length,
      total_lots_available: targetLots.length,
      unmapped: targetUnits.length - mappedCount,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

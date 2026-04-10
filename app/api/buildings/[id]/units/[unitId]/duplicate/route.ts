export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { getServiceClient } from "@/lib/supabase/service-client";

const duplicateSchema = z.object({
  target_floors: z.array(z.number().int().min(-5).max(50)).min(1, "Au moins un étage cible requis"),
});

interface RouteParams {
  params: Promise<{ id: string; unitId: string }>;
}

/**
 * POST /api/buildings/[id]/units/[unitId]/duplicate
 * Duplicate a unit to other floors
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id: buildingId, unitId } = await params;
    const { user, error } = await getAuthenticatedUser(request);

    if (error || !user) {
      throw new ApiError(401, "Non authentifié");
    }

    const serviceClient = getServiceClient();

    // Get profile
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) throw new ApiError(404, "Profil non trouvé");

    // Verify building access
    const { data: building } = await serviceClient
      .from("buildings")
      .select("id, owner_id")
      .eq("id", buildingId)
      .single();

    if (!building) throw new ApiError(404, "Immeuble non trouvé");
    if (profile.role !== "admin" && building.owner_id !== profile.id) {
      throw new ApiError(403, "Accès non autorisé");
    }

    // Get source unit
    const { data: sourceUnit } = await serviceClient
      .from("building_units")
      .select("*")
      .eq("id", unitId)
      .eq("building_id", buildingId)
      .single();

    if (!sourceUnit) throw new ApiError(404, "Lot source non trouvé");

    // Validate body
    const body = await request.json();
    const validation = duplicateSchema.safeParse(body);
    if (!validation.success) {
      throw new ApiError(400, "Données invalides", validation.error.errors);
    }

    const { target_floors } = validation.data;

    // For each target floor, find next available position and create unit
    const createdUnits = [];

    for (const floor of target_floors) {
      // Skip if same floor as source
      if (floor === sourceUnit.floor) continue;

      // Find next available position on this floor
      const { data: existingOnFloor } = await serviceClient
        .from("building_units")
        .select("position")
        .eq("building_id", buildingId)
        .eq("floor", floor);

      const usedPositions = new Set((existingOnFloor || []).map((u: { position: string }) => u.position));
      let position = "A";
      for (let i = 0; i < 26; i++) {
        const pos = String.fromCharCode(65 + i);
        if (!usedPositions.has(pos)) {
          position = pos;
          break;
        }
      }

      const { data: newUnit, error: insertErr } = await serviceClient
        .from("building_units")
        .insert({
          building_id: buildingId,
          floor,
          position,
          type: sourceUnit.type,
          template: sourceUnit.template,
          surface: sourceUnit.surface,
          nb_pieces: sourceUnit.nb_pieces,
          loyer_hc: sourceUnit.loyer_hc,
          charges: sourceUnit.charges,
          depot_garantie: sourceUnit.depot_garantie,
          status: "vacant",
        })
        .select()
        .single();

      if (insertErr) {
        console.error(`[duplicate] Error creating unit on floor ${floor}:`, insertErr);
        continue;
      }

      createdUnits.push(newUnit);
    }

    return NextResponse.json({
      success: true,
      count: createdUnits.length,
      units: createdUnits,
    }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

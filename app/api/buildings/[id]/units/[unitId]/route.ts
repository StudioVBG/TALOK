export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";

/**
 * Validation schema for updating a unit
 */
const unitTypeEnum = z.enum(["appartement", "studio", "local_commercial", "parking", "cave", "bureau"]);
const unitStatusEnum = z.enum(["vacant", "occupe", "travaux", "reserve"]);
const unitTemplateEnum = z.enum(["studio", "t1", "t2", "t3", "t4", "t5", "local", "parking", "cave"]);

const updateUnitSchema = z.object({
  floor: z.number().int().min(0).optional(),
  position: z.string().min(1).max(10).optional(),
  type: unitTypeEnum.optional(),
  surface: z.number().positive().optional(),
  nb_pieces: z.number().int().min(0).optional(),
  template: unitTemplateEnum.optional(),
  loyer_hc: z.number().min(0).optional(),
  charges: z.number().min(0).optional(),
  depot_garantie: z.number().min(0).optional(),
  status: unitStatusEnum.optional(),
  current_lease_id: z.string().uuid().nullable().optional(),
});

const duplicateSchema = z.object({
  targetFloors: z.array(z.number().int().min(0)).min(1, "Au moins un étage cible requis"),
});

interface RouteParams {
  params: Promise<{ id: string; unitId: string }>;
}

/**
 * Helper to verify building access
 */
async function verifyBuildingAccess(
  supabase: any,
  buildingId: string,
  profileId: string,
  role: string
): Promise<void> {
  const { data: building, error } = await supabase
    .from("buildings")
    .select("id, owner_id")
    .eq("id", buildingId)
    .single();

  if (error || !building) {
    throw new ApiError(404, "Immeuble non trouvé");
  }

  if (role !== "admin" && building.owner_id !== profileId) {
    throw new ApiError(403, "Accès non autorisé à cet immeuble");
  }
}

/**
 * GET /api/buildings/[id]/units/[unitId] - Get a single unit
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id: buildingId, unitId } = await params;
    const { user, error, supabase } = await getAuthenticatedUser(request);

    if (error || !user || !supabase) {
      throw new ApiError(error?.status || 401, error?.message || "Non authentifié");
    }

    // Get owner profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      throw new ApiError(404, "Profil non trouvé");
    }

    // Verify building access
    await verifyBuildingAccess(supabase, buildingId, profile.id, profile.role);

    // Fetch unit
    const { data: unit, error: unitError } = await supabase
      .from("building_units")
      .select("*")
      .eq("id", unitId)
      .eq("building_id", buildingId)
      .single();

    if (unitError || !unit) {
      throw new ApiError(404, "Lot non trouvé");
    }

    return NextResponse.json({ unit });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/buildings/[id]/units/[unitId] - Update a unit
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id: buildingId, unitId } = await params;
    const { user, error, supabase } = await getAuthenticatedUser(request);

    if (error || !user || !supabase) {
      throw new ApiError(error?.status || 401, error?.message || "Non authentifié");
    }

    // Get owner profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      throw new ApiError(404, "Profil non trouvé");
    }

    // Verify building access
    await verifyBuildingAccess(supabase, buildingId, profile.id, profile.role);

    // Check unit exists
    const { data: existing, error: existingError } = await supabase
      .from("building_units")
      .select("id")
      .eq("id", unitId)
      .eq("building_id", buildingId)
      .single();

    if (existingError || !existing) {
      throw new ApiError(404, "Lot non trouvé");
    }

    // Validate request body
    const body = await request.json();
    const validation = updateUnitSchema.safeParse(body);

    if (!validation.success) {
      throw new ApiError(400, "Données invalides", validation.error.errors);
    }

    // Update unit
    const { data: unit, error: updateError } = await supabase
      .from("building_units")
      .update({
        ...validation.data,
        updated_at: new Date().toISOString(),
      })
      .eq("id", unitId)
      .select()
      .single();

    if (updateError) {
      console.error("[PATCH /api/buildings/[id]/units/[unitId]] Update error:", updateError);
      throw new ApiError(500, "Erreur lors de la mise à jour du lot");
    }

    return NextResponse.json({ unit });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/buildings/[id]/units/[unitId] - Delete a unit
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { id: buildingId, unitId } = await params;
    const { user, error, supabase } = await getAuthenticatedUser(request);

    if (error || !user || !supabase) {
      throw new ApiError(error?.status || 401, error?.message || "Non authentifié");
    }

    // Get owner profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      throw new ApiError(404, "Profil non trouvé");
    }

    // Verify building access
    await verifyBuildingAccess(supabase, buildingId, profile.id, profile.role);

    // Check unit exists and is not occupied
    const { data: existing, error: existingError } = await supabase
      .from("building_units")
      .select("id, status, current_lease_id")
      .eq("id", unitId)
      .eq("building_id", buildingId)
      .single();

    if (existingError || !existing) {
      throw new ApiError(404, "Lot non trouvé");
    }

    if (existing.status === "occupe" || existing.current_lease_id) {
      throw new ApiError(400, "Impossible de supprimer un lot occupé ou lié à un bail");
    }

    // Create service client for delete
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new ApiError(500, "Configuration serveur incomplète");
    }

    const { createClient } = await import("@supabase/supabase-js");
    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Delete unit
    const { error: deleteError } = await serviceClient
      .from("building_units")
      .delete()
      .eq("id", unitId);

    if (deleteError) {
      console.error("[DELETE /api/buildings/[id]/units/[unitId]] Delete error:", deleteError);
      throw new ApiError(500, "Erreur lors de la suppression du lot");
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/buildings/[id]/units/[unitId]/duplicate - Duplicate a unit to other floors
 * Note: This is handled via the main POST route with a special action
 */

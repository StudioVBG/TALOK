export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";

/**
 * Validation schema for updating a building
 */
const updateBuildingSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  adresse_complete: z.string().min(1).optional(),
  code_postal: z.string().regex(/^(0[1-9]|[1-8]\d|9[0-5]|97[1-6])\d{3}$/).optional(),
  ville: z.string().min(1).optional(),
  departement: z.string().optional(),
  floors: z.number().int().min(1).max(50).optional(),
  construction_year: z.number().int().min(1800).max(new Date().getFullYear() + 5).optional(),
  has_ascenseur: z.boolean().optional(),
  has_gardien: z.boolean().optional(),
  has_interphone: z.boolean().optional(),
  has_digicode: z.boolean().optional(),
  has_local_velo: z.boolean().optional(),
  has_local_poubelles: z.boolean().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/buildings/[id] - Get a single building with its units
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
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

    // Fetch building with units
    const { data: building, error: buildingError } = await supabase
      .from("buildings")
      .select(`
        *,
        building_units (*)
      `)
      .eq("id", id)
      .single();

    if (buildingError || !building) {
      throw new ApiError(404, "Immeuble non trouvé");
    }

    // Check ownership (unless admin)
    if (profile.role !== "admin" && building.owner_id !== profile.id) {
      throw new ApiError(403, "Accès non autorisé à cet immeuble");
    }

    // Sort units by floor and position
    if (building.building_units) {
      building.building_units.sort((a: any, b: any) => {
        if (a.floor !== b.floor) return a.floor - b.floor;
        return a.position.localeCompare(b.position);
      });
    }

    // Rename building_units to units for cleaner API
    const response = {
      ...building,
      units: building.building_units || [],
      building_units: undefined,
    };

    return NextResponse.json({ building: response });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/buildings/[id] - Update a building
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
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

    // Check building exists and user has access
    const { data: existing, error: existingError } = await supabase
      .from("buildings")
      .select("id, owner_id")
      .eq("id", id)
      .single();

    if (existingError || !existing) {
      throw new ApiError(404, "Immeuble non trouvé");
    }

    if (profile.role !== "admin" && existing.owner_id !== profile.id) {
      throw new ApiError(403, "Accès non autorisé à cet immeuble");
    }

    // Validate request body
    const body = await request.json();
    const validation = updateBuildingSchema.safeParse(body);

    if (!validation.success) {
      throw new ApiError(400, "Données invalides", validation.error.errors);
    }

    const payload = validation.data;

    // Update departement if code_postal changed
    if (payload.code_postal && !payload.departement) {
      if (payload.code_postal.startsWith("97")) {
        payload.departement = payload.code_postal.substring(0, 3);
      } else if (payload.code_postal.startsWith("20")) {
        const cp = parseInt(payload.code_postal, 10);
        payload.departement = cp < 20200 ? "2A" : "2B";
      } else {
        payload.departement = payload.code_postal.substring(0, 2);
      }
    }

    // Update building
    const { data: building, error: updateError } = await supabase
      .from("buildings")
      .update({
        ...payload,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("[PATCH /api/buildings] Update error:", updateError);
      throw new ApiError(500, "Erreur lors de la mise à jour de l'immeuble");
    }

    return NextResponse.json({ building });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/buildings/[id] - Delete a building (soft delete)
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
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

    // Check building exists and user has access
    const { data: existing, error: existingError } = await supabase
      .from("buildings")
      .select("id, owner_id")
      .eq("id", id)
      .single();

    if (existingError || !existing) {
      throw new ApiError(404, "Immeuble non trouvé");
    }

    if (profile.role !== "admin" && existing.owner_id !== profile.id) {
      throw new ApiError(403, "Accès non autorisé à cet immeuble");
    }

    // Check if building has occupied units
    const { data: occupiedUnits, error: occupiedError } = await supabase
      .from("building_units")
      .select("id")
      .eq("building_id", id)
      .eq("status", "occupe")
      .limit(1);

    if (!occupiedError && occupiedUnits && occupiedUnits.length > 0) {
      throw new ApiError(400, "Impossible de supprimer un immeuble avec des lots occupés");
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

    // Soft delete: set deleted_at timestamp
    const { error: deleteError } = await serviceClient
      .from("buildings")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);

    if (deleteError) {
      // If deleted_at column doesn't exist, do hard delete
      if (deleteError.message?.includes("deleted_at")) {
        const { error: hardDeleteError } = await serviceClient
          .from("buildings")
          .delete()
          .eq("id", id);

        if (hardDeleteError) {
          console.error("[DELETE /api/buildings] Delete error:", hardDeleteError);
          throw new ApiError(500, "Erreur lors de la suppression de l'immeuble");
        }
      } else {
        console.error("[DELETE /api/buildings] Delete error:", deleteError);
        throw new ApiError(500, "Erreur lors de la suppression de l'immeuble");
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}

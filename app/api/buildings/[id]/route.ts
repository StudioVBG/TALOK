export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { getServiceClient } from "@/lib/supabase/service-client";

const updateBuildingSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  adresse_complete: z.string().min(1).optional(),
  code_postal: z.string().regex(/^(?:(?:0[1-9]|[1-8]\d|9[0-5])\d{3}|97[1-6]\d{2})$/).optional(),
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

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { user, error } = await getAuthenticatedUser(request);

    if (error || !user) {
      throw new ApiError(error?.status || 401, error?.message || "Non authentifié");
    }

    const serviceClient = getServiceClient();

    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      throw new ApiError(404, "Profil non trouvé");
    }

    const { data: building, error: buildingError } = await serviceClient
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

    if (profile.role !== "admin" && building.owner_id !== profile.id) {
      throw new ApiError(403, "Accès non autorisé à cet immeuble");
    }

    if (building.building_units) {
      building.building_units.sort((a: any, b: any) => {
        if (a.floor !== b.floor) return a.floor - b.floor;
        return a.position.localeCompare(b.position);
      });
    }

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

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { user, error } = await getAuthenticatedUser(request);

    if (error || !user) {
      throw new ApiError(error?.status || 401, error?.message || "Non authentifié");
    }

    const serviceClient = getServiceClient();

    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      throw new ApiError(404, "Profil non trouvé");
    }

    const { data: existing, error: existingError } = await serviceClient
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

    const body = await request.json();
    const validation = updateBuildingSchema.safeParse(body);

    if (!validation.success) {
      throw new ApiError(400, "Données invalides", validation.error.errors);
    }

    const payload = validation.data;

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

    const { data: building, error: updateError } = await serviceClient
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

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { user, error } = await getAuthenticatedUser(request);

    if (error || !user) {
      throw new ApiError(error?.status || 401, error?.message || "Non authentifié");
    }

    const serviceClient = getServiceClient();

    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      throw new ApiError(404, "Profil non trouvé");
    }

    const { data: existing, error: existingError } = await serviceClient
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

    const { data: occupiedUnits, error: occupiedError } = await serviceClient
      .from("building_units")
      .select("id")
      .eq("building_id", id)
      .eq("status", "occupe")
      .limit(1);

    if (!occupiedError && occupiedUnits && occupiedUnits.length > 0) {
      throw new ApiError(400, "Impossible de supprimer un immeuble avec des lots occupés");
    }

    const { error: deleteError } = await serviceClient
      .from("buildings")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);

    if (deleteError) {
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

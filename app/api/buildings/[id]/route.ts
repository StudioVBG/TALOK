export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { getServiceClient } from "@/lib/supabase/service-client";

const updateBuildingSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  adresse_complete: z.string().min(1).optional(),
  code_postal: z.string().regex(/^(?:(?:0[1-9]|[1-8]\d|9[0-5])\d{3}|97[1-6]\d{2})$/).optional(),
  ville: z.string().min(1).optional(),
  departement: z.string().optional(),
  floors: z.number().int().min(1).max(50).optional(),
  construction_year: z.number().int().min(1800).max(new Date().getFullYear() + 5).optional().nullable(),
  surface_totale: z.number().nonnegative().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  ownership_type: z.enum(["full", "partial"]).optional(),
  total_lots_in_building: z.number().int().positive().optional().nullable(),
  has_ascenseur: z.boolean().optional(),
  has_gardien: z.boolean().optional(),
  has_interphone: z.boolean().optional(),
  has_digicode: z.boolean().optional(),
  has_local_velo: z.boolean().optional(),
  has_local_poubelles: z.boolean().optional(),
  has_parking_commun: z.boolean().optional(),
  has_jardin_commun: z.boolean().optional(),
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

    // Cohérence ownership_type ↔ total_lots_in_building
    if (
      payload.ownership_type === "partial" &&
      (payload.total_lots_in_building === null ||
        (payload.total_lots_in_building === undefined &&
          !("total_lots_in_building" in payload)))
    ) {
      // Si partial fourni sans total_lots, on n'exige pas nécessairement qu'il soit
      // dans CE patch (il peut déjà exister). On vérifie en DB.
      const { data: current } = await serviceClient
        .from("buildings")
        .select("total_lots_in_building")
        .eq("id", id)
        .single();
      if (!current || current.total_lots_in_building == null) {
        throw new ApiError(
          400,
          "Copropriété partielle : indiquez le nombre total de lots de l'immeuble physique."
        );
      }
    }
    if (payload.ownership_type === "full") {
      // En mode full, total_lots_in_building doit être NULL (réinitialisation)
      (payload as Record<string, unknown>).total_lots_in_building = null;
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

    // Garde : refuser la suppression si au moins un lot a un bail bloquant
    // (status='occupe' OU current_lease_id != NULL OU bail actif via leases).
    const { data: blocking } = await serviceClient.rpc(
      "building_active_lease_units",
      { p_building_id: id }
    );
    if (Array.isArray(blocking) && blocking.length > 0) {
      throw new ApiError(
        409,
        `Impossible de supprimer l'immeuble : ${blocking.length} lot(s) ont un bail actif. Résilier les baux d'abord.`
      );
    }

    // Fallback safety : garder la vérification status='occupe' au cas où
    // `current_lease_id` n'est pas sync (anciens records).
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

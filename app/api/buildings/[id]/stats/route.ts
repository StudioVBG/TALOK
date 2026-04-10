export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { getServiceClient } from "@/lib/supabase/service-client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id: buildingId } = await params;
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
      .select("id, owner_id, name")
      .eq("id", buildingId)
      .single();

    if (buildingError || !building) {
      throw new ApiError(404, "Immeuble non trouvé");
    }

    if (profile.role !== "admin" && building.owner_id !== profile.id) {
      throw new ApiError(403, "Accès non autorisé à cet immeuble");
    }

    const { data: viewStats, error: viewError } = await serviceClient
      .from("building_stats")
      .select("*")
      .eq("id", buildingId)
      .single();

    if (!viewError && viewStats) {
      return NextResponse.json({ stats: viewStats });
    }

    const { data: units, error: unitsError } = await serviceClient
      .from("building_units")
      .select("*")
      .eq("building_id", buildingId);

    if (unitsError) {
      console.error("[GET /api/buildings/[id]/stats] Units error:", unitsError);
      throw new ApiError(500, "Erreur lors de la récupération des statistiques");
    }

    const allUnits = units || [];

    const totalUnits = allUnits.filter(u =>
      u.type === "appartement" || u.type === "studio" || u.type === "bureau" || u.type === "local_commercial"
    ).length;
    const totalParkings = allUnits.filter(u => u.type === "parking").length;
    const totalCaves = allUnits.filter(u => u.type === "cave").length;
    const surfaceTotale = allUnits.reduce((acc, u) => acc + (u.surface || 0), 0);
    const revenusPotentiels = allUnits.reduce((acc, u) => acc + (u.loyer_hc || 0) + (u.charges || 0), 0);
    const occupiedUnits = allUnits.filter(u => u.status === "occupe").length;
    const vacantUnits = allUnits.filter(u => u.status === "vacant").length;
    const occupancyRate = allUnits.length > 0 ? Math.round((occupiedUnits / allUnits.length) * 100) : 0;

    const byStatus = {
      vacant: allUnits.filter(u => u.status === "vacant").length,
      occupe: allUnits.filter(u => u.status === "occupe").length,
      travaux: allUnits.filter(u => u.status === "travaux").length,
      reserve: allUnits.filter(u => u.status === "reserve").length,
    };

    const byType = {
      appartement: allUnits.filter(u => u.type === "appartement").length,
      studio: allUnits.filter(u => u.type === "studio").length,
      local_commercial: allUnits.filter(u => u.type === "local_commercial").length,
      bureau: allUnits.filter(u => u.type === "bureau").length,
      parking: totalParkings,
      cave: totalCaves,
    };

    const revenueOccupe = allUnits
      .filter(u => u.status === "occupe")
      .reduce((acc, u) => acc + (u.loyer_hc || 0) + (u.charges || 0), 0);

    const stats = {
      id: buildingId,
      name: building.name,
      owner_id: building.owner_id,
      total_units: totalUnits,
      total_parkings: totalParkings,
      total_caves: totalCaves,
      surface_totale: surfaceTotale,
      revenus_potentiels: revenusPotentiels,
      revenus_actuels: revenueOccupe,
      occupancy_rate: occupancyRate,
      vacant_units: vacantUnits,
      occupied_units: occupiedUnits,
      by_status: byStatus,
      by_type: byType,
    };

    return NextResponse.json({ stats });
  } catch (error) {
    return handleApiError(error);
  }
}

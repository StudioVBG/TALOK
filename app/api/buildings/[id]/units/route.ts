/**
 * /api/buildings/[id]/units
 *
 * [NOT CONSUMED BY FRONTEND — kept for API programmatic use]
 *
 * Le wizard et la page de gestion des lots passent par
 * POST /api/properties/[id]/building-units (RPC transactionnelle).
 * Cette route reste disponible pour un usage API direct (tests, scripts,
 * intégration future). Voir docs/api-buildings.md.
 */
export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { applyRateLimit } from "@/lib/middleware/rate-limit";
import { createLogger } from "@/lib/logging/structured-logger";
import { getServiceClient } from "@/lib/supabase/service-client";

const unitTypeEnum = z.enum(["appartement", "studio", "local_commercial", "parking", "cave", "bureau"]);
const unitStatusEnum = z.enum(["vacant", "occupe", "travaux", "reserve"]);
const unitTemplateEnum = z.enum(["studio", "t1", "t2", "t3", "t4", "t5", "local", "parking", "cave"]);

const createUnitSchema = z.object({
  floor: z.number().int().min(0, "L'étage doit être >= 0"),
  position: z.string().min(1, "La position est requise").max(10),
  type: unitTypeEnum,
  surface: z.number().positive("La surface doit être positive"),
  nb_pieces: z.number().int().min(0).default(0),
  template: unitTemplateEnum.optional(),
  loyer_hc: z.number().min(0).optional().default(0),
  charges: z.number().min(0).optional().default(0),
  depot_garantie: z.number().min(0).optional().default(0),
  status: unitStatusEnum.optional().default("vacant"),
});

const bulkCreateSchema = z.object({
  units: z.array(createUnitSchema).min(1, "Au moins un lot requis"),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function verifyBuildingAccess(
  serviceClient: ReturnType<typeof getServiceClient>,
  buildingId: string,
  profileId: string,
  role: string
): Promise<void> {
  const { data: building, error } = await serviceClient
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

    await verifyBuildingAccess(serviceClient, buildingId, profile.id, profile.role);

    const { data: units, error: unitsError } = await serviceClient
      .from("building_units")
      .select("*")
      .eq("building_id", buildingId)
      .order("floor", { ascending: true })
      .order("position", { ascending: true });

    if (unitsError) {
      createLogger("GET /api/buildings/[id]/units").error("Error fetching units", { unitsError });
      throw new ApiError(500, "Erreur lors de la récupération des lots");
    }

    return NextResponse.json({ units: units || [] });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const rateLimitResponse = applyRateLimit(request, "property");
    if (rateLimitResponse) return rateLimitResponse;

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

    await verifyBuildingAccess(serviceClient, buildingId, profile.id, profile.role);

    const body = await request.json();

    if (body.units && Array.isArray(body.units)) {
      const validation = bulkCreateSchema.safeParse(body);
      if (!validation.success) {
        throw new ApiError(400, "Données invalides", validation.error.errors);
      }

      const unitsToInsert = validation.data.units.map(unit => ({
        building_id: buildingId,
        ...unit,
      }));

      const { data: units, error: insertError } = await serviceClient
        .from("building_units")
        .insert(unitsToInsert)
        .select();

      if (insertError) {
        createLogger("POST /api/buildings/[id]/units").error("Bulk insert error", { insertError });
        throw new ApiError(500, "Erreur lors de la création des lots", insertError);
      }

      return NextResponse.json({ units }, { status: 201 });
    }

    const validation = createUnitSchema.safeParse(body);
    if (!validation.success) {
      throw new ApiError(400, "Données invalides", validation.error.errors);
    }

    const { data: unit, error: insertError } = await serviceClient
      .from("building_units")
      .insert({
        building_id: buildingId,
        ...validation.data,
      })
      .select()
      .single();

    if (insertError) {
      createLogger("POST /api/buildings/[id]/units").error("Insert error", { insertError });
      throw new ApiError(500, "Erreur lors de la création du lot", insertError);
    }

    return NextResponse.json({ unit }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

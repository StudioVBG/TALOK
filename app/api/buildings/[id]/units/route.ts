export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";

/**
 * Validation schema for creating a unit
 */
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
 * GET /api/buildings/[id]/units - Get all units for a building
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id: buildingId } = await params;
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

    // Fetch units
    const { data: units, error: unitsError } = await supabase
      .from("building_units")
      .select("*")
      .eq("building_id", buildingId)
      .order("floor", { ascending: true })
      .order("position", { ascending: true });

    if (unitsError) {
      console.error("[GET /api/buildings/[id]/units] Error:", unitsError);
      throw new ApiError(500, "Erreur lors de la récupération des lots");
    }

    return NextResponse.json({ units: units || [] });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/buildings/[id]/units - Create a new unit (or bulk create)
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id: buildingId } = await params;
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

    // Parse body
    const body = await request.json();

    // Check if bulk create
    if (body.units && Array.isArray(body.units)) {
      const validation = bulkCreateSchema.safeParse(body);
      if (!validation.success) {
        throw new ApiError(400, "Données invalides", validation.error.errors);
      }

      // Create service client
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !serviceRoleKey) {
        throw new ApiError(500, "Configuration serveur incomplète");
      }

      const { createClient } = await import("@supabase/supabase-js");
      const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      // Bulk insert
      const unitsToInsert = validation.data.units.map(unit => ({
        building_id: buildingId,
        ...unit,
      }));

      const { data: units, error: insertError } = await serviceClient
        .from("building_units")
        .insert(unitsToInsert)
        .select();

      if (insertError) {
        console.error("[POST /api/buildings/[id]/units] Bulk insert error:", insertError);
        throw new ApiError(500, "Erreur lors de la création des lots", insertError);
      }

      return NextResponse.json({ units }, { status: 201 });
    }

    // Single unit create
    const validation = createUnitSchema.safeParse(body);
    if (!validation.success) {
      throw new ApiError(400, "Données invalides", validation.error.errors);
    }

    // Create service client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new ApiError(500, "Configuration serveur incomplète");
    }

    const { createClient } = await import("@supabase/supabase-js");
    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Insert unit
    const { data: unit, error: insertError } = await serviceClient
      .from("building_units")
      .insert({
        building_id: buildingId,
        ...validation.data,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[POST /api/buildings/[id]/units] Insert error:", insertError);
      throw new ApiError(500, "Erreur lors de la création du lot", insertError);
    }

    return NextResponse.json({ unit }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

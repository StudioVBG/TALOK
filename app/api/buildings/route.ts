export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";

/**
 * Validation schema for creating a building
 */
const createBuildingSchema = z.object({
  name: z.string().min(1, "Le nom est requis").max(100, "Le nom est trop long"),
  adresse_complete: z.string().min(1, "L'adresse est requise"),
  code_postal: z.string().regex(/^(0[1-9]|[1-8]\d|9[0-5]|97[1-6])\d{3}$/, "Code postal invalide"),
  ville: z.string().min(1, "La ville est requise"),
  departement: z.string().optional(),
  floors: z.number().int().min(1, "Minimum 1 étage").max(50, "Maximum 50 étages"),
  construction_year: z.number().int().min(1800).max(new Date().getFullYear() + 5).optional(),
  has_ascenseur: z.boolean().optional().default(false),
  has_gardien: z.boolean().optional().default(false),
  has_interphone: z.boolean().optional().default(false),
  has_digicode: z.boolean().optional().default(false),
  has_local_velo: z.boolean().optional().default(false),
  has_local_poubelles: z.boolean().optional().default(false),
  property_id: z.string().uuid().optional(),
});

/**
 * GET /api/buildings - Get all buildings for the current owner
 */
export async function GET(request: Request) {
  try {
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

    if (profile.role !== "owner" && profile.role !== "admin") {
      throw new ApiError(403, "Accès réservé aux propriétaires");
    }

    // Fetch buildings with units count
    let query = supabase
      .from("buildings")
      .select(`
        *,
        building_units (count)
      `)
      .order("created_at", { ascending: false });

    // Non-admin users only see their own buildings
    if (profile.role !== "admin") {
      query = query.eq("owner_id", profile.id);
    }

    const { data: buildings, error: buildingsError } = await query;

    if (buildingsError) {
      console.error("[GET /api/buildings] Error:", buildingsError);
      throw new ApiError(500, "Erreur lors de la récupération des immeubles");
    }

    // Transform to include units_count
    const transformedBuildings = (buildings || []).map((b: any) => ({
      ...b,
      units_count: b.building_units?.[0]?.count || 0,
      building_units: undefined, // Remove the raw count object
    }));

    return NextResponse.json({ buildings: transformedBuildings });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/buildings - Create a new building
 */
export async function POST(request: Request) {
  try {
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

    if (profile.role !== "owner") {
      throw new ApiError(403, "Seuls les propriétaires peuvent créer des immeubles");
    }

    // Validate request body
    const body = await request.json();
    const validation = createBuildingSchema.safeParse(body);

    if (!validation.success) {
      throw new ApiError(400, "Données invalides", validation.error.errors);
    }

    const payload = validation.data;

    // Extract departement from code_postal if not provided
    let departement = payload.departement;
    if (!departement && payload.code_postal) {
      if (payload.code_postal.startsWith("97")) {
        departement = payload.code_postal.substring(0, 3);
      } else if (payload.code_postal.startsWith("20")) {
        const cp = parseInt(payload.code_postal, 10);
        departement = cp < 20200 ? "2A" : "2B";
      } else {
        departement = payload.code_postal.substring(0, 2);
      }
    }

    // Create service client for insert
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new ApiError(500, "Configuration serveur incomplète");
    }

    const { createClient } = await import("@supabase/supabase-js");
    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Insert building
    const { data: building, error: insertError } = await serviceClient
      .from("buildings")
      .insert({
        owner_id: profile.id,
        property_id: payload.property_id || null,
        name: payload.name,
        adresse_complete: payload.adresse_complete,
        code_postal: payload.code_postal,
        ville: payload.ville,
        departement,
        floors: payload.floors,
        construction_year: payload.construction_year,
        has_ascenseur: payload.has_ascenseur,
        has_gardien: payload.has_gardien,
        has_interphone: payload.has_interphone,
        has_digicode: payload.has_digicode,
        has_local_velo: payload.has_local_velo,
        has_local_poubelles: payload.has_local_poubelles,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[POST /api/buildings] Insert error:", insertError);
      throw new ApiError(500, "Erreur lors de la création de l'immeuble", insertError);
    }

    // Emit event
    try {
      await serviceClient.from("outbox").insert({
        event_type: "Building.Created",
        payload: {
          building_id: building.id,
          owner_id: profile.id,
          name: building.name,
        },
      });
    } catch (e) {
      console.warn("[POST /api/buildings] Outbox insert failed:", e);
    }

    return NextResponse.json({ building }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

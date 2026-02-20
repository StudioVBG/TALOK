export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { getServiceClient } from "@/lib/supabase/service-client";
import { z } from "zod";

const buildingUnitPayloadSchema = z.object({
  id: z.string().optional(),
  floor: z.number().int().min(-5).max(50),
  position: z.string().min(1).max(20),
  type: z.enum(["appartement", "studio", "local_commercial", "parking", "cave", "bureau"]),
  surface: z.number().positive(),
  nb_pieces: z.number().int().min(0),
  template: z.string().optional().nullable(),
  loyer_hc: z.number().min(0),
  charges: z.number().min(0),
  depot_garantie: z.number().min(0),
  status: z.enum(["vacant", "occupe", "travaux", "reserve"]).optional(),
});

const bodySchema = z.object({
  building_floors: z.number().int().min(1).max(50).optional(),
  has_ascenseur: z.boolean().optional(),
  has_gardien: z.boolean().optional(),
  has_interphone: z.boolean().optional(),
  has_digicode: z.boolean().optional(),
  has_local_velo: z.boolean().optional(),
  has_local_poubelles: z.boolean().optional(),
  units: z.array(buildingUnitPayloadSchema).min(1, "Au moins un lot requis"),
});

/**
 * POST /api/properties/[id]/building-units
 * Crée ou met à jour l'immeuble et ses lots pour une propriété de type immeuble.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: propertyId } = await params;
    const { user, error: authError } = await getAuthenticatedUser(request);
    if (authError || !user) {
      return NextResponse.json({ error: authError?.message ?? "Non authentifié" }, { status: 401 });
    }

    const serviceClient = getServiceClient();

    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();
    if (!profile || (profile.role !== "owner" && profile.role !== "admin")) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { data: property, error: propErr } = await serviceClient
      .from("properties")
      .select("id, owner_id, adresse_complete, code_postal, ville, departement")
      .eq("id", propertyId)
      .single();
    if (propErr || !property) {
      return NextResponse.json({ error: "Propriété non trouvée" }, { status: 404 });
    }
    if (property.owner_id !== profile.id && profile.role !== "admin") {
      return NextResponse.json({ error: "Vous n'êtes pas propriétaire de ce bien" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { building_floors, has_ascenseur, has_gardien, has_interphone, has_digicode, has_local_velo, has_local_poubelles, units } = parsed.data;

    let buildingId: string;

    const { data: existingBuilding } = await serviceClient
      .from("buildings")
      .select("id")
      .eq("property_id", propertyId)
      .maybeSingle();

    if (existingBuilding?.id) {
      buildingId = existingBuilding.id;
      await serviceClient
        .from("buildings")
        .update({
          floors: building_floors ?? 1,
          has_ascenseur: has_ascenseur ?? false,
          has_gardien: has_gardien ?? false,
          has_interphone: has_interphone ?? false,
          has_digicode: has_digicode ?? false,
          has_local_velo: has_local_velo ?? false,
          has_local_poubelles: has_local_poubelles ?? false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", buildingId);
    } else {
      const { data: newBuilding, error: insertErr } = await serviceClient
        .from("buildings")
        .insert({
          owner_id: property.owner_id,
          property_id: propertyId,
          name: property.adresse_complete?.slice(0, 200) ?? "Immeuble",
          adresse_complete: property.adresse_complete ?? "",
          code_postal: property.code_postal ?? "",
          ville: property.ville ?? "",
          departement: property.departement ?? null,
          floors: building_floors ?? 1,
          has_ascenseur: has_ascenseur ?? false,
          has_gardien: has_gardien ?? false,
          has_interphone: has_interphone ?? false,
          has_digicode: has_digicode ?? false,
          has_local_velo: has_local_velo ?? false,
          has_local_poubelles: has_local_poubelles ?? false,
        })
        .select("id")
        .single();
      if (insertErr || !newBuilding?.id) {
        console.error("[building-units] Erreur création building:", insertErr);
        return NextResponse.json({ error: "Erreur lors de la création de l'immeuble" }, { status: 500 });
      }
      buildingId = newBuilding.id;
    }

    await serviceClient.from("building_units").delete().eq("building_id", buildingId);

    const rows = units.map((u) => ({
      building_id: buildingId,
      floor: u.floor,
      position: u.position,
      type: u.type,
      surface: u.surface,
      nb_pieces: u.nb_pieces,
      template: u.template ?? null,
      loyer_hc: u.loyer_hc,
      charges: u.charges,
      depot_garantie: u.depot_garantie,
      status: u.status ?? "vacant",
    }));

    const { error: unitsErr } = await serviceClient.from("building_units").insert(rows);
    if (unitsErr) {
      console.error("[building-units] Erreur insertion lots:", unitsErr);
      return NextResponse.json({ error: "Erreur lors de l'enregistrement des lots" }, { status: 500 });
    }

    return NextResponse.json({ success: true, building_id: buildingId, count: rows.length });
  } catch (e) {
    console.error("[building-units]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

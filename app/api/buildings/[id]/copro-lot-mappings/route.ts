export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET  /api/buildings/[id]/copro-lot-mappings
 *      Retourne la liste des building_units et leur copro_lot_id éventuel.
 *
 * PATCH /api/buildings/[id]/copro-lot-mappings
 *      Body : { mappings: [{ building_unit_id, copro_lot_id | null }] }
 *      Met à jour un ou plusieurs mappings manuels.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { getServiceClient } from "@/lib/supabase/service-client";

const PatchSchema = z.object({
  mappings: z
    .array(
      z.object({
        building_unit_id: z.string().uuid(),
        copro_lot_id: z.string().uuid().nullable(),
      })
    )
    .min(1)
    .max(100),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function authorize(buildingId: string, request: Request) {
  const { user, error } = await getAuthenticatedUser(request);
  if (error || !user) {
    return { ok: false, status: 401, body: { error: "Non authentifié" } } as const;
  }
  const serviceClient = getServiceClient();
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile) {
    return { ok: false, status: 404, body: { error: "Profil introuvable" } } as const;
  }
  const profileId = (profile as { id: string }).id;

  const { data: building } = await serviceClient
    .from("buildings")
    .select("id, owner_id, site_id")
    .eq("id", buildingId)
    .maybeSingle();
  if (!building) {
    return { ok: false, status: 404, body: { error: "Immeuble introuvable" } } as const;
  }
  const b = building as { owner_id: string; site_id: string | null };

  let isSyndic = false;
  if (b.site_id) {
    const { data: site } = await serviceClient
      .from("sites")
      .select("syndic_profile_id")
      .eq("id", b.site_id)
      .maybeSingle();
    isSyndic = (site as { syndic_profile_id: string } | null)?.syndic_profile_id === profileId;
  }
  if (b.owner_id !== profileId && !isSyndic) {
    return { ok: false, status: 403, body: { error: "Accès refusé" } } as const;
  }

  return {
    ok: true,
    serviceClient,
    profileId,
    siteId: b.site_id,
  } as const;
}

export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const auth = await authorize(id, request);
  if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status });

  const { data: units } = await auth.serviceClient
    .from("building_units")
    .select(
      "id, floor, position, type, copro_lot_id, property_id, properties:properties(unique_code, adresse_complete)"
    )
    .eq("building_id", id)
    .order("floor", { ascending: true })
    .order("position", { ascending: true });

  const unitRows = (units ?? []) as Array<{
    id: string;
    floor: number;
    position: number;
    type: string | null;
    copro_lot_id: string | null;
  }>;

  let lots: unknown[] = [];
  if (auth.siteId) {
    const { data: site } = await auth.serviceClient
      .from("sites")
      .select("copro_entity_id")
      .eq("id", auth.siteId)
      .maybeSingle();
    const coproEntityId = (site as { copro_entity_id: string | null } | null)?.copro_entity_id;
    if (coproEntityId) {
      const { data } = await auth.serviceClient
        .from("copro_lots")
        .select("id, lot_number, lot_type, owner_name, tantiemes_generaux, surface_m2")
        .eq("copro_entity_id", coproEntityId)
        .eq("is_active", true)
        .order("lot_number");
      lots = data ?? [];
    }
  }

  return NextResponse.json({ units: unitRows, lots });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const auth = await authorize(id, request);
  if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status });

  const body = await request.json().catch(() => ({}));
  const parse = PatchSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  }

  let updated = 0;
  for (const m of parse.data.mappings) {
    const { error } = await auth.serviceClient
      .from("building_units")
      .update({ copro_lot_id: m.copro_lot_id, updated_at: new Date().toISOString() })
      .eq("id", m.building_unit_id)
      .eq("building_id", id);
    if (!error) updated += 1;
  }
  return NextResponse.json({ updated });
}

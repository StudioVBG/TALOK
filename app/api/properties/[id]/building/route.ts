export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { getServiceClient } from "@/lib/supabase/service-client";

/**
 * GET /api/properties/[id]/building
 * Récupère le building et ses units pour une propriété de type immeuble.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: propertyId } = await params;
    const { user, error: authError } = await getAuthenticatedUser(request);
    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const serviceClient = getServiceClient();

    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();
    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // Récupérer le building lié à cette property
    const { data: building, error: bErr } = await serviceClient
      .from("buildings")
      .select("*")
      .eq("property_id", propertyId)
      .maybeSingle();

    if (bErr || !building) {
      return NextResponse.json({ building: null, units: [] });
    }

    // Vérifier l'accès
    if (building.owner_id !== profile.id && profile.role !== "admin") {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // Récupérer les units
    const { data: units } = await serviceClient
      .from("building_units")
      .select("*")
      .eq("building_id", building.id)
      .order("floor", { ascending: true })
      .order("position", { ascending: true });

    return NextResponse.json({
      building,
      units: units ?? [],
    });
  } catch (e) {
    console.error("[GET /api/properties/[id]/building]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

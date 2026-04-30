export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/buildings/[id]/auto-map-copro-lots
 *
 * Délègue au helper lib/buildings/auto-map-copro-lots.ts. Accessible à
 * l'owner du building OU au syndic du site lié.
 */

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { getServiceClient } from "@/lib/supabase/service-client";
import { autoMapCoproLots } from "@/lib/buildings/auto-map-copro-lots";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id: buildingId } = await params;
    const { user, error: authError } = await getAuthenticatedUser(request);
    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const serviceClient = getServiceClient();

    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!profile) {
      return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });
    }
    const profileId = (profile as { id: string }).id;

    const { data: building } = await serviceClient
      .from("buildings")
      .select("id, owner_id, site_id")
      .eq("id", buildingId)
      .maybeSingle();
    if (!building) {
      return NextResponse.json({ error: "Immeuble introuvable" }, { status: 404 });
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
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const result = await autoMapCoproLots(serviceClient, buildingId);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

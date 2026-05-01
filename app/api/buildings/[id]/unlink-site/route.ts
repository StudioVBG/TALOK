export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/buildings/[id]/unlink-site
 *
 * Annule le lien entre un building et un site syndic. Possible :
 * - par l'owner si statut pending (annulation de sa demande)
 * - par l'owner ou le syndic si statut linked (rupture du lien)
 *
 * Note : ne supprime pas user_site_roles existants — à faire manuellement
 * côté syndic si besoin (l'owner reste copropriétaire si invité indépendamment).
 */

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { getServiceClient } from "@/lib/supabase/service-client";

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
      .select("id, role")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!profile) {
      return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });
    }
    const profileId = (profile as { id: string }).id;
    const role = (profile as { role: string }).role;

    const { data: building } = await serviceClient
      .from("buildings")
      .select("id, owner_id, site_id, site_link_status")
      .eq("id", buildingId)
      .maybeSingle();
    if (!building) {
      return NextResponse.json({ error: "Immeuble introuvable" }, { status: 404 });
    }

    const isOwner = (building as { owner_id: string }).owner_id === profileId;
    const siteId = (building as { site_id: string | null }).site_id;
    let isSyndicOfSite = false;
    if (siteId) {
      const { data: site } = await serviceClient
        .from("sites")
        .select("syndic_profile_id")
        .eq("id", siteId)
        .maybeSingle();
      isSyndicOfSite = (site as { syndic_profile_id: string } | null)?.syndic_profile_id === profileId;
    }

    if (!isOwner && !isSyndicOfSite && role !== "admin" && role !== "platform_admin") {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // Annule le pending ou rompt le linked
    await serviceClient
      .from("building_site_links")
      .update({
        status: "cancelled",
        decided_by_profile_id: profileId,
        decided_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("building_id", buildingId)
      .in("status", ["pending"]);

    await serviceClient
      .from("buildings")
      .update({
        site_id: null,
        site_link_status: "unlinked",
        site_linked_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", buildingId);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

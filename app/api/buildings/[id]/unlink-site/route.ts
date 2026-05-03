export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/buildings/[id]/unlink-site
 *
 * Annule le lien entre un building et un site syndic. Possible :
 * - par l'owner si statut pending (annulation de sa demande)
 * - par l'owner ou le syndic si statut linked (rupture du lien)
 *
 * P0 fix : cancelle aussi les links 'approved' (avant : seulement 'pending'
 * → état dangling où building.site_id était null mais building_site_links
 * gardait status='approved'). Nettoie également user_site_roles si on
 * sort du mode volunteer (l'owner reste sinon coproprietaire_bailleur).
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
      .select("id, owner_id, site_id, site_link_status, owner_syndic_mode")
      .eq("id", buildingId)
      .maybeSingle();
    if (!building) {
      return NextResponse.json({ error: "Immeuble introuvable" }, { status: 404 });
    }

    const b = building as {
      owner_id: string;
      site_id: string | null;
      site_link_status: string;
      owner_syndic_mode: string | null;
    };
    const isOwner = b.owner_id === profileId;
    const siteId = b.site_id;
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

    // Cancelle TOUTES les liens actifs (pending OU approved). Avant : seul
    // 'pending' était traité, ce qui laissait des building_site_links en
    // 'approved' alors que buildings.site_id avait été remis à null.
    await serviceClient
      .from("building_site_links")
      .update({
        status: "cancelled",
        decided_by_profile_id: profileId,
        decided_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("building_id", buildingId)
      .in("status", ["pending", "approved"]);

    // Si on était en mode "syndic-bénévole" (owner = syndic du site qu'il
    // vient d'activer), on retire le rôle user_site_roles 'syndic' pour
    // garantir un retour à l'état initial. On ne touche PAS au site lui-même
    // (il peut contenir de la donnée comptable). La désactivation totale
    // (suppression du site) est une opération admin.
    if (siteId && b.owner_syndic_mode === "volunteer" && isOwner) {
      await serviceClient
        .from("user_site_roles")
        .delete()
        .eq("user_id", user.id)
        .eq("site_id", siteId)
        .eq("role_code", "syndic");
    }

    await serviceClient
      .from("buildings")
      .update({
        site_id: null,
        site_link_status: "unlinked",
        site_linked_at: null,
        owner_syndic_mode: "none",
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

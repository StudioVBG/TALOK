export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/syndic/site-claims
 *
 * Liste toutes les demandes de rattachement (building → site) en attente
 * adressées aux sites gérés par le syndic connecté.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireSyndic } from "@/lib/helpers/syndic-auth";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSyndic(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") ?? "pending";

    let query = auth.serviceClient
      .from("building_site_links")
      .select(
        "*, building:buildings(id, name, adresse_complete, code_postal, ville, ownership_type, total_lots_in_building, owner:profiles!buildings_owner_id_fkey(id, prenom, nom, email_contact)), site:sites(id, name)"
      )
      .order("created_at", { ascending: false });

    if (status !== "all") {
      query = query.eq("status", status);
    }

    if (!auth.isAdmin) {
      const { data: mySites } = await auth.serviceClient
        .from("sites")
        .select("id")
        .eq("syndic_profile_id", auth.profile.id);
      const siteIds = (mySites ?? []).map((s) => (s as { id: string }).id);
      if (siteIds.length === 0) return NextResponse.json([]);
      query = query.in("site_id", siteIds);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data ?? []);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

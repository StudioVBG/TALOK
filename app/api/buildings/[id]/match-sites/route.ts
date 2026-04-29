export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/buildings/[id]/match-sites
 *
 * Cherche des sites syndic Talok dont l'adresse / le code postal correspondent
 * à ceux d'un building côté owner. Utilisé pour suggérer un rattachement.
 */

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { getServiceClient } from "@/lib/supabase/service-client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
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

    const { data: building } = await serviceClient
      .from("buildings")
      .select("id, owner_id, code_postal, ville, adresse_complete")
      .eq("id", id)
      .maybeSingle();

    if (!building) {
      return NextResponse.json({ error: "Immeuble introuvable" }, { status: 404 });
    }

    const ownerId = (building as { owner_id: string }).owner_id;
    const profileId = (profile as { id: string }).id;
    if (ownerId !== profileId) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const codePostal = (building as { code_postal: string | null }).code_postal;
    const ville = (building as { ville: string | null }).ville;

    if (!codePostal || !ville) {
      return NextResponse.json([]);
    }

    // Match prioritaire : code postal + ville
    const { data: sites } = await serviceClient
      .from("sites")
      .select("id, name, address_line1, postal_code, city, syndic_profile_id, is_active")
      .eq("postal_code", codePostal)
      .ilike("city", ville)
      .eq("is_active", true)
      .limit(20);

    return NextResponse.json(sites ?? []);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

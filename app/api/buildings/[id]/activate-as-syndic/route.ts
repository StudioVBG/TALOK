export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/buildings/[id]/activate-as-syndic
 *
 * Pour les owners ownership_type='full' qui veulent structurer leur gestion
 * en activant le mode "syndic-bénévole" : crée un site Talok lié à leur
 * building et auto-approuve la liaison. Donne accès à /syndic/sites/[id]
 * (compta dédiée, contrats fournisseurs, AGs, etc.).
 *
 * Légalement, un mono-propriétaire n'a pas de syndic obligatoire — cette
 * action est purement organisationnelle.
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

    const { data: building } = await serviceClient
      .from("buildings")
      .select(
        "id, owner_id, name, adresse_complete, code_postal, ville, ownership_type, site_id, site_link_status, total_lots_in_building"
      )
      .eq("id", buildingId)
      .maybeSingle();
    if (!building) {
      return NextResponse.json({ error: "Immeuble introuvable" }, { status: 404 });
    }
    const b = building as {
      owner_id: string;
      name: string | null;
      adresse_complete: string | null;
      code_postal: string | null;
      ville: string | null;
      ownership_type: string;
      site_id: string | null;
      site_link_status: string;
      total_lots_in_building: number | null;
    };

    if (b.owner_id !== profileId) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
    if (b.ownership_type !== "full") {
      return NextResponse.json(
        {
          error:
            "Le mode syndic-bénévole n'est disponible que pour les immeubles que vous possédez intégralement.",
        },
        { status: 400 }
      );
    }
    if (b.site_id) {
      return NextResponse.json(
        { error: "Cet immeuble est déjà rattaché à une copropriété." },
        { status: 409 }
      );
    }

    // Crée un site Talok pour cet immeuble, avec l'owner comme syndic
    const { data: site, error: siteError } = await serviceClient
      .from("sites")
      .insert({
        name: b.name ?? "Mon immeuble",
        address_line1: b.adresse_complete ?? "",
        postal_code: b.code_postal ?? "",
        city: b.ville ?? "",
        syndic_profile_id: profileId,
        is_active: true,
        type: "copropriete",
        total_tantiemes_general: 10000,
      })
      .select("id")
      .single();

    if (siteError || !site) {
      return NextResponse.json(
        { error: siteError?.message ?? "Erreur lors de la création du site" },
        { status: 500 }
      );
    }
    const siteId = (site as { id: string }).id;

    // Crée le lien building <-> site (auto-approved car même utilisateur)
    const { error: linkError } = await serviceClient
      .from("building_site_links")
      .insert({
        building_id: buildingId,
        site_id: siteId,
        status: "approved",
        claimed_by_profile_id: profileId,
        decided_by_profile_id: profileId,
        decided_at: new Date().toISOString(),
        claim_message: "Mode syndic-bénévole activé par le propriétaire.",
        decision_reason: "auto-approuvé (owner = syndic)",
      });

    if (linkError) {
      // Cleanup le site créé si la liaison échoue
      await serviceClient.from("sites").delete().eq("id", siteId);
      return NextResponse.json({ error: linkError.message }, { status: 500 });
    }

    // Marque le building en mode volunteer
    await serviceClient
      .from("buildings")
      .update({ owner_syndic_mode: "volunteer", updated_at: new Date().toISOString() })
      .eq("id", buildingId);

    // Promote profile to syndic role if not already
    await serviceClient
      .from("profiles")
      .update({ role: "syndic" })
      .eq("id", profileId)
      .eq("role", "owner");

    return NextResponse.json({ success: true, site_id: siteId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

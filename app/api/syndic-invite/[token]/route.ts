export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/syndic-invite/[token]
 * Endpoint public (pas d'auth requise) qui retourne les infos pré-remplies
 * de l'invitation à partir du token. Utilisé par /auth/syndic-invite/[token].
 *
 * POST /api/syndic-invite/[token]
 * Endpoint authentifié appelé après l'inscription du syndic. Crée le site,
 * rattache le building, et marque l'invitation comme redeemed.
 */

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { getServiceClient } from "@/lib/supabase/service-client";

interface RouteParams {
  params: Promise<{ token: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { token } = await params;
    if (!token || token.length < 16) {
      return NextResponse.json({ error: "Token invalide" }, { status: 400 });
    }

    const serviceClient = getServiceClient();

    const { data: invitation } = await serviceClient
      .from("syndic_invitations_public")
      .select(
        "id, status, expires_at, suggested_syndic_name, suggested_syndic_email, suggested_syndic_phone, suggested_copro_name, message, building:buildings(name, adresse_complete, code_postal, ville, total_lots_in_building), invited_by:profiles!syndic_invitations_public_invited_by_profile_id_fkey(prenom, nom)"
      )
      .eq("token", token)
      .maybeSingle();

    if (!invitation) {
      return NextResponse.json({ error: "Invitation introuvable" }, { status: 404 });
    }
    const inv = invitation as {
      status: string;
      expires_at: string;
      suggested_syndic_email: string;
    };

    if (inv.status !== "pending") {
      return NextResponse.json(
        { error: "Cette invitation a déjà été utilisée ou annulée." },
        { status: 410 }
      );
    }
    if (new Date(inv.expires_at) < new Date()) {
      return NextResponse.json({ error: "Cette invitation a expiré." }, { status: 410 });
    }

    return NextResponse.json(invitation);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { token } = await params;
    const { user, error: authError } = await getAuthenticatedUser(request);
    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const serviceClient = getServiceClient();

    const { data: invitation } = await serviceClient
      .from("syndic_invitations_public")
      .select(
        "id, status, expires_at, building_id, suggested_copro_name, building:buildings(name, adresse_complete, code_postal, ville, total_lots_in_building)"
      )
      .eq("token", token)
      .maybeSingle();

    if (!invitation) {
      return NextResponse.json({ error: "Invitation introuvable" }, { status: 404 });
    }
    const inv = invitation as {
      id: string;
      status: string;
      expires_at: string;
      building_id: string;
      suggested_copro_name: string | null;
      building: {
        name: string | null;
        adresse_complete: string | null;
        code_postal: string | null;
        ville: string | null;
        total_lots_in_building: number | null;
      };
    };

    if (inv.status !== "pending") {
      return NextResponse.json(
        { error: "Invitation déjà utilisée ou annulée." },
        { status: 410 }
      );
    }
    if (new Date(inv.expires_at) < new Date()) {
      return NextResponse.json({ error: "Invitation expirée." }, { status: 410 });
    }

    // Récupère le profile du syndic fraîchement inscrit
    const { data: syndicProfile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!syndicProfile) {
      return NextResponse.json(
        { error: "Inscrivez-vous d'abord sur Talok puis revenez sur ce lien." },
        { status: 400 }
      );
    }
    const syndicProfileId = (syndicProfile as { id: string }).id;
    const syndicProfileRole = (syndicProfile as { role: string }).role;

    // P0 fix : on NE mute PLUS profiles.role.
    // Un owner qui accepte une invitation conserve son rôle ; l'accès au
    // namespace /syndic/** est accordé via sites.syndic_profile_id (cf.
    // app/syndic/layout.tsx). Mutation silencieuse interdite — elle bloquait
    // l'accès à /owner/** sans rollback possible.
    // Si le rôle actuel est étranger au syndic (ex: tenant, provider), on
    // refuse plutôt que d'écraser l'identité.
    const acceptableRoles = ["owner", "syndic", "admin", "platform_admin"];
    if (!acceptableRoles.includes(syndicProfileRole)) {
      return NextResponse.json(
        {
          error:
            "Votre compte ne peut pas devenir syndic d'une copropriété. Inscrivez-vous avec un compte propriétaire ou syndic dédié.",
        },
        { status: 403 }
      );
    }

    // Crée le site avec le syndic comme gestionnaire
    const { data: site, error: siteError } = await serviceClient
      .from("sites")
      .insert({
        name:
          inv.suggested_copro_name ??
          inv.building.name ??
          inv.building.adresse_complete ??
          "Copropriété",
        address_line1: inv.building.adresse_complete ?? "",
        postal_code: inv.building.code_postal ?? "",
        city: inv.building.ville ?? "",
        syndic_profile_id: syndicProfileId,
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

    // Crée la liaison building ↔ site (auto-approuvée car invitation explicite)
    await serviceClient.from("building_site_links").insert({
      building_id: inv.building_id,
      site_id: siteId,
      status: "approved",
      claimed_by_profile_id: syndicProfileId,
      decided_by_profile_id: syndicProfileId,
      decided_at: new Date().toISOString(),
      claim_message: "Rattachement automatique via invitation publique d'un copropriétaire.",
      decision_reason: "auto-approuvé (invitation publique)",
    });

    // Trace explicite du rôle syndic sur ce site (source de vérité granulaire).
    // Permet au layout /syndic de reconnaître l'utilisateur même si son
    // profiles.role reste 'owner'.
    const { data: syndicUserId } = await serviceClient
      .from("profiles")
      .select("user_id")
      .eq("id", syndicProfileId)
      .maybeSingle();
    const userId = (syndicUserId as { user_id: string } | null)?.user_id;
    if (userId) {
      await serviceClient
        .from("user_site_roles")
        .insert({ user_id: userId, site_id: siteId, role_code: "syndic" })
        .select();
    }

    // Marque l'invitation comme redeemed
    await serviceClient
      .from("syndic_invitations_public")
      .update({
        status: "redeemed",
        redeemed_at: new Date().toISOString(),
        redeemed_by_user_id: user.id,
        resulting_site_id: siteId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", inv.id);

    return NextResponse.json({ success: true, site_id: siteId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/buildings/[id]/match-sites?q=...
 *
 * Cherche des sites syndic Talok :
 *   - sans `q` : auto-suggestion par code postal + ville du building
 *   - avec `q` : recherche libre sur le nom du site, ou sur la raison
 *     sociale / SIRET / numéro de carte pro du syndic
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

    const { searchParams } = new URL(request.url);
    const query = (searchParams.get("q") ?? "").trim();
    const codePostal = (building as { code_postal: string | null }).code_postal;
    const ville = (building as { ville: string | null }).ville;

    // Mode auto-suggestion : code postal + ville
    if (!query) {
      if (!codePostal || !ville) {
        return NextResponse.json([]);
      }
      const { data: sites } = await serviceClient
        .from("sites")
        .select("id, name, address_line1, postal_code, city, syndic_profile_id, is_active")
        .eq("postal_code", codePostal)
        .ilike("city", ville)
        .eq("is_active", true)
        .limit(20);
      return NextResponse.json(sites ?? []);
    }

    // Mode recherche libre : par nom de site OU raison sociale / SIRET / carte pro du syndic
    const sanitized = query.replace(/[%_]/g, "").slice(0, 100);
    const isDigitsOnly = /^\d+$/.test(sanitized.replace(/\s/g, ""));

    // 1. Match sur sites par name
    const sitesByName = await serviceClient
      .from("sites")
      .select("id, name, address_line1, postal_code, city, syndic_profile_id, is_active")
      .eq("is_active", true)
      .ilike("name", `%${sanitized}%`)
      .limit(15);

    // 2. Match sur syndic_profiles (raison_sociale, siret, numero_carte_pro)
    let syndicProfileIds: string[] = [];
    {
      let q = serviceClient
        .from("syndic_profiles")
        .select("profile_id")
        .limit(20);
      if (isDigitsOnly) {
        q = q.or(
          `siret.ilike.%${sanitized.replace(/\s/g, "")}%,numero_carte_pro.ilike.%${sanitized}%`
        );
      } else {
        q = q.or(`raison_sociale.ilike.%${sanitized}%,numero_carte_pro.ilike.%${sanitized}%`);
      }
      const { data } = await q;
      syndicProfileIds = (data ?? []).map((r) => (r as { profile_id: string }).profile_id);
    }

    let sitesBySyndic: unknown[] = [];
    if (syndicProfileIds.length > 0) {
      const { data } = await serviceClient
        .from("sites")
        .select("id, name, address_line1, postal_code, city, syndic_profile_id, is_active")
        .eq("is_active", true)
        .in("syndic_profile_id", syndicProfileIds)
        .limit(15);
      sitesBySyndic = data ?? [];
    }

    // Dédoublonne par site.id
    const seen = new Set<string>();
    const merged = [...((sitesByName.data ?? []) as Array<{ id: string }>), ...(sitesBySyndic as Array<{ id: string }>)].filter((s) => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });

    return NextResponse.json(merged.slice(0, 20));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

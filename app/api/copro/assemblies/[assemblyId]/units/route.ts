export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/copro/assemblies/[assemblyId]/units
 *
 * Retourne la liste des lots du site de l'assemblée, avec :
 * - lot_number, type, surface
 * - owner_profile_id + owner_name
 * - tantieme_general
 * - total de tantièmes du site
 *
 * Utilisé par la page live pour la saisie des votes (autocomplete).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAssemblyAccess } from "@/lib/helpers/syndic-auth";

interface RouteParams {
  params: { assemblyId: string };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const access = await requireAssemblyAccess(request, params.assemblyId);
  if (access instanceof NextResponse) return access;

  const { auth, assembly } = access;

  try {
    // Charger les lots actifs du site
    const { data: units, error: unitsError } = await auth.serviceClient
      .from("copro_units")
      .select("id, lot_number, type, surface, tantieme_general, tantiemes_speciaux, owner_profile_id")
      .eq("site_id", assembly.site_id)
      .eq("is_active", true)
      .order("lot_number", { ascending: true });

    if (unitsError) throw unitsError;

    // Charger les propriétaires
    const ownerIds = ((units || []) as any[])
      .map((u) => u.owner_profile_id)
      .filter((id): id is string => !!id);

    const ownersMap = new Map<string, { prenom: string; nom: string }>();
    if (ownerIds.length > 0) {
      const { data: owners } = await auth.serviceClient
        .from("profiles")
        .select("id, prenom, nom")
        .in("id", ownerIds);

      for (const owner of (owners || []) as any[]) {
        ownersMap.set(owner.id, {
          prenom: owner.prenom || "",
          nom: owner.nom || "",
        });
      }
    }

    // Charger les totaux tantièmes du site
    const { data: site } = await auth.serviceClient
      .from("sites")
      .select("total_tantiemes_general, name")
      .eq("id", assembly.site_id)
      .single();

    // Enrichir les lots avec owner_name
    const enrichedUnits = ((units || []) as any[]).map((u) => {
      const owner = u.owner_profile_id ? ownersMap.get(u.owner_profile_id) : null;
      const ownerName = owner
        ? `${owner.prenom} ${owner.nom}`.trim() || "Sans nom"
        : "Non assigné";
      return {
        id: u.id,
        lot_number: u.lot_number,
        type: u.type,
        surface: u.surface,
        tantieme_general: u.tantieme_general,
        tantiemes_speciaux: u.tantiemes_speciaux || {},
        owner_profile_id: u.owner_profile_id,
        owner_name: ownerName,
      };
    });

    return NextResponse.json({
      units: enrichedUnits,
      site: {
        name: (site as any)?.name || "Copropriété",
        total_tantiemes_general: (site as any)?.total_tantiemes_general || 10000,
      },
      total_units: enrichedUnits.length,
    });
  } catch (error) {
    console.error("[assembly:units:GET]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /api/copro/councils
 * GET  — Liste les conseils syndicaux (d'un site ou de tous)
 * POST — Crée un nouveau conseil syndical
 */

import { NextRequest, NextResponse } from "next/server";
import { requireSyndic } from "@/lib/helpers/syndic-auth";
import { checkCoproFeatureForProfile } from "@/lib/helpers/copro-feature-gate";
import { CreateCouncilSchema } from "@/lib/validations/syndic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const siteId = searchParams.get("siteId");
  const status = searchParams.get("status");

  const auth = await requireSyndic(request, { siteId });
  if (auth instanceof NextResponse) return auth;

  try {
    let query = auth.serviceClient
      .from("copro_councils")
      .select("*")
      .order("mandate_start", { ascending: false });

    if (siteId) {
      query = query.eq("site_id", siteId);
    } else if (!auth.isAdmin) {
      // Restreindre aux sites gérés par ce syndic
      const { data: mySites } = await auth.serviceClient
        .from("sites")
        .select("id")
        .eq("syndic_profile_id", auth.profile.id);
      const siteIds = (mySites || []).map((s: any) => s.id);
      if (siteIds.length === 0) return NextResponse.json([]);
      query = query.in("site_id", siteIds);
    }

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error) {
    console.error("[councils:GET]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parseResult = CreateCouncilSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const input = parseResult.data;

    const auth = await requireSyndic(request, { siteId: input.site_id });
    if (auth instanceof NextResponse) return auth;

    // S1-2 : feature gate copro_module
    const gateError = await checkCoproFeatureForProfile(auth.profile.id);
    if (gateError) return gateError;

    // Validation dates
    const mandateStart = new Date(input.mandate_start);
    const mandateEnd = new Date(input.mandate_end);
    if (mandateEnd <= mandateStart) {
      return NextResponse.json(
        { error: "La date de fin de mandat doit être postérieure à la date de début" },
        { status: 400 }
      );
    }

    const { data: council, error } = await auth.serviceClient
      .from("copro_councils")
      .insert({
        site_id: input.site_id,
        mandate_start: input.mandate_start,
        mandate_end: input.mandate_end,
        president_profile_id: input.president_profile_id || null,
        president_unit_id: input.president_unit_id || null,
        vice_president_profile_id: input.vice_president_profile_id || null,
        vice_president_unit_id: input.vice_president_unit_id || null,
        members: input.members,
        elected_in_assembly_id: input.elected_in_assembly_id || null,
        elected_resolution_id: input.elected_resolution_id || null,
        internal_rules_document_url: input.internal_rules_document_url || null,
        notes: input.notes || null,
        status: "active",
      })
      .select()
      .single();

    if (error) {
      // Index unique sur (site_id) WHERE status='active'
      if ((error as any).code === "23505") {
        return NextResponse.json(
          {
            error: "Un conseil syndical actif existe déjà pour ce site. Dissolvez-le d'abord.",
          },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json(council, { status: 201 });
  } catch (error) {
    console.error("[councils:POST]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

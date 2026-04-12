export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /api/copro/assemblies
 * GET  — Liste les assemblées d'un site (ou de tous les sites gérés)
 * POST — Crée une nouvelle assemblée (statut 'draft')
 *
 * SOTA 2026 — utilise la table copro_assemblies créée en migration
 * 20260411140000. Réécrit pour remplacer la version cassée qui pointait
 * vers une table `assemblies` inexistante.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireSyndic } from "@/lib/helpers/syndic-auth";
import { checkCoproFeatureForProfile } from "@/lib/helpers/copro-feature-gate";
import { CreateAssemblySchema } from "@/lib/validations/syndic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const siteId = searchParams.get("siteId");
  const status = searchParams.get("status");
  const upcoming = searchParams.get("upcoming") === "true";

  const auth = await requireSyndic(request, { siteId });
  if (auth instanceof NextResponse) return auth;

  try {
    let query = auth.serviceClient
      .from("copro_assemblies")
      .select("*")
      .order("scheduled_at", { ascending: upcoming });

    if (siteId) {
      query = query.eq("site_id", siteId);
    } else if (!auth.isAdmin) {
      // Restreindre aux sites gérés par ce syndic
      const { data: mySites } = await auth.serviceClient
        .from("sites")
        .select("id")
        .eq("syndic_profile_id", auth.profile.id);
      const siteIds = (mySites || []).map((s: any) => s.id);
      if (siteIds.length === 0) {
        return NextResponse.json([]);
      }
      query = query.in("site_id", siteIds);
    }

    if (status) {
      query = query.eq("status", status);
    }

    if (upcoming) {
      query = query
        .in("status", ["draft", "convened", "in_progress"])
        .gte("scheduled_at", new Date().toISOString());
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error) {
    console.error("[assemblies:GET]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parseResult = CreateAssemblySchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const input = parseResult.data;

    const auth = await requireSyndic(request, { siteId: input.site_id });
    if (auth instanceof NextResponse) return auth;

    // S1-2 : feature gate copro_module (bloque les plans Gratuit/Starter)
    const gateError = await checkCoproFeatureForProfile(auth.profile.id);
    if (gateError) return gateError;

    // Générer un numéro de référence si absent
    let referenceNumber = input.reference_number;
    if (!referenceNumber) {
      const year = new Date(input.scheduled_at).getFullYear();
      const typePrefix = {
        ordinaire: "AGO",
        extraordinaire: "AGE",
        concertation: "CONC",
        consultation_ecrite: "CE",
      }[input.assembly_type];

      const { count } = await auth.serviceClient
        .from("copro_assemblies")
        .select("id", { count: "exact", head: true })
        .eq("site_id", input.site_id)
        .eq("assembly_type", input.assembly_type)
        .gte("scheduled_at", `${year}-01-01`)
        .lte("scheduled_at", `${year}-12-31`);

      referenceNumber = `${typePrefix}-${year}-${String((count || 0) + 1).padStart(3, "0")}`;
    }

    const { data: assembly, error } = await auth.serviceClient
      .from("copro_assemblies")
      .insert({
        site_id: input.site_id,
        assembly_type: input.assembly_type,
        title: input.title,
        reference_number: referenceNumber,
        fiscal_year: input.fiscal_year ?? new Date(input.scheduled_at).getFullYear(),
        scheduled_at: input.scheduled_at,
        location: input.location || null,
        location_address: input.location_address || null,
        online_meeting_url: input.online_meeting_url || null,
        is_hybrid: input.is_hybrid,
        quorum_required: input.quorum_required ?? null,
        description: input.description || null,
        notes: input.notes || null,
        status: "draft",
        created_by: auth.user.id,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(assembly, { status: 201 });
  } catch (error) {
    console.error("[assemblies:POST]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /api/copro/assemblies/[assemblyId]/resolutions
 * GET  — Liste des résolutions d'une AG (ordre du jour)
 * POST — Ajoute une résolution à l'AG
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAssemblyAccess } from "@/lib/helpers/syndic-auth";
import { CreateResolutionSchema } from "@/lib/validations/syndic";

interface RouteParams {
  params: { assemblyId: string };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const access = await requireAssemblyAccess(request, params.assemblyId);
  if (access instanceof NextResponse) return access;

  const { auth, assembly } = access;

  try {
    const { data, error } = await auth.serviceClient
      .from("copro_resolutions")
      .select("*")
      .eq("assembly_id", assembly.id)
      .order("resolution_number", { ascending: true });

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error) {
    console.error("[resolutions:GET]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const access = await requireAssemblyAccess(request, params.assemblyId);
  if (access instanceof NextResponse) return access;

  const { auth, assembly } = access;

  // Ne pas ajouter de résolution à une AG déjà tenue ou annulée
  if (!["draft", "convened", "in_progress"].includes(assembly.status)) {
    return NextResponse.json(
      {
        error: `Impossible d'ajouter une résolution à une assemblée en statut '${assembly.status}'`,
      },
      { status: 409 }
    );
  }

  try {
    const body = await request.json();
    const parseResult = CreateResolutionSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const input = parseResult.data;

    const { data: resolution, error } = await auth.serviceClient
      .from("copro_resolutions")
      .insert({
        assembly_id: assembly.id,
        site_id: assembly.site_id,
        resolution_number: input.resolution_number,
        title: input.title,
        description: input.description,
        category: input.category,
        majority_rule: input.majority_rule,
        estimated_amount_cents: input.estimated_amount_cents || null,
        contract_partner: input.contract_partner || null,
        attached_documents: input.attached_documents || [],
        status: "proposed",
      })
      .select()
      .single();

    if (error) {
      // Contrainte unique sur (assembly_id, resolution_number)
      if ((error as any).code === "23505") {
        return NextResponse.json(
          { error: `Une résolution avec le numéro ${input.resolution_number} existe déjà` },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json(resolution, { status: 201 });
  } catch (error) {
    console.error("[resolutions:POST]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/copro/assemblies/[assemblyId]/close
 *
 * Clôture la session de l'assemblée :
 * - Valide que le statut est 'in_progress'
 * - Enregistre la date effective de tenue (held_at)
 * - Transition : in_progress → held
 *
 * Note : les résolutions conservent leur statut de vote.
 * Le PV peut ensuite être créé via POST /api/copro/assemblies/[id]/minutes
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAssemblyAccess } from "@/lib/helpers/syndic-auth";
import { CloseAssemblySchema } from "@/lib/validations/syndic";

interface RouteParams {
  params: { assemblyId: string };
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const access = await requireAssemblyAccess(request, params.assemblyId);
  if (access instanceof NextResponse) return access;

  const { auth, assembly } = access;

  if (assembly.status !== "in_progress") {
    return NextResponse.json(
      {
        error: `Impossible de clôturer : l'assemblée doit être en statut 'in_progress' (actuellement: '${assembly.status}')`,
      },
      { status: 409 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const parseResult = CloseAssemblySchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const input = parseResult.data;
    const heldAt = input.held_at || new Date().toISOString();

    const { data: updated, error: updateError } = await auth.serviceClient
      .from("copro_assemblies")
      .update({
        status: "held",
        held_at: heldAt,
        notes: input.final_notes || undefined,
        updated_at: new Date().toISOString(),
      })
      .eq("id", assembly.id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Compter les résolutions et leur statut pour le résumé
    const { data: resolutions } = await auth.serviceClient
      .from("copro_resolutions")
      .select("status")
      .eq("assembly_id", assembly.id);

    const summary = (resolutions || []).reduce<Record<string, number>>((acc, r: any) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      success: true,
      assembly: updated,
      resolutions_summary: summary,
      message: "Session clôturée. Vous pouvez maintenant générer le procès-verbal.",
    });
  } catch (error) {
    console.error("[assembly:close]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

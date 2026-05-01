export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/copro/assemblies/[assemblyId]/start
 *
 * Démarre la session de l'assemblée :
 * - Valide que le statut est 'convened' (convocations envoyées)
 * - Enregistre le bureau (président, secrétaire, scrutateurs)
 * - Enregistre les tantièmes présents/représentés
 * - Calcule automatiquement si le quorum est atteint
 * - Transition : convened → in_progress
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAssemblyAccess } from "@/lib/helpers/syndic-auth";
import { StartAssemblySchema } from "@/lib/validations/syndic";
import { logCoproAction } from "@/lib/audit/copro-audit";

interface RouteParams {
  params: { assemblyId: string };
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const access = await requireAssemblyAccess(request, params.assemblyId);
  if (access instanceof NextResponse) return access;

  const { auth, assembly } = access;

  if (assembly.status !== "convened") {
    return NextResponse.json(
      {
        error: `Impossible de démarrer : l'assemblée doit être en statut 'convened' (actuellement: '${assembly.status}'). Envoyez d'abord les convocations.`,
      },
      { status: 409 }
    );
  }

  try {
    const body = await request.json();
    const parseResult = StartAssemblySchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const input = parseResult.data;

    // Récupérer l'assemblée complète pour comparer au quorum requis
    const { data: assemblyFull, error: assemblyError } = await auth.serviceClient
      .from("copro_assemblies")
      .select("id, site_id, quorum_required")
      .eq("id", assembly.id)
      .single();

    if (assemblyError || !assemblyFull) {
      return NextResponse.json({ error: "Assemblée introuvable" }, { status: 404 });
    }

    // Calculer si le quorum est atteint
    const quorumRequired = (assemblyFull as any).quorum_required;
    const quorumReached =
      quorumRequired === null || quorumRequired === undefined
        ? true // Pas de quorum requis = toujours atteint
        : input.present_tantiemes >= quorumRequired;

    const now = new Date().toISOString();

    const { data: updated, error: updateError } = await auth.serviceClient
      .from("copro_assemblies")
      .update({
        status: "in_progress",
        presided_by: input.presided_by || null,
        secretary_profile_id: input.secretary_profile_id || null,
        scrutineers: input.scrutineers || [],
        present_tantiemes: input.present_tantiemes,
        quorum_reached: quorumReached,
        updated_at: now,
      })
      .eq("id", assembly.id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Audit trail (action high : démarrage AG en mode live)
    await logCoproAction({
      userId: auth.user.id,
      profileId: auth.profile.id,
      action: "start",
      entityType: "copro_assembly",
      entityId: assembly.id,
      siteId: (assemblyFull as any).site_id,
      metadata: {
        present_tantiemes: input.present_tantiemes,
        quorum_required: quorumRequired,
        quorum_reached: quorumReached,
        presided_by: input.presided_by ?? null,
        scrutineers_count: (input.scrutineers ?? []).length,
      },
      request,
    });

    return NextResponse.json({
      success: true,
      assembly: updated,
      quorum_reached: quorumReached,
      message: quorumReached
        ? "Session démarrée, quorum atteint"
        : "Session démarrée MAIS quorum NON atteint — seuls les votes à la majorité simple seront valides",
    });
  } catch (error) {
    console.error("[assembly:start]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /api/copro/assemblies/[assemblyId]/minutes
 * GET  — Liste les PV (versions) d'une AG
 * POST — Crée un nouveau PV (version incrémentée)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAssemblyAccess } from "@/lib/helpers/syndic-auth";
import { CreateMinuteSchema } from "@/lib/validations/syndic";

interface RouteParams {
  params: { assemblyId: string };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const access = await requireAssemblyAccess(request, params.assemblyId);
  if (access instanceof NextResponse) return access;

  const { auth, assembly } = access;

  try {
    const { data, error } = await auth.serviceClient
      .from("copro_minutes")
      .select("*")
      .eq("assembly_id", assembly.id)
      .order("version", { ascending: false });

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error) {
    console.error("[minutes:GET]", error);
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

  // Ne créer un PV que pour une AG tenue
  if (!["held", "in_progress"].includes(assembly.status)) {
    return NextResponse.json(
      { error: "Le PV ne peut être créé que pour une assemblée tenue ou en cours" },
      { status: 409 }
    );
  }

  try {
    const body = await request.json();
    const parseResult = CreateMinuteSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const input = parseResult.data;

    // Déterminer la prochaine version
    const { data: existingMinutes } = await auth.serviceClient
      .from("copro_minutes")
      .select("version")
      .eq("assembly_id", assembly.id)
      .order("version", { ascending: false })
      .limit(1);

    const nextVersion = existingMinutes && existingMinutes.length > 0
      ? ((existingMinutes[0] as any).version as number) + 1
      : 1;

    // Calcul du délai de contestation (2 mois à partir de la notification)
    const contestationDeadline = new Date();
    contestationDeadline.setMonth(contestationDeadline.getMonth() + 2);

    const { data: minute, error } = await auth.serviceClient
      .from("copro_minutes")
      .insert({
        assembly_id: assembly.id,
        site_id: assembly.site_id,
        version: nextVersion,
        content: input.content || {},
        content_html: input.content_html || null,
        document_url: input.document_url || null,
        status: "draft",
        contestation_deadline: contestationDeadline.toISOString(),
        created_by: auth.user.id,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(minute, { status: 201 });
  } catch (error) {
    console.error("[minutes:POST]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

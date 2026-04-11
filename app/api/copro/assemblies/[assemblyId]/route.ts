export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /api/copro/assemblies/[assemblyId]
 * GET    — Récupère une assemblée avec ses résolutions
 * PATCH  — Met à jour une assemblée (uniquement en status 'draft' ou 'convened')
 * DELETE — Annule une assemblée (soft delete via status='cancelled')
 *
 * SOTA 2026 — utilise copro_assemblies
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAssemblyAccess } from "@/lib/helpers/syndic-auth";
import { UpdateAssemblySchema } from "@/lib/validations/syndic";

interface RouteParams {
  params: { assemblyId: string };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const access = await requireAssemblyAccess(request, params.assemblyId);
  if (access instanceof NextResponse) return access;

  const { auth, assembly } = access;

  try {
    // Récupérer l'assemblée complète avec ses résolutions
    const { data: assemblyDetail, error: assemblyError } = await auth.serviceClient
      .from("copro_assemblies")
      .select("*")
      .eq("id", assembly.id)
      .single();

    if (assemblyError) throw assemblyError;

    const { data: resolutions } = await auth.serviceClient
      .from("copro_resolutions")
      .select("*")
      .eq("assembly_id", assembly.id)
      .order("resolution_number", { ascending: true });

    const { data: convocations } = await auth.serviceClient
      .from("copro_convocations")
      .select("id, status, delivery_method, sent_at, delivered_at, recipient_name")
      .eq("assembly_id", assembly.id);

    const { data: minutes } = await auth.serviceClient
      .from("copro_minutes")
      .select("id, version, status, signed_by_president_at, distributed_at")
      .eq("assembly_id", assembly.id)
      .order("version", { ascending: false });

    return NextResponse.json({
      assembly: assemblyDetail,
      resolutions: resolutions || [],
      convocations: convocations || [],
      minutes: minutes || [],
    });
  } catch (error) {
    console.error("[assembly:GET]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const access = await requireAssemblyAccess(request, params.assemblyId);
  if (access instanceof NextResponse) return access;

  const { auth, assembly } = access;

  // Ne pas autoriser la modification d'une AG déjà tenue ou annulée
  if (!["draft", "convened"].includes(assembly.status)) {
    return NextResponse.json(
      {
        error: `Impossible de modifier une assemblée en statut '${assembly.status}'. Seules les assemblées 'draft' ou 'convened' sont modifiables.`,
      },
      { status: 409 }
    );
  }

  try {
    const body = await request.json();
    const parseResult = UpdateAssemblySchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const updates = parseResult.data;

    const { data: updated, error } = await auth.serviceClient
      .from("copro_assemblies")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", assembly.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[assembly:PATCH]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const access = await requireAssemblyAccess(request, params.assemblyId);
  if (access instanceof NextResponse) return access;

  const { auth, assembly } = access;

  // Ne pas supprimer une AG déjà tenue
  if (assembly.status === "held") {
    return NextResponse.json(
      { error: "Impossible d'annuler une assemblée déjà tenue" },
      { status: 409 }
    );
  }

  try {
    const { error } = await auth.serviceClient
      .from("copro_assemblies")
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", assembly.id);

    if (error) throw error;

    return NextResponse.json({ success: true, message: "Assemblée annulée" });
  } catch (error) {
    console.error("[assembly:DELETE]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

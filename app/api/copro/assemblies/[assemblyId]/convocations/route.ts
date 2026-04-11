export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /api/copro/assemblies/[assemblyId]/convocations
 * GET  — Liste des convocations envoyées pour une AG
 * POST — Crée un batch de convocations pour une AG (une par unit_id)
 *
 * Note : l'envoi réel (email/postal) est géré par un job séparé.
 * Cette route crée uniquement les enregistrements en DB avec status='pending'.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAssemblyAccess } from "@/lib/helpers/syndic-auth";
import { CreateConvocationsBatchSchema } from "@/lib/validations/syndic";

interface RouteParams {
  params: { assemblyId: string };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const access = await requireAssemblyAccess(request, params.assemblyId);
  if (access instanceof NextResponse) return access;

  const { auth, assembly } = access;

  try {
    const { data, error } = await auth.serviceClient
      .from("copro_convocations")
      .select("*")
      .eq("assembly_id", assembly.id)
      .order("created_at", { ascending: true });

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error) {
    console.error("[convocations:GET]", error);
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

  // Ne convoquer que les AG en status 'draft' ou 'convened'
  if (!["draft", "convened"].includes(assembly.status)) {
    return NextResponse.json(
      { error: `Impossible de convoquer une assemblée en statut '${assembly.status}'` },
      { status: 409 }
    );
  }

  try {
    const body = await request.json();
    const parseResult = CreateConvocationsBatchSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const input = parseResult.data;

    // Récupérer les unités cibles : soit spécifiques, soit toutes les unités actives du site
    let unitsQuery = auth.serviceClient
      .from("copro_units")
      .select("id, lot_number, owner_profile_id, type")
      .eq("site_id", assembly.site_id)
      .eq("is_active", true);

    if (input.unit_ids && input.unit_ids.length > 0) {
      unitsQuery = unitsQuery.in("id", input.unit_ids);
    }

    const { data: units, error: unitsError } = await unitsQuery;
    if (unitsError) throw unitsError;

    if (!units || units.length === 0) {
      return NextResponse.json(
        { error: "Aucune unité trouvée pour cette convocation" },
        { status: 404 }
      );
    }

    // Récupérer les profils des propriétaires pour remplir les destinataires
    const ownerIds = units
      .map((u: any) => u.owner_profile_id)
      .filter((id: string | null): id is string => !!id);

    const ownersMap = new Map<string, { prenom: string; nom: string; email: string }>();
    if (ownerIds.length > 0) {
      const { data: owners } = await auth.serviceClient
        .from("profiles")
        .select("id, prenom, nom, email")
        .in("id", ownerIds);

      for (const owner of (owners || []) as any[]) {
        ownersMap.set(owner.id, {
          prenom: owner.prenom || "",
          nom: owner.nom || "",
          email: owner.email || "",
        });
      }
    }

    // Préparer les insertions
    const now = new Date().toISOString();
    const convocationsToInsert = (units as any[]).map((unit) => {
      const owner = unit.owner_profile_id ? ownersMap.get(unit.owner_profile_id) : null;
      const recipientName = owner
        ? `${owner.prenom} ${owner.nom}`.trim() || `Lot ${unit.lot_number}`
        : `Lot ${unit.lot_number} (non assigné)`;

      return {
        assembly_id: assembly.id,
        site_id: assembly.site_id,
        unit_id: unit.id,
        recipient_profile_id: unit.owner_profile_id || null,
        recipient_name: recipientName,
        recipient_email: owner?.email || null,
        delivery_method: input.delivery_method,
        status: "pending" as const,
        convocation_document_url: input.convocation_document_url || null,
        ordre_du_jour_document_url: input.ordre_du_jour_document_url || null,
      };
    });

    const { data: inserted, error: insertError } = await auth.serviceClient
      .from("copro_convocations")
      .insert(convocationsToInsert)
      .select();

    if (insertError) throw insertError;

    // Passer l'AG en status 'convened' si elle était en 'draft'
    if (assembly.status === "draft") {
      await auth.serviceClient
        .from("copro_assemblies")
        .update({
          status: "convened",
          first_convocation_sent_at: now,
          updated_at: now,
        })
        .eq("id", assembly.id);
    }

    return NextResponse.json(
      {
        success: true,
        count: inserted?.length || 0,
        convocations: inserted,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[convocations:POST]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

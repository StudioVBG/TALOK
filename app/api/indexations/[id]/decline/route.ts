export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";

/**
 * POST /api/indexations/[id]/decline - Refuser une révision IRL
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const serviceClient = getServiceClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const indexationId = params.id;

    // Récupérer les données optionnelles
    let body: { reason?: string } = {};
    try {
      body = await request.json();
    } catch {
      // Body vide, c'est OK
    }

    // Récupérer l'indexation
    const { data: indexation, error: indexError } = await serviceClient
      .from("lease_indexations")
      .select(`
        *,
        lease:lease_id (
          id,
          property:property_id (
            id,
            owner_id
          )
        )
      `)
      .eq("id", indexationId)
      .single();

    if (indexError || !indexation) {
      return NextResponse.json(
        { error: "Indexation non trouvée" },
        { status: 404 }
      );
    }

    // Vérifier les permissions
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    const profileData = profile as any;
    const indexData = indexation as any;
    const isAdmin = profileData?.role === "admin";
    const isOwner = indexData.lease?.property?.owner_id === profileData?.id;

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: "Seul le propriétaire peut refuser une révision" },
        { status: 403 }
      );
    }

    // Vérifier le statut
    if (indexData.status !== "pending") {
      return NextResponse.json(
        { error: "Cette révision a déjà été traitée" },
        { status: 400 }
      );
    }

    // Marquer l'indexation comme refusée
    const { error: updateError } = await serviceClient
      .from("lease_indexations")
      .update({
        status: "declined",
        declined_at: new Date().toISOString(),
        decline_reason: body.reason || null,
      })
      .eq("id", indexationId);

    if (updateError) {
      console.error("[decline] Erreur mise à jour:", updateError);
      throw updateError;
    }

    // Journaliser
    await serviceClient.from("audit_log").insert({
      user_id: user.id,
      action: "irl_indexation_declined",
      entity_type: "lease_indexation",
      entity_id: indexationId,
      metadata: {
        lease_id: indexData.lease_id,
        old_rent: indexData.old_rent,
        new_rent: indexData.new_rent,
        reason: body.reason,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Révision refusée",
    });
  } catch (error: unknown) {
    console.error("[decline] Erreur:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}


export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import {
  verifyEDLAccess,
  createServiceClient,
  getUserProfile,
} from "@/lib/helpers/edl-auth";
import { applyRateLimit } from "@/lib/middleware/rate-limit";

/**
 * POST /api/edl/[id]/duplicate - Dupliquer un EDL (entrée → sortie)
 *
 * Crée une copie de l'EDL d'entrée comme base pour l'EDL de sortie,
 * en conservant la structure des pièces et éléments mais en réinitialisant
 * les conditions, notes, photos et signatures.
 *
 * Body optionnel:
 *   - scheduled_at?: string (ISO date pour la date de sortie)
 *   - type?: "sortie" (défaut)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Rate limiting (strict pour opération lourde)
    const rateLimitResponse = applyRateLimit(request, "edlDuplicate");
    if (rateLimitResponse) return rateLimitResponse;

    const { id: sourceEdlId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const serviceClient = createServiceClient();

    // Récupérer le profil
    const profile = await getUserProfile(serviceClient, user.id);
    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // Vérifier les permissions
    const accessResult = await verifyEDLAccess(
      {
        edlId: sourceEdlId,
        userId: user.id,
        profileId: profile.id,
        profileRole: profile.role,
      },
      serviceClient
    );

    if (!accessResult.authorized) {
      return NextResponse.json(
        { error: accessResult.reason || "Accès non autorisé" },
        { status: accessResult.edl ? 403 : 404 }
      );
    }

    // Seul le propriétaire ou admin peut dupliquer
    if (
      accessResult.accessType !== "owner" &&
      accessResult.accessType !== "admin" &&
      accessResult.accessType !== "creator"
    ) {
      return NextResponse.json(
        { error: "Seul le propriétaire peut dupliquer cet EDL" },
        { status: 403 }
      );
    }

    const sourceEdl = accessResult.edl;

    // Vérifier que l'EDL source est un EDL d'entrée signé/complété
    if (sourceEdl.type !== "entree") {
      return NextResponse.json(
        { error: "Seul un EDL d'entrée peut être dupliqué en EDL de sortie" },
        { status: 400 }
      );
    }

    // Optionnel: body avec date planifiée
    let body: { scheduled_at?: string; type?: string } = {};
    try {
      body = await request.json();
    } catch {
      // Body optionnel
    }

    const targetType = body.type || "sortie";

    // Vérifier qu'il n'existe pas déjà un EDL de sortie en cours
    const { data: existingEdl } = await serviceClient
      .from("edl")
      .select("id, status")
      .eq("lease_id", sourceEdl.lease_id)
      .eq("type", targetType)
      .in("status", ["draft", "scheduled", "in_progress"])
      .maybeSingle();

    if (existingEdl) {
      return NextResponse.json(
        {
          error: "Un EDL de sortie est déjà en cours pour ce bail",
          existing_edl_id: existingEdl.id,
        },
        { status: 409 }
      );
    }

    // Récupérer property_id
    const leaseData = Array.isArray(sourceEdl.lease)
      ? sourceEdl.lease[0]
      : sourceEdl.lease;
    const propertyId =
      sourceEdl.property_id || leaseData?.property_id || null;

    // 1. Créer le nouvel EDL
    const scheduledDate = body.scheduled_at
      ? new Date(body.scheduled_at).toISOString().split("T")[0]
      : null;

    const { data: newEdl, error: createError } = await serviceClient
      .from("edl")
      .insert({
        lease_id: sourceEdl.lease_id,
        property_id: propertyId,
        type: targetType,
        status: body.scheduled_at ? "scheduled" : "draft",
        scheduled_at: body.scheduled_at || null,
        scheduled_date: scheduledDate,
        created_by: user.id,
        keys: sourceEdl.keys || [],
      } as any)
      .select()
      .single();

    if (createError) {
      console.error("[duplicate] Create error:", createError);
      return NextResponse.json(
        { error: createError.message || "Erreur lors de la duplication" },
        { status: 500 }
      );
    }

    const newEdlData = newEdl as any;

    // 2. Dupliquer les items (pièces/éléments) avec conditions réinitialisées
    const { data: sourceItems } = await serviceClient
      .from("edl_items")
      .select("*")
      .eq("edl_id", sourceEdlId);

    if (sourceItems && sourceItems.length > 0) {
      const duplicatedItems = sourceItems.map((item: any) => ({
        edl_id: newEdlData.id,
        room_name: item.room_name,
        item_name: item.item_name,
        category: item.category,
        description: item.description,
        condition: null, // Réinitialiser pour la sortie
        notes: null, // Réinitialiser pour la sortie
      }));

      const { error: itemsError } = await serviceClient
        .from("edl_items")
        .insert(duplicatedItems);

      if (itemsError) {
        console.error("[duplicate] Items error:", itemsError);
      }
    }

    // 3. Injecter les signataires du bail
    const { data: leaseSigners } = await serviceClient
      .from("lease_signers")
      .select("profile_id, role")
      .eq("lease_id", sourceEdl.lease_id);

    if (leaseSigners && leaseSigners.length > 0) {
      const edlSignatures = leaseSigners.map((ls: any) => ({
        edl_id: newEdlData.id,
        signer_user: null,
        signer_profile_id: ls.profile_id,
        signer_role:
          ls.role === "proprietaire" || ls.role === "owner"
            ? "owner"
            : "tenant",
        invitation_token: crypto.randomUUID(),
      }));

      await serviceClient.from("edl_signatures").insert(edlSignatures);
    }

    // 4. Journaliser
    await serviceClient.from("audit_log").insert({
      user_id: user.id,
      action: "edl_duplicated",
      entity_type: "edl",
      entity_id: newEdlData.id,
      metadata: {
        source_edl_id: sourceEdlId,
        source_type: sourceEdl.type,
        target_type: targetType,
        items_count: sourceItems?.length || 0,
      },
    } as any);

    return NextResponse.json(
      {
        edl: newEdlData,
        source_edl_id: sourceEdlId,
        items_duplicated: sourceItems?.length || 0,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("[POST /api/edl/[id]/duplicate] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

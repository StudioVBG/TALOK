export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import {
  verifyEDLAccess,
  createServiceClient,
  getUserProfile,
} from "@/lib/helpers/edl-auth";

/**
 * POST /api/edl/[id]/validate - Valider/finaliser un EDL
 *
 * Vérifie la complétude de l'EDL (pièces, signatures) et le verrouille.
 * Seul le propriétaire ou admin peut valider.
 *
 * Body optionnel: { force?: boolean } pour forcer la validation sans signatures complètes
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: edlId } = await params;
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

    // Vérifier les permissions avec le helper SOTA
    const accessResult = await verifyEDLAccess(
      {
        edlId,
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

    // Seul le propriétaire, créateur ou admin peut valider
    if (
      accessResult.accessType !== "owner" &&
      accessResult.accessType !== "admin" &&
      accessResult.accessType !== "creator"
    ) {
      return NextResponse.json(
        { error: "Seul le propriétaire peut valider cet EDL" },
        { status: 403 }
      );
    }

    const edl = accessResult.edl;

    // Vérifier que l'EDL n'est pas déjà signé/validé
    if (edl.status === "signed") {
      return NextResponse.json(
        { error: "L'EDL est déjà signé et validé" },
        { status: 400 }
      );
    }

    // Optionnel: forcer la validation sans vérifications complètes
    let body: { force?: boolean } = {};
    try {
      body = await request.json();
    } catch {
      // Body optionnel
    }

    const validationErrors: string[] = [];

    // 1. Vérifier qu'il y a au moins une pièce/élément
    const { data: items, error: itemsError } = await serviceClient
      .from("edl_items")
      .select("id")
      .eq("edl_id", edlId)
      .limit(1);

    if (itemsError) {
      console.error("[validate] Items error:", itemsError);
    }

    if (!items || items.length === 0) {
      validationErrors.push("L'EDL doit contenir au moins une pièce inspectée");
    }

    // 2. Vérifier les signatures
    const { data: signatures } = await serviceClient
      .from("edl_signatures")
      .select("signer_role, signed_at, signature_image_path")
      .eq("edl_id", edlId);

    const hasOwnerSignature = signatures?.some(
      (s: any) =>
        ["owner", "proprietaire", "bailleur"].includes(s.signer_role) &&
        s.signature_image_path &&
        s.signed_at
    );

    const hasTenantSignature = signatures?.some(
      (s: any) =>
        ["tenant", "locataire", "locataire_principal"].includes(
          s.signer_role
        ) &&
        s.signature_image_path &&
        s.signed_at
    );

    if (!hasOwnerSignature) {
      validationErrors.push("La signature du propriétaire est manquante");
    }
    if (!hasTenantSignature) {
      validationErrors.push("La signature du locataire est manquante");
    }

    // Si des erreurs et pas de force
    if (validationErrors.length > 0 && !body.force) {
      return NextResponse.json(
        {
          error: "Validation incomplète",
          details: validationErrors,
          can_force: true,
        },
        { status: 422 }
      );
    }

    // Déterminer le nouveau statut
    const newStatus =
      hasOwnerSignature && hasTenantSignature ? "signed" : "completed";

    // Valider l'EDL
    const { error: updateError } = await serviceClient
      .from("edl")
      .update({
        status: newStatus,
        completed_date: new Date().toISOString().split("T")[0],
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", edlId);

    if (updateError) {
      console.error("[validate] Update error:", updateError);
      return NextResponse.json(
        { error: updateError.message || "Erreur lors de la validation" },
        { status: 500 }
      );
    }

    // Journaliser
    await serviceClient.from("audit_log").insert({
      user_id: user.id,
      action: "edl_validated",
      entity_type: "edl",
      entity_id: edlId,
      metadata: {
        new_status: newStatus,
        forced: body.force || false,
        validation_errors: validationErrors,
      },
    } as any);

    // Émettre un événement
    await serviceClient.from("outbox").insert({
      event_type: "Inspection.Validated",
      payload: {
        edl_id: edlId,
        status: newStatus,
        validated_by: user.id,
      },
    } as any);

    return NextResponse.json({
      success: true,
      status: newStatus,
      validation_errors:
        validationErrors.length > 0 ? validationErrors : undefined,
    });
  } catch (error: unknown) {
    console.error("[POST /api/edl/[id]/validate] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

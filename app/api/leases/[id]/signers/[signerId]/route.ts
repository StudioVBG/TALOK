export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";

/**
 * GET /api/leases/[id]/signers/[signerId] - Récupérer un signataire spécifique
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string; signerId: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { id: leaseId, signerId } = params;

    const { data: signer, error } = await supabase
      .from("lease_signers")
      .select(`
        id,
        role,
        signature_status,
        signed_at,
        invited_email,
        profile:profile_id (
          id,
          prenom,
          nom,
          email,
          telephone,
          avatar_url
        )
      `)
      .eq("id", signerId)
      .eq("lease_id", leaseId)
      .single();

    if (error || !signer) {
      return NextResponse.json(
        { error: "Signataire non trouvé" },
        { status: 404 }
      );
    }

    return NextResponse.json({ signer });
  } catch (error: unknown) {
    console.error("[signer/GET] Erreur:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/leases/[id]/signers/[signerId] - Supprimer un signataire
 */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string; signerId: string } }
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

    const { id: leaseId, signerId } = params;

    // Récupérer le profil de l'utilisateur actuel
    const { data: ownerProfile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!ownerProfile || (ownerProfile.role !== "owner" && ownerProfile.role !== "admin")) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    // Récupérer le signataire avec le bail
    const { data: signer, error: signerError } = await serviceClient
      .from("lease_signers")
      .select(`
        id,
        role,
        signature_status,
        invited_email,
        profile_id,
        lease:lease_id (
          id,
          statut,
          property:property_id (
            id,
            owner_id
          )
        )
      `)
      .eq("id", signerId)
      .eq("lease_id", leaseId)
      .single();

    if (signerError || !signer) {
      return NextResponse.json(
        { error: "Signataire non trouvé" },
        { status: 404 }
      );
    }

    const signerData = signer as any;

    // Vérifier que le propriétaire est bien le propriétaire du bien
    if (signerData.lease?.property?.owner_id !== ownerProfile.id && ownerProfile.role !== "admin") {
      return NextResponse.json(
        { error: "Ce bail ne vous appartient pas" },
        { status: 403 }
      );
    }

    // On ne peut pas supprimer le propriétaire
    if (signerData.role === "proprietaire") {
      return NextResponse.json(
        { error: "Impossible de supprimer le propriétaire du bail" },
        { status: 400 }
      );
    }

    // Vérifier le statut du bail
    if (!["draft", "pending_signature"].includes(signerData.lease?.statut)) {
        return NextResponse.json(
        { error: "Impossible de modifier les signataires d'un bail actif ou terminé" },
        { status: 400 }
        );
    }

    // Supprimer le signataire
    const { error: deleteError } = await serviceClient
      .from("lease_signers")
      .delete()
      .eq("id", signerId);

    if (deleteError) {
      console.error("[signer/DELETE] Erreur suppression:", deleteError);
      return NextResponse.json(
        { error: "Erreur lors de la suppression" },
        { status: 500 }
      );
    }

    // Journaliser
    await serviceClient.from("audit_log").insert({
      user_id: user.id,
      action: "signer_removed",
      entity_type: "lease_signer",
      entity_id: signerId,
      metadata: {
        lease_id: leaseId,
        role: signerData.role,
        email: signerData.invited_email,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Signataire supprimé",
    });
  } catch (error: unknown) {
    console.error("[signer/DELETE] Erreur:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

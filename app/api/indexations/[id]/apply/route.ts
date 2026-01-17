export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";

/**
 * POST /api/indexations/[id]/apply - Appliquer une révision IRL
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

    // Récupérer l'indexation
    const { data: indexation, error: indexError } = await serviceClient
      .from("lease_indexations")
      .select(`
        *,
        lease:lease_id (
          id,
          loyer,
          property:property_id (
            id,
            owner_id
          ),
          signers:lease_signers (
            profile_id,
            role,
            profile:profile_id (user_id)
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
        { error: "Seul le propriétaire peut appliquer une révision" },
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

    // Mettre à jour le loyer du bail
    const { error: updateLeaseError } = await serviceClient
      .from("leases")
      .update({ loyer: indexData.new_rent })
      .eq("id", indexData.lease_id);

    if (updateLeaseError) {
      console.error("[apply] Erreur mise à jour loyer:", updateLeaseError);
      throw updateLeaseError;
    }

    // Marquer l'indexation comme appliquée
    const { error: updateIndexError } = await serviceClient
      .from("lease_indexations")
      .update({
        status: "applied",
        applied_at: new Date().toISOString(),
      })
      .eq("id", indexationId);

    if (updateIndexError) {
      console.error("[apply] Erreur mise à jour indexation:", updateIndexError);
    }

    // Notifier le locataire
    const tenantSigner = indexData.lease?.signers?.find(
      (s: any) => s.role === "locataire_principal"
    );

    if (tenantSigner?.profile?.user_id) {
      await serviceClient.from("notifications").insert({
        user_id: tenantSigner.profile.user_id,
        type: "rent_increase",
        title: "Révision de votre loyer",
        body: `Votre loyer a été révisé de ${indexData.old_rent}€ à ${indexData.new_rent}€ suite à l'indexation IRL. Cette révision prend effet le ${new Date(indexData.effective_date).toLocaleDateString("fr-FR")}.`,
        priority: "high",
        metadata: {
          indexation_id: indexationId,
          old_rent: indexData.old_rent,
          new_rent: indexData.new_rent,
          effective_date: indexData.effective_date,
        },
      });
    }

    // Émettre un événement
    await serviceClient.from("outbox").insert({
      event_type: "IRL.Applied",
      payload: {
        indexation_id: indexationId,
        lease_id: indexData.lease_id,
        old_rent: indexData.old_rent,
        new_rent: indexData.new_rent,
        increase_percent: indexData.increase_percent,
        applied_by: user.id,
      },
    });

    // Journaliser
    await serviceClient.from("audit_log").insert({
      user_id: user.id,
      action: "irl_indexation_applied",
      entity_type: "lease_indexation",
      entity_id: indexationId,
      metadata: {
        lease_id: indexData.lease_id,
        old_rent: indexData.old_rent,
        new_rent: indexData.new_rent,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Révision appliquée avec succès",
      new_rent: indexData.new_rent,
    });
  } catch (error: unknown) {
    console.error("[apply] Erreur:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}


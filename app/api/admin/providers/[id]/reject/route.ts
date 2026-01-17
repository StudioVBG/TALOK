export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/helpers/auth-helper";

/**
 * POST /api/admin/providers/[id]/reject - Rejeter un prestataire
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { error, user, supabase } = await requireAdmin(request);

    if (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Une erreur est survenue", details: (error as any).details },
        { status: error.status }
      );
    }

    if (!user || !supabase) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { reason } = body;

    const profileId = params.id as any;

    // Vérifier que le prestataire existe
    const { data: provider, error: providerError } = await supabase
      .from("provider_profiles")
      .select("profile_id, status")
      .eq("profile_id", profileId)
      .single();

    if (providerError || !provider) {
      return NextResponse.json(
        { error: "Prestataire non trouvé" },
        { status: 404 }
      );
    }

    if ((provider as any).status === "rejected") {
      return NextResponse.json(
        { error: "Ce prestataire est déjà rejeté" },
        { status: 400 }
      );
    }

    // Mettre à jour le statut
    const { data: updated, error: updateError } = await supabase
      .from("provider_profiles")
      .update({
        status: "rejected",
        validated_at: new Date().toISOString(),
        validated_by: user.id,
        rejection_reason: reason || "Raison non spécifiée",
      })
      .eq("profile_id", profileId)
      .select()
      .single();

    if (updateError) {
      console.error("Error rejecting provider:", updateError);
      return NextResponse.json(
        { error: updateError.message || "Erreur lors du rejet" },
        { status: 500 }
      );
    }

    // Émettre un événement dans l'outbox
    const { error: outboxError } = await supabase.from("outbox").insert({
      event_type: "provider.rejected",
      payload: {
        profile_id: profileId,
        validated_by: user.id,
        validated_at: new Date().toISOString(),
        rejection_reason: reason || "Raison non spécifiée",
      },
      status: "pending",
      scheduled_at: new Date().toISOString(),
    });

    if (outboxError) {
      console.error("Error inserting outbox event:", outboxError);
      // Ne pas échouer la requête si l'événement ne peut pas être inséré
    }

    // Log dans audit_log
    const { error: auditError } = await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "provider.rejected",
      resource_type: "provider_profile",
      resource_id: profileId,
      metadata: {
        validated_by: user.id,
        validated_at: new Date().toISOString(),
        rejection_reason: reason || "Raison non spécifiée",
      },
    });

    if (auditError) {
      console.error("Error inserting audit log:", auditError);
      // Ne pas échouer la requête si l'audit ne peut pas être inséré
    }

    return NextResponse.json({
      success: true,
      provider: updated,
    });
  } catch (error: unknown) {
    console.error("Error in POST /api/admin/providers/[id]/reject:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}






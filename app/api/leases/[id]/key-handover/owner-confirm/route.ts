/**
 * POST /api/leases/[id]/key-handover/owner-confirm
 *
 * Confirmation simplifiée de la remise des clés par le propriétaire.
 * - Insère un enregistrement key_handovers confirmé
 * - Met à jour le bail : status → active, key_handover_date = NOW()
 * - Déclenche ensureInitialInvoiceForLease() pour la facture initiale
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { ensureInitialInvoiceForLease } from "@/lib/services/lease-initial-invoice.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id: leaseId } = await params;

    // Auth
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const serviceClient = getServiceClient();

    // Vérifier que l'utilisateur est propriétaire
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.role !== "owner") {
      return NextResponse.json(
        { error: "Seul le propriétaire peut confirmer la remise des clés" },
        { status: 403 }
      );
    }

    // Récupérer le bail et vérifier la propriété
    const { data: lease, error: leaseError } = await serviceClient
      .from("leases")
      .select(
        `id, statut, property_id, properties!leases_property_id_fkey (id, owner_id, adresse_complete)`
      )
      .eq("id", leaseId)
      .single();

    if (leaseError || !lease) {
      return NextResponse.json({ error: "Bail non trouvé" }, { status: 404 });
    }

    const property = (lease as any).properties;
    if (property?.owner_id !== profile.id) {
      return NextResponse.json(
        { error: "Vous n'êtes pas le propriétaire de ce bail" },
        { status: 403 }
      );
    }

    // Vérifier que le bail est dans un état compatible
    if (!["fully_signed", "active"].includes(lease.statut)) {
      return NextResponse.json(
        {
          error: `Le bail doit être signé pour confirmer la remise des clés (statut actuel : ${lease.statut})`,
        },
        { status: 400 }
      );
    }

    // Vérifier s'il y a déjà une remise confirmée
    const { data: existingHandover } = await (
      serviceClient.from("key_handovers") as any
    )
      .select("id, confirmed_at")
      .eq("lease_id", leaseId)
      .not("confirmed_at", "is", null)
      .limit(1)
      .maybeSingle();

    if (existingHandover?.confirmed_at) {
      return NextResponse.json(
        { error: "La remise des clés a déjà été confirmée" },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();

    // Insérer la confirmation de remise des clés
    const { error: insertError } = await (
      serviceClient.from("key_handovers") as any
    ).insert({
      lease_id: leaseId,
      confirmed_at: now,
      confirmed_by: profile.id,
      method: "owner_manual",
      metadata: {
        confirmed_by_role: "owner",
        confirmed_by_user_id: user.id,
      },
    });

    if (insertError) {
      console.error("[Owner Key Handover] Insert error:", insertError);
      return NextResponse.json(
        { error: "Erreur lors de l'enregistrement de la remise des clés" },
        { status: 500 }
      );
    }

    // Mettre à jour le bail : status → active, key_handover_date
    const { error: updateError } = await serviceClient
      .from("leases")
      .update({
        statut: "active",
        activated_at: now,
        key_handover_date: now,
        updated_at: now,
      })
      .eq("id", leaseId);

    if (updateError) {
      console.error("[Owner Key Handover] Lease update error:", updateError);
      return NextResponse.json(
        { error: "Erreur lors de l'activation du bail" },
        { status: 500 }
      );
    }

    // Déclencher ensureInitialInvoiceForLease pour la facture initiale
    let invoiceResult = null;
    try {
      invoiceResult = await ensureInitialInvoiceForLease(
        serviceClient as any,
        leaseId
      );
    } catch (invoiceError) {
      console.error(
        "[Owner Key Handover] Invoice generation error (non-bloquant):",
        invoiceError
      );
      // Non-bloquant : la remise des clés et l'activation sont déjà faites
    }

    // Événement outbox
    await serviceClient.from("outbox").insert({
      event_type: "Lease.KeyHandoverConfirmed",
      payload: {
        lease_id: leaseId,
        confirmed_by: profile.id,
        confirmed_at: now,
        method: "owner_manual",
        invoice_id: invoiceResult?.invoiceId ?? null,
        invoice_created: invoiceResult?.created ?? false,
      },
    });

    // Audit log
    await serviceClient.from("audit_log").insert({
      user_id: user.id,
      action: "key_handover_owner_confirmed",
      entity_type: "lease",
      entity_id: leaseId,
      metadata: {
        method: "owner_manual",
        invoice_id: invoiceResult?.invoiceId ?? null,
        previous_status: lease.statut,
        new_status: "active",
      },
    });

    // Invalider le cache
    revalidatePath(`/owner/leases/${leaseId}`);
    revalidatePath("/owner/leases");
    if (property?.id) {
      revalidatePath(`/owner/properties/${property.id}`);
    }

    return NextResponse.json({
      success: true,
      message:
        "Remise des clés confirmée et bail activé",
      lease_id: leaseId,
      new_status: "active",
      invoice: invoiceResult
        ? {
            id: invoiceResult.invoiceId,
            amount: invoiceResult.amount,
            deposit_amount: invoiceResult.depositAmount,
            created: invoiceResult.created,
          }
        : null,
    });
  } catch (error: unknown) {
    console.error("[Owner Key Handover] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Erreur serveur",
      },
      { status: 500 }
    );
  }
}

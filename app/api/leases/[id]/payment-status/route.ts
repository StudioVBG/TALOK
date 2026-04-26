/**
 * GET /api/leases/[id]/payment-status
 *
 * Retourne le statut du paiement initial pour un bail donné.
 * Utilisé par le front pour afficher l'état du paiement et débloquer la remise des clés.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";
import { getInitialInvoiceSettlement } from "@/lib/services/invoice-status.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id: leaseId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const serviceClient = getServiceClient();

    // Vérifier le profil et l'accès
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });
    }

    // Vérifier l'accès au bail
    const { data: lease } = await serviceClient
      .from("leases")
      .select(
        "id, initial_payment_confirmed, initial_payment_date, properties!leases_property_id_fkey(owner_id)"
      )
      .eq("id", leaseId)
      .maybeSingle();

    if (!lease) {
      return NextResponse.json({ error: "Bail introuvable" }, { status: 404 });
    }

    // Vérifier que l'utilisateur est propriétaire, signataire ou admin
    const isOwner =
      profile.role === "owner" &&
      (lease as any).properties?.owner_id === profile.id;
    const isAdmin = profile.role === "admin";

    if (!isOwner && !isAdmin) {
      const { data: signer } = await serviceClient
        .from("lease_signers")
        .select("id")
        .eq("lease_id", leaseId)
        .eq("profile_id", profile.id)
        .maybeSingle();

      if (!signer) {
        return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
      }
    }

    // Récupérer le settlement dynamique
    const settlement = await getInitialInvoiceSettlement(
      serviceClient as any,
      leaseId
    );

    const leaseAny = lease as any;
    return NextResponse.json({
      initial_payment_confirmed:
        leaseAny.initial_payment_confirmed ?? settlement?.isSettled ?? false,
      first_payment_date:
        leaseAny.initial_payment_date ?? settlement?.invoice?.date_paiement ?? null,
      amount: settlement?.invoice?.montant_total ?? null,
      total_paid: settlement?.totalPaid ?? 0,
      remaining: settlement?.remaining ?? 0,
      is_settled: settlement?.isSettled ?? false,
      invoice_status: settlement?.status ?? null,
    });
  } catch (error: unknown) {
    console.error("[payment-status GET]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

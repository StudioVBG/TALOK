export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST /api/leases/[id]/deposit/refunds - Restituer le dépôt de garantie (totale ou partielle)
 *
 * @version 2026-01-22 - Fix: Next.js 15 params Promise pattern
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const { amount, reason, proof_url, is_partial = false } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: "Montant requis et doit être positif" },
        { status: 400 }
      );
    }

    if (!reason) {
      return NextResponse.json(
        { error: "Raison de restitution requise" },
        { status: 400 }
      );
    }

    // Vérifier que l'utilisateur est propriétaire du bail
    const { data: lease } = await supabase
      .from("leases")
      .select(`
        id,
        property:properties!inner(owner_id)
      `)
      .eq("id", id as any)
      .single();

    if (!lease) {
      return NextResponse.json(
        { error: "Bail non trouvé" },
        { status: 404 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id as any)
      .single();

    const leaseData = lease as any;
    const profileData = profile as any;
    if (leaseData.property.owner_id !== profileData?.id) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    // Vérifier le solde disponible
    const { data: balance } = await supabase
      .from("deposit_balance")
      .select("balance")
      .eq("lease_id", id as any)
      .maybeSingle();

    const balanceData = balance as any;
    const availableBalance = balanceData?.balance || 0;

    if (amount > availableBalance) {
      return NextResponse.json(
        { error: "Montant supérieur au solde disponible" },
        { status: 400 }
      );
    }

    // Vérifier que l'EDL de sortie est signé (pour restitution totale)
    if (!is_partial) {
      const { data: edl } = await supabase
        .from("edl")
        .select("id, signed_at")
        .eq("lease_id", id as any)
        .eq("type", "sortie" as any)
        .is("signed_at", null)
        .maybeSingle();

      const edlData = edl as any;
      if (!edlData || !edlData.signed_at) {
        return NextResponse.json(
          { error: "L'EDL de sortie doit être signé avant restitution totale" },
          { status: 400 }
        );
      }
    }

    // Créer le mouvement de restitution
    const movementType = is_partial ? "restitution_partielle" : "restitution_totale";
    const { data: movement, error } = await supabase
      .from("deposit_movements")
      .insert({
        lease_id: id as any,
        type: movementType,
        amount,
        reason,
        proof_url,
        status: "returned",
        processed_at: new Date().toISOString(),
        processed_by: user.id,
      } as any)
      .select()
      .single();

    if (error) throw error;

    const movementData = movement as any;

    // Émettre un événement
    const eventType = is_partial ? "Deposit.PartiallyReturned" : "Deposit.Returned";
    await supabase.from("outbox").insert({
      event_type: eventType,
      payload: {
        movement_id: movementData.id,
        lease_id: id as any,
        amount,
        is_partial,
      },
    } as any);

    // Journaliser
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "deposit_returned",
      entity_type: "deposit",
      entity_id: movementData.id,
      metadata: { amount, is_partial, lease_id: id as any },
    } as any);

    return NextResponse.json({ movement });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}






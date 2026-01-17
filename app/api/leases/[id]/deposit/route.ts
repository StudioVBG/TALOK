export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST /api/leases/[id]/deposit - Encaisser un dépôt de garantie
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const { amount, proof_url, reason } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: "Montant requis et doit être positif" },
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
      .eq("id", params.id as any)
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

    // Vérifier le montant du dépôt dans le bail
    const { data: leaseDetails } = await supabase
      .from("leases")
      .select("depot_de_garantie")
      .eq("id", params.id as any)
      .single();

    // Créer le mouvement d'encaissement
    const { data: movement, error } = await supabase
      .from("deposit_movements")
      .insert({
        lease_id: params.id as any,
        type: "encaissement",
        amount,
        reason: reason || "Dépôt de garantie",
        proof_url,
        status: "received",
        processed_at: new Date().toISOString(),
        processed_by: user.id,
      } as any)
      .select()
      .single();

    if (error) throw error;

    const movementData = movement as any;

    // Émettre un événement
    await supabase.from("outbox").insert({
      event_type: "Deposit.Received",
      payload: {
        movement_id: movementData.id,
        lease_id: params.id as any,
        amount,
      },
    } as any);

    // Journaliser
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "deposit_received",
      entity_type: "deposit",
      entity_id: movementData.id,
      metadata: { amount, lease_id: params.id as any },
    } as any);

    return NextResponse.json({ movement });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/leases/[id]/deposit - Récupérer l'historique du dépôt
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Vérifier l'accès au bail
    const { data: roommate } = await supabase
      .from("roommates")
      .select("id")
      .eq("lease_id", params.id as any)
      .eq("user_id", user.id as any)
      .maybeSingle();

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id as any)
      .single();

    const { data: lease } = await supabase
      .from("leases")
      .select(`
        id,
        property:properties!inner(owner_id)
      `)
      .eq("id", params.id as any)
      .single();

    const leaseData = lease as any;
    const profileData = profile as any;
    const hasAccess = roommate || leaseData?.property?.owner_id === profileData?.id;

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    // Récupérer les mouvements
    const { data: movements, error } = await supabase
      .from("deposit_movements")
      .select("*")
      .eq("lease_id", params.id as any)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Récupérer le solde
    const { data: balance } = await supabase
      .from("deposit_balance")
      .select("*")
      .eq("lease_id", params.id as any)
      .maybeSingle();

    return NextResponse.json({
      movements: movements || [],
      balance: balance || { balance: 0, total_received: 0, total_returned: 0 },
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}






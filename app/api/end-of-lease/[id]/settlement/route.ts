export const runtime = 'nodejs';

/**
 * API Routes pour le solde de tout compte
 * GET /api/end-of-lease/[id]/settlement - Récupérer le solde d'un bail
 * POST /api/end-of-lease/[id]/settlement - Générer le solde de tout compte
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient, createRouteHandlerClient } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leaseId } = await params;
    const supabase = await createRouteHandlerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    // Récupérer le solde avec les détails
    const { data: settlement, error } = await supabase
      .from("dg_settlements")
      .select(`
        *,
        lease:leases!dg_settlements_lease_id_fkey(
          id, loyer, depot_de_garantie,
          property:properties(id, adresse_complete, ville)
        ),
        deduction_items:settlement_deduction_items(*)
      `)
      .eq("lease_id", leaseId)
      .maybeSingle();

    if (error) {
      console.error("Erreur récupération solde:", error);
      return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
    }

    if (!settlement) {
      return NextResponse.json({ error: "Solde non trouvé" }, { status: 404 });
    }

    return NextResponse.json(settlement);
  } catch (error: unknown) {
    console.error("Erreur API settlement GET:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leaseId } = await params;
    const supabase = await createRouteHandlerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    // Récupérer le profil
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // Vérifier que l'utilisateur est propriétaire ou admin
    const { data: lease } = await supabase
      .from("leases")
      .select(`
        id, depot_de_garantie, statut,
        property:properties(id, owner_id, adresse_complete)
      `)
      .eq("id", leaseId)
      .single();

    if (!lease) {
      return NextResponse.json({ error: "Bail non trouvé" }, { status: 404 });
    }

    const isOwner = (lease.property as any)?.owner_id === profile.id;
    if (!isOwner && profile.role !== "admin") {
      return NextResponse.json(
        { error: "Seul le propriétaire peut générer le solde" },
        { status: 403 }
      );
    }

    // Appeler la fonction RPC pour générer le solde
    const serviceClient = createServiceRoleClient();
    const { data: settlementId, error: rpcError } = await serviceClient.rpc(
      "generate_settlement",
      {
        p_lease_id: leaseId,
        p_created_by: profile.id,
      }
    );

    if (rpcError) {
      console.error("Erreur génération solde:", rpcError);
      return NextResponse.json({ error: rpcError.message }, { status: 500 });
    }

    // Récupérer le solde créé
    const { data: settlement, error: fetchError } = await serviceClient
      .from("dg_settlements")
      .select(`
        *,
        lease:leases!dg_settlements_lease_id_fkey(
          id, loyer, depot_de_garantie,
          property:properties(id, adresse_complete, ville)
        ),
        deduction_items:settlement_deduction_items(*)
      `)
      .eq("id", settlementId)
      .single();

    if (fetchError) {
      console.error("Erreur récupération solde:", fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    return NextResponse.json(settlement, { status: 201 });
  } catch (error: unknown) {
    console.error("Erreur API settlement POST:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}








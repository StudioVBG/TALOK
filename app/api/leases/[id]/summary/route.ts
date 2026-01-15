export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/leases/[id]/summary - Fiche synthèse d'un bail
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

    // Récupérer le bail avec les détails
    const { data: lease, error: leaseError } = await supabase
      .from("leases")
      .select(
        `
        *,
        property:properties(*),
        unit:units(*),
        signers:lease_signers(
          *,
          profile:profiles(*)
        )
      `
      )
      .eq("id", params.id as any)
      .single();

    if (leaseError || !lease) {
      return NextResponse.json(
        { error: "Bail non trouvé" },
        { status: 404 }
      );
    }

    const leaseData = lease as any;

    // Vérifier que l'utilisateur est signataire
    const isSigner = leaseData.signers?.some(
      (s: any) => s.profile?.user_id === user.id
    );

    if (!isSigner) {
      return NextResponse.json(
        { error: "Non autorisé" },
        { status: 403 }
      );
    }

    // Récupérer les colocataires si colocation
    let roommates = null;
    if (leaseData.type_bail === "colocation") {
      const { data: roommatesData } = await supabase
        .from("roommates")
        .select(
          `
          *,
          profile:profiles(prenom, nom, avatar_url)
        `
        )
        .eq("lease_id", params.id as any)
        .is("left_on", null);

      roommates = roommatesData;
    }

    // Récupérer le dernier paiement
    const { data: lastPayment } = await supabase
      .from("payment_shares")
      .select("*")
        .eq("lease_id", params.id as any)
        .order("month", { ascending: false })
      .limit(1)
      .single();

    return NextResponse.json({
      lease: {
        id: leaseData.id,
        type_bail: leaseData.type_bail,
        loyer: leaseData.loyer,
        charges_forfaitaires: leaseData.charges_forfaitaires,
        depot_de_garantie: leaseData.depot_de_garantie,
        date_debut: leaseData.date_debut,
        date_fin: leaseData.date_fin,
        statut: leaseData.statut,
        property: leaseData.property,
        unit: leaseData.unit,
        signers: leaseData.signers,
        roommates,
        last_payment: lastPayment,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}


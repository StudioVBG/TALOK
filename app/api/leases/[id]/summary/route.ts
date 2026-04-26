export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";

/**
 * GET /api/leases/[id]/summary - Fiche synthèse d'un bail
 *
 * Service-role + check métier explicite (cf. docs/audits/rls-cascade-audit.md) :
 * accès accordé aux signataires du bail, au propriétaire de la propriété
 * et aux admins. Avant ce fix, la cascade RLS sur properties/units/profiles
 * pouvait blanker la jointure et renvoyer 404 à un signataire légitime.
 */
export async function GET(
  _request: Request,
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

    const serviceClient = getServiceClient();

    const { data: lease } = await serviceClient
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
      .eq("id", id)
      .maybeSingle();

    if (!lease) {
      return NextResponse.json(
        { error: "Bail non trouvé" },
        { status: 404 }
      );
    }

    const leaseData = lease as Record<string, unknown> & {
      type_bail?: string;
      property?: { owner_id?: string } | null;
      signers?: Array<{ profile?: { user_id?: string } | null }> | null;
    };

    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .maybeSingle();

    const profileData = profile as { id: string; role: string } | null;
    const isAdmin = profileData?.role === "admin";
    const isOwner = leaseData.property?.owner_id === profileData?.id;
    const isSigner = leaseData.signers?.some(
      (s) => s.profile?.user_id === user.id
    ) ?? false;

    if (!isAdmin && !isOwner && !isSigner) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
    }

    let roommates = null;
    if (leaseData.type_bail === "colocation") {
      const { data: roommatesData } = await serviceClient
        .from("roommates")
        .select(
          `
          *,
          profile:profiles(prenom, nom, avatar_url)
        `
        )
        .eq("lease_id", id)
        .is("left_on", null);

      roommates = roommatesData;
    }

    const { data: lastPayment } = await serviceClient
      .from("payment_shares")
      .select("*")
      .eq("lease_id", id)
      .order("month", { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({
      lease: {
        id: (leaseData as Record<string, unknown>).id,
        type_bail: leaseData.type_bail,
        loyer: (leaseData as Record<string, unknown>).loyer,
        charges_forfaitaires: (leaseData as Record<string, unknown>).charges_forfaitaires,
        depot_de_garantie: (leaseData as Record<string, unknown>).depot_de_garantie,
        date_debut: (leaseData as Record<string, unknown>).date_debut,
        date_fin: (leaseData as Record<string, unknown>).date_fin,
        statut: (leaseData as Record<string, unknown>).statut,
        property: leaseData.property,
        unit: (leaseData as Record<string, unknown>).unit,
        signers: leaseData.signers,
        roommates,
        last_payment: lastPayment,
      },
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

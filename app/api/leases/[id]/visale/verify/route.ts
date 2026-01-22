export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST /api/leases/[id]/visale/verify - Vérifier une attestation Visale
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
    const { attestation_url, document_id } = body;

    if (!attestation_url && !document_id) {
      return NextResponse.json(
        { error: "attestation_url ou document_id requis" },
        { status: 400 }
      );
    }

    // Vérifier l'accès au bail
    const { data: lease } = await supabase
      .from("leases")
      .select(`
        id,
        property:properties!inner(owner_id),
        roommates(user_id)
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
      .select("id, role")
      .eq("user_id", user.id as any)
      .single();

    const leaseData = lease as any;
    const profileData = profile as any;
    const isAdmin = profileData?.role === "admin";
    const isOwner = leaseData.property.owner_id === profileData?.id;
    const isTenant = leaseData.roommates?.some((r: any) => r.user_id === user.id);

    if (!isOwner && !isTenant) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    // TODO: Vérifier l'attestation Visale via API externe
    // Pour l'instant, simulation
    const isValid = true; // À remplacer par vérification réelle
    const visaleData = {
      numero: "VISALE-123456",
      date_debut: "2025-01-01",
      date_fin: "2026-12-31",
      montant_garanti: 12000,
    };

    if (!isValid) {
      return NextResponse.json(
        { error: "Attestation Visale invalide" },
        { status: 400 }
      );
    }

    // Mettre à jour ou créer le garant Visale
    const { data: roommate } = await supabase
      .from("roommates")
      .select("id")
      .eq("lease_id", id as any)
      .eq("user_id", user.id as any)
      .limit(1)
      .maybeSingle();

    if (roommate) {
      const roommateData = roommate as any;
      const { data: guarantor } = await supabase
        .from("guarantors")
        .select("id")
        .eq("roommate_id", roommateData.id)
        .eq("type", "visale" as any)
        .maybeSingle();

      if (guarantor) {
        const guarantorData = guarantor as any;
        await supabase
          .from("guarantors")
          .update({
            status: "accepted",
            metadata: visaleData,
          } as any)
          .eq("id", guarantorData.id);
      } else {
        await supabase.from("guarantors").insert({
          roommate_id: roommateData.id,
          type: "visale",
          status: "accepted",
          metadata: visaleData,
        } as any);
      }
    }

    // Émettre un événement
    await supabase.from("outbox").insert({
      event_type: "Guarantee.Validated",
      payload: {
        lease_id: id as any,
        type: "visale",
        visale_data: visaleData,
      },
    } as any);

    return NextResponse.json({
      success: true,
      visale: visaleData,
      message: "Attestation Visale validée",
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}






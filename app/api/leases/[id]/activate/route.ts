// @ts-nocheck
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST /api/leases/[id]/activate - Activer manuellement un bail
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

    // Vérifier que l'utilisateur est propriétaire
    const { data: lease } = await supabase
      .from("leases")
      .select(`
        id,
        statut,
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
      .select("id, role")
      .eq("user_id", user.id as any)
      .single();

    const leaseData = lease as any;
    const profileData = profile as any;
    const isAdmin = profileData?.role === "admin";
    const isOwner = leaseData.property.owner_id === profileData?.id;

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    if (leaseData.statut === "active") {
      return NextResponse.json(
        { error: "Le bail est déjà actif" },
        { status: 400 }
      );
    }

    // Vérifier que tous les signataires ont signé
    const { data: signers } = await (supabase as any)
      .from("lease_signers")
      .select("signature_status")
      .eq("lease_id", params.id as any);

    const allSigned = signers?.every((s: any) => s.signature_status === "signed");

    if (!allSigned && !isAdmin) {
      return NextResponse.json(
        { error: "Tous les signataires doivent avoir signé" },
        { status: 400 }
      );
    }

    // Activer le bail
    const supabaseClient = supabase as any;
    const { data: updated, error } = await supabaseClient
      .from("leases")
      .update({ statut: "active" } as any)
      .eq("id", params.id as any)
      .select()
      .single();

    if (error) throw error;

    // Émettre un événement
    await supabaseClient.from("outbox").insert({
      event_type: "Lease.Activated",
      payload: {
        lease_id: params.id as any,
        activated_by: user.id,
        manual: true,
      },
    } as any);

    // Journaliser
    await supabaseClient.from("audit_log").insert({
      user_id: user.id,
      action: "lease_activated",
      entity_type: "lease",
      entity_id: params.id,
      metadata: { manual: true },
    } as any);

    return NextResponse.json({ lease: updated });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}






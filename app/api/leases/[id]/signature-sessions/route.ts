export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST /api/leases/[id]/signature-sessions - Démarrer un parcours de signature eIDAS/TSP
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
    const { signers, prefer_eidas = true } = body; // Array de {profile_id, role}

    if (!signers || signers.length === 0) {
      return NextResponse.json(
        { error: "Au moins un signataire requis" },
        { status: 400 }
      );
    }

    // Vérifier que l'utilisateur est propriétaire du bail
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

    const leaseData = lease as any;
    if (leaseData.statut !== "draft") {
      return NextResponse.json(
        { error: "Le bail doit être en statut 'draft'" },
        { status: 400 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id as any)
      .single();

    const profileData = profile as any;
    if (leaseData.property.owner_id !== profileData?.id) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    // Récupérer le draft
    const { data: draft } = await supabase
      .from("lease_drafts")
      .select("*")
      .eq("lease_id", params.id as any)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!draft) {
      return NextResponse.json(
        { error: "Aucun draft trouvé pour ce bail" },
        { status: 404 }
      );
    }

    const draftData = draft as any;

    // Créer les sessions de signature pour chaque signataire
    const sessions = [];
    for (const signer of signers) {
      // Vérifier si le signataire existe déjà
      const { data: existing } = await supabase
        .from("lease_signers")
        .select("id")
        .eq("lease_id", params.id as any)
        .eq("profile_id", signer.profile_id)
        .maybeSingle();

      if (!existing) {
        // Créer le signataire
        await supabase.from("lease_signers").insert({
          lease_id: params.id as any,
          profile_id: signer.profile_id,
          role: signer.role,
          signature_status: "pending",
        } as any);
      }

      // Créer une session de signature (simplifié, devrait utiliser un service TSP)
      const sessionId = crypto.randomUUID();
      sessions.push({
        session_id: sessionId,
        profile_id: signer.profile_id,
        role: signer.role,
        signature_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/sign/${sessionId}`,
      });

      // Émettre un événement
      await supabase.from("outbox").insert({
        event_type: "Signature.Requested",
        payload: {
          session_id: sessionId,
          lease_id: params.id as any,
          draft_id: draftData.id,
          signer_profile_id: signer.profile_id,
          prefer_eidas,
        },
      } as any);
    }

    // Mettre à jour le statut du bail
    await supabase
      .from("leases")
      .update({ statut: "pending_signature" } as any)
      .eq("id", params.id as any);

    // Émettre un événement
    await supabase.from("outbox").insert({
      event_type: "Lease.Sent",
      payload: {
        lease_id: params.id as any,
        draft_id: draftData.id,
        signers_count: signers.length,
      },
    } as any);

    // Journaliser
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "lease_sent_for_signature",
      entity_type: "lease",
      entity_id: params.id,
      metadata: { signers_count: signers.length },
    } as any);

    return NextResponse.json({
      success: true,
      sessions,
      lease_status: "pending_signature",
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}






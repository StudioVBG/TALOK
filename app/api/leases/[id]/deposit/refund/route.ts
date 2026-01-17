export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";

/**
 * POST /api/leases/[id]/deposit/refund - Effectuer la restitution du dépôt de garantie
 * 
 * PATTERN: Création unique (enregistrement de la restitution + génération document)
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const serviceClient = getServiceClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const leaseId = params.id;
    const body = await request.json();

    const {
      total_deposit,
      deductions,
      total_deductions,
      refund_amount,
      refund_method,
      iban,
      notes,
    } = body;

    // Récupérer le bail
    const { data: lease, error: leaseError } = await serviceClient
      .from("leases")
      .select(`
        *,
        property:property_id (
          id,
          owner_id,
          adresse_complete
        ),
        signers:lease_signers (
          profile_id,
          role,
          profile:profile_id (
            id,
            prenom,
            nom,
            user_id,
            email
          )
        )
      `)
      .eq("id", leaseId)
      .single();

    if (leaseError || !lease) {
      return NextResponse.json(
        { error: "Bail non trouvé" },
        { status: 404 }
      );
    }

    const leaseData = lease as any;

    // Vérifier les permissions
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    const profileData = profile as any;
    const isAdmin = profileData?.role === "admin";
    const isOwner = leaseData.property?.owner_id === profileData?.id;

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: "Seul le propriétaire peut effectuer la restitution" },
        { status: 403 }
      );
    }

    // Vérifier le statut du bail
    if (leaseData.statut !== "terminated") {
      return NextResponse.json(
        { error: "Le bail doit être terminé pour restituer le dépôt" },
        { status: 400 }
      );
    }

    // Créer l'enregistrement de restitution
    const { data: refund, error: refundError } = await serviceClient
      .from("deposit_refunds")
      .insert({
        lease_id: leaseId,
        total_deposit,
        total_deductions,
        refund_amount,
        deductions: deductions,
        refund_method,
        iban: refund_method === "virement" ? iban : null,
        notes,
        status: "pending",
        created_by: user.id,
      })
      .select()
      .single();

    if (refundError) {
      console.error("[deposit/refund] Erreur création:", refundError);
      
      // Si la table n'existe pas, créer une migration simple
      if (refundError.code === "42P01") {
        // Table doesn't exist - return sans erreur, la migration sera créée
        console.log("[deposit/refund] Table deposit_refunds manquante");
      }
      
      throw refundError;
    }

    // Trouver le locataire
    const tenant = leaseData.signers?.find((s: any) => s.role === "locataire_principal");

    // Notifier le locataire
    if (tenant?.profile?.user_id) {
      await serviceClient.from("notifications").insert({
        user_id: tenant.profile.user_id,
        type: "deposit_refund",
        title: "Restitution de votre dépôt de garantie",
        body: refund_amount > 0
          ? `Votre dépôt de garantie sera restitué : ${refund_amount}€ par ${refund_method}.`
          : `Votre dépôt de garantie a été intégralement retenu (retenues : ${total_deductions}€).`,
        priority: "high",
        metadata: {
          lease_id: leaseId,
          refund_id: refund?.id,
          refund_amount,
          deductions: total_deductions,
        },
      });
    }

    // Émettre un événement
    await serviceClient.from("outbox").insert({
      event_type: "Deposit.Refunded",
      payload: {
        lease_id: leaseId,
        refund_id: refund?.id,
        tenant_id: tenant?.profile?.id,
        total_deposit,
        refund_amount,
        deductions: total_deductions,
        refund_method,
      },
    });

    // Journaliser
    await serviceClient.from("audit_log").insert({
      user_id: user.id,
      action: "deposit_refund_created",
      entity_type: "deposit_refund",
      entity_id: refund?.id || leaseId,
      metadata: {
        lease_id: leaseId,
        total_deposit,
        refund_amount,
        deductions,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Restitution enregistrée",
      refund: refund,
    });
  } catch (error: unknown) {
    console.error("[deposit/refund] Erreur:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}


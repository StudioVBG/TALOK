export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/leases/[id]/initiate-signature
 * Initie le processus de signature d'un bail
 * - Vérifie que le bail a des signataires
 * - Met à jour le statut en "pending_signature"
 * - Envoie les invitations par email
 */

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";
import { sendLeaseInviteEmail } from "@/lib/services/email-service";
import { LEASE_STATUS } from "@/lib/constants/roles";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const leaseId = params.id;

  try {
    const supabase = await createClient();
    const serviceClient = getServiceClient();

    // 1. Vérifier l'authentification
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // 2. Récupérer le profil de l'utilisateur
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role, prenom, nom")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // 3. Récupérer le bail avec ses signataires et la propriété
    const { data: lease, error: leaseError } = await serviceClient
      .from("leases")
      .select(`
        id,
        statut,
        loyer,
        charges_forfaitaires,
        date_debut,
        date_fin,
        type_bail,
        property:properties(id, adresse_complete, ville, owner_id),
        signers:lease_signers(
          id,
          role,
          signature_status,
          profile_id,
          invited_email,
          invited_name,
          profiles(id, prenom, nom, email, user_id)
        )
      `)
      .eq("id", leaseId)
      .single();

    if (leaseError || !lease) {
      return NextResponse.json({ error: "Bail non trouvé" }, { status: 404 });
    }

    // 4. Vérifier que l'utilisateur est le propriétaire
    const property = lease.property as any;
    if (property?.owner_id !== profile.id) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    // 5. Vérifier que le bail est en brouillon
    if (lease.statut !== "draft" && lease.statut !== LEASE_STATUS.DRAFT) {
      return NextResponse.json({
        error: `Le bail ne peut pas être envoyé pour signature (statut actuel: ${lease.statut})`,
      }, { status: 400 });
    }

    // 6. Vérifier qu'il y a au moins 2 signataires (propriétaire + locataire)
    const signers = lease.signers as any[];
    if (!signers || signers.length < 2) {
      return NextResponse.json({
        error: "Le bail doit avoir au moins 2 signataires (propriétaire et locataire)",
      }, { status: 400 });
    }

    const hasOwner = signers.some((s: any) =>
      ["proprietaire", "owner", "bailleur"].includes(s.role)
    );
    const hasTenant = signers.some((s: any) =>
      ["locataire_principal", "locataire", "tenant", "colocataire"].includes(s.role)
    );

    if (!hasOwner || !hasTenant) {
      return NextResponse.json({
        error: "Le bail doit avoir un propriétaire et au moins un locataire",
      }, { status: 400 });
    }

    // 7. Mettre à jour le statut du bail
    const { error: updateError } = await serviceClient
      .from("leases")
      .update({
        statut: LEASE_STATUS.PENDING_SIGNATURE,
        sent_for_signature_at: new Date().toISOString(),
      })
      .eq("id", leaseId);

    if (updateError) {
      console.error("[initiate-signature] Erreur mise à jour statut:", updateError);
      return NextResponse.json({
        error: "Erreur lors de la mise à jour du statut",
      }, { status: 500 });
    }

    // 8. Envoyer les emails d'invitation aux signataires
    const emailPromises = signers.map(async (signer: any) => {
      const signerProfile = signer.profiles;
      const email = signerProfile?.email || signer.invited_email;
      const name = signerProfile
        ? `${signerProfile.prenom || ""} ${signerProfile.nom || ""}`.trim()
        : signer.invited_name || "Signataire";

      if (!email) {
        console.warn(`[initiate-signature] Signataire ${signer.id} sans email`);
        return null;
      }

      try {
        await sendLeaseInviteEmail({
          to: email,
          tenantName: name,
          propertyAddress: property?.adresse_complete || property?.ville || "le bien",
          leaseId: leaseId,
          ownerName: `${profile.prenom || ""} ${profile.nom || ""}`.trim() || "Le propriétaire",
        });
        console.log(`[initiate-signature] Email envoyé à ${email}`);
        return { success: true, email };
      } catch (emailError) {
        console.error(`[initiate-signature] Erreur envoi email à ${email}:`, emailError);
        return { success: false, email, error: emailError };
      }
    });

    const emailResults = await Promise.all(emailPromises);
    const successfulEmails = emailResults.filter((r) => r?.success).length;

    // 9. Journaliser l'action
    await serviceClient.from("audit_log").insert({
      user_id: user.id,
      action: "lease_signature_initiated",
      entity_type: "lease",
      entity_id: leaseId,
      metadata: {
        signers_count: signers.length,
        emails_sent: successfulEmails,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Processus de signature initié",
      lease_status: LEASE_STATUS.PENDING_SIGNATURE,
      emails_sent: successfulEmails,
      total_signers: signers.length,
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erreur serveur";
    console.error("[initiate-signature] Erreur:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

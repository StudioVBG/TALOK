export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";
import { sendLeaseInviteEmail } from "@/lib/services/email-service";

/**
 * POST /api/leases/[id]/signers/[signerId]/resend - Relancer une invitation
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string; signerId: string } }
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

    const { id: leaseId, signerId } = params;

    // Récupérer le profil de l'utilisateur actuel
    const { data: ownerProfile } = await supabase
      .from("profiles")
      .select("id, role, prenom, nom")
      .eq("user_id", user.id)
      .single();

    if (!ownerProfile || (ownerProfile.role !== "owner" && ownerProfile.role !== "admin")) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    // Récupérer le signataire avec le bail et la propriété
    const { data: signer, error: signerError } = await serviceClient
      .from("lease_signers")
      .select(`
        id,
        role,
        signature_status,
        invited_email,
        profile:profile_id (
          id,
          email,
          prenom,
          nom,
          user_id
        ),
        lease:lease_id (
          id,
          loyer,
          charges_forfaitaires,
          type_bail,
          property:property_id (
            id,
            owner_id,
            adresse_complete,
            code_postal,
            ville
          )
        )
      `)
      .eq("id", signerId)
      .eq("lease_id", leaseId)
      .single();

    if (signerError || !signer) {
      return NextResponse.json(
        { error: "Signataire non trouvé" },
        { status: 404 }
      );
    }

    const signerData = signer as any;

    // Vérifier que le propriétaire est bien le propriétaire du bien
    if (signerData.lease?.property?.owner_id !== ownerProfile.id && ownerProfile.role !== "admin") {
      return NextResponse.json(
        { error: "Ce bail ne vous appartient pas" },
        { status: 403 }
      );
    }

    // Vérifier que le signataire n'a pas déjà signé
    if (signerData.signature_status === "signed") {
      return NextResponse.json(
        { error: "Ce signataire a déjà signé le bail" },
        { status: 400 }
      );
    }

    // Récupérer l'email
    const email = signerData.profile?.email || signerData.invited_email;
    if (!email) {
      return NextResponse.json(
        { error: "Aucune adresse email disponible pour ce signataire" },
        { status: 400 }
      );
    }

    // Générer un nouveau lien d'invitation
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const inviteToken = Buffer.from(`${leaseId}:${email}:${Date.now()}`).toString("base64url");
    const inviteUrl = `${appUrl}/signature/${inviteToken}`;

    // Envoyer l'email
    let emailSent = false;
    try {
      const emailResult = await sendLeaseInviteEmail({
        to: email,
        tenantName: signerData.profile 
          ? `${signerData.profile.prenom} ${signerData.profile.nom}` 
          : undefined,
        ownerName: `${ownerProfile.prenom} ${ownerProfile.nom}`,
        propertyAddress: `${signerData.lease.property.adresse_complete}, ${signerData.lease.property.code_postal} ${signerData.lease.property.ville}`,
        rent: signerData.lease.loyer,
        charges: signerData.lease.charges_forfaitaires,
        leaseType: signerData.lease.type_bail,
        inviteUrl,
        role: signerData.role,
        isReminder: true,
      });
      emailSent = emailResult.success;
    } catch (emailError) {
      console.error("[resend] Erreur envoi email:", emailError);
    }

    // Créer une notification si le profil existe
    if (signerData.profile?.user_id) {
      await serviceClient.from("notifications").insert({
        user_id: signerData.profile.user_id,
        type: "lease_reminder",
        title: "📬 Rappel: Bail à signer",
        body: `${ownerProfile.prenom} ${ownerProfile.nom} vous rappelle de signer le bail pour ${signerData.lease.property.adresse_complete}.`,
        read: false,
        metadata: {
          lease_id: leaseId,
          signer_id: signerId,
          invite_url: inviteUrl,
        },
      });
    }

    // Journaliser
    await serviceClient.from("audit_log").insert({
      user_id: user.id,
      action: "invitation_resent",
      entity_type: "lease_signer",
      entity_id: signerId,
      metadata: {
        lease_id: leaseId,
        email,
        email_sent: emailSent,
      },
    });

    return NextResponse.json({
      success: true,
      email_sent: emailSent,
      message: emailSent
        ? `Rappel envoyé à ${email}`
        : `Rappel créé. Lien d'invitation: ${inviteUrl}`,
      invite_url: inviteUrl,
    });
  } catch (error: unknown) {
    console.error("[resend] Erreur:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}


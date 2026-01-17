export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { sendLeaseInviteEmail } from "@/lib/services/email-service";

const addSignerSchema = z.object({
  email: z.string().email("Email invalide"),
  name: z.string().nullable().optional(),
  role: z.enum(["locataire_principal", "colocataire", "garant"]),
});

/**
 * GET /api/leases/[id]/signers - Récupérer les signataires d'un bail
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

    const leaseId = params.id;

    const { data: signers, error } = await supabase
      .from("lease_signers")
      .select(`
        id,
        role,
        signature_status,
        signed_at,
        invited_email,
        profile:profile_id (
          id,
          prenom,
          nom,
          email,
          telephone,
          avatar_url
        )
      `)
      .eq("lease_id", leaseId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[signers] Erreur:", error);
      return NextResponse.json(
        { error: "Erreur récupération signataires" },
        { status: 500 }
      );
    }

    return NextResponse.json({ signers });
  } catch (error: unknown) {
    console.error("[signers/GET] Erreur:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/leases/[id]/signers - Ajouter un signataire au bail
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
    const validated = addSignerSchema.parse(body);

    // Récupérer le profil de l'utilisateur actuel
    const { data: ownerProfile } = await supabase
      .from("profiles")
      .select("id, role, prenom, nom")
      .eq("user_id", user.id)
      .single();

    if (!ownerProfile || (ownerProfile.role !== "owner" && ownerProfile.role !== "admin")) {
      return NextResponse.json(
        { error: "Seul un propriétaire peut ajouter des signataires" },
        { status: 403 }
      );
    }

    // Récupérer le bail avec la propriété
    const { data: lease, error: leaseError } = await serviceClient
      .from("leases")
      .select(`
        id,
        statut,
        type_bail,
        loyer,
        charges_forfaitaires,
        property:property_id (
          id,
          owner_id,
          adresse_complete,
          code_postal,
          ville
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

    // Vérifier que le propriétaire est bien le propriétaire du bien
    if (leaseData.property?.owner_id !== ownerProfile.id && ownerProfile.role !== "admin") {
      return NextResponse.json(
        { error: "Ce bail ne vous appartient pas" },
        { status: 403 }
      );
    }

    // Vérifier le statut du bail
    if (!["draft", "pending_signature"].includes(leaseData.statut)) {
      return NextResponse.json(
        { error: "Impossible d'ajouter un signataire à ce bail (statut: " + leaseData.statut + ")" },
        { status: 400 }
      );
    }

    // Si on ajoute un locataire principal, vérifier qu'il n'y en a pas déjà un
    if (validated.role === "locataire_principal") {
      const { data: existingMain } = await serviceClient
        .from("lease_signers")
        .select("id")
        .eq("lease_id", leaseId)
        .eq("role", "locataire_principal")
        .maybeSingle();

      if (existingMain) {
        return NextResponse.json(
          { error: "Un locataire principal existe déjà pour ce bail" },
          { status: 400 }
        );
      }
    }

    // Vérifier si l'email existe déjà comme signataire (par invited_email)
    const { data: existingByEmail } = await serviceClient
      .from("lease_signers")
      .select("id")
      .eq("lease_id", leaseId)
      .eq("invited_email", validated.email)
      .maybeSingle();

    if (existingByEmail) {
      return NextResponse.json(
        { error: "Cette personne est déjà signataire de ce bail" },
        { status: 400 }
      );
    }

    // Chercher si un profil existe déjà avec cet email
    const { data: existingUsers } = await serviceClient.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === validated.email.toLowerCase()
    );

    let profileId: string | null = null;

    if (existingUser) {
      // Récupérer le profil existant
      const { data: existingProfile } = await serviceClient
        .from("profiles")
        .select("id")
        .eq("user_id", existingUser.id)
        .single();

      if (existingProfile) {
        profileId = existingProfile.id;
      }
    }

    // Vérifier aussi par profile_id si un profil existe avec cet email
    if (profileId) {
      const { data: existingByProfile } = await serviceClient
        .from("lease_signers")
        .select("id")
        .eq("lease_id", leaseId)
        .eq("profile_id", profileId)
        .maybeSingle();

      if (existingByProfile) {
        return NextResponse.json(
          { error: "Cette personne est déjà signataire de ce bail" },
          { status: 400 }
        );
      }
    }

    // Créer le signataire
    const signerData: any = {
      lease_id: leaseId,
      role: validated.role,
      signature_status: "pending",
      invited_email: validated.email,
      invited_name: validated.name || null,
      invited_at: new Date().toISOString(),
    };

    if (profileId) {
      signerData.profile_id = profileId;
    }

    const { data: newSigner, error: signerError } = await serviceClient
      .from("lease_signers")
      .insert(signerData)
      .select()
      .single();

    if (signerError) {
      console.error("[signers/POST] Erreur création signataire:", signerError);
      return NextResponse.json(
        { error: "Erreur lors de l'ajout du signataire", details: signerError.message },
        { status: 500 }
      );
    }

    // Créer une notification si le profil existe
    if (profileId && existingUser) {
      await serviceClient.from("notifications").insert({
        user_id: existingUser.id,
        type: "lease_invite",
        title: validated.role === "garant" ? "🛡️ Demande de garantie" : "🏠 Nouveau bail à signer",
        body: `${ownerProfile.prenom} ${ownerProfile.nom} vous invite à ${
          validated.role === "garant" ? "vous porter garant pour" : "signer"
        } un bail pour ${leaseData.property.adresse_complete}, ${leaseData.property.code_postal} ${leaseData.property.ville}.`,
        read: false,
        metadata: {
          lease_id: leaseId,
          property_id: leaseData.property.id,
          owner_name: `${ownerProfile.prenom} ${ownerProfile.nom}`,
          role: validated.role,
        },
      });
    }

    // Envoyer l'email d'invitation
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const inviteToken = Buffer.from(`${leaseId}:${validated.email}:${Date.now()}`).toString("base64url");
    const inviteUrl = `${appUrl}/signature/${inviteToken}`;

    let emailSent = false;
    try {
      const emailResult = await sendLeaseInviteEmail({
        to: validated.email,
        tenantName: validated.name || undefined,
        ownerName: `${ownerProfile.prenom} ${ownerProfile.nom}`,
        propertyAddress: `${leaseData.property.adresse_complete}, ${leaseData.property.code_postal} ${leaseData.property.ville}`,
        rent: leaseData.loyer,
        charges: leaseData.charges_forfaitaires,
        leaseType: leaseData.type_bail,
        inviteUrl,
        role: validated.role,
      });
      emailSent = emailResult.success;
    } catch (emailError) {
      console.error("[signers/POST] Erreur envoi email:", emailError);
    }

    // Mettre à jour le statut du bail si nécessaire
    if (leaseData.statut === "draft") {
      await serviceClient
        .from("leases")
        .update({ statut: "pending_signature" })
        .eq("id", leaseId);
    }

    // Journaliser
    await serviceClient.from("audit_log").insert({
      user_id: user.id,
      action: "signer_added",
      entity_type: "lease_signer",
      entity_id: newSigner.id,
      metadata: {
        lease_id: leaseId,
        email: validated.email,
        role: validated.role,
        email_sent: emailSent,
      },
    });

    return NextResponse.json({
      success: true,
      signer: newSigner,
      email_sent: emailSent,
      message: emailSent
        ? `Invitation envoyée à ${validated.email}`
        : `Signataire ajouté. Lien d'invitation: ${inviteUrl}`,
      invite_url: inviteUrl,
    });
  } catch (error: unknown) {
    console.error("[signers/POST] Erreur:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

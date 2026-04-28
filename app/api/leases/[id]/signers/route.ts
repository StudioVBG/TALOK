export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { sendLeaseInviteEmail } from "@/lib/services/email-service";
import { applyRateLimit } from "@/lib/security/rate-limit";

const addSignerSchema = z.object({
  email: z.string().email("Email invalide"),
  name: z.string().nullable().optional(),
  role: z.enum(["locataire_principal", "colocataire", "garant"]),
});

/**
 * GET /api/leases/[id]/signers - Récupérer les signataires d'un bail
 *
 * @version 2026-01-22 - Fix: Next.js 15 params Promise pattern
 */
export async function GET(
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

    const leaseId = id;

    const { data: signers, error } = await supabase
      .from("lease_signers")
      .select(`
        id,
        role,
        signature_status,
        signed_at,
        invited_email,
        invited_name,
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
 *
 * @version 2026-01-22 - Fix: Next.js 15 params Promise pattern
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const rateLimitResponse = await applyRateLimit(request, "leaseInvite");
    if (rateLimitResponse) return rateLimitResponse;

    const supabase = await createClient();
    const serviceClient = getServiceClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const leaseId = id;
    const body = await request.json();
    const parseResult = addSignerSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parseResult.error.errors },
        { status: 400 }
      );
    }
    const validated = parseResult.data;

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

    // ✅ SOTA 2026: Vérifier le statut du bail — autoriser l'ajout de signataires
    // tant que le bail n'est pas encore activé/terminé.
    // Cas légitime : ajout d'un garant APRÈS signature initiale (fully_signed).
    const ALLOWED_SIGNER_ADD_STATUS = [
      "draft",
      "sent",
      "pending_signature",
      "partially_signed",
      "pending_owner_signature",
      "fully_signed",
    ];
    if (!ALLOWED_SIGNER_ADD_STATUS.includes(leaseData.statut)) {
      return NextResponse.json(
        { error: "Impossible d'ajouter un signataire à ce bail (statut: " + leaseData.statut + ")" },
        { status: 400 }
      );
    }

    // Résoudre profileId pour l'email demandé (utilisé pour doublon et pour création du signer)
    let profileId: string | null = null;
    const { data: existingUsers } = await serviceClient.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === validated.email.toLowerCase()
    );
    if (existingUser) {
      const { data: existingProfile } = await serviceClient
        .from("profiles")
        .select("id")
        .eq("user_id", existingUser.id)
        .single();
      if (existingProfile) profileId = existingProfile.id;
    }

    // Si on ajoute un locataire principal, vérifier s'il existe déjà (même email = relance, autre email = blocage)
    if (validated.role === "locataire_principal") {
      const { data: existingMain } = await serviceClient
        .from("lease_signers")
        .select("id, invited_email, profile_id")
        .eq("lease_id", leaseId)
        .eq("role", "locataire_principal")
        .maybeSingle();

      if (existingMain) {
        const existingRow = existingMain as { invited_email?: string | null; profile_id?: string | null };
        const existingEmail = existingRow.invited_email?.toLowerCase().trim();
        const requestedEmail = validated.email.toLowerCase().trim();
        const isSameEmail = existingEmail === requestedEmail;
        const isSameProfile = existingRow.profile_id && profileId === existingRow.profile_id;

        if (isSameEmail || isSameProfile) {
          // Relance : créer une nouvelle invitation et renvoyer l'email (pas de nouveau signer)
          const invitationToken = randomBytes(32).toString("hex");
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 30);
          await serviceClient.from("invitations").insert({
            token: invitationToken,
            email: validated.email,
            role: "locataire_principal",
            property_id: leaseData.property?.id ?? null,
            unit_id: null,
            lease_id: leaseId,
            created_by: ownerProfile.id,
            expires_at: expiresAt.toISOString(),
          });
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
          const inviteUrl = `${appUrl}/invite/${invitationToken}`;
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
              role: "locataire_principal",
            });
            emailSent = emailResult.success;
          } catch (e) {
            console.error("[signers/POST] Erreur envoi email relance:", e);
          }
          return NextResponse.json({
            success: true,
            resent: true,
            message: emailSent ? `Invitation relancée à ${validated.email}` : `Lien d'invitation : ${inviteUrl}`,
            invite_url: inviteUrl,
          });
        }
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

    // Créer un record dans la table invitations pour que le locataire puisse accepter via /invite/:token
    const invitationToken = randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    const { error: invError } = await serviceClient.from("invitations").insert({
      token: invitationToken,
      email: validated.email,
      role: validated.role,
      property_id: leaseData.property?.id ?? null,
      unit_id: null,
      lease_id: leaseId,
      created_by: ownerProfile.id,
      expires_at: expiresAt.toISOString(),
    });
    if (invError) {
      console.error("[signers/POST] Erreur création invitation (non bloquante):", invError);
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

    // Envoyer l'email d'invitation (lien /invite pour accepter l'invitation et lier le compte)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const inviteUrl = `${appUrl}/invite/${invitationToken}`;

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

    // ✅ SOTA 2026: Recalculer le statut du bail après ajout d'un signataire
    // - draft → pending_signature (premier signataire ajouté)
    // - fully_signed → pending_signature (nouveau signataire pas encore signé)
    // - partially_signed reste partially_signed
    const statusRequiringUpdate = ["draft", "fully_signed", "pending_owner_signature"];
    if (statusRequiringUpdate.includes(leaseData.statut)) {
      const newStatus = leaseData.statut === "draft" ? "pending_signature" : "pending_signature";
      await serviceClient
        .from("leases")
        .update({ statut: newStatus })
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

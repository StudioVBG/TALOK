export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * API Route pour inviter un garant
 * POST /api/guarantors/invite - Propriétaire invite un garant pour un bail
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient, createRouteHandlerClient } from "@/lib/supabase/server";
import { createGuarantorInvitationSchema } from "@/lib/validations/guarantor";
import { sendEmail } from "@/lib/services/email-service";
import { emailTemplates } from "@/lib/emails/templates";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    // Récupérer le profil du propriétaire
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role, prenom, nom")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // Seuls les propriétaires et admins peuvent inviter des garants
    if (profile.role !== "owner" && profile.role !== "admin") {
      return NextResponse.json(
        { error: "Seuls les propriétaires peuvent inviter des garants" },
        { status: 403 }
      );
    }

    // Valider les données
    const body = await request.json();
    const validatedData = createGuarantorInvitationSchema.parse(body);

    // Vérifier que le bail appartient au propriétaire
    if (profile.role === "owner") {
      const { data: lease } = await supabase
        .from("leases")
        .select("id, property:properties(id, owner_id, adresse_complete, ville)")
        .eq("id", validatedData.lease_id)
        .single();

      if (!lease || (lease.property as any)?.owner_id !== profile.id) {
        return NextResponse.json(
          { error: "Bail non trouvé ou non autorisé" },
          { status: 403 }
        );
      }
    }

    // Vérifier qu'il n'y a pas déjà une invitation active pour cet email sur ce bail
    const serviceClient = createServiceRoleClient();
    const { data: existingInvitation } = await serviceClient
      .from("guarantor_invitations")
      .select("id, status")
      .eq("lease_id", validatedData.lease_id)
      .eq("guarantor_email", validatedData.guarantor_email)
      .in("status", ["pending", "accepted"])
      .maybeSingle();

    if (existingInvitation) {
      return NextResponse.json(
        { error: "Une invitation est déjà en cours pour cet email sur ce bail" },
        { status: 409 }
      );
    }

    // Créer l'invitation
    const { data: invitation, error: createError } = await serviceClient
      .from("guarantor_invitations")
      .insert({
        lease_id: validatedData.lease_id,
        tenant_profile_id: validatedData.tenant_profile_id,
        invited_by: profile.id,
        guarantor_name: validatedData.guarantor_name,
        guarantor_email: validatedData.guarantor_email,
        guarantor_phone: validatedData.guarantor_phone || null,
        guarantor_type: validatedData.guarantor_type,
        relationship: validatedData.relationship || null,
      })
      .select()
      .single();

    if (createError) {
      console.error("Erreur création invitation:", createError);
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    // Récupérer les infos du locataire et du bien pour l'email
    const { data: lease } = await serviceClient
      .from("leases")
      .select(`
        loyer, charges_forfaitaires,
        property:properties(adresse_complete, ville),
        tenant:profiles!leases_tenant_id_fkey(prenom, nom)
      `)
      .eq("id", validatedData.lease_id)
      .single();

    const tenantName = lease?.tenant
      ? `${(lease.tenant as any).prenom || ""} ${(lease.tenant as any).nom || ""}`.trim()
      : "le locataire";

    const propertyAddress = (lease?.property as any)?.adresse_complete || "";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.talok.fr";
    const inviteUrl = `${appUrl}/auth/signup?role=guarantor&token=${invitation.invitation_token}&email=${encodeURIComponent(validatedData.guarantor_email)}`;

    // Envoyer l'email d'invitation
    try {
      const template = emailTemplates.guarantorInvitation({
        guarantorName: validatedData.guarantor_name,
        ownerName: `${profile.prenom || ""} ${profile.nom || ""}`.trim() || "Le propriétaire",
        tenantName,
        propertyAddress,
        rentAmount: lease?.loyer || 0,
        chargesAmount: lease?.charges_forfaitaires || 0,
        cautionType: validatedData.guarantor_type,
        inviteUrl,
      });

      await sendEmail({
        to: validatedData.guarantor_email,
        subject: template.subject,
        html: template.html,
        tags: [{ name: "type", value: "guarantor_invitation" }],
        idempotencyKey: `guarantor-invitation/${invitation.id}`,
      });
    } catch (emailError) {
      console.error("[POST /invite] Email send error:", emailError);
      // Don't fail the invitation if email fails - it's still created
    }

    return NextResponse.json(invitation, { status: 201 });
  } catch (error: unknown) {
    if ((error as any).name === "ZodError") {
      return NextResponse.json(
        { error: "Données invalides", details: (error as any).errors },
        { status: 400 }
      );
    }
    console.error("Erreur API guarantors/invite POST:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

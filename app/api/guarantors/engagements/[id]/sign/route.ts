export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * API Route pour signer un engagement de caution
 * POST /api/guarantors/engagements/[id]/sign
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient, createRouteHandlerClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/services/email-service";
import { emailTemplates } from "@/lib/emails/templates";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: engagementId } = await params;
    const supabase = await createRouteHandlerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    // Récupérer le profil du garant
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role, prenom, nom")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    if (profile.role !== "guarantor" && profile.role !== "admin") {
      return NextResponse.json(
        { error: "Seuls les garants peuvent signer un engagement" },
        { status: 403 }
      );
    }

    // Récupérer l'engagement
    const serviceClient = createServiceRoleClient();
    const { data: engagement, error: fetchError } = await serviceClient
      .from("guarantor_engagements")
      .select(`
        *,
        tenant:profiles!guarantor_engagements_tenant_profile_id_fkey(id, prenom, nom),
        lease:leases!guarantor_engagements_lease_id_fkey(
          id, loyer, charges_forfaitaires,
          property:properties(id, adresse_complete, ville, owner_id)
        )
      `)
      .eq("id", engagementId)
      .single();

    if (fetchError || !engagement) {
      return NextResponse.json(
        { error: "Engagement non trouvé" },
        { status: 404 }
      );
    }

    // Vérifier que l'engagement appartient au garant
    if (profile.role === "guarantor" && engagement.guarantor_profile_id !== profile.id) {
      return NextResponse.json(
        { error: "Vous n'êtes pas autorisé à signer cet engagement" },
        { status: 403 }
      );
    }

    // Vérifier que l'engagement est en attente de signature
    if (engagement.statut !== "pending") {
      return NextResponse.json(
        { error: "Cet engagement n'est pas en attente de signature" },
        { status: 400 }
      );
    }

    // Vérifier que le garant a donné son consentement
    const { data: guarantorProfile } = await serviceClient
      .from("guarantor_profiles")
      .select("consent_garant, documents_verified")
      .eq("profile_id", profile.id)
      .single();

    if (!guarantorProfile?.consent_garant) {
      return NextResponse.json(
        { error: "Vous devez d'abord donner votre consentement de cautionnement dans votre profil" },
        { status: 400 }
      );
    }

    // Optionnel: body peut contenir le numéro Visale
    let visaleNumber: string | null = null;
    try {
      const body = await request.json();
      visaleNumber = body?.visale_number || null;
    } catch {
      // No body is fine
    }

    // Signer l'engagement
    const now = new Date().toISOString();
    const updateData: Record<string, unknown> = {
      statut: "active",
      date_signature: now.split("T")[0], // DATE format
      signed_at: now,
    };

    if (visaleNumber && engagement.type_garantie === "visale") {
      updateData.visale_number = visaleNumber;
    }

    const { data: updatedEngagement, error: updateError } = await serviceClient
      .from("guarantor_engagements")
      .update(updateData)
      .eq("id", engagementId)
      .select(`
        *,
        tenant:profiles!guarantor_engagements_tenant_profile_id_fkey(id, prenom, nom),
        lease:leases!guarantor_engagements_lease_id_fkey(
          id, loyer, charges_forfaitaires,
          property:properties(id, adresse_complete, ville)
        )
      `)
      .single();

    if (updateError) {
      console.error("Erreur signature engagement:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Notifier le propriétaire que le garant a signé
    try {
      const ownerId = (engagement.lease as any)?.property?.owner_id;
      if (ownerId) {
        const { data: ownerProfile } = await serviceClient
          .from("profiles")
          .select("user_id, prenom, nom")
          .eq("id", ownerId)
          .single();

        if (ownerProfile?.user_id) {
          const { data: { user: ownerUser } } = await serviceClient.auth.admin.getUserById(ownerProfile.user_id);
          if (ownerUser?.email) {
            const guarantorName = `${profile.prenom || ""} ${profile.nom || ""}`.trim() || "Le garant";
            const tenantName = `${(engagement.tenant as any)?.prenom || ""} ${(engagement.tenant as any)?.nom || ""}`.trim() || "le locataire";
            const propertyAddress = (engagement.lease as any)?.property?.adresse_complete || "";

            const template = emailTemplates.guarantorEngagementSigned({
              ownerName: `${ownerProfile.prenom || ""} ${ownerProfile.nom || ""}`.trim(),
              guarantorName,
              tenantName,
              propertyAddress,
              cautionType: engagement.type_garantie,
            });

            await sendEmail({
              to: ownerUser.email,
              subject: template.subject,
              html: template.html,
              tags: [{ name: "type", value: "guarantor_engagement_signed" }],
              idempotencyKey: `guarantor-engagement-signed/${engagementId}`,
            });
          }
        }
      }
    } catch (emailError) {
      console.error("[POST /sign] Email notification error:", emailError);
    }

    return NextResponse.json(updatedEngagement);
  } catch (error: unknown) {
    console.error("Erreur API engagements/sign POST:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

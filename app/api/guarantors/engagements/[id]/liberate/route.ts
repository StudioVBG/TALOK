export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * API Route pour libérer un garant de son engagement
 * POST /api/guarantors/engagements/[id]/liberate
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient, createRouteHandlerClient } from "@/lib/supabase/server";
import { liberateEngagementSchema } from "@/lib/validations/guarantor";
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

    // Récupérer le profil
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role, prenom, nom")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // Seuls les propriétaires et admins peuvent libérer un garant
    if (profile.role !== "owner" && profile.role !== "admin") {
      return NextResponse.json(
        { error: "Seuls les propriétaires peuvent libérer un garant" },
        { status: 403 }
      );
    }

    // Valider les données
    const body = await request.json();
    const validatedData = liberateEngagementSchema.parse(body);

    // Récupérer l'engagement
    const serviceClient = createServiceRoleClient();
    const { data: engagement, error: fetchError } = await serviceClient
      .from("guarantor_engagements")
      .select(`
        *,
        guarantor:guarantor_profiles!guarantor_engagements_guarantor_profile_id_fkey(
          profile_id
        ),
        tenant:profiles!guarantor_engagements_tenant_profile_id_fkey(id, prenom, nom),
        lease:leases!guarantor_engagements_lease_id_fkey(
          id, loyer, property:properties(id, adresse_complete, ville, owner_id)
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

    // Vérifier que le bail appartient au propriétaire
    if (profile.role === "owner") {
      const ownerId = (engagement.lease as any)?.property?.owner_id;
      if (ownerId !== profile.id) {
        return NextResponse.json(
          { error: "Vous n'êtes pas autorisé à libérer cet engagement" },
          { status: 403 }
        );
      }
    }

    // Vérifier que l'engagement est actif
    if (engagement.statut !== "active") {
      return NextResponse.json(
        { error: "Seuls les engagements actifs peuvent être libérés" },
        { status: 400 }
      );
    }

    // Libérer l'engagement
    const now = new Date().toISOString();
    const { data: updatedEngagement, error: updateError } = await serviceClient
      .from("guarantor_engagements")
      .update({
        statut: "terminated",
        liberated_at: now,
        liberation_reason: validatedData.reason,
      })
      .eq("id", engagementId)
      .select()
      .single();

    if (updateError) {
      console.error("Erreur libération engagement:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Notifier le garant de sa libération
    try {
      const guarantorProfileId = (engagement.guarantor as any)?.profile_id;
      if (guarantorProfileId) {
        const { data: guarantorProf } = await serviceClient
          .from("profiles")
          .select("user_id, prenom, nom")
          .eq("id", guarantorProfileId)
          .single();

        if (guarantorProf?.user_id) {
          const { data: { user: guarantorUser } } = await serviceClient.auth.admin.getUserById(guarantorProf.user_id);
          if (guarantorUser?.email) {
            const guarantorName = `${guarantorProf.prenom || ""} ${guarantorProf.nom || ""}`.trim() || "Garant";
            const tenantName = `${(engagement.tenant as any)?.prenom || ""} ${(engagement.tenant as any)?.nom || ""}`.trim() || "le locataire";
            const propertyAddress = (engagement.lease as any)?.property?.adresse_complete || "";

            const template = emailTemplates.guarantorLiberated({
              guarantorName,
              tenantName,
              propertyAddress,
              reason: validatedData.reason,
            });

            await sendEmail({
              to: guarantorUser.email,
              subject: template.subject,
              html: template.html,
              tags: [{ name: "type", value: "guarantor_liberated" }],
              idempotencyKey: `guarantor-liberated/${engagementId}`,
            });
          }
        }
      }
    } catch (emailError) {
      console.error("[POST /liberate] Email notification error:", emailError);
    }

    return NextResponse.json(updatedEngagement);
  } catch (error: unknown) {
    if ((error as any).name === "ZodError") {
      return NextResponse.json(
        { error: "Données invalides", details: (error as any).errors },
        { status: 400 }
      );
    }
    console.error("Erreur API engagements/liberate POST:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';

/**
 * API Routes pour les engagements de caution
 * GET /api/guarantors/engagements - Liste des engagements
 * POST /api/guarantors/engagements - Créer un engagement (propriétaire)
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient, createRouteHandlerClient } from "@/lib/supabase/server";
import { createEngagementSchema } from "@/lib/validations/guarantor";
import { sendEmail } from "@/lib/services/email-service";
import { emailTemplates } from "@/lib/emails/templates";

export async function GET() {
  try {
    const supabase = await createRouteHandlerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    // Récupérer le profil
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    let query = supabase
      .from("guarantor_engagements")
      .select(`
        *,
        tenant:profiles!guarantor_engagements_tenant_profile_id_fkey(
          id, prenom, nom
        ),
        lease:leases!guarantor_engagements_lease_id_fkey(
          id, loyer, charges_forfaitaires, date_debut,
          property:properties(
            id, adresse_complete, ville
          )
        )
      `)
      .order("created_at", { ascending: false });

    // Filtrer selon le rôle
    if (profile.role === "guarantor") {
      query = query.eq("guarantor_profile_id", profile.id);
    } else if (profile.role === "owner") {
      // Récupérer les engagements pour les baux du propriétaire
      const { data: ownerLeases } = await supabase
        .from("leases")
        .select("id")
        .in("property_id",
          supabase
            .from("properties")
            .select("id")
            .eq("owner_id", profile.id) as any
        );
      
      if (ownerLeases && ownerLeases.length > 0) {
        query = query.in("lease_id", ownerLeases.map(l => l.id));
      } else {
        return NextResponse.json({ engagements: [] });
      }
    }

    const { data: engagements, error } = await query;

    if (error) {
      console.error("Erreur récupération engagements:", error);
      return NextResponse.json({ error: error instanceof Error ? (error as Error).message : "Une erreur est survenue" }, { status: 500 });
    }

    return NextResponse.json({ engagements: engagements || [] });
  } catch (error: unknown) {
    console.error("Erreur API engagements GET:", error);
    return NextResponse.json(
      { error: error instanceof Error ? (error as Error).message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    // Récupérer le profil
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // Seuls les propriétaires et admins peuvent créer des engagements
    if (profile.role !== "owner" && profile.role !== "admin") {
      return NextResponse.json(
        { error: "Seuls les propriétaires peuvent créer des engagements" },
        { status: 403 }
      );
    }

    // Valider les données
    const body = await request.json();
    const validatedData = createEngagementSchema.parse(body);

    // Vérifier que le bail appartient au propriétaire
    if (profile.role === "owner") {
      const { data: lease } = await supabase
        .from("leases")
        .select("id, property:properties(owner_id)")
        .eq("id", validatedData.lease_id)
        .single();

      if (!lease || (lease.property as any)?.owner_id !== profile.id) {
        return NextResponse.json(
          { error: "Bail non trouvé ou non autorisé" },
          { status: 403 }
        );
      }
    }

    // Vérifier que le garant existe
    const { data: guarantorProfile } = await supabase
      .from("guarantor_profiles")
      .select("profile_id")
      .eq("profile_id", validatedData.guarantor_profile_id)
      .single();

    if (!guarantorProfile) {
      return NextResponse.json(
        { error: "Profil garant non trouvé" },
        { status: 404 }
      );
    }

    // Créer l'engagement
    const serviceClient = createServiceRoleClient();
    const { data: engagement, error: createError } = await serviceClient
      .from("guarantor_engagements")
      .insert({
        ...validatedData,
        status: "pending_signature",
      })
      .select(`
        *,
        tenant:profiles!guarantor_engagements_tenant_profile_id_fkey(
          id, prenom, nom
        ),
        lease:leases!guarantor_engagements_lease_id_fkey(
          id, loyer, charges_forfaitaires
        )
      `)
      .single();

    if (createError) {
      console.error("Erreur création engagement:", createError);
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    // Send notification to guarantor
    try {
      const { data: guarantorProf } = await serviceClient
        .from("profiles")
        .select("prenom, nom, user_id")
        .eq("id", validatedData.guarantor_profile_id)
        .single();
      if (guarantorProf?.user_id) {
        const { data: { user: guarantorUser } } = await serviceClient.auth.admin.getUserById(guarantorProf.user_id);
        if (guarantorUser?.email) {
          const eng = engagement as any;
          const tenantName = `${eng.tenant?.prenom || ""} ${eng.tenant?.nom || ""}`.trim() || "le locataire";
          const guarantorName = `${guarantorProf.prenom || ""} ${guarantorProf.nom || ""}`.trim() || "Garant";
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.talok.fr";

          // Fetch property address via lease
          const { data: leaseWithProp } = await serviceClient
            .from("leases")
            .select("property:properties(adresse_complete)")
            .eq("id", validatedData.lease_id)
            .single();
          const propertyAddress = (leaseWithProp?.property as any)?.adresse_complete || "";

          const template = emailTemplates.guarantorEngagement({
            guarantorName,
            tenantName,
            propertyAddress,
            rentAmount: eng.lease?.loyer || 0,
            chargesAmount: eng.lease?.charges_forfaitaires || 0,
            dashboardUrl: `${appUrl}/guarantor/dashboard`,
          });
          await sendEmail({
            to: guarantorUser.email,
            subject: template.subject,
            html: template.html,
            tags: [{ name: "type", value: "guarantor_engagement" }],
            idempotencyKey: `guarantor-engagement/${engagement.id}`,
          });
        }
      }
    } catch (e) {
      console.error("[POST /engagements] Email send error:", e);
    }

    return NextResponse.json(engagement, { status: 201 });
  } catch (error: unknown) {
    if ((error as any).name === "ZodError") {
      return NextResponse.json(
        { error: "Données invalides", details: (error as any).errors },
        { status: 400 }
      );
    }
    console.error("Erreur API engagements POST:", error);
    return NextResponse.json(
      { error: error instanceof Error ? (error as Error).message : "Erreur serveur" },
      { status: 500 }
    );
  }
}








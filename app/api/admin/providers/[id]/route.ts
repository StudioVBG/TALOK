export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/helpers/auth-helper";
import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/admin/providers/[id] - Récupérer les détails d'un prestataire
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { error, user, supabase } = await requireAdmin(request);

    if (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Une erreur est survenue" },
        { status: error.status }
      );
    }

    if (!user || !supabase) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const providerId = params.id;

    // Récupérer le provider_profile
    const { data: providerProfile, error: providerError } = await supabase
      .from("provider_profiles")
      .select("*")
      .eq("profile_id", providerId as any)
      .single();

    if (providerError || !providerProfile) {
      return NextResponse.json(
        { error: "Prestataire non trouvé" },
        { status: 404 }
      );
    }

    // Récupérer le profil
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", providerId as any)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Profil non trouvé" },
        { status: 404 }
      );
    }

    // Récupérer l'email depuis auth.users
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { data: { user: authUser }, error: authUserError } = await adminClient.auth.admin.getUserById(profile.user_id);

    return NextResponse.json({
      id: (profile as any).id,
      profile_id: (profile as any).id,
      user_id: profile.user_id,
      name: `${profile.prenom || ""} ${profile.nom || ""}`.trim() || "Sans nom",
      prenom: profile.prenom || "",
      nom: profile.nom || "",
      email: authUser?.email || undefined,
      phone: profile.telephone || undefined,
      avatar_url: profile.avatar_url || undefined,
      date_naissance: profile.date_naissance || undefined,
      suspended: profile.suspended || false,
      suspended_at: profile.suspended_at || undefined,
      suspension_reason: profile.suspension_reason || undefined,
      type_services: providerProfile.type_services || [],
      certifications: providerProfile.certifications || undefined,
      zones_intervention: providerProfile.zones_intervention || undefined,
      status: providerProfile.status,
      validated_at: providerProfile.validated_at || undefined,
      validated_by: providerProfile.validated_by || undefined,
      rejection_reason: providerProfile.rejection_reason || undefined,
      created_at: providerProfile.created_at,
      updated_at: providerProfile.updated_at,
    });
  } catch (error: unknown) {
    console.error("Error in GET /api/admin/providers/[id]:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/providers/[id] - Modifier les informations d'un prestataire
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { error, user, supabase } = await requireAdmin(request);

    if (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Une erreur est survenue" },
        { status: error.status }
      );
    }

    if (!user || !supabase) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const providerId = params.id;
    const body = await request.json();

    // Mettre à jour le profil
    const profileUpdates: any = {};
    if (body.prenom !== undefined) profileUpdates.prenom = body.prenom;
    if (body.nom !== undefined) profileUpdates.nom = body.nom;
    if (body.phone !== undefined) profileUpdates.telephone = body.phone;
    if (body.date_naissance !== undefined) profileUpdates.date_naissance = body.date_naissance;

    if (Object.keys(profileUpdates).length > 0) {
      const { error: profileError } = await supabase
        .from("profiles")
        .update(profileUpdates)
        .eq("id", providerId as any);

      if (profileError) {
        console.error("Error updating profile:", profileError);
        return NextResponse.json(
          { error: profileError.message || "Erreur lors de la mise à jour du profil" },
          { status: 500 }
        );
      }
    }

    // Mettre à jour le provider_profile
    const providerUpdates: any = {};
    if (body.type_services !== undefined) providerUpdates.type_services = body.type_services;
    if (body.certifications !== undefined) providerUpdates.certifications = body.certifications;
    if (body.zones_intervention !== undefined) providerUpdates.zones_intervention = body.zones_intervention;

    if (Object.keys(providerUpdates).length > 0) {
      const { error: providerError } = await supabase
        .from("provider_profiles")
        .update(providerUpdates)
        .eq("profile_id", providerId as any);

      if (providerError) {
        console.error("Error updating provider profile:", providerError);
        return NextResponse.json(
          { error: providerError.message || "Erreur lors de la mise à jour du profil prestataire" },
          { status: 500 }
        );
      }
    }

    // Mettre à jour l'email si fourni (nécessite le service role)
    if (body.email !== undefined && body.email !== null) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("id", providerId as any)
        .single();

    const profileData = profile as any;

      if (profile?.user_id) {
        const adminClient = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          {
            auth: {
              autoRefreshToken: false,
              persistSession: false,
            },
          }
        );

        const { error: emailError } = await adminClient.auth.admin.updateUserById(
          profile.user_id,
          { email: body.email }
        );

        if (emailError) {
          console.error("Error updating email:", emailError);
          return NextResponse.json(
            { error: emailError.message || "Erreur lors de la mise à jour de l'email" },
            { status: 500 }
          );
        }
      }
    }

    // Journaliser l'action
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "provider_updated",
      entity_type: "provider_profile",
      entity_id: providerId,
      metadata: { updates: { ...profileUpdates, ...providerUpdates, email: body.email ? "updated" : undefined } },
    } as any);

    return NextResponse.json({ success: true, message: "Prestataire mis à jour avec succès" });
  } catch (error: unknown) {
    console.error("Error in PATCH /api/admin/providers/[id]:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}






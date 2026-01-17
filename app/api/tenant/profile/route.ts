export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

const profileUpdateSchema = z.object({
  profileId: z.string().uuid(),
  prenom: z.string().min(1, "Prénom requis"),
  nom: z.string().min(1, "Nom requis"),
  telephone: z.string().optional(),
  date_naissance: z.string().optional(),
  lieu_naissance: z.string().optional(),
  nationalite: z.string().optional(),
  adresse: z.string().optional(),
  situation_pro: z.string().optional(),
  revenus_mensuels: z.number().nullable().optional(),
  nb_adultes: z.number().min(1).max(10).optional(),
  nb_enfants: z.number().min(0).max(20).optional(),
});

/**
 * PUT /api/tenant/profile
 * Met à jour le profil du locataire
 */
export async function PUT(request: Request) {
  try {
    const supabase = await createClient();

    // Vérifier l'authentification
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    // Valider les données
    const body = await request.json();
    const validated = profileUpdateSchema.parse(body);

    // Vérifier que le profil appartient à l'utilisateur
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id, user_id, role")
      .eq("id", validated.profileId)
      .single();

    if (!existingProfile || existingProfile.user_id !== user.id) {
      return NextResponse.json(
        { error: "Profil non trouvé ou accès non autorisé" },
        { status: 403 }
      );
    }

    if (existingProfile.role !== "tenant") {
      return NextResponse.json(
        { error: "Ce profil n'est pas un locataire" },
        { status: 400 }
      );
    }

    // Mettre à jour le profil principal
    const profileUpdate: Record<string, any> = {
      prenom: validated.prenom,
      nom: validated.nom,
      updated_at: new Date().toISOString(),
    };

    if (validated.telephone) profileUpdate.telephone = validated.telephone;
    if (validated.date_naissance) profileUpdate.date_naissance = validated.date_naissance;
    if (validated.lieu_naissance) profileUpdate.lieu_naissance = validated.lieu_naissance;
    if (validated.nationalite) profileUpdate.nationalite = validated.nationalite;
    if (validated.adresse) profileUpdate.adresse = validated.adresse;

    const { error: profileError } = await supabase
      .from("profiles")
      .update(profileUpdate)
      .eq("id", validated.profileId);

    if (profileError) {
      console.error("[TenantProfile] Erreur update profil:", profileError);
      return NextResponse.json(
        { error: "Erreur lors de la mise à jour du profil" },
        { status: 500 }
      );
    }

    // Mettre à jour ou créer le tenant_profiles
    const tenantData: Record<string, any> = {};
    
    if (validated.situation_pro) tenantData.situation_pro = validated.situation_pro;
    if (validated.revenus_mensuels !== undefined) tenantData.revenus_mensuels = validated.revenus_mensuels;
    if (validated.nb_adultes !== undefined) tenantData.nb_adultes = validated.nb_adultes;
    if (validated.nb_enfants !== undefined) tenantData.nb_enfants = validated.nb_enfants;

    if (Object.keys(tenantData).length > 0) {
      // Vérifier si tenant_profiles existe
      const { data: existingTenant } = await supabase
        .from("tenant_profiles")
        .select("profile_id")
        .eq("profile_id", validated.profileId)
        .maybeSingle();

      if (existingTenant) {
        // Update
        const { error: tenantError } = await supabase
          .from("tenant_profiles")
          .update({
            ...tenantData,
            updated_at: new Date().toISOString(),
          })
          .eq("profile_id", validated.profileId);

        if (tenantError) {
          console.error("[TenantProfile] Erreur update tenant_profiles:", tenantError);
        }
      } else {
        // Insert
        const { error: tenantError } = await supabase
          .from("tenant_profiles")
          .insert({
            profile_id: validated.profileId,
            ...tenantData,
            nb_adultes: validated.nb_adultes || 1,
            nb_enfants: validated.nb_enfants || 0,
            garant_required: false,
          });

        if (tenantError) {
          console.error("[TenantProfile] Erreur insert tenant_profiles:", tenantError);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Profil mis à jour avec succès",
    });

  } catch (error: unknown) {
    console.error("[TenantProfile] Erreur:", error);

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

/**
 * GET /api/tenant/profile
 * Récupère le profil du locataire connecté
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    // Vérifier l'authentification
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    // Récupérer le profil
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select(`
        id,
        user_id,
        role,
        prenom,
        nom,
        email,
        telephone,
        avatar_url,
        date_naissance,
        lieu_naissance,
        nationalite,
        adresse
      `)
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Profil non trouvé" },
        { status: 404 }
      );
    }

    if (profile.role !== "tenant") {
      return NextResponse.json(
        { error: "Ce profil n'est pas un locataire" },
        { status: 400 }
      );
    }

    // Récupérer les données tenant
    const { data: tenantProfile } = await supabase
      .from("tenant_profiles")
      .select("*")
      .eq("profile_id", profile.id)
      .maybeSingle();

    return NextResponse.json({
      profile,
      tenantProfile,
    });

  } catch (error: unknown) {
    console.error("[TenantProfile GET] Erreur:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}







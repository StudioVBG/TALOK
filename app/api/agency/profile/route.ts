export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

/**
 * API Routes pour le profil agence
 * GET /api/agency/profile - Récupérer le profil
 * POST /api/agency/profile - Créer le profil
 * PUT /api/agency/profile - Mettre à jour le profil
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

// Schéma de validation
const agencyProfileSchema = z.object({
  raison_sociale: z.string().min(2, "Raison sociale requise"),
  forme_juridique: z.enum(["SARL", "SAS", "SASU", "SCI", "EURL", "EI", "SA", "autre"]).optional(),
  siret: z.string().optional(),
  numero_carte_pro: z.string().optional(),
  carte_pro_delivree_par: z.string().optional(),
  carte_pro_validite: z.string().optional(),
  garantie_financiere_montant: z.number().optional(),
  garantie_financiere_organisme: z.string().optional(),
  assurance_rcp: z.string().optional(),
  assurance_rcp_organisme: z.string().optional(),
  adresse_siege: z.string().optional(),
  logo_url: z.string().url().optional().nullable(),
  website: z.string().url().optional().nullable(),
  description: z.string().optional(),
  zones_intervention: z.array(z.string()).optional(),
  services_proposes: z.array(z.string()).optional(),
  commission_gestion_defaut: z.number().min(0).max(100).optional(),
});

// Schéma de mise à jour (défini explicitement pour éviter les problèmes webpack avec .partial())
const agencyProfileUpdateSchema = z.object({
  raison_sociale: z.string().min(2, "Raison sociale requise").optional(),
  forme_juridique: z.enum(["SARL", "SAS", "SASU", "SCI", "EURL", "EI", "SA", "autre"]).optional(),
  siret: z.string().optional(),
  numero_carte_pro: z.string().optional(),
  carte_pro_delivree_par: z.string().optional(),
  carte_pro_validite: z.string().optional(),
  garantie_financiere_montant: z.number().optional(),
  garantie_financiere_organisme: z.string().optional(),
  assurance_rcp: z.string().optional(),
  assurance_rcp_organisme: z.string().optional(),
  adresse_siege: z.string().optional(),
  logo_url: z.string().url().optional().nullable(),
  website: z.string().url().optional().nullable(),
  description: z.string().optional(),
  zones_intervention: z.array(z.string()).optional(),
  services_proposes: z.array(z.string()).optional(),
  commission_gestion_defaut: z.number().min(0).max(100).optional(),
});

export async function GET() {
  try {
    const supabase = await createClient();
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

    if (profile.role !== "agency" && profile.role !== "admin") {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    // Récupérer le profil agence
    const { data: agencyProfile, error } = await supabase
      .from("agency_profiles")
      .select("*")
      .eq("profile_id", profile.id)
      .maybeSingle();

    if (error) {
      console.error("Erreur récupération profil agence:", error);
      return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
    }

    return NextResponse.json(agencyProfile);
  } catch (error: unknown) {
    console.error("Erreur API agency profile GET:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
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

    if (profile.role !== "agency" && profile.role !== "admin") {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    // Vérifier si le profil existe déjà
    const { data: existingProfile } = await supabase
      .from("agency_profiles")
      .select("profile_id")
      .eq("profile_id", profile.id)
      .maybeSingle();

    if (existingProfile) {
      return NextResponse.json(
        { error: "Un profil agence existe déjà" },
        { status: 409 }
      );
    }

    // Valider les données
    const body = await request.json();
    const validatedData = agencyProfileSchema.parse(body);

    // Créer le profil agence
    const { data: newProfile, error: createError } = await supabase
      .from("agency_profiles")
      .insert({
        profile_id: profile.id,
        ...validatedData,
      })
      .select()
      .single();

    if (createError) {
      console.error("Erreur création profil agence:", createError);
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    return NextResponse.json(newProfile, { status: 201 });
  } catch (error: unknown) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Données invalides", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Erreur API agency profile POST:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur serveur" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
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

    if (profile.role !== "agency" && profile.role !== "admin") {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    // Valider les données
    const body = await request.json();
    const validatedData = agencyProfileUpdateSchema.parse(body);

    // Mettre à jour le profil
    const { data: updatedProfile, error: updateError } = await supabase
      .from("agency_profiles")
      .update(validatedData)
      .eq("profile_id", profile.id)
      .select()
      .single();

    if (updateError) {
      console.error("Erreur mise à jour profil agence:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json(updatedProfile);
  } catch (error: unknown) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Données invalides", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Erreur API agency profile PUT:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur serveur" }, { status: 500 });
  }
}


export const runtime = 'nodejs';

/**
 * API Route pour le profil garant de l'utilisateur connecté
 * GET /api/guarantors/me - Récupérer mon profil garant
 * PUT /api/guarantors/me - Mettre à jour mon profil garant
 */

import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase/server";
import { updateGuarantorProfileSchema } from "@/lib/validations/guarantor";

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
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // Récupérer le profil garant
    const { data: guarantorProfile, error } = await supabase
      .from("guarantor_profiles")
      .select("*")
      .eq("profile_id", profile.id)
      .maybeSingle();

    if (error) {
      console.error("Erreur récupération profil garant:", error);
      return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
    }

    if (!guarantorProfile) {
      return NextResponse.json({ error: "Profil garant non trouvé" }, { status: 404 });
    }

    return NextResponse.json(guarantorProfile);
  } catch (error: unknown) {
    console.error("Erreur API guarantors/me GET:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    // Récupérer le profil
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // Valider les données
    const body = await request.json();
    const validatedData = updateGuarantorProfileSchema.parse(body);

    // Préparer les données de mise à jour
    const updateData: any = { ...validatedData };

    // Ajouter les timestamps pour les consentements
    if (validatedData.consent_garant === true) {
      updateData.consent_garant_at = new Date().toISOString();
    }
    if (validatedData.consent_data_processing === true) {
      updateData.consent_data_processing_at = new Date().toISOString();
    }

    // Mettre à jour le profil garant
    const { data: updatedProfile, error: updateError } = await supabase
      .from("guarantor_profiles")
      .update(updateData)
      .eq("profile_id", profile.id)
      .select()
      .single();

    if (updateError) {
      console.error("Erreur mise à jour profil garant:", updateError);
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
    console.error("Erreur API guarantors/me PUT:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}








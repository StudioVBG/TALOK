export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * API Routes pour les garants
 * GET /api/guarantors - Liste des garants (admin) ou profil actuel
 * POST /api/guarantors - Créer un profil garant
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient, createRouteHandlerClient } from "@/lib/supabase/server";
import { createGuarantorProfileSchema } from "@/lib/validations/guarantor";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    // Récupérer le profil de l'utilisateur
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // Si admin, retourner la liste des garants
    if (profile.role === "admin") {
      const searchParams = request.nextUrl.searchParams;
      const verified = searchParams.get("verified");
      const page = parseInt(searchParams.get("page") || "1");
      const limit = parseInt(searchParams.get("limit") || "20");
      const offset = (page - 1) * limit;

      let query = supabase
        .from("guarantor_profiles")
        .select(`
          *,
          profile:profiles!guarantor_profiles_profile_id_fkey(
            id, prenom, nom, telephone, user_id
          )
        `, { count: "exact" });

      if (verified !== null) {
        query = query.eq("documents_verified", verified === "true");
      }

      const { data: guarantors, count, error } = await query
        .range(offset, offset + limit - 1)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Erreur récupération garants:", error);
        return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
      }

      return NextResponse.json({
        guarantors: guarantors || [],
        total: count || 0,
        page,
        limit,
      });
    }

    // Sinon, retourner le profil garant de l'utilisateur
    const { data: guarantorProfile, error } = await supabase
      .from("guarantor_profiles")
      .select("*")
      .eq("profile_id", profile.id)
      .maybeSingle();

    if (error) {
      console.error("Erreur récupération profil garant:", error);
      return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
    }

    return NextResponse.json(guarantorProfile);
  } catch (error: unknown) {
    console.error("Erreur API guarantors GET:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
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

    // Vérifier que l'utilisateur est un garant
    if (profile.role !== "guarantor" && profile.role !== "admin") {
      return NextResponse.json(
        { error: "Seuls les garants peuvent créer un profil garant" },
        { status: 403 }
      );
    }

    // Vérifier si le profil existe déjà
    const { data: existingProfile } = await supabase
      .from("guarantor_profiles")
      .select("profile_id")
      .eq("profile_id", profile.id)
      .maybeSingle();

    if (existingProfile) {
      return NextResponse.json(
        { error: "Un profil garant existe déjà pour cet utilisateur" },
        { status: 409 }
      );
    }

    // Valider les données
    const body = await request.json();
    const validatedData = createGuarantorProfileSchema.parse(body);

    // Créer le profil garant
    const serviceClient = createServiceRoleClient();
    const { data: newProfile, error: createError } = await serviceClient
      .from("guarantor_profiles")
      .insert({
        profile_id: profile.id,
        ...validatedData,
      })
      .select()
      .single();

    if (createError) {
      console.error("Erreur création profil garant:", createError);
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
    console.error("Erreur API guarantors POST:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}








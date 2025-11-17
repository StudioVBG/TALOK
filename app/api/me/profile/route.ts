import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { profileUpdateSchema } from "@/lib/validations";

/**
 * GET /api/me/profile - Récupérer le profil de l'utilisateur connecté
 */
export async function GET(request: Request) {
  try {
    const { user, error, supabase } = await getAuthenticatedUser(request);

    if (error || !user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    // Utiliser le service role pour éviter les problèmes RLS
    const { createClient } = await import("@supabase/supabase-js");
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      console.error("Error fetching profile:", profileError);
      return NextResponse.json(
        { error: "Profil non trouvé" },
        { status: 404 }
      );
    }

    return NextResponse.json(profile);
  } catch (error: any) {
    console.error("Error in GET /api/me/profile:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/me/profile - Mettre à jour les informations du profil utilisateur
 */
export async function PATCH(request: Request) {
  try {
    const { user, error, supabase } = await getAuthenticatedUser(request);

    if (error || !user || !supabase) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const validated = profileUpdateSchema.parse(body);

    const updatePayload: Record<string, any> = {};
    if (validated.prenom !== undefined) updatePayload.prenom = validated.prenom;
    if (validated.nom !== undefined) updatePayload.nom = validated.nom;
    if (validated.telephone !== undefined) updatePayload.telephone = validated.telephone;
    if (validated.date_naissance !== undefined) updatePayload.date_naissance = validated.date_naissance;

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json(
        { error: "Aucun champ à mettre à jour" },
        { status: 400 }
      );
    }

    const supabaseClient = supabase as any;
    const { data: profile, error: updateError } = await supabaseClient
      .from("profiles")
      .update(updatePayload)
      .eq("user_id", user.id as any)
      .select()
      .single();

    if (updateError || !profile) {
      console.error("Error updating profile:", updateError);
      return NextResponse.json(
        { error: updateError?.message || "Erreur lors de la mise à jour du profil" },
        { status: 500 }
      );
    }

    return NextResponse.json(profile);
  } catch (error: any) {
    console.error("Error in PATCH /api/me/profile:", error);
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Données invalides", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';

/**
 * API Route pour le dashboard prestataire
 * GET /api/provider/dashboard
 */

import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createRouteHandlerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    // Récupérer le profil prestataire
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, prenom, nom, role")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Profil non trouvé" },
        { status: 404 }
      );
    }

    if (profile.role !== "provider") {
      return NextResponse.json(
        { error: "Accès non autorisé - rôle prestataire requis" },
        { status: 403 }
      );
    }

    // Utiliser la RPC provider_dashboard
    const { data, error } = await supabase.rpc("provider_dashboard", {
      p_user_id: user.id
    });

    if (error) {
      console.error("Erreur RPC provider dashboard:", error);
      return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error("Erreur API provider dashboard:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}








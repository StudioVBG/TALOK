export const runtime = 'nodejs';

/**
 * API Routes pour les documents des garants
 * GET /api/guarantors/documents - Liste des documents
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

    // Récupérer le profil
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // Récupérer les documents
    const { data: documents, error } = await supabase
      .from("guarantor_documents")
      .select("*")
      .eq("guarantor_profile_id", profile.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erreur récupération documents:", error);
      return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
    }

    return NextResponse.json({ documents: documents || [] });
  } catch (error: unknown) {
    console.error("Erreur API guarantors/documents GET:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}








/**
 * API Route pour le dashboard garant
 * GET /api/guarantors/dashboard
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

    // Appeler la fonction RPC pour le dashboard
    const { data, error } = await supabase.rpc("guarantor_dashboard", {
      p_guarantor_user_id: user.id,
    });

    if (error) {
      console.error("Erreur dashboard garant:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Profil garant non trouvé" }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Erreur API guarantors/dashboard:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}








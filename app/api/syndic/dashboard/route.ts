export const runtime = 'nodejs';

/**
 * API Route pour le dashboard syndic
 * GET /api/syndic/dashboard
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

    // Appeler la fonction RPC
    const { data, error } = await supabase.rpc("syndic_dashboard", {
      p_user_id: user.id,
    });

    if (error) {
      console.error("Erreur dashboard syndic:", error);
      return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json(
        { error: "Aucune copropriété trouvée" },
        { status: 404 }
      );
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error("Erreur API syndic dashboard:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}








export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";

/**
 * GET /api/vetuste/grid
 * Retourne la grille de vétusté complète
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const serviceClient = getServiceClient();

    const { data: grid, error } = await serviceClient
      .from("vetuste_grid")
      .select("*")
      .order("element_type", { ascending: true });

    if (error) {
      console.error("[GET /api/vetuste/grid] Error:", error);
      return NextResponse.json(
        { error: "Erreur lors de la récupération de la grille" },
        { status: 500 }
      );
    }

    return NextResponse.json({ grid: grid || [] });
  } catch (error: unknown) {
    console.error("[GET /api/vetuste/grid] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

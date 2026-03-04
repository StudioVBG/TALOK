export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";

/**
 * POST /api/me/onboarding-complete
 * Marque l'onboarding comme terminé pour l'utilisateur connecté.
 * Met à jour profiles.onboarding_completed_at.
 */
export async function POST(request: Request) {
  try {
    const { user, error } = await getAuthenticatedUser(request);

    if (error || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { supabaseAdmin } = await import("@/app/api/_lib/supabase");
    const serviceClient = supabaseAdmin();

    const now = new Date().toISOString();

    const { error: updateError } = await serviceClient
      .from("profiles")
      .update({ onboarding_completed_at: now })
      .eq("user_id", user.id);

    if (updateError) {
      console.error("[POST /api/me/onboarding-complete] Erreur:", updateError);
      return NextResponse.json(
        { error: "Impossible de marquer l'onboarding comme terminé" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, onboarding_completed_at: now });
  } catch (error: unknown) {
    console.error("Error in POST /api/me/onboarding-complete:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

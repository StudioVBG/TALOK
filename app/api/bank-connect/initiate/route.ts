export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { withSecurity } from "@/lib/api/with-security";

/**
 * POST /api/bank-connect/initiate
 * Initie une connexion bancaire via l'Edge Function GoCardless
 */
export const POST = withSecurity(async function POST(request: Request) {
  try {
    const { user, error, supabase } = await getAuthenticatedUser(request);

    if (error || !user || !supabase) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { institutionId } = body;

    if (!institutionId) {
      return NextResponse.json(
        { error: "institutionId requis" },
        { status: 400 }
      );
    }

    // Appeler l'Edge Function bank-sync avec l'action "initiate"
    const { data, error: fnError } = await supabase.functions.invoke("bank-sync", {
      body: { action: "initiate", institutionId },
    });

    if (fnError) {
      console.error("[POST /api/bank-connect/initiate] Edge function error:", fnError);
      return NextResponse.json(
        { error: fnError.message || "Erreur lors de l'initiation de la connexion bancaire" },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error("[POST /api/bank-connect/initiate] Unexpected error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}, { routeName: "POST /api/bank-connect/initiate", csrf: true });

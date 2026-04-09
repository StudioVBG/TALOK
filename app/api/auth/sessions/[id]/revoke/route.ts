export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

/**
 * POST /api/auth/sessions/[id]/revoke — Révoquer une session active
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;

    if (!sessionId) {
      return NextResponse.json(
        { error: "ID de session requis" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json(
        { error: "Profil non trouvé" },
        { status: 404 }
      );
    }

    // Use service role to call the revoke function
    const serviceClient = createServiceRoleClient();
    const { data: revoked, error: revokeError } = await serviceClient.rpc(
      "revoke_session",
      {
        p_session_id: sessionId,
        p_profile_id: profile.id,
      }
    );

    if (revokeError) {
      console.error("Error revoking session:", revokeError);
      return NextResponse.json(
        { error: "Erreur lors de la révocation de la session" },
        { status: 500 }
      );
    }

    if (!revoked) {
      return NextResponse.json(
        { error: "Session non trouvée ou déjà révoquée" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: "Session révoquée avec succès",
      session_id: sessionId,
    });
  } catch (error: unknown) {
    console.error("Error in POST /api/auth/sessions/[id]/revoke:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

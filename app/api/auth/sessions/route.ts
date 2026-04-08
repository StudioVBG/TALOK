export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

/**
 * GET /api/auth/sessions — Liste des sessions actives de l'utilisateur
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Get profile ID
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

    // Fetch active (non-revoked) sessions
    const { data: sessions, error: sessionsError } = await supabase
      .from("active_sessions")
      .select("id, device_name, ip_address, user_agent, last_active_at, created_at, is_current")
      .eq("profile_id", profile.id)
      .is("revoked_at", null)
      .order("last_active_at", { ascending: false });

    if (sessionsError) {
      console.error("Error fetching sessions:", sessionsError);
      return NextResponse.json(
        { error: "Erreur lors de la récupération des sessions" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      sessions: sessions || [],
      count: sessions?.length || 0,
    });
  } catch (error: unknown) {
    console.error("Error in GET /api/auth/sessions:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/auth/sessions — Enregistrer/mettre à jour la session active courante
 * Appelé par le client lors du login ou du rafraîchissement de token
 */
export async function POST(request: NextRequest) {
  try {
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

    // Extract device info from request
    const userAgent = request.headers.get("user-agent") || undefined;
    const forwarded = request.headers.get("x-forwarded-for");
    const ipAddress = forwarded?.split(",")[0]?.trim() || undefined;

    const body = await request.json().catch(() => ({}));
    const deviceName = body.device_name || undefined;

    // Use service role to call the upsert function
    const serviceClient = createServiceRoleClient();
    const { data: sessionId, error: upsertError } = await serviceClient.rpc(
      "upsert_active_session",
      {
        p_profile_id: profile.id,
        p_device_name: deviceName || null,
        p_ip_address: ipAddress || null,
        p_user_agent: userAgent || null,
      }
    );

    if (upsertError) {
      console.error("Error upserting session:", upsertError);
      return NextResponse.json(
        { error: "Erreur lors de l'enregistrement de la session" },
        { status: 500 }
      );
    }

    return NextResponse.json({ session_id: sessionId }, { status: 201 });
  } catch (error: unknown) {
    console.error("Error in POST /api/auth/sessions:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

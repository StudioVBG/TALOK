export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

/**
 * API Route pour le compteur de messages non lus
 * GET /api/unified-chat/unread-count - Obtenir le nombre de messages non lus
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/unified-chat/unread-count
 * Récupère le nombre total de messages non lus pour l'utilisateur
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

    // Récupérer le profil
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // Utiliser la fonction RPC pour obtenir le compteur
    const { data: count, error: countError } = await supabase.rpc(
      "get_total_unread_count",
      {
        p_profile_id: profile.id,
      }
    );

    if (countError) {
      // Fallback: compter manuellement
      const { data: participants } = await supabase
        .from("conversation_participants")
        .select("unread_count")
        .eq("profile_id", profile.id)
        .is("left_at", null);

      const manualCount = (participants || []).reduce(
        (sum: number, p: { unread_count: number }) => sum + (p.unread_count || 0),
        0
      );

      return NextResponse.json({ unread_count: manualCount });
    }

    return NextResponse.json({ unread_count: count || 0 });
  } catch (error: unknown) {
    console.error("Erreur API unread-count:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}


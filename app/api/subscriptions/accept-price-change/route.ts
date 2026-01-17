export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST /api/subscriptions/accept-price-change - Accepter les nouvelles conditions tarifaires
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
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

    // Mettre à jour l'abonnement
    const { data: subscription, error } = await supabase
      .from("subscriptions")
      .update({
        price_change_accepted: true,
        updated_at: new Date().toISOString()
      })
      .eq("owner_id", profile.id)
      .select()
      .single();

    if (error) throw error;

    // Log audit
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "price_change_accepted",
      entity_type: "subscription",
      entity_id: subscription.id
    });

    return NextResponse.json({ success: true, subscription });
  } catch (error: unknown) {
    console.error("[Accept Price Change POST]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
  }
}


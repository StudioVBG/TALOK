export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/admin/plans/history
 * Récupère l'historique de toutes les modifications de plans
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    
    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    
    // Vérifier le rôle admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();
    
    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }
    
    // Récupérer l'historique avec les infos du plan
    const { data: history, error } = await supabase
      .from("plan_pricing_history")
      .select(`
        *,
        subscription_plans!plan_id (
          name
        )
      `)
      .order("created_at", { ascending: false })
      .limit(100);
    
    if (error) {
      console.error("[Plans History] Erreur:", error);
      return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
    }
    
    // Formater les données
    const formattedHistory = (history || []).map((entry: any) => ({
      ...entry,
      plan_name: entry.subscription_plans?.name || "Plan inconnu"
    }));
    
    return NextResponse.json({ history: formattedHistory });
  } catch (error: unknown) {
    console.error("[Plans History] Erreur:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
  }
}


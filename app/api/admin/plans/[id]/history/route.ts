export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/admin/plans/[id]/history - Historique des modifications d'un plan
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // Récupérer l'historique
    const { data: history, error } = await supabase
      .from("plan_pricing_history")
      .select(`
        *,
        changed_by_profile:profiles!plan_pricing_history_changed_by_fkey(prenom, nom)
      `)
      .eq("plan_id", id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    return NextResponse.json({ history: history || [] });
  } catch (error: any) {
    console.error("[Plan History]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


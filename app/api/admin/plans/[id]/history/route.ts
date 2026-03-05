export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { requireAdmin } from "@/lib/helpers/auth-helper";
import { NextResponse } from "next/server";

/**
 * GET /api/admin/plans/[id]/history - Historique des modifications d'un plan
 *
 * @version 2026-01-22 - Fix: Next.js 15 params Promise pattern
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { error: authError, user, profile, supabase } = await requireAdmin(request);
    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: authError.status });
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
  } catch (error: unknown) {
    console.error("[Plan History]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
  }
}

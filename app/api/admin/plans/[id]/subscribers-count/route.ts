export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { requireAdmin } from "@/lib/helpers/auth-helper";
import { NextResponse } from "next/server";

/**
 * GET /api/admin/plans/[id]/subscribers-count - Compter les abonnés actifs d'un plan
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

    // Compter les abonnés actifs
    const { count, error } = await supabase
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("plan_id", id)
      .in("status", ["active", "trialing"]);

    if (error) throw error;

    return NextResponse.json({ count: count || 0 });
  } catch (error: unknown) {
    console.error("[Subscribers Count]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
  }
}

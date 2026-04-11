export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { requireAdminPermissions, isAdminAuthError } from "@/lib/middleware/admin-rbac";
import { extractErrorMessage } from "@/lib/helpers/extract-error-message";

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

    const auth = await requireAdminPermissions(request, ["admin.plans.read"], {
      rateLimit: "adminStandard",
    });
    if (isAdminAuthError(auth)) return auth;

    const supabase = await createClient();

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
    return NextResponse.json({ error: extractErrorMessage(error) }, { status: 500 });
  }
}


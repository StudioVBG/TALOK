export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdminPermissions, isAdminAuthError } from "@/lib/middleware/admin-rbac";
import { extractErrorMessage } from "@/lib/helpers/extract-error-message";

/**
 * GET /api/admin/plans/history
 * Récupère l'historique de toutes les modifications de plans
 */
export async function GET(request: Request) {
  try {
    const auth = await requireAdminPermissions(request, ["admin.plans.read"], {
      rateLimit: "adminStandard",
    });
    if (isAdminAuthError(auth)) return auth;

    const supabase = await createClient();
    
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
      return NextResponse.json({ error: extractErrorMessage(error) }, { status: 500 });
    }
    
    // Formater les données
    const formattedHistory = (history || []).map((entry: any) => ({
      ...entry,
      plan_name: entry.subscription_plans?.name || "Plan inconnu"
    }));
    
    return NextResponse.json({ history: formattedHistory });
  } catch (error: unknown) {
    console.error("[Plans History] Erreur:", error);
    return NextResponse.json({ error: extractErrorMessage(error) }, { status: 500 });
  }
}


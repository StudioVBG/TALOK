export const runtime = 'nodejs';

/**
 * API Route pour les statistiques admin
 * GET /api/admin/stats
 */

import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase/server";
import { requireAdminPermissions, isAdminAuthError } from "@/lib/middleware/admin-rbac";
import { extractErrorMessage } from "@/lib/helpers/extract-error-message";

export async function GET(request: Request) {
  try {
    const auth = await requireAdminPermissions(request, ["admin.reports.read"], {
      rateLimit: "adminStandard",
    });
    if (isAdminAuthError(auth)) return auth;

    const supabase = await createRouteHandlerClient();

    // Appeler la fonction RPC
    const { data, error } = await supabase.rpc("admin_dashboard_stats");

    if (error) {
      console.error("Erreur stats admin:", error);
      return NextResponse.json({ error: extractErrorMessage(error) }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error("Erreur API admin stats:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';

/**
 * ⚠️ DEPRECATED — `/api/admin/stats` n'est plus appelée par l'UI Talok.
 * Le hook `useAdminStats` qui pointait vers cette route est lui-même
 * orphelin (zéro consommateur dans le repo au 2026-04-26).
 *
 * Les surfaces actives pour les KPIs admin sont :
 *   - `/admin/dashboard`         → RPC `admin_stats` directement (cf. `app/admin/_data/fetchAdminStats.ts`)
 *   - `/admin/metrics`           → `/api/admin/metrics` (KPI étendus + charts)
 *   - `/admin/metrics-saas`      → `/api/admin/metrics/saas` (MRR / churn / ARPU / LTV)
 *   - `/admin/reports`           → Supabase direct (export CSV par dates)
 *   - `/admin/platform-health`   → `/api/admin/health` (latence + Stripe + crons)
 *
 * Conservée pour compatibilité avec d'éventuels appels admin manuels mais
 * loggée pour surveillance. Si aucun warn n'apparaît dans les logs prod
 * pendant 90 jours, route + hook (`useAdminStats` dans `lib/hooks/use-admin-queries.ts`)
 * peuvent être supprimés.
 */

import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase/server";
import { requireAdminPermissions, isAdminAuthError } from "@/lib/middleware/admin-rbac";

export async function GET(request: Request) {
  try {
    const auth = await requireAdminPermissions(request, ["admin.reports.read"], {
      rateLimit: "adminStandard",
    });
    if (isAdminAuthError(auth)) return auth;

    console.warn(
      "[DEPRECATED] GET /api/admin/stats called",
      { admin_user_id: auth.user.id }
    );

    const supabase = await createRouteHandlerClient();
    const { data, error } = await supabase.rpc("admin_dashboard_stats");

    if (error) {
      console.error("Erreur stats admin:", error);
      return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
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

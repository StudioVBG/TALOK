export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { extractErrorMessage } from "@/lib/helpers/extract-error-message";
import { NextResponse } from "next/server";

/**
 * API Route pour la génération automatique des factures
 * Destinée à être appelée par un cron job (pg_cron via net.http_get).
 * GET /api/cron/generate-invoices
 * Header requis: Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: Request) {
  // Sécurité : vérifier le Bearer token (cohérent avec les autres routes cron)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const supabase = createServiceRoleClient();

    // Déterminer le mois cible (le mois actuel par défaut)
    const now = new Date();
    const targetMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const { data, error } = await supabase.rpc("generate_monthly_invoices", {
      p_target_month: targetMonth,
    });

    if (error) {
      const message = extractErrorMessage(error);
      console.error("[CRON] generate-invoices RPC failed:", message, error);
      return NextResponse.json(
        {
          success: false,
          error: message,
          targetMonth,
          timestamp: new Date().toISOString(),
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      result: data,
      targetMonth,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = extractErrorMessage(error);
    console.error("[CRON] generate-invoices failed:", message, error);

    return NextResponse.json(
      {
        success: false,
        error: message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}


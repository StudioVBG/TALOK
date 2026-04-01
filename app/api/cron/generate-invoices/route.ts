export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";

/**
 * API Route pour la génération automatique des factures
 * Destinée à être appelée par un cron job (ex: Upstash QStash, cron-job.org)
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
      p_target_month: targetMonth
    });

    if (error) {
      console.error("[Cron] Erreur RPC:", error);
      return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
    }

    // Envoyer des notifications aux locataires concernés (optionnel, déjà géré via triggers ?)
    // Ici, on pourrait ajouter un job dans l'outbox pour chaque facture générée

    return NextResponse.json({
      success: true,
      result: data,
      timestamp: new Date().toISOString()
    });
  } catch (error: unknown) {
    console.error("[Cron] Erreur serveur:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
  }
}


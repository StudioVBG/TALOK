export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";
import { verifyCronSecret, unauthorizedResponse } from "@/app/api/_lib/supabase";

/**
 * API Route pour la génération automatique des factures
 * Destinée à être appelée par un cron job (ex: GitHub Actions, Supabase Cron)
 * GET /api/cron/generate-invoices avec header Authorization: Bearer CRON_SECRET
 */
export async function GET(request: Request) {
  // Vérification sécurité - CRON_SECRET obligatoire en production
  if (!verifyCronSecret(request)) {
    return unauthorizedResponse("CRON_SECRET invalide ou manquant");
  }

  try {
    const supabase = createServiceRoleClient();
    
    // Déterminer le mois cible (le mois actuel par défaut)
    const now = new Date();
    const targetMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    console.log(`[Cron] Lancement de la génération des factures pour ${targetMonth}`);

    const { data, error } = await supabase.rpc("generate_monthly_invoices", {
      p_target_month: targetMonth
    });

    if (error) {
      console.error("[Cron] Erreur RPC:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Envoyer des notifications aux locataires concernés (optionnel, déjà géré via triggers ?)
    // Ici, on pourrait ajouter un job dans l'outbox pour chaque facture générée

    return NextResponse.json({
      success: true,
      result: data,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("[Cron] Erreur serveur:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


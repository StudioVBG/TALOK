export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/owner/money/summary
 * Récupère le résumé financier du propriétaire connecté
 * (loyers attendus, collectés, impayés, graphique mensuel)
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Récupérer le profil propriétaire
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .eq("role", "owner")
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil propriétaire non trouvé" }, { status: 403 });
    }

    const ownerId = profile.id;

    // Récupérer les propriétés du propriétaire
    const { data: properties } = await supabase
      .from("properties")
      .select("id")
      .eq("owner_id", ownerId);

    const propertyIds = properties?.map((p) => p.id) || [];

    if (propertyIds.length === 0) {
      return NextResponse.json({
        total_due_current_month: 0,
        total_collected_current_month: 0,
        arrears_amount: 0,
        collection_rate: 0,
        chart_data: [],
      });
    }

    // Récupérer les baux
    const { data: leases } = await supabase
      .from("leases")
      .select("id")
      .in("property_id", propertyIds);

    const leaseIds = leases?.map((l) => l.id) || [];

    if (leaseIds.length === 0) {
      return NextResponse.json({
        total_due_current_month: 0,
        total_collected_current_month: 0,
        arrears_amount: 0,
        collection_rate: 0,
        chart_data: [],
      });
    }

    // Récupérer toutes les factures
    const { data: invoices } = await supabase
      .from("invoices")
      .select("id, montant_total, statut, periode")
      .in("lease_id", leaseIds);

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const currentPeriod = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;

    // KPIs du mois en cours
    const currentMonthInvoices =
      invoices?.filter((inv) => inv.periode === currentPeriod) || [];

    const totalDue = currentMonthInvoices.reduce(
      (sum, inv) => sum + (Number(inv.montant_total) || 0),
      0
    );
    const totalCollected = currentMonthInvoices
      .filter((inv) => inv.statut === "paid")
      .reduce((sum, inv) => sum + (Number(inv.montant_total) || 0), 0);

    // Impayés (toutes les factures non payées des mois précédents)
    const arrearsAmount =
      invoices
        ?.filter((inv) => inv.statut !== "paid" && inv.periode && inv.periode < currentPeriod)
        .reduce((sum, inv) => sum + (Number(inv.montant_total) || 0), 0) || 0;

    // Taux de recouvrement
    const collectionRate = totalDue > 0 ? Math.round((totalCollected / totalDue) * 100) : 0;

    // Graphique des 12 derniers mois
    const chartData: Array<{ period: string; expected: number; collected: number }> = [];
    for (let i = 11; i >= 0; i--) {
      const date = new Date(currentYear, currentMonth - i, 1);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const period = `${year}-${String(month).padStart(2, "0")}`;

      const periodInvoices = invoices?.filter((inv) => inv.periode === period) || [];
      const expected = periodInvoices.reduce(
        (sum, inv) => sum + (Number(inv.montant_total) || 0),
        0
      );
      const collected = periodInvoices
        .filter((inv) => inv.statut === "paid")
        .reduce((sum, inv) => sum + (Number(inv.montant_total) || 0), 0);

      chartData.push({ period, expected, collected });
    }

    return NextResponse.json({
      total_due_current_month: totalDue,
      total_collected_current_month: totalCollected,
      arrears_amount: arrearsAmount,
      collection_rate: collectionRate,
      chart_data: chartData,
    });
  } catch (error: unknown) {
    console.error("[GET /api/owner/money/summary] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

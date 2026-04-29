export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/syndic/dashboard
 * - sans ?site_id : retourne le récapitulatif global (RPC syndic_dashboard)
 * - avec ?site_id : retourne la shape SyndicDashboardData consommée par
 *   useSyndicDashboard (KPIs, budget vs réalisé, prochain appel, impayés,
 *   fonds travaux) construite à partir des tables copro_*
 */

import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase/server";

interface FundCallLineRow {
  id: string;
  call_id: string;
  lot_id: string;
  owner_name: string | null;
  amount_cents: number;
  paid_cents: number;
  payment_status: string;
}

interface FundCallRow {
  id: string;
  site_id: string;
  period_label: string | null;
  due_date: string | null;
  total_amount_cents: number | null;
  total_amount: number | null;
  status: string | null;
  created_at: string;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const siteId = new URL(request.url).searchParams.get("site_id");

    if (!siteId) {
      const { data, error } = await supabase.rpc("syndic_dashboard", {
        p_user_id: user.id,
      });
      if (error) {
        return NextResponse.json(
          { error: error.message ?? "Erreur RPC" },
          { status: 500 }
        );
      }
      return NextResponse.json(data ?? {});
    }

    // Mode site_id : agrège les données pour la shape SyndicDashboardData.
    // RLS garantit qu'on ne lit que les sites accessibles à l'utilisateur.

    const [budgetsRes, fundCallsRes, fondsTravauxRes] = await Promise.all([
      supabase
        .from("copro_budgets")
        .select("id, fiscal_year, total_budget_cents, status")
        .eq("site_id", siteId)
        .order("fiscal_year", { ascending: false })
        .limit(1),
      supabase
        .from("copro_fund_calls")
        .select("id, site_id, period_label, due_date, total_amount_cents, total_amount, status, created_at")
        .eq("site_id", siteId)
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(20),
      supabase
        .from("copro_fonds_travaux")
        .select(
          "solde_actuel_cents, cotisation_taux_percent, total_collected_cents, total_spent_cents"
        )
        .eq("site_id", siteId)
        .eq("status", "active")
        .order("fiscal_year", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const fundCalls = (fundCallsRes.data ?? []) as unknown as FundCallRow[];
    const callIds = fundCalls.map((c) => c.id);

    const linesRes = callIds.length
      ? await supabase
          .from("copro_fund_call_lines")
          .select("id, call_id, lot_id, owner_name, amount_cents, paid_cents, payment_status")
          .in("call_id", callIds)
      : { data: [] as FundCallLineRow[] };

    const lines = (linesRes.data ?? []) as unknown as FundCallLineRow[];

    // KPIs
    const lastBudgetCents = budgetsRes.data?.[0]?.total_budget_cents ?? 0;
    const totalCalled = fundCalls.reduce(
      (sum, c) => sum + (c.total_amount_cents ?? Math.round((c.total_amount ?? 0) * 100)),
      0
    );
    const totalPaid = lines.reduce((sum, l) => sum + (l.paid_cents ?? 0), 0);
    const totalDue = lines.reduce((sum, l) => sum + (l.amount_cents ?? 0), 0);
    const impayesCents = Math.max(0, totalDue - totalPaid);
    const overdueLines = lines.filter(
      (l) => l.payment_status === "overdue" || l.payment_status === "partial" || (l.paid_cents ?? 0) < (l.amount_cents ?? 0)
    );

    const kpis = {
      budget_execution_pct: lastBudgetCents > 0 ? Math.min(100, Math.round((totalCalled / lastBudgetCents) * 100)) : 0,
      tresorerie_cents: Math.max(0, totalPaid),
      taux_recouvrement_pct: totalDue > 0 ? Math.round((totalPaid / totalDue) * 100) : 100,
      impayes_cents: impayesCents,
      impayes_count: overdueLines.length,
    };

    // Prochain appel : premier non-payé futur, sinon le plus récent
    const today = new Date().toISOString().split("T")[0];
    const upcoming = fundCalls.find((c) => c.due_date && c.due_date >= today);
    const nextFundCall = upcoming
      ? {
          id: upcoming.id,
          period_label: upcoming.period_label ?? "—",
          due_date: upcoming.due_date ?? "",
          total_cents: upcoming.total_amount_cents ?? Math.round((upcoming.total_amount ?? 0) * 100),
          is_sent: upcoming.status === "sent" || upcoming.status === "paid" || upcoming.status === "partial",
        }
      : null;

    // Budget vs Réalisé : agrège par poste — placeholder vide tant que la table copro_expense_categories n'est pas branchée
    const budgetVsRealise: Array<{ poste: string; budget_cents: number; realise_cents: number }> = [];

    // Impayés détaillés (top 10)
    const overdueByLot = new Map<string, { lot_id: string; owner_name: string; amount_cents: number; days_late: number }>();
    for (const line of overdueLines) {
      const call = fundCalls.find((c) => c.id === line.call_id);
      const dueDate = call?.due_date;
      const daysLate = dueDate
        ? Math.max(0, Math.floor((Date.now() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24)))
        : 0;
      const remaining = Math.max(0, (line.amount_cents ?? 0) - (line.paid_cents ?? 0));
      const existing = overdueByLot.get(line.lot_id);
      overdueByLot.set(line.lot_id, {
        lot_id: line.lot_id,
        owner_name: line.owner_name ?? existing?.owner_name ?? "Copropriétaire",
        amount_cents: (existing?.amount_cents ?? 0) + remaining,
        days_late: Math.max(existing?.days_late ?? 0, daysLate),
      });
    }
    const overdueCopros = Array.from(overdueByLot.values())
      .sort((a, b) => b.amount_cents - a.amount_cents)
      .slice(0, 10)
      .map((e) => ({
        lot_id: e.lot_id,
        lot_number: "", // résolu côté UI si besoin
        owner_name: e.owner_name,
        amount_cents: e.amount_cents,
        days_late: e.days_late,
      }));

    const fonds = fondsTravauxRes.data;
    const worksFund = {
      balance_cents: fonds?.solde_actuel_cents ?? 0,
      rate_pct: Number(fonds?.cotisation_taux_percent ?? 0),
      evolution_cents: (fonds?.total_collected_cents ?? 0) - (fonds?.total_spent_cents ?? 0),
    };

    return NextResponse.json({
      kpis,
      budget_vs_realise: budgetVsRealise,
      next_fund_call: nextFundCall,
      overdue_copros: overdueCopros,
      works_fund: worksFund,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

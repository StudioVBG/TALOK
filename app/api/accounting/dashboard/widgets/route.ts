/**
 * API Route: Widgets KPI complémentaires du dashboard comptable
 * GET /api/accounting/dashboard/widgets?entityId=...&exerciseId=...
 *
 * Retourne en un seul appel les agrégats que le dashboard ne fournit pas
 * déjà via /api/accounting/exercises/[id]/balance :
 *
 *  - topProperties[]        : 3 biens les plus rentables sur l'exercice
 *                             (consomme la vue v_pnl_by_property).
 *  - yoyComparison          : revenus / charges année courante vs N-1
 *                             (lit accounting_entry_lines via les
 *                             exercices ouverts/clôturés correspondants).
 *  - recoverableChargesCents: somme classe 708xxx de l'exercice courant
 *                             (charges récupérées sur le locataire :
 *                             TEOM, refacturations).
 *
 * Feature gate : bank_reconciliation (plan Confort+).
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { requireAccountingAccess } from "@/lib/accounting/feature-gates";
import type {
  DashboardWidgetsResponse,
  TopPropertyResult,
} from "@/lib/accounting/dashboard-widgets-types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface PnlRow {
  property_id: string;
  account_number: string;
  total_debit_cents: number | string;
  total_credit_cents: number | string;
}

interface PropertyRow {
  id: string;
  adresse_complete: string | null;
}

interface ExerciseRow {
  id: string;
  start_date: string;
  end_date: string;
  status: "open" | "closing" | "closed";
}

interface BalanceRow {
  account_number: string;
  total_debit_cents: number | string;
  total_credit_cents: number | string;
}

function n(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const v = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(v) ? v : 0;
}

function yearOf(dateString: string | null | undefined): number | null {
  if (!dateString) return null;
  const y = parseInt(dateString.slice(0, 4), 10);
  return Number.isFinite(y) ? y : null;
}

async function fetchBalanceRows(
  supabase: ReturnType<typeof getServiceClient>,
  entityId: string,
  exerciseId: string,
): Promise<BalanceRow[]> {
  // Try the pre-aggregated MV via fn_balance_for_exercise first. The MV
  // is only refreshed at exercise close / nightly via pg_cron, so for
  // an open exercise with freshly-validated entries it can be empty or
  // stale — in that case we fall through to a live aggregation on
  // accounting_entry_lines so KPIs stay truthful.
  const { data: mvRows, error: mvErr } = await (supabase as any).rpc(
    "fn_balance_for_exercise",
    { p_entity_id: entityId, p_exercise_id: exerciseId },
  );
  if (!mvErr && Array.isArray(mvRows) && mvRows.length > 0) {
    return mvRows as BalanceRow[];
  }

  const { data: liveRows } = await (supabase as any)
    .from("accounting_entry_lines")
    .select(
      `account_number, debit_cents, credit_cents,
       accounting_entries!inner(entity_id, exercise_id, is_validated, informational)`,
    )
    .eq("accounting_entries.entity_id", entityId)
    .eq("accounting_entries.exercise_id", exerciseId)
    .eq("accounting_entries.is_validated", true);

  const aggregated = new Map<string, { debit: number; credit: number }>();
  for (const line of (liveRows ?? []) as Array<{
    account_number: string;
    debit_cents: number;
    credit_cents: number;
    accounting_entries:
      | { informational: boolean }
      | { informational: boolean }[];
  }>) {
    const meta = Array.isArray(line.accounting_entries)
      ? line.accounting_entries[0]
      : line.accounting_entries;
    if (meta?.informational) continue;
    const cur = aggregated.get(line.account_number) ?? { debit: 0, credit: 0 };
    cur.debit += n(line.debit_cents);
    cur.credit += n(line.credit_cents);
    aggregated.set(line.account_number, cur);
  }
  return Array.from(aggregated.entries()).map(([account, totals]) => ({
    account_number: account,
    total_debit_cents: totals.debit,
    total_credit_cents: totals.credit,
  }));
}

async function aggregateExerciseBalance(
  supabase: ReturnType<typeof getServiceClient>,
  entityId: string,
  exerciseId: string,
): Promise<{ revenueCents: number; expensesCents: number }> {
  const rows = await fetchBalanceRows(supabase, entityId, exerciseId);
  let revenueCents = 0;
  let expensesCents = 0;
  for (const row of rows) {
    const cls = row.account_number.charAt(0);
    if (cls === "7") {
      revenueCents += n(row.total_credit_cents) - n(row.total_debit_cents);
    } else if (cls === "6") {
      expensesCents += n(row.total_debit_cents) - n(row.total_credit_cents);
    }
  }
  return { revenueCents, expensesCents };
}

async function recoverableCharges(
  supabase: ReturnType<typeof getServiceClient>,
  entityId: string,
  exerciseId: string,
): Promise<number> {
  // Comptes 708xxx = "Produits annexes / charges récupérées".
  // Le solde créditeur correspond aux charges effectivement récupérées
  // sur le locataire pendant l'exercice.
  const rows = await fetchBalanceRows(supabase, entityId, exerciseId);
  let total = 0;
  for (const row of rows) {
    if (row.account_number.startsWith("708")) {
      total += n(row.total_credit_cents) - n(row.total_debit_cents);
    }
  }
  return Math.max(0, total);
}

async function topProperties(
  supabase: ReturnType<typeof getServiceClient>,
  entityId: string,
  exerciseId: string,
): Promise<TopPropertyResult[]> {
  const { data: rows } = await (supabase as any)
    .from("v_pnl_by_property")
    .select("property_id, account_number, total_debit_cents, total_credit_cents")
    .eq("entity_id", entityId)
    .eq("exercise_id", exerciseId);
  const pnlRows = (rows ?? []) as PnlRow[];
  if (pnlRows.length === 0) return [];

  // Agrège revenus/charges par property
  const byProperty = new Map<string, { revenueCents: number; expensesCents: number }>();
  for (const row of pnlRows) {
    const cls = row.account_number.charAt(0);
    if (cls !== "6" && cls !== "7") continue;
    const acc = byProperty.get(row.property_id) ?? {
      revenueCents: 0,
      expensesCents: 0,
    };
    if (cls === "7") {
      acc.revenueCents += n(row.total_credit_cents) - n(row.total_debit_cents);
    } else {
      acc.expensesCents += n(row.total_debit_cents) - n(row.total_credit_cents);
    }
    byProperty.set(row.property_id, acc);
  }

  // Récupère les libellés d'adresse en une requête
  const ids = Array.from(byProperty.keys());
  const labels = new Map<string, string | null>();
  if (ids.length > 0) {
    const { data: props } = await supabase
      .from("properties")
      .select("id, adresse_complete")
      .in("id", ids);
    for (const p of (props ?? []) as PropertyRow[]) {
      labels.set(p.id, p.adresse_complete);
    }
  }

  const results: TopPropertyResult[] = [];
  for (const [propertyId, agg] of byProperty.entries()) {
    results.push({
      propertyId,
      propertyAddress: labels.get(propertyId) ?? null,
      revenueCents: agg.revenueCents,
      expensesCents: agg.expensesCents,
      netResultCents: agg.revenueCents - agg.expensesCents,
    });
  }
  // Tri décroissant par revenu, top 3
  results.sort((a, b) => b.revenueCents - a.revenueCents);
  return results.slice(0, 3);
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Non authentifié");

    const serviceClient = getServiceClient();
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!profile) throw new ApiError(403, "Profil non trouvé");

    const featureGate = await requireAccountingAccess(profile.id, "balance");
    if (featureGate) return featureGate;

    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId");
    const exerciseId = searchParams.get("exerciseId");
    if (!entityId) throw new ApiError(400, "entityId requis");
    if (!exerciseId) throw new ApiError(400, "exerciseId requis");

    // Vérifie l'accès à l'entity (admins exclus du check)
    if (profile.role !== "admin") {
      const { data: entity } = await serviceClient
        .from("legal_entities")
        .select("id")
        .eq("id", entityId)
        .eq("owner_profile_id", profile.id)
        .maybeSingle();
      if (!entity) throw new ApiError(403, "Accès refusé à cette entité");
    }

    // Charge exercice courant + exercice précédent (pour YoY)
    const { data: exercises } = await (serviceClient as any)
      .from("accounting_exercises")
      .select("id, start_date, end_date, status")
      .eq("entity_id", entityId)
      .order("start_date", { ascending: false })
      .limit(10);

    const exerciseList = (exercises ?? []) as ExerciseRow[];
    const currentExercise =
      exerciseList.find((e) => e.id === exerciseId) ?? null;
    const previousExercise = currentExercise
      ? exerciseList.find(
          (e) =>
            e.id !== currentExercise.id &&
            e.end_date <= currentExercise.start_date,
        ) ?? null
      : null;

    const [currentBalance, previousBalance, recoverable, top] =
      await Promise.all([
        aggregateExerciseBalance(serviceClient, entityId, exerciseId),
        previousExercise
          ? aggregateExerciseBalance(
              serviceClient,
              entityId,
              previousExercise.id,
            )
          : Promise.resolve({ revenueCents: 0, expensesCents: 0 }),
        recoverableCharges(serviceClient, entityId, exerciseId),
        topProperties(serviceClient, entityId, exerciseId),
      ]);

    const currentRev = currentBalance.revenueCents;
    const prevRev = previousBalance.revenueCents;
    const revenueDeltaPercent =
      previousExercise && prevRev > 0
        ? Math.round(((currentRev - prevRev) / prevRev) * 1000) / 10
        : null;

    const payload: DashboardWidgetsResponse = {
      topProperties: top,
      yoy: {
        currentYear: yearOf(currentExercise?.start_date),
        previousYear: yearOf(previousExercise?.start_date),
        currentRevenueCents: currentBalance.revenueCents,
        currentExpensesCents: currentBalance.expensesCents,
        currentResultCents:
          currentBalance.revenueCents - currentBalance.expensesCents,
        previousRevenueCents: previousBalance.revenueCents,
        previousExpensesCents: previousBalance.expensesCents,
        previousResultCents:
          previousBalance.revenueCents - previousBalance.expensesCents,
        revenueDeltaPercent,
      },
      recoverableChargesCents: recoverable,
    };

    return NextResponse.json({ success: true, data: payload });
  } catch (error) {
    return handleApiError(error);
  }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  authenticateAPIKey,
  requireScope,
  addRateLimitHeaders,
} from "@/lib/api/api-key-auth";
import { apiError, apiSuccess } from "@/lib/api/middleware";

/**
 * GET /api/v1/accounting/balance
 * Get balance of accounts for the owner
 *
 * Returns aggregated debit/credit totals grouped by account number.
 * Query params: from (YYYY-MM-DD), to (YYYY-MM-DD)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateAPIKey(request);
    if (auth instanceof Response) return auth;

    const scopeCheck = requireScope(auth, "accounting");
    if (scopeCheck) return scopeCheck;

    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const from = searchParams.get("from") || `${new Date().getFullYear()}-01-01`;
    const to = searchParams.get("to") || new Date().toISOString().split("T")[0];

    // Get all entries for the period, grouped by account
    const { data: entries, error } = await supabase
      .from("accounting_entries")
      .select("compte_numero, compte_libelle, montant_debit, montant_credit")
      .eq("owner_id", auth.profileId)
      .gte("date_ecriture", from)
      .lte("date_ecriture", to);

    if (error) {
      console.error("[GET /v1/accounting/balance] Error:", error);
      return apiError("Erreur lors de la récupération", 500);
    }

    // Aggregate by account
    const accountMap = new Map<
      string,
      { compte_numero: string; compte_libelle: string; total_debit: number; total_credit: number }
    >();

    for (const entry of entries || []) {
      const key = entry.compte_numero || "000000";
      const existing = accountMap.get(key);

      if (existing) {
        existing.total_debit += entry.montant_debit || 0;
        existing.total_credit += entry.montant_credit || 0;
      } else {
        accountMap.set(key, {
          compte_numero: entry.compte_numero || "000000",
          compte_libelle: entry.compte_libelle || "",
          total_debit: entry.montant_debit || 0,
          total_credit: entry.montant_credit || 0,
        });
      }
    }

    const accounts = Array.from(accountMap.values())
      .map((a) => ({
        ...a,
        solde: a.total_debit - a.total_credit,
      }))
      .sort((a, b) => a.compte_numero.localeCompare(b.compte_numero));

    const totals = accounts.reduce(
      (acc, a) => ({
        total_debit: acc.total_debit + a.total_debit,
        total_credit: acc.total_credit + a.total_credit,
      }),
      { total_debit: 0, total_credit: 0 }
    );

    const response = apiSuccess({
      period: { from, to },
      accounts,
      totals: {
        ...totals,
        solde: totals.total_debit - totals.total_credit,
      },
    });

    return addRateLimitHeaders(response, auth);
  } catch (error: unknown) {
    console.error("[GET /v1/accounting/balance] Error:", error);
    return apiError("Erreur serveur", 500);
  }
}

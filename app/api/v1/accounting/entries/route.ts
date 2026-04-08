export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  authenticateAPIKey,
  requireScope,
  addRateLimitHeaders,
} from "@/lib/api/api-key-auth";
import { apiError, apiSuccess, getPaginationParams } from "@/lib/api/middleware";

/**
 * GET /api/v1/accounting/entries
 * List accounting entries (journal entries) for the owner
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateAPIKey(request);
    if (auth instanceof Response) return auth;

    const scopeCheck = requireScope(auth, "accounting");
    if (scopeCheck) return scopeCheck;

    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const { page, limit, offset } = getPaginationParams(searchParams);

    const from = searchParams.get("from"); // YYYY-MM-DD
    const to = searchParams.get("to");     // YYYY-MM-DD
    const journalCode = searchParams.get("journal_code");

    let query = supabase
      .from("accounting_entries")
      .select(`
        id, journal_code, piece_ref, date_ecriture, date_comptable,
        libelle, montant_debit, montant_credit, lettrage,
        compte_numero, compte_libelle, property_id, lease_id,
        created_at
      `, { count: "exact" })
      .eq("owner_id", auth.profileId)
      .order("date_ecriture", { ascending: false })
      .range(offset, offset + limit - 1);

    if (from) {
      query = query.gte("date_ecriture", from);
    }
    if (to) {
      query = query.lte("date_ecriture", to);
    }
    if (journalCode) {
      query = query.eq("journal_code", journalCode);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("[GET /v1/accounting/entries] Error:", error);
      return apiError("Erreur lors de la récupération", 500);
    }

    const response = apiSuccess({
      entries: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
    });

    return addRateLimitHeaders(response, auth);
  } catch (error: unknown) {
    console.error("[GET /v1/accounting/entries] Error:", error);
    return apiError("Erreur serveur", 500);
  }
}

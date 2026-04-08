// @ts-nocheck
/**
 * API Route: Bank Reconciliation — Transaction listing
 * GET /api/accounting/bank/reconciliation
 *
 * Lists bank_transactions with optional filters, joined matched entry.
 * Returns transactions + reconciliation stats.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { requireAccountingAccess } from "@/lib/accounting/feature-gates";

export const dynamic = "force-dynamic";

const VALID_STATUSES = [
  "pending",
  "matched_auto",
  "matched_manual",
  "suggested",
  "orphan",
  "ignored",
] as const;

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError(401, "Non authentifie");
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      throw new ApiError(403, "Acces reserve aux administrateurs");
    }

    const featureGate = await requireAccountingAccess(
      profile.id,
      "reconciliation",
    );
    if (featureGate) return featureGate;

    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId");
    const connectionId = searchParams.get("connectionId");
    const status = searchParams.get("status");

    if (!entityId) {
      throw new ApiError(400, "entityId est requis");
    }

    // Validate status if provided
    if (
      status &&
      !VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])
    ) {
      throw new ApiError(
        400,
        `Statut invalide. Valeurs acceptees: ${VALID_STATUSES.join(", ")}`,
      );
    }

    // Fetch connections for this entity
    const { data: connections, error: connError } = await supabase
      .from("bank_connections")
      .select("id")
      .eq("entity_id", entityId)
      .eq("is_active", true);

    if (connError) {
      throw new ApiError(500, `Erreur connexions: ${connError.message}`);
    }

    if (!connections || connections.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          transactions: [],
          stats: { total: 0, matched: 0, suggested: 0, orphan: 0 },
        },
      });
    }

    const connectionIds = connectionId
      ? [connectionId]
      : connections.map((c: { id: string }) => c.id);

    // Fetch bank transactions with optional filters
    let query = supabase
      .from("bank_transactions")
      .select(
        `
        *,
        matched_entry:accounting_entries!matched_entry_id(
          id, entry_number, entry_date, label, journal_code, is_validated
        )
      `,
      )
      .in("connection_id", connectionIds)
      .order("transaction_date", { ascending: false });

    if (status) {
      query = query.eq("reconciliation_status", status);
    }

    const { data: transactions, error: txError } = await query;

    if (txError) {
      throw new ApiError(500, `Erreur transactions: ${txError.message}`);
    }

    // Compute stats across all transactions (unfiltered by status)
    const { data: allTx, error: statsError } = await supabase
      .from("bank_transactions")
      .select("reconciliation_status")
      .in("connection_id", connectionIds);

    if (statsError) {
      throw new ApiError(500, `Erreur stats: ${statsError.message}`);
    }

    const stats = {
      total: allTx.length,
      matched: 0,
      suggested: 0,
      orphan: 0,
    };

    for (const tx of allTx) {
      switch (tx.reconciliation_status) {
        case "matched_auto":
        case "matched_manual":
          stats.matched++;
          break;
        case "suggested":
          stats.suggested++;
          break;
        case "orphan":
          stats.orphan++;
          break;
      }
    }

    return NextResponse.json({
      success: true,
      data: { transactions: transactions ?? [], stats },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

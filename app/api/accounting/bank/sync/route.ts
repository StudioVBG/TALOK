/**
 * API Route: Bank Sync
 * POST /api/accounting/bank/sync - Sync transactions from bank connections
 *
 * Body: { connectionId? } — optional, sync all active connections if not provided
 *
 * For each connection: fetches balances + transactions since last_sync_at,
 * inserts new transactions, updates last_sync_at.
 *
 * Callers : aucun UI à ce jour. Le cron quotidien (6h UTC) passe par
 * l'edge function `supabase/functions/bank-sync/` qui parle directement à
 * la base. Cette route reste exposée comme point d'entrée manuel
 * (ex. trigger admin via curl, intégration future "Synchroniser
 * maintenant" dans l'UI banque). Ne pas supprimer sans avoir confirmé
 * qu'aucun script ops ne l'appelle.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { requireAccountingAccess } from "@/lib/accounting/feature-gates";
import { getBalances, getTransactions, getRequisitionStatus } from "@/lib/bank/nordigen";
import { z } from "zod";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const SyncSchema = z.object({
  connectionId: z.string().uuid().optional(),
});

// ---------------------------------------------------------------------------
// Helper: convert amount string "123.45" -> 12345 cents
// ---------------------------------------------------------------------------

function amountToCents(amount: string): number {
  const parsed = parseFloat(amount);
  if (isNaN(parsed)) return 0;
  return Math.round(parsed * 100);
}

// ---------------------------------------------------------------------------
// POST — Sync bank transactions
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
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

    // Feature gate: open_banking required
    const featureGate = await requireAccountingAccess(profile.id, "open_banking");
    if (featureGate) return featureGate;

    const body = await request.json();
    const validation = SyncSchema.safeParse(body);

    if (!validation.success) {
      throw new ApiError(400, validation.error.errors[0].message);
    }

    const { connectionId } = validation.data;

    // -----------------------------------------------------------------------
    // Fetch connections to sync
    // -----------------------------------------------------------------------

    let query = (supabase as any)
      .from("bank_connections")
      .select("*")
      .eq("is_active", true)
      .in("sync_status", ["synced", "active"]);

    if (connectionId) {
      query = query.eq("id", connectionId);
    }

    const { data: connections, error: connError } = await query;

    if (connError) {
      console.error("[Bank Sync] Fetch connections error:", connError);
      throw new ApiError(500, "Erreur lors de la recuperation des connexions");
    }

    if (!connections || connections.length === 0) {
      return NextResponse.json({
        success: true,
        data: { synced: 0, newTransactions: 0 },
      });
    }

    // -----------------------------------------------------------------------
    // Sync each connection
    // -----------------------------------------------------------------------

    let totalSynced = 0;
    let totalNewTransactions = 0;
    const errors: Array<{ connectionId: string; error: string }> = [];

    for (const connection of connections) {
      try {
        // Get requisition to find account IDs
        const requisition = await getRequisitionStatus(connection.provider_connection_id);

        if (!requisition.accounts || requisition.accounts.length === 0) {
          console.warn(`[Bank Sync] No accounts for connection ${connection.id}`);
          continue;
        }

        const accountId = requisition.accounts[0];

        // Fetch balances (non-blocking failure)
        try {
          const balances = await getBalances(accountId);
          const closingBalance = balances.find(
            (b) => b.balanceType === "closingBooked" || b.balanceType === "interimAvailable",
          );

          if (closingBalance) {
            await (supabase as any)
              .from("bank_connections")
              .update({
                balance_cents: amountToCents(closingBalance.balanceAmount.amount),
                balance_currency: closingBalance.balanceAmount.currency,
                updated_at: new Date().toISOString(),
              })
              .eq("id", connection.id);
          }
        } catch (balanceError) {
          console.warn(`[Bank Sync] Balance fetch failed for ${connection.id}:`, balanceError);
        }

        // Determine date range for transactions
        const dateFrom = connection.last_sync_at
          ? new Date(connection.last_sync_at).toISOString().split("T")[0]
          : (() => {
              const d = new Date();
              d.setDate(d.getDate() - 90);
              return d.toISOString().split("T")[0];
            })();

        // Fetch transactions
        const txData = await getTransactions(accountId, dateFrom);
        const bookedTxs = txData.booked ?? [];

        if (bookedTxs.length > 0) {
          const rows = bookedTxs.map((tx) => ({
            connection_id: connection.id,
            provider_transaction_id: tx.transactionId,
            transaction_date: tx.bookingDate,
            value_date: tx.valueDate || null,
            amount_cents: amountToCents(tx.transactionAmount.amount),
            currency: tx.transactionAmount.currency || "EUR",
            label: tx.remittanceInformationUnstructured || null,
            raw_label: tx.remittanceInformationUnstructured || null,
            counterpart_name: tx.creditorName || tx.debtorName || null,
            counterpart_iban: tx.creditorAccount?.iban || tx.debtorAccount?.iban || null,
            reconciliation_status: "pending",
          }));

          // Insert with ON CONFLICT DO NOTHING
          const { error: txInsertError, count } = await (supabase as any)
            .from("bank_transactions")
            .upsert(rows, {
              onConflict: "provider_transaction_id",
              ignoreDuplicates: true,
              count: "exact",
            });

          if (txInsertError) {
            console.error(`[Bank Sync] Transaction insert error for ${connection.id}:`, txInsertError);
          } else {
            totalNewTransactions += count ?? 0;
          }
        }

        // Update last_sync_at
        await (supabase as any)
          .from("bank_connections")
          .update({
            last_sync_at: new Date().toISOString(),
            error_message: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", connection.id);

        totalSynced++;
      } catch (syncError) {
        const errorMessage = syncError instanceof Error ? syncError.message : "Erreur inconnue";
        console.error(`[Bank Sync] Error syncing connection ${connection.id}:`, syncError);

        // Check for 401/expired token — mark connection as expired
        const isExpired =
          errorMessage.includes("401") ||
          errorMessage.includes("expired") ||
          errorMessage.includes("EX");

        if (isExpired) {
          await (supabase as any)
            .from("bank_connections")
            .update({
              sync_status: "expired",
              error_message: "Consentement bancaire expire. Veuillez reconnecter votre compte.",
              updated_at: new Date().toISOString(),
            })
            .eq("id", connection.id);
        } else {
          await (supabase as any)
            .from("bank_connections")
            .update({
              error_message: errorMessage,
              updated_at: new Date().toISOString(),
            })
            .eq("id", connection.id);
        }

        errors.push({ connectionId: connection.id, error: errorMessage });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        synced: totalSynced,
        newTransactions: totalNewTransactions,
        ...(errors.length > 0 ? { errors } : {}),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

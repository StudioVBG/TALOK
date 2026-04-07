/**
 * Edge Function: Bank Sync (Cron daily 6h)
 *
 * Syncs transactions for all active bank connections via GoCardless API.
 * Runs reconciliation for entities with new transactions.
 *
 * Deploy: supabase functions deploy bank-sync
 * Schedule: 0 6 * * * (daily at 6:00 UTC)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GC_SECRET_ID = Deno.env.get("GOCARDLESS_SECRET_ID");
const GC_SECRET_KEY = Deno.env.get("GOCARDLESS_SECRET_KEY");
const API_BASE = "https://bankaccountdata.gocardless.com/api/v2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ---------------------------------------------------------------------------
// GoCardless API helpers (inline — Edge Functions can't import from lib/)
// ---------------------------------------------------------------------------

let cachedToken: { access: string; expires: number } | null = null;

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expires) {
    return cachedToken.access;
  }

  if (!GC_SECRET_ID || !GC_SECRET_KEY) {
    throw new Error("GOCARDLESS_SECRET_ID and GOCARDLESS_SECRET_KEY must be set");
  }

  const res = await fetch(`${API_BASE}/token/new/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret_id: GC_SECRET_ID, secret_key: GC_SECRET_KEY }),
  });

  if (!res.ok) {
    throw new Error(`GoCardless auth failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  cachedToken = {
    access: data.access,
    expires: Date.now() + (data.access_expires - 60) * 1000,
  };
  return cachedToken.access;
}

async function gcFetch(path: string, options?: RequestInit): Promise<Response> {
  const token = await getToken();
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  });
}

async function getRequisitionStatus(
  requisitionId: string,
): Promise<{ id: string; status: string; accounts: string[] }> {
  const res = await gcFetch(`/requisitions/${requisitionId}/`);
  if (!res.ok) throw new Error(`Requisition fetch failed: ${res.status}`);
  return res.json();
}

async function getBalances(
  accountId: string,
): Promise<Array<{ balanceAmount: { amount: string; currency: string }; balanceType: string }>> {
  const res = await gcFetch(`/accounts/${accountId}/balances/`);
  if (!res.ok) throw new Error(`Balances fetch failed: ${res.status}`);
  const data = await res.json();
  return data.balances ?? [];
}

interface GCTransaction {
  transactionId: string;
  bookingDate: string;
  valueDate: string;
  transactionAmount: { amount: string; currency: string };
  remittanceInformationUnstructured: string;
  creditorName?: string;
  debtorName?: string;
  creditorAccount?: { iban: string };
  debtorAccount?: { iban: string };
}

async function getTransactions(
  accountId: string,
  dateFrom?: string,
): Promise<{ booked: GCTransaction[]; pending: GCTransaction[] }> {
  const params = new URLSearchParams();
  if (dateFrom) params.set("date_from", dateFrom);
  const qs = params.toString() ? `?${params.toString()}` : "";
  const res = await gcFetch(`/accounts/${accountId}/transactions/${qs}`);
  if (!res.ok) throw new Error(`Transactions fetch failed: ${res.status}`);
  const data = await res.json();
  return {
    booked: data.transactions?.booked ?? [],
    pending: data.transactions?.pending ?? [],
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function amountToCents(amount: string): number {
  const parsed = parseFloat(amount);
  if (isNaN(parsed)) return 0;
  return Math.round(parsed * 100);
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    console.log(`[Bank Sync] Running for ${today}`);

    // -----------------------------------------------------------------------
    // 1. Fetch connections due for sync
    // -----------------------------------------------------------------------

    const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString();

    const { data: connections, error: connError } = await supabase
      .from("bank_connections")
      .select("*")
      .in("sync_status", ["synced", "active"])
      .eq("is_active", true)
      .or(`last_sync_at.is.null,last_sync_at.lt.${twelveHoursAgo}`);

    if (connError) throw connError;

    if (!connections || connections.length === 0) {
      console.log("[Bank Sync] No connections due for sync");
      return new Response(
        JSON.stringify({ success: true, synced: 0, newTransactions: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`[Bank Sync] Found ${connections.length} connections to sync`);

    // -----------------------------------------------------------------------
    // 2. Sync each connection (try/catch per connection)
    // -----------------------------------------------------------------------

    let totalSynced = 0;
    let totalNewTransactions = 0;
    const entitiesWithNewTx = new Set<string>();
    const errors: Array<{ connectionId: string; error: string }> = [];

    for (const connection of connections) {
      try {
        // Get requisition status to find account IDs
        const requisition = await getRequisitionStatus(connection.provider_connection_id);

        if (requisition.status === "EX" || requisition.status === "RJ") {
          await supabase
            .from("bank_connections")
            .update({
              sync_status: "expired",
              error_message: `Requisition status: ${requisition.status}`,
              updated_at: now.toISOString(),
            })
            .eq("id", connection.id);
          continue;
        }

        if (!requisition.accounts || requisition.accounts.length === 0) {
          console.warn(`[Bank Sync] No accounts for connection ${connection.id}`);
          continue;
        }

        const accountId = requisition.accounts[0];

        // Fetch balances (non-blocking)
        try {
          const balances = await getBalances(accountId);
          const closingBalance = balances.find(
            (b) =>
              b.balanceType === "closingBooked" ||
              b.balanceType === "interimAvailable",
          );
          if (closingBalance) {
            await supabase
              .from("bank_connections")
              .update({
                balance_cents: amountToCents(closingBalance.balanceAmount.amount),
                balance_currency: closingBalance.balanceAmount.currency,
              })
              .eq("id", connection.id);
          }
        } catch (balErr) {
          console.warn(`[Bank Sync] Balance error for ${connection.id}:`, balErr);
        }

        // Determine date range
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

        let newTxCount = 0;

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
            counterpart_iban:
              tx.creditorAccount?.iban || tx.debtorAccount?.iban || null,
            reconciliation_status: "pending",
          }));

          const { error: txInsertError, count } = await supabase
            .from("bank_transactions")
            .upsert(rows, {
              onConflict: "provider_transaction_id",
              ignoreDuplicates: true,
              count: "exact",
            });

          if (txInsertError) {
            console.error(
              `[Bank Sync] Insert error for ${connection.id}:`,
              txInsertError,
            );
          } else {
            newTxCount = count ?? 0;
            totalNewTransactions += newTxCount;
          }
        }

        // Update last_sync_at and reset error count
        await supabase
          .from("bank_connections")
          .update({
            last_sync_at: now.toISOString(),
            error_message: null,
            consecutive_errors: 0,
            updated_at: now.toISOString(),
          })
          .eq("id", connection.id);

        totalSynced++;

        if (newTxCount > 0) {
          entitiesWithNewTx.add(connection.entity_id);
        }

        console.log(
          `[Bank Sync] Connection ${connection.id}: ${bookedTxs.length} fetched, ${newTxCount} new`,
        );
      } catch (syncError: unknown) {
        const errorMessage =
          syncError instanceof Error ? syncError.message : "Erreur inconnue";
        console.error(
          `[Bank Sync] Error for connection ${connection.id}:`,
          syncError,
        );

        // Check for 401/expired
        const isExpired =
          errorMessage.includes("401") || errorMessage.includes("expired");

        if (isExpired) {
          await supabase
            .from("bank_connections")
            .update({
              sync_status: "expired",
              error_message:
                "Consentement bancaire expire. Veuillez reconnecter votre compte.",
              updated_at: now.toISOString(),
            })
            .eq("id", connection.id);
        } else {
          // Track consecutive errors
          const currentErrors = connection.consecutive_errors ?? 0;
          const newErrorCount = currentErrors + 1;

          const updateData: Record<string, unknown> = {
            error_message: errorMessage,
            consecutive_errors: newErrorCount,
            updated_at: now.toISOString(),
          };

          // 3 consecutive errors -> mark as error
          if (newErrorCount >= 3) {
            updateData.sync_status = "error";
            console.warn(
              `[Bank Sync] Connection ${connection.id} marked as error after ${newErrorCount} consecutive failures`,
            );
          }

          await supabase
            .from("bank_connections")
            .update(updateData)
            .eq("id", connection.id);
        }

        errors.push({ connectionId: connection.id, error: errorMessage });
      }
    }

    // -----------------------------------------------------------------------
    // 3. Run basic reconciliation for entities with new transactions
    // -----------------------------------------------------------------------

    for (const entityId of entitiesWithNewTx) {
      try {
        // Find the current active exercise for this entity
        const { data: exercise } = await supabase
          .from("accounting_exercises")
          .select("id")
          .eq("entity_id", entityId)
          .eq("status", "open")
          .order("start_date", { ascending: false })
          .limit(1)
          .single();

        if (exercise) {
          // Fetch pending transactions for this entity
          const { data: entityConnections } = await supabase
            .from("bank_connections")
            .select("id")
            .eq("entity_id", entityId)
            .eq("is_active", true);

          if (entityConnections && entityConnections.length > 0) {
            const connIds = entityConnections.map((c: { id: string }) => c.id);

            // Count pending to decide if reconciliation is worth running
            const { count: pendingCount } = await supabase
              .from("bank_transactions")
              .select("*", { count: "exact", head: true })
              .in("connection_id", connIds)
              .eq("reconciliation_status", "pending");

            if ((pendingCount ?? 0) > 0) {
              console.log(
                `[Bank Sync] Triggering reconciliation for entity ${entityId} (${pendingCount} pending)`,
              );

              // Basic reconciliation: match by exact amount and close date
              // Full reconciliation is done by the API route on user request
              // Here we just do auto-matching for high-confidence matches
              const { data: pendingTxs } = await supabase
                .from("bank_transactions")
                .select("*")
                .in("connection_id", connIds)
                .eq("reconciliation_status", "pending");

              if (pendingTxs && pendingTxs.length > 0) {
                // Fetch unmatched entries
                const { data: entries } = await supabase
                  .from("accounting_entries")
                  .select(
                    "id, entry_number, entry_date, label, accounting_entry_lines(debit_cents, credit_cents)",
                  )
                  .eq("entity_id", entityId)
                  .eq("exercise_id", exercise.id)
                  .eq("is_validated", true)
                  .in("journal_code", ["BQ", "OD"]);

                if (entries && entries.length > 0) {
                  // Simple exact-amount auto-match
                  for (const tx of pendingTxs) {
                    const txAmount = Math.abs(tx.amount_cents);
                    for (const entry of entries) {
                      const lines = entry.accounting_entry_lines as Array<{
                        debit_cents: number;
                        credit_cents: number;
                      }>;
                      const entryDebit = lines.reduce(
                        (s: number, l) => s + l.debit_cents,
                        0,
                      );
                      const entryCred = lines.reduce(
                        (s: number, l) => s + l.credit_cents,
                        0,
                      );
                      const entryAmount =
                        tx.amount_cents > 0 ? entryDebit : entryCred;

                      if (txAmount === entryAmount && entryAmount > 0) {
                        await supabase
                          .from("bank_transactions")
                          .update({
                            reconciliation_status: "matched_auto",
                            matched_entry_id: entry.id,
                            match_score: 95,
                          })
                          .eq("id", tx.id)
                          .eq("reconciliation_status", "pending"); // Prevent race
                        break;
                      }
                    }
                  }
                }
              }
            }
          }
        }
      } catch (reconError) {
        console.error(
          `[Bank Sync] Reconciliation error for entity ${entityId}:`,
          reconError,
        );
        // Non-blocking — continue with other entities
      }
    }

    // -----------------------------------------------------------------------
    // 4. Audit log
    // -----------------------------------------------------------------------

    await supabase.from("audit_log").insert({
      user_id: "00000000-0000-0000-0000-000000000000",
      action: "bank_sync_cron",
      entity_type: "system",
      entity_id: today,
      metadata: {
        date: today,
        connections_checked: connections.length,
        synced: totalSynced,
        new_transactions: totalNewTransactions,
        errors: errors.length,
        entities_reconciled: entitiesWithNewTx.size,
      },
    } as any);

    console.log(
      `[Bank Sync] Completed: ${totalSynced}/${connections.length} synced, ${totalNewTransactions} new transactions, ${errors.length} errors`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        date: today,
        synced: totalSynced,
        newTransactions: totalNewTransactions,
        connectionsChecked: connections.length,
        entitiesReconciled: entitiesWithNewTx.size,
        errors: errors.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("[Bank Sync] Fatal error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Erreur lors de la synchronisation",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

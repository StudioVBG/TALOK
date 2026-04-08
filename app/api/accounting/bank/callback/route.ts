// @ts-nocheck
/**
 * API Route: Bank OAuth Callback
 * GET /api/accounting/bank/callback - Browser redirect after bank authorization
 *
 * Query params:
 *   ref — Nordigen requisition ID
 *
 * On success: updates connection, triggers first sync, redirects to bank UI.
 * On error: updates connection status, redirects with error flag.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getRequisitionStatus,
  getAccountDetails,
  getTransactions,
  hashIBAN,
  maskIBAN,
} from "@/lib/bank/nordigen";

export const dynamic = "force-dynamic";

const BANK_UI_PATH = "/owner/accounting/bank";

// ---------------------------------------------------------------------------
// Helper: convert amount string "123.45" -> 12345 cents
// ---------------------------------------------------------------------------

function amountToCents(amount: string): number {
  const parsed = parseFloat(amount);
  if (isNaN(parsed)) return 0;
  return Math.round(parsed * 100);
}

// ---------------------------------------------------------------------------
// GET — Callback handler
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ref = searchParams.get("ref");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  if (!ref) {
    return NextResponse.redirect(`${appUrl}${BANK_UI_PATH}?error=missing_ref`);
  }

  const supabase = await createClient();

  // Find the connection by requisition ID
  const { data: connection, error: connError } = await supabase
    .from("bank_connections")
    .select("*")
    .eq("provider_connection_id", ref)
    .single();

  if (connError || !connection) {
    console.error("[Bank Callback] Connection not found for ref:", ref);
    return NextResponse.redirect(`${appUrl}${BANK_UI_PATH}?error=not_found`);
  }

  try {
    // -----------------------------------------------------------------------
    // 1. Check requisition status
    // -----------------------------------------------------------------------

    const requisition = await getRequisitionStatus(ref);

    if (requisition.status !== "LN") {
      // Not linked — mark as error
      await supabase
        .from("bank_connections")
        .update({
          sync_status: "error",
          error_message: `Statut requisition: ${requisition.status}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", connection.id);

      return NextResponse.redirect(`${appUrl}${BANK_UI_PATH}?error=link_failed`);
    }

    if (!requisition.accounts || requisition.accounts.length === 0) {
      await supabase
        .from("bank_connections")
        .update({
          sync_status: "error",
          error_message: "Aucun compte bancaire lie",
          updated_at: new Date().toISOString(),
        })
        .eq("id", connection.id);

      return NextResponse.redirect(`${appUrl}${BANK_UI_PATH}?error=no_accounts`);
    }

    // -----------------------------------------------------------------------
    // 2. Get account details (use first account)
    // -----------------------------------------------------------------------

    const accountId = requisition.accounts[0];
    const accountDetails = await getAccountDetails(accountId);

    const ibanHashed = accountDetails.iban
      ? await hashIBAN(accountDetails.iban)
      : `linked_${connection.id}`;
    const ibanMasked = accountDetails.iban
      ? maskIBAN(accountDetails.iban)
      : "****";

    // Consent expires in 90 days (DSP2 standard)
    const consentExpires = new Date();
    consentExpires.setDate(consentExpires.getDate() + 90);

    // Update connection with IBAN and active status
    const bankName = accountDetails.ownerName
      ? `${connection.bank_name} — ${accountDetails.ownerName}`
      : connection.bank_name;

    await supabase
      .from("bank_connections")
      .update({
        iban_hash: ibanHashed,
        bank_name: `${bankName} (${ibanMasked})`,
        sync_status: "synced",
        consent_expires_at: consentExpires.toISOString(),
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", connection.id);

    // -----------------------------------------------------------------------
    // 3. Trigger first sync (inline)
    // -----------------------------------------------------------------------

    try {
      // Fetch last 90 days of transactions
      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - 90);
      const dateFromStr = dateFrom.toISOString().split("T")[0];

      const txData = await getTransactions(accountId, dateFromStr);
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

        // Insert with ON CONFLICT DO NOTHING (provider_transaction_id)
        const { error: txInsertError } = await supabase
          .from("bank_transactions")
          .upsert(rows, {
            onConflict: "provider_transaction_id",
            ignoreDuplicates: true,
          });

        if (txInsertError) {
          console.error("[Bank Callback] Transaction insert error:", txInsertError);
        }
      }

      // Update last_sync_at
      await supabase
        .from("bank_connections")
        .update({ last_sync_at: new Date().toISOString() })
        .eq("id", connection.id);
    } catch (syncError) {
      // First sync failure is non-blocking — connection is still active
      console.error("[Bank Callback] First sync error:", syncError);
    }

    // -----------------------------------------------------------------------
    // 4. Redirect to bank UI with success
    // -----------------------------------------------------------------------

    return NextResponse.redirect(`${appUrl}${BANK_UI_PATH}?connected=true`);
  } catch (error) {
    console.error("[Bank Callback] Unexpected error:", error);

    // Update connection with error status
    await supabase
      .from("bank_connections")
      .update({
        sync_status: "error",
        error_message: error instanceof Error ? error.message : "Erreur inconnue",
        updated_at: new Date().toISOString(),
      })
      .eq("id", connection.id);

    return NextResponse.redirect(`${appUrl}${BANK_UI_PATH}?error=true`);
  }
}

/**
 * Receipt → accounting entry bridge.
 *
 * When a rent payment is confirmed *outside* the Stripe webhook (manual
 * "mark as paid", off-Stripe confirm, manual receipt generation, etc.),
 * the receipt PDF gets created by `ensureReceiptDocument` but the
 * corresponding double-entry was never posted. This module provides a
 * single idempotent helper that both the non-Stripe code paths and
 * future triggers can call safely.
 *
 * Idempotency: the helper looks up any prior `accounting_entries` row
 * with `reference = payment_id AND source LIKE 'auto:rent_received%'`
 * and bails out if one already exists — so the Stripe webhook's inline
 * `createAutoEntry` call and this helper can never produce a double
 * booking for the same payment.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAutoEntry } from "@/lib/accounting/engine";
import { getOrCreateCurrentExercise } from "@/lib/accounting/auto-exercise";

export interface EnsureReceiptAccountingEntryResult {
  created: boolean;
  /** Reason `created` is false. Always set when created=false. */
  skippedReason?:
    | "already_exists"
    | "payment_not_found"
    | "entity_not_resolved"
    | "exercise_not_available"
    | "error";
  entryId?: string;
  error?: string;
}

interface PaymentRow {
  id: string;
  montant: number | null;
  date_paiement: string | null;
  invoice: {
    id: string;
    periode: string | null;
    lease: {
      id: string;
      property: {
        id: string;
        legal_entity_id: string | null;
        adresse_complete: string | null;
      } | null;
    } | null;
  } | null;
}

/**
 * Ensure an accounting entry exists for `rent_received` on the given
 * payment. Safe to call multiple times and from any code path.
 */
export async function ensureReceiptAccountingEntry(
  supabase: SupabaseClient,
  paymentId: string,
  options: { userId?: string } = {},
): Promise<EnsureReceiptAccountingEntryResult> {
  try {
    // ─── 1. Idempotency guard ───────────────────────────────────────
    // Look for any prior auto-entry already keyed to this payment id.
    // We match on `reference` + source prefix because the Stripe webhook
    // writes source = "auto:rent_received" and the non-Stripe path will
    // do the same through createAutoEntry.
    const { data: existing } = await (supabase as unknown as {
      from: (t: string) => {
        select: (s: string) => {
          eq: (k: string, v: string) => {
            like: (k: string, pattern: string) => {
              limit: (n: number) => {
                maybeSingle: () => Promise<{ data: { id: string } | null }>;
              };
            };
          };
        };
      };
    })
      .from("accounting_entries")
      .select("id")
      .eq("reference", paymentId)
      .like("source", "auto:rent_received%")
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      return { created: false, skippedReason: "already_exists", entryId: existing.id };
    }

    // ─── 2. Fetch the payment with the minimum join needed to resolve
    //       the owning entity and amount. ────────────────────────────
    const { data: payment } = await supabase
      .from("payments")
      .select(
        `
          id,
          montant,
          date_paiement,
          invoice:invoices!inner(
            id,
            periode,
            lease:leases!inner(
              id,
              property:properties!inner(
                id,
                legal_entity_id,
                adresse_complete
              )
            )
          )
        `,
      )
      .eq("id", paymentId)
      .maybeSingle();

    const paymentRow = payment as unknown as PaymentRow | null;
    if (!paymentRow) {
      return { created: false, skippedReason: "payment_not_found" };
    }

    const entityId = paymentRow.invoice?.lease?.property?.legal_entity_id ?? null;
    if (!entityId) {
      return { created: false, skippedReason: "entity_not_resolved" };
    }

    // ─── 3. Current exercise for that entity ───────────────────────
    const exercise = await getOrCreateCurrentExercise(supabase, entityId);
    if (!exercise) {
      return { created: false, skippedReason: "exercise_not_available" };
    }

    // ─── 4. Post the double-entry via the canonical helper ─────────
    // The amount on `payments.montant` is stored in euros (NUMERIC) so
    // we multiply by 100 to get cents, matching the Stripe path that
    // sends cents directly.
    const amountCents = Math.round(Number(paymentRow.montant ?? 0) * 100);
    if (amountCents <= 0) {
      return { created: false, skippedReason: "error", error: "amount_non_positive" };
    }

    const entryDate =
      paymentRow.date_paiement ?? new Date().toISOString().split("T")[0];

    const propertyAddress =
      paymentRow.invoice?.lease?.property?.adresse_complete ?? "";
    const periode = paymentRow.invoice?.periode ?? "";
    const label = `Loyer${periode ? ` ${periode}` : ""}${
      propertyAddress ? ` - ${propertyAddress}` : ""
    }`.trim();

    const entry = await createAutoEntry(supabase, "rent_received", {
      entityId,
      exerciseId: exercise.id,
      userId: options.userId ?? "system",
      amountCents,
      label,
      date: entryDate,
      reference: paymentId,
    });

    return { created: true, entryId: entry.id };
  } catch (err) {
    console.error("[ensureReceiptAccountingEntry] failed:", err);
    return {
      created: false,
      skippedReason: "error",
      error: err instanceof Error ? err.message : "unknown",
    };
  }
}

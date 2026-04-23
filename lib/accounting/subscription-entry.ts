/**
 * Talok subscription → accounting entry bridge.
 *
 * When a Talok subscription invoice is paid (Stripe `invoice.paid` webhook),
 * it is booked as a platform fee in the owner's primary accounting-enabled
 * entity. This is an owner-side expense (SaaS platform fee), not to be
 * confused with a rent invoice paid by the tenant.
 *
 *   debit  622800 (Honoraires et commissions divers)
 *   credit 512100 (Banque)
 *
 * Entity resolution: picks the first `legal_entities` row with
 * `accounting_enabled = true` belonging to `subscriptions.owner_id`, ordered
 * by created_at ASC. If the owner has zero accounting-enabled entities,
 * the entry is skipped — the owner can configure compta later and backfill.
 * If they have more than one, the primary (oldest) is chosen.
 *
 * Idempotency: looked up by (reference = subscription_invoice_id,
 * source LIKE 'auto:subscription_paid%').
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAutoEntry } from "@/lib/accounting/engine";
import { getOrCreateCurrentExercise } from "@/lib/accounting/auto-exercise";
import {
  getEntityAccountingConfig,
  markEntryInformational,
  shouldMarkInformational,
} from "@/lib/accounting/entity-config";
import { resolveSystemActorForEntity } from "@/lib/accounting/system-actor";

export type EnsureSubscriptionSkipReason =
  | "already_exists"
  | "invoice_not_found"
  | "subscription_not_found"
  | "no_enabled_entity"
  | "exercise_not_available"
  | "amount_invalid"
  | "error";

export interface EnsureSubscriptionEntryResult {
  created: boolean;
  skippedReason?: EnsureSubscriptionSkipReason;
  entryId?: string;
  entityId?: string;
  error?: string;
}

interface SubscriptionInvoiceRow {
  id: string;
  subscription_id: string;
  amount_paid: number | null;
  paid_at: string | null;
  stripe_invoice_id: string | null;
}

interface SubscriptionRow {
  id: string;
  owner_id: string;
}

/**
 * Ensure an accounting entry exists for a paid Talok subscription invoice.
 * Safe to call multiple times from any code path (Stripe webhook, backfill).
 */
export async function ensureSubscriptionPaidEntry(
  supabase: SupabaseClient,
  subscriptionInvoiceId: string,
  options: { userId?: string } = {},
): Promise<EnsureSubscriptionEntryResult> {
  try {
    // ─── 1. Idempotency guard ───────────────────────────────────────
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
      .eq("reference", subscriptionInvoiceId)
      .like("source", "auto:subscription_paid%")
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      return {
        created: false,
        skippedReason: "already_exists",
        entryId: existing.id,
      };
    }

    // ─── 2. Load the subscription invoice ───────────────────────────
    const { data: invoice } = await supabase
      .from("subscription_invoices")
      .select("id, subscription_id, amount_paid, paid_at, stripe_invoice_id")
      .eq("id", subscriptionInvoiceId)
      .maybeSingle();

    const invoiceRow = invoice as unknown as SubscriptionInvoiceRow | null;
    if (!invoiceRow) {
      return { created: false, skippedReason: "invoice_not_found" };
    }

    const amountCents = Math.round(Number(invoiceRow.amount_paid ?? 0));
    // subscription_invoices.amount_paid is already stored in cents (Stripe format)
    if (amountCents <= 0) {
      return { created: false, skippedReason: "amount_invalid" };
    }

    // ─── 3. Load the subscription to get owner_id ───────────────────
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("id, owner_id")
      .eq("id", invoiceRow.subscription_id)
      .maybeSingle();

    const subRow = subscription as unknown as SubscriptionRow | null;
    if (!subRow) {
      return { created: false, skippedReason: "subscription_not_found" };
    }

    // ─── 4. Find the primary accounting-enabled entity ──────────────
    // Picks the oldest (usually the particulier/default entity created first).
    const { data: entity } = await supabase
      .from("legal_entities")
      .select("id")
      .eq("owner_profile_id", subRow.owner_id)
      .eq("accounting_enabled", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const entityRow = entity as { id: string } | null;
    if (!entityRow) {
      return { created: false, skippedReason: "no_enabled_entity" };
    }

    const entityId = entityRow.id;
    const config = await getEntityAccountingConfig(supabase, entityId);
    if (!config) {
      return { created: false, skippedReason: "no_enabled_entity" };
    }

    // ─── 5. Current exercise ────────────────────────────────────────
    const exercise = await getOrCreateCurrentExercise(supabase, entityId);
    if (!exercise) {
      return { created: false, skippedReason: "exercise_not_available" };
    }

    // ─── 6. Post the double-entry ───────────────────────────────────
    const entryDate =
      invoiceRow.paid_at?.split("T")[0] ??
      new Date().toISOString().split("T")[0];

    const actorUserId =
      options.userId ?? (await resolveSystemActorForEntity(supabase, entityId));
    if (!actorUserId) {
      return { created: false, skippedReason: "error", error: "actor_unresolved" };
    }

    const entry = await createAutoEntry(supabase, "subscription_paid", {
      entityId,
      exerciseId: exercise.id,
      userId: actorUserId,
      amountCents,
      label: "Abonnement Talok",
      date: entryDate,
      reference: subscriptionInvoiceId,
    });

    if (shouldMarkInformational(config)) {
      await markEntryInformational(supabase, entry.id);
    }

    return { created: true, entryId: entry.id, entityId };
  } catch (err) {
    console.error("[ensureSubscriptionPaidEntry] failed:", err);
    return {
      created: false,
      skippedReason: "error",
      error: err instanceof Error ? err.message : "unknown",
    };
  }
}

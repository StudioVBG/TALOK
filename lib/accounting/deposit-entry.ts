/**
 * Security deposit → accounting entry bridge.
 *
 * When a security deposit is received (`POST /api/leases/[id]/deposit`) or
 * refunded (`POST /api/leases/[id]/deposit/refund`), the engine needs a
 * matching double-entry booking. This module provides two idempotent helpers
 * on the same pattern as `ensureReceiptAccountingEntry` (rent receipts):
 *
 *   - ensureDepositReceivedEntry: books `deposit_received` (BQ journal)
 *       debit  512300 (Banque DG)
 *       credit 165000 (Dépôts de garantie reçus)
 *
 *   - ensureDepositRefundedEntry: books `deposit_returned` (BQ journal)
 *       debit  165000 (Dépôts reçus)
 *       credit 512300 (Banque DG)      ← amount refunded to tenant
 *       credit 791000 (Transferts)      ← optional, for retentions
 *
 * Idempotency: existing accounting_entries are looked up by
 * (reference = deposit_movement_id OR refund_id) AND source LIKE 'auto:deposit_*'.
 * Safe to call multiple times from any code path.
 *
 * Gating: respects `legal_entities.accounting_enabled` (skip if false) and
 * `legal_entities.declaration_mode` (flag as informational if micro_foncier).
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

export type EnsureDepositSkipReason =
  | "already_exists"
  | "source_not_found"
  | "entity_not_resolved"
  | "accounting_disabled"
  | "exercise_not_available"
  | "amount_invalid"
  | "error";

export interface EnsureDepositEntryResult {
  created: boolean;
  skippedReason?: EnsureDepositSkipReason;
  entryId?: string;
  error?: string;
}

interface ExistingEntryQuery {
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
}

async function findExistingEntry(
  supabase: SupabaseClient,
  reference: string,
  sourcePrefix: string,
): Promise<string | null> {
  const { data } = await (supabase as unknown as ExistingEntryQuery)
    .from("accounting_entries")
    .select("id")
    .eq("reference", reference)
    .like("source", `${sourcePrefix}%`)
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

interface LeaseEntityRow {
  id: string;
  property: {
    legal_entity_id: string | null;
    adresse_complete: string | null;
  } | null;
}

async function resolveEntityForLease(
  supabase: SupabaseClient,
  leaseId: string,
): Promise<{ entityId: string | null; propertyAddress: string | null }> {
  const { data } = await supabase
    .from("leases")
    .select(
      `
        id,
        property:properties!inner(
          legal_entity_id,
          adresse_complete
        )
      `,
    )
    .eq("id", leaseId)
    .maybeSingle();

  const row = data as unknown as LeaseEntityRow | null;
  return {
    entityId: row?.property?.legal_entity_id ?? null,
    propertyAddress: row?.property?.adresse_complete ?? null,
  };
}

// ---------------------------------------------------------------------------
// 1. Deposit received
// ---------------------------------------------------------------------------

interface DepositMovementRow {
  id: string;
  lease_id: string;
  amount: number | null;
  processed_at: string | null;
  created_at: string;
  type: string;
  status: string;
}

/**
 * Ensure an accounting entry exists for a `deposit_received` event.
 * Idempotent: if an entry with the same movement reference already exists,
 * returns `created: false`.
 */
export async function ensureDepositReceivedEntry(
  supabase: SupabaseClient,
  movementId: string,
  options: { userId?: string } = {},
): Promise<EnsureDepositEntryResult> {
  try {
    const existingId = await findExistingEntry(
      supabase,
      movementId,
      "auto:deposit_received",
    );
    if (existingId) {
      return {
        created: false,
        skippedReason: "already_exists",
        entryId: existingId,
      };
    }

    const { data: movement } = await supabase
      .from("deposit_movements")
      .select("id, lease_id, amount, processed_at, created_at, type, status")
      .eq("id", movementId)
      .maybeSingle();

    const row = movement as unknown as DepositMovementRow | null;
    if (!row || row.type !== "encaissement" || row.status !== "received") {
      return { created: false, skippedReason: "source_not_found" };
    }

    const { entityId, propertyAddress } = await resolveEntityForLease(
      supabase,
      row.lease_id,
    );
    if (!entityId) {
      return { created: false, skippedReason: "entity_not_resolved" };
    }

    const config = await getEntityAccountingConfig(supabase, entityId);
    if (!config || !config.accountingEnabled) {
      return { created: false, skippedReason: "accounting_disabled" };
    }

    const amountCents = Math.round(Number(row.amount ?? 0) * 100);
    if (amountCents <= 0) {
      return { created: false, skippedReason: "amount_invalid" };
    }

    const exercise = await getOrCreateCurrentExercise(supabase, entityId);
    if (!exercise) {
      return { created: false, skippedReason: "exercise_not_available" };
    }

    const entryDate =
      (row.processed_at ?? row.created_at).split("T")[0] ??
      new Date().toISOString().split("T")[0];
    const label = `Dépôt de garantie reçu${
      propertyAddress ? ` - ${propertyAddress}` : ""
    }`;

    const actorUserId =
      options.userId ?? (await resolveSystemActorForEntity(supabase, entityId));
    if (!actorUserId) {
      return { created: false, skippedReason: "error", error: "actor_unresolved" };
    }

    const entry = await createAutoEntry(supabase, "deposit_received", {
      entityId,
      exerciseId: exercise.id,
      userId: actorUserId,
      amountCents,
      label,
      date: entryDate,
      reference: movementId,
    });

    if (shouldMarkInformational(config)) {
      await markEntryInformational(supabase, entry.id);
    }

    return { created: true, entryId: entry.id };
  } catch (err) {
    console.error("[ensureDepositReceivedEntry] failed:", err);
    return {
      created: false,
      skippedReason: "error",
      error: err instanceof Error ? err.message : "unknown",
    };
  }
}

// ---------------------------------------------------------------------------
// 2. Deposit refunded
// ---------------------------------------------------------------------------

interface DepositRefundRow {
  id: string;
  lease_id: string;
  total_deposit: number | null;
  total_deductions: number | null;
  refund_amount: number | null;
  created_at: string;
}

/**
 * Ensure an accounting entry exists for a `deposit_returned` event.
 * Handles both full refund and partial refund (with retentions) via the
 * engine's `secondaryAmountCents` parameter.
 */
export async function ensureDepositRefundedEntry(
  supabase: SupabaseClient,
  refundId: string,
  options: { userId?: string } = {},
): Promise<EnsureDepositEntryResult> {
  try {
    const existingId = await findExistingEntry(
      supabase,
      refundId,
      "auto:deposit_returned",
    );
    if (existingId) {
      return {
        created: false,
        skippedReason: "already_exists",
        entryId: existingId,
      };
    }

    const { data: refund } = await supabase
      .from("deposit_refunds")
      .select("id, lease_id, total_deposit, total_deductions, refund_amount, created_at")
      .eq("id", refundId)
      .maybeSingle();

    const row = refund as unknown as DepositRefundRow | null;
    if (!row) {
      return { created: false, skippedReason: "source_not_found" };
    }

    const { entityId, propertyAddress } = await resolveEntityForLease(
      supabase,
      row.lease_id,
    );
    if (!entityId) {
      return { created: false, skippedReason: "entity_not_resolved" };
    }

    const config = await getEntityAccountingConfig(supabase, entityId);
    if (!config || !config.accountingEnabled) {
      return { created: false, skippedReason: "accounting_disabled" };
    }

    const refundCents = Math.round(Number(row.refund_amount ?? 0) * 100);
    const retainedCents = Math.round(Number(row.total_deductions ?? 0) * 100);
    if (refundCents + retainedCents <= 0) {
      return { created: false, skippedReason: "amount_invalid" };
    }

    const exercise = await getOrCreateCurrentExercise(supabase, entityId);
    if (!exercise) {
      return { created: false, skippedReason: "exercise_not_available" };
    }

    const entryDate =
      row.created_at.split("T")[0] ??
      new Date().toISOString().split("T")[0];
    const label = `Restitution dépôt de garantie${
      propertyAddress ? ` - ${propertyAddress}` : ""
    }`;

    // Engine builder treats amountCents = refunded, secondaryAmountCents = retained.
    // When refund is zero (full retention) we still need a non-zero primary amount
    // so we swap: amountCents = retained, secondaryAmountCents = 0, and the
    // builder produces a valid 2-line entry.
    const primaryCents = refundCents > 0 ? refundCents : retainedCents;
    const secondaryCents = refundCents > 0 ? retainedCents : 0;

    const actorUserId =
      options.userId ?? (await resolveSystemActorForEntity(supabase, entityId));
    if (!actorUserId) {
      return { created: false, skippedReason: "error", error: "actor_unresolved" };
    }

    const entry = await createAutoEntry(supabase, "deposit_returned", {
      entityId,
      exerciseId: exercise.id,
      userId: actorUserId,
      amountCents: primaryCents,
      secondaryAmountCents: secondaryCents,
      label,
      date: entryDate,
      reference: refundId,
    });

    if (shouldMarkInformational(config)) {
      await markEntryInformational(supabase, entry.id);
    }

    return { created: true, entryId: entry.id };
  } catch (err) {
    console.error("[ensureDepositRefundedEntry] failed:", err);
    return {
      created: false,
      skippedReason: "error",
      error: err instanceof Error ? err.message : "unknown",
    };
  }
}

/**
 * Reusable backfill engine: replays past business events for a single legal
 * entity to generate missing double-entry accounting bookings.
 *
 * Idempotent: every ensure* helper dedupes via (reference, source LIKE 'auto:%')
 * so this is safe to rerun.
 *
 * Used by both the CLI script (scripts/backfill-accounting-entries.ts) and the
 * POST /api/accounting/backfill route.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ensureDepositReceivedEntry,
  ensureDepositRefundedEntry,
  ensureReceiptAccountingEntry,
  ensureSubscriptionPaidEntry,
} from "@/lib/accounting";

export interface BackfillStats {
  processed: number;
  created: number;
  skipped: number;
  errors: number;
  /** First N error messages encountered in this category (capped). */
  errorMessages: string[];
}

export interface BackfillResult {
  rent: BackfillStats;
  depositIn: BackfillStats;
  depositOut: BackfillStats;
  subscription: BackfillStats;
  totals: BackfillStats;
}

export interface BackfillOptions {
  from?: string | null;
  dryRun?: boolean;
  verbose?: boolean;
  /**
   * `auth.users.id` of the operator triggering the backfill — stamped onto
   * every generated accounting entry as `created_by`. When omitted, each
   * ensure* helper falls back to the entity owner's auth user id.
   */
  userId?: string;
}

const ERROR_MESSAGES_CAP = 20;

export function newStats(): BackfillStats {
  return { processed: 0, created: 0, skipped: 0, errors: 0, errorMessages: [] };
}

function pushError(stats: BackfillStats, message: string) {
  stats.errors++;
  if (stats.errorMessages.length < ERROR_MESSAGES_CAP) {
    stats.errorMessages.push(message);
  }
}

function recordResult(
  stats: BackfillStats,
  result: { created: boolean; skippedReason?: string; error?: string },
  context: { category: string; sourceId: string },
) {
  stats.processed++;
  if (result.created) {
    stats.created++;
  } else if (result.skippedReason === "error") {
    pushError(stats, `${context.sourceId}: ${result.error ?? "unknown"}`);
    console.error(
      `[backfill/${context.category}] ${context.sourceId} failed:`,
      result.error ?? "unknown",
    );
  } else {
    stats.skipped++;
  }
}

function mergeInto(target: BackfillStats, source: BackfillStats) {
  target.processed += source.processed;
  target.created += source.created;
  target.skipped += source.skipped;
  target.errors += source.errors;
  for (const m of source.errorMessages) {
    if (target.errorMessages.length >= ERROR_MESSAGES_CAP) break;
    target.errorMessages.push(m);
  }
}

/**
 * Bulk-fetch the set of source IDs that already have a matching auto-entry.
 * Running this once per category replaces N individual idempotency probes
 * from ensure* helpers — the short-circuit is the common path on re-runs
 * and saves ~6 round-trips per already-booked item.
 */
async function fetchAlreadyBookedReferences(
  supabase: SupabaseClient,
  references: string[],
  sourcePrefix: string,
): Promise<Set<string>> {
  if (references.length === 0) return new Set();
  const CHUNK = 500;
  const booked = new Set<string>();
  for (let i = 0; i < references.length; i += CHUNK) {
    const slice = references.slice(i, i + CHUNK);
    const { data, error } = await (supabase as any)
      .from("accounting_entries")
      .select("reference")
      .in("reference", slice)
      .like("source", `${sourcePrefix}%`);
    if (error) {
      console.warn(
        `[backfill] bulk idempotency probe failed for ${sourcePrefix}; falling back to per-item check`,
        error,
      );
      return new Set();
    }
    for (const row of (data as Array<{ reference: string | null }> | null) ?? []) {
      if (row.reference) booked.add(row.reference);
    }
  }
  return booked;
}

async function backfillRentPayments(
  supabase: SupabaseClient,
  entityId: string,
  from: string | null,
  userId: string | undefined,
): Promise<BackfillStats> {
  const stats = newStats();

  // Payments reach this entity via: payments → invoices → leases → properties.legal_entity_id
  let q: any = (supabase as any)
    .from("payments")
    .select(
      `
        id,
        date_paiement,
        statut,
        invoice:invoices!inner(
          id,
          lease:leases!inner(
            id,
            property:properties!inner(id, legal_entity_id)
          )
        )
      `,
    )
    .eq("statut", "succeeded")
    .eq("invoice.lease.property.legal_entity_id", entityId)
    .order("date_paiement", { ascending: true });

  if (from) q = q.gte("date_paiement", from);

  const { data: payments, error } = await q;
  if (error) {
    console.error("[backfill/rent] query failed:", error);
    pushError(stats, `query_failed: ${error.message}`);
    return stats;
  }

  const rows = (payments as Array<{ id: string }> | null) ?? [];
  const alreadyBooked = await fetchAlreadyBookedReferences(
    supabase,
    rows.map((r) => r.id),
    "auto:rent_received",
  );
  for (const p of rows) {
    if (alreadyBooked.has(p.id)) {
      stats.processed++;
      stats.skipped++;
      continue;
    }
    const result = await ensureReceiptAccountingEntry(supabase as any, p.id, { userId });
    recordResult(stats, result, { category: "rent", sourceId: p.id });
  }
  return stats;
}

async function backfillDepositReceived(
  supabase: SupabaseClient,
  entityId: string,
  from: string | null,
  userId: string | undefined,
): Promise<BackfillStats> {
  const stats = newStats();

  let q: any = (supabase as any)
    .from("deposit_movements")
    .select(
      `
        id,
        processed_at,
        created_at,
        lease:leases!inner(
          id,
          property:properties!inner(id, legal_entity_id)
        )
      `,
    )
    .eq("type", "encaissement")
    .eq("status", "received")
    .eq("lease.property.legal_entity_id", entityId)
    .order("created_at", { ascending: true });

  if (from) q = q.gte("created_at", from);

  const { data: movements, error } = await q;
  if (error) {
    console.error("[backfill/depositIn] query failed:", error);
    pushError(stats, `query_failed: ${error.message}`);
    return stats;
  }

  const rows = (movements as Array<{ id: string }> | null) ?? [];
  const alreadyBooked = await fetchAlreadyBookedReferences(
    supabase,
    rows.map((r) => r.id),
    "auto:deposit_received",
  );
  for (const m of rows) {
    if (alreadyBooked.has(m.id)) {
      stats.processed++;
      stats.skipped++;
      continue;
    }
    const result = await ensureDepositReceivedEntry(supabase as any, m.id, { userId });
    recordResult(stats, result, { category: "depositIn", sourceId: m.id });
  }
  return stats;
}

async function backfillDepositRefunded(
  supabase: SupabaseClient,
  entityId: string,
  from: string | null,
  userId: string | undefined,
): Promise<BackfillStats> {
  const stats = newStats();

  let q: any = (supabase as any)
    .from("deposit_refunds")
    .select(
      `
        id,
        created_at,
        lease:leases!inner(
          id,
          property:properties!inner(id, legal_entity_id)
        )
      `,
    )
    .eq("lease.property.legal_entity_id", entityId)
    .order("created_at", { ascending: true });

  if (from) q = q.gte("created_at", from);

  const { data: refunds, error } = await q;
  if (error) {
    console.error("[backfill/depositOut] query failed:", error);
    pushError(stats, `query_failed: ${error.message}`);
    return stats;
  }

  const rows = (refunds as Array<{ id: string }> | null) ?? [];
  const alreadyBooked = await fetchAlreadyBookedReferences(
    supabase,
    rows.map((row) => row.id),
    "auto:deposit_returned",
  );
  for (const r of rows) {
    if (alreadyBooked.has(r.id)) {
      stats.processed++;
      stats.skipped++;
      continue;
    }
    const result = await ensureDepositRefundedEntry(supabase as any, r.id, { userId });
    recordResult(stats, result, { category: "depositOut", sourceId: r.id });
  }
  return stats;
}

async function backfillSubscriptions(
  supabase: SupabaseClient,
  entityId: string,
  from: string | null,
  userId: string | undefined,
): Promise<BackfillStats> {
  const stats = newStats();

  // subscriptions.owner_id → profiles.id == legal_entities.owner_profile_id
  const { data: entity } = await (supabase as any)
    .from("legal_entities")
    .select("owner_profile_id")
    .eq("id", entityId)
    .single();

  const ownerProfileId = (entity as { owner_profile_id?: string } | null)?.owner_profile_id;
  if (!ownerProfileId) return stats;

  let q: any = (supabase as any)
    .from("subscription_invoices")
    .select(
      `
        id,
        paid_at,
        status,
        subscription:subscriptions!inner(id, owner_id)
      `,
    )
    .eq("status", "paid")
    .eq("subscription.owner_id", ownerProfileId)
    .order("paid_at", { ascending: true });

  if (from) q = q.gte("paid_at", from);

  const { data: invoices, error } = await q;
  if (error) {
    console.error("[backfill/subscription] query failed:", error);
    pushError(stats, `query_failed: ${error.message}`);
    return stats;
  }

  const rows = (invoices as Array<{ id: string }> | null) ?? [];
  const alreadyBooked = await fetchAlreadyBookedReferences(
    supabase,
    rows.map((r) => r.id),
    "auto:subscription_paid",
  );
  for (const inv of rows) {
    if (alreadyBooked.has(inv.id)) {
      stats.processed++;
      stats.skipped++;
      continue;
    }
    const result = await ensureSubscriptionPaidEntry(supabase as any, inv.id, { userId });
    recordResult(stats, result, { category: "subscription", sourceId: inv.id });
  }
  return stats;
}

export async function runEntityBackfill(
  supabase: SupabaseClient,
  entityId: string,
  options: BackfillOptions = {},
): Promise<BackfillResult> {
  const from = options.from ?? null;

  // Dry-run is honored by short-circuiting before any ensure* call. We still
  // walk the queries to count what *would* be processed.
  if (options.dryRun) {
    return runDryRun(supabase, entityId, from);
  }

  const userId = options.userId;
  const rent = await backfillRentPayments(supabase, entityId, from, userId);
  const depositIn = await backfillDepositReceived(supabase, entityId, from, userId);
  const depositOut = await backfillDepositRefunded(supabase, entityId, from, userId);
  const subscription = await backfillSubscriptions(supabase, entityId, from, userId);

  const totals = newStats();
  mergeInto(totals, rent);
  mergeInto(totals, depositIn);
  mergeInto(totals, depositOut);
  mergeInto(totals, subscription);

  if (totals.errors > 0) {
    console.info("[backfill] completed with errors", {
      entityId,
      rent: { errors: rent.errors, samples: rent.errorMessages },
      depositIn: { errors: depositIn.errors, samples: depositIn.errorMessages },
      depositOut: { errors: depositOut.errors, samples: depositOut.errorMessages },
      subscription: { errors: subscription.errors, samples: subscription.errorMessages },
    });
  }

  return { rent, depositIn, depositOut, subscription, totals };
}

async function runDryRun(supabase: SupabaseClient, entityId: string, from: string | null): Promise<BackfillResult> {
  async function countQuery(builder: any, category: string): Promise<BackfillStats> {
    const s = newStats();
    const { data, error } = await builder;
    if (error) {
      console.error(`[backfill/${category}] dry-run query failed:`, error);
      pushError(s, `query_failed: ${error.message}`);
      return s;
    }
    const rows = (data as Array<unknown> | null) ?? [];
    s.processed = rows.length;
    s.created = rows.length;
    return s;
  }

  let rentQ: any = (supabase as any)
    .from("payments")
    .select(`id, invoice:invoices!inner(id, lease:leases!inner(id, property:properties!inner(id, legal_entity_id)))`)
    .eq("statut", "succeeded")
    .eq("invoice.lease.property.legal_entity_id", entityId);
  if (from) rentQ = rentQ.gte("date_paiement", from);

  let depInQ: any = (supabase as any)
    .from("deposit_movements")
    .select(`id, lease:leases!inner(id, property:properties!inner(id, legal_entity_id))`)
    .eq("type", "encaissement")
    .eq("status", "received")
    .eq("lease.property.legal_entity_id", entityId);
  if (from) depInQ = depInQ.gte("created_at", from);

  let depOutQ: any = (supabase as any)
    .from("deposit_refunds")
    .select(`id, lease:leases!inner(id, property:properties!inner(id, legal_entity_id))`)
    .eq("lease.property.legal_entity_id", entityId);
  if (from) depOutQ = depOutQ.gte("created_at", from);

  const { data: entity } = await (supabase as any)
    .from("legal_entities")
    .select("owner_profile_id")
    .eq("id", entityId)
    .single();
  const ownerProfileId = (entity as { owner_profile_id?: string } | null)?.owner_profile_id;

  let subscription = newStats();
  if (ownerProfileId) {
    let subQ: any = (supabase as any)
      .from("subscription_invoices")
      .select(`id, subscription:subscriptions!inner(id, owner_id)`)
      .eq("status", "paid")
      .eq("subscription.owner_id", ownerProfileId);
    if (from) subQ = subQ.gte("paid_at", from);
    subscription = await countQuery(subQ, "subscription");
  }

  const rent = await countQuery(rentQ, "rent");
  const depositIn = await countQuery(depInQ, "depositIn");
  const depositOut = await countQuery(depOutQ, "depositOut");

  const totals = newStats();
  mergeInto(totals, rent);
  mergeInto(totals, depositIn);
  mergeInto(totals, depositOut);
  mergeInto(totals, subscription);

  return { rent, depositIn, depositOut, subscription, totals };
}

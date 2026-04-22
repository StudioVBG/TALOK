/**
 * Historical backfill: replay business events to generate missing double-entry
 * bookings for entities where accounting was activated after the fact.
 *
 * Idempotent: all ensure* helpers dedupe via (reference, source LIKE 'auto:*%')
 * so this script can be rerun without creating duplicates.
 *
 * Usage:
 *   npx tsx scripts/backfill-accounting-entries.ts --entity=<uuid>
 *   npx tsx scripts/backfill-accounting-entries.ts --all
 *   npx tsx scripts/backfill-accounting-entries.ts --entity=<uuid> --from=2024-01-01
 *   npx tsx scripts/backfill-accounting-entries.ts --entity=<uuid> --dry-run
 *
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env.
 */

import { createClient } from "@supabase/supabase-js";
import {
  ensureReceiptAccountingEntry,
  ensureDepositReceivedEntry,
  ensureDepositRefundedEntry,
  ensureSubscriptionPaidEntry,
} from "@/lib/accounting";

interface Args {
  entityId: string | null;
  all: boolean;
  from: string | null;
  dryRun: boolean;
}

interface Stats {
  processed: number;
  created: number;
  skipped: number;
  errors: number;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    entityId: null,
    all: false,
    from: null,
    dryRun: false,
  };
  for (const arg of argv.slice(2)) {
    if (arg.startsWith("--entity=")) args.entityId = arg.slice("--entity=".length);
    else if (arg === "--all") args.all = true;
    else if (arg.startsWith("--from=")) args.from = arg.slice("--from=".length);
    else if (arg === "--dry-run") args.dryRun = true;
  }
  if (!args.entityId && !args.all) {
    throw new Error("Specify --entity=<uuid> or --all");
  }
  return args;
}

function newStats(): Stats {
  return { processed: 0, created: 0, skipped: 0, errors: 0 };
}

function recordResult(
  stats: Stats,
  result: { created: boolean; skippedReason?: string; error?: string },
) {
  stats.processed++;
  if (result.created) stats.created++;
  else if (result.skippedReason === "error") stats.errors++;
  else stats.skipped++;
}

function log(label: string, stats: Stats) {
  console.log(
    `  ${label}: processed=${stats.processed} created=${stats.created} skipped=${stats.skipped} errors=${stats.errors}`,
  );
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function resolveEntities(
  supabase: ReturnType<typeof createClient>,
  args: Args,
): Promise<Array<{ id: string; nom: string; accounting_enabled: boolean }>> {
  const query = (supabase as any)
    .from("legal_entities")
    .select("id, nom, accounting_enabled")
    .eq("accounting_enabled", true)
    .order("created_at", { ascending: true });

  if (args.entityId) {
    const { data } = await query.eq("id", args.entityId);
    return (data as any[]) ?? [];
  }
  const { data } = await query;
  return (data as any[]) ?? [];
}

async function backfillRentPayments(
  supabase: ReturnType<typeof createClient>,
  entityId: string,
  from: string | null,
  dryRun: boolean,
): Promise<Stats> {
  const stats = newStats();

  // Payments reach this entity via: payments → invoices → leases → properties.legal_entity_id
  // We filter at the properties level via an inner join.
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
    console.error("  [payments] query failed:", error.message);
    return stats;
  }

  for (const p of (payments as Array<{ id: string }> | null) ?? []) {
    if (dryRun) {
      stats.processed++;
      stats.created++;
      continue;
    }
    const result = await ensureReceiptAccountingEntry(supabase as any, p.id);
    recordResult(stats, result);
    if (stats.processed % 100 === 0) log("rent_received", stats);
    await sleep(5);
  }
  return stats;
}

async function backfillDepositReceived(
  supabase: ReturnType<typeof createClient>,
  entityId: string,
  from: string | null,
  dryRun: boolean,
): Promise<Stats> {
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
    console.error("  [deposit_received] query failed:", error.message);
    return stats;
  }

  for (const m of (movements as Array<{ id: string }> | null) ?? []) {
    if (dryRun) {
      stats.processed++;
      stats.created++;
      continue;
    }
    const result = await ensureDepositReceivedEntry(supabase as any, m.id);
    recordResult(stats, result);
    await sleep(5);
  }
  return stats;
}

async function backfillDepositRefunded(
  supabase: ReturnType<typeof createClient>,
  entityId: string,
  from: string | null,
  dryRun: boolean,
): Promise<Stats> {
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
    console.error("  [deposit_refunded] query failed:", error.message);
    return stats;
  }

  for (const r of (refunds as Array<{ id: string }> | null) ?? []) {
    if (dryRun) {
      stats.processed++;
      stats.created++;
      continue;
    }
    const result = await ensureDepositRefundedEntry(supabase as any, r.id);
    recordResult(stats, result);
    await sleep(5);
  }
  return stats;
}

async function backfillSubscriptions(
  supabase: ReturnType<typeof createClient>,
  entityId: string,
  from: string | null,
  dryRun: boolean,
): Promise<Stats> {
  const stats = newStats();

  // subscriptions.owner_id → profiles.id == legal_entities.owner_profile_id
  const { data: entity } = await (supabase as any)
    .from("legal_entities")
    .select("owner_profile_id")
    .eq("id", entityId)
    .single();

  const ownerProfileId = (entity as { owner_profile_id?: string } | null)
    ?.owner_profile_id;
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
    console.error("  [subscription_paid] query failed:", error.message);
    return stats;
  }

  for (const inv of (invoices as Array<{ id: string }> | null) ?? []) {
    if (dryRun) {
      stats.processed++;
      stats.created++;
      continue;
    }
    const result = await ensureSubscriptionPaidEntry(supabase as any, inv.id);
    recordResult(stats, result);
    await sleep(5);
  }
  return stats;
}

async function main() {
  const args = parseArgs(process.argv);

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars are required",
    );
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  console.log(
    `\n=== Accounting backfill ===\nentity=${args.entityId ?? "ALL"} from=${args.from ?? "beginning"} dry-run=${args.dryRun}\n`,
  );

  const entities = await resolveEntities(supabase, args);
  if (entities.length === 0) {
    console.log(
      "No accounting-enabled entities matched. Set accounting_enabled=true first via the settings UI.",
    );
    return;
  }

  const totals = newStats();

  for (const entity of entities) {
    console.log(`\n→ ${entity.nom} (${entity.id})`);

    const stats = {
      rent: await backfillRentPayments(supabase, entity.id, args.from, args.dryRun),
      depositIn: await backfillDepositReceived(
        supabase,
        entity.id,
        args.from,
        args.dryRun,
      ),
      depositOut: await backfillDepositRefunded(
        supabase,
        entity.id,
        args.from,
        args.dryRun,
      ),
      subscription: await backfillSubscriptions(
        supabase,
        entity.id,
        args.from,
        args.dryRun,
      ),
    };

    log("rent_received", stats.rent);
    log("deposit_received", stats.depositIn);
    log("deposit_refunded", stats.depositOut);
    log("subscription_paid", stats.subscription);

    for (const s of Object.values(stats)) {
      totals.processed += s.processed;
      totals.created += s.created;
      totals.skipped += s.skipped;
      totals.errors += s.errors;
    }
  }

  console.log(
    `\n=== Done ===\nTotal: processed=${totals.processed} created=${totals.created} skipped=${totals.skipped} errors=${totals.errors}`,
  );
  if (args.dryRun) {
    console.log("(dry-run: no entries were actually created)");
  }
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});

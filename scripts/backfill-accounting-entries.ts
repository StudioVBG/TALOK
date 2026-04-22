/**
 * CLI shell around runEntityBackfill (lib/accounting/backfill.ts).
 *
 * The actual replay logic lives in the library so it can be reused by the
 * POST /api/accounting/backfill route triggered from the settings UI.
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
  runEntityBackfill,
  newStats,
  type BackfillStats,
} from "@/lib/accounting/backfill";

interface Args {
  entityId: string | null;
  all: boolean;
  from: string | null;
  dryRun: boolean;
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

function log(label: string, stats: BackfillStats) {
  console.log(
    `  ${label}: processed=${stats.processed} created=${stats.created} skipped=${stats.skipped} errors=${stats.errors}`,
  );
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

  const grandTotals = newStats();

  for (const entity of entities) {
    console.log(`\n→ ${entity.nom} (${entity.id})`);

    const result = await runEntityBackfill(supabase as any, entity.id, {
      from: args.from,
      dryRun: args.dryRun,
    });

    log("rent_received", result.rent);
    log("deposit_received", result.depositIn);
    log("deposit_refunded", result.depositOut);
    log("subscription_paid", result.subscription);

    grandTotals.processed += result.totals.processed;
    grandTotals.created += result.totals.created;
    grandTotals.skipped += result.totals.skipped;
    grandTotals.errors += result.totals.errors;
  }

  console.log(
    `\n=== Done ===\nTotal: processed=${grandTotals.processed} created=${grandTotals.created} skipped=${grandTotals.skipped} errors=${grandTotals.errors}`,
  );
  if (args.dryRun) {
    console.log("(dry-run: no entries were actually created)");
  }
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});

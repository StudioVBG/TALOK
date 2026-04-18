/**
 * Backfill des PDF definitifs bails + EDL signes.
 *
 * Objectif : pour chaque bail / EDL deja signe mais dont le document stocke
 * etait un HTML (signed_final.html / signed_document.html), generer le PDF
 * typographie via le pipeline Puppeteer et remplacer l'entree documents.
 *
 * Utilisation :
 *   npx tsx scripts/backfill-signed-pdfs.ts --dry-run
 *   npx tsx scripts/backfill-signed-pdfs.ts
 *   npx tsx scripts/backfill-signed-pdfs.ts --lease-id=<uuid>
 *   npx tsx scripts/backfill-signed-pdfs.ts --edl-id=<uuid>
 *   npx tsx scripts/backfill-signed-pdfs.ts --only=leases
 *   npx tsx scripts/backfill-signed-pdfs.ts --only=edl
 *
 * Batch : 5 elements en parallele, pause 2s entre batches.
 */

/* eslint-disable no-console */

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

import { getServiceClient } from "@/lib/supabase/service-client";
import { generateSignedLeasePdf } from "@/lib/pdf/lease-signed-pdf";
import { generateSignedEdlPdf } from "@/lib/pdf/edl-signed-pdf";

const BATCH_SIZE = 5;
const BATCH_PAUSE_MS = 2_000;

type Args = {
  dryRun: boolean;
  leaseId?: string;
  edlId?: string;
  only?: "leases" | "edl";
  force: boolean;
};

function parseArgs(): Args {
  const args: Args = { dryRun: false, force: false };
  for (const raw of process.argv.slice(2)) {
    if (raw === "--dry-run") args.dryRun = true;
    else if (raw === "--force") args.force = true;
    else if (raw.startsWith("--lease-id=")) args.leaseId = raw.slice("--lease-id=".length);
    else if (raw.startsWith("--edl-id=")) args.edlId = raw.slice("--edl-id=".length);
    else if (raw === "--only=leases") args.only = "leases";
    else if (raw === "--only=edl") args.only = "edl";
  }
  return args;
}

async function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

async function processInBatches<T>(
  items: T[],
  handler: (item: T) => Promise<{ ok: boolean; id: string; info?: string }>
) {
  const report = { ok: 0, skipped: 0, failed: 0, failures: [] as Array<{ id: string; error: string }> };
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const slice = items.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(slice.map((item) => handler(item)));
    for (const r of results) {
      if (r.status === "fulfilled" && r.value.ok) {
        report.ok++;
        console.log(`  ok ${r.value.id}${r.value.info ? ` (${r.value.info})` : ""}`);
      } else if (r.status === "fulfilled") {
        report.skipped++;
        console.log(`  skip ${r.value.id}${r.value.info ? ` (${r.value.info})` : ""}`);
      } else {
        report.failed++;
        const reason = r.reason instanceof Error ? r.reason.message : String(r.reason);
        report.failures.push({ id: "?", error: reason });
        console.error(`  FAIL ${reason}`);
      }
    }
    if (i + BATCH_SIZE < items.length) await sleep(BATCH_PAUSE_MS);
  }
  return report;
}

async function backfillLeases(args: Args) {
  const supabase = getServiceClient();
  console.log("\n=== Backfill BAILS ===");

  let query = supabase
    .from("leases")
    .select("id, statut, sealed_at, signed_pdf_path, signed_pdf_generated")
    .not("sealed_at", "is", null);

  if (args.leaseId) {
    query = query.eq("id", args.leaseId);
  } else {
    // candidats : scelles mais pas de .pdf (soit .html legacy soit placeholder "pending_generation_*")
    query = query.or("signed_pdf_path.is.null,signed_pdf_path.ilike.%.html,signed_pdf_path.ilike.pending_generation_%");
  }

  const { data: leases, error } = await query;
  if (error) throw error;
  if (!leases || leases.length === 0) {
    console.log("Aucun bail a traiter.");
    return { ok: 0, skipped: 0, failed: 0 };
  }
  console.log(`${leases.length} bail(s) a traiter.`);

  if (args.dryRun) {
    for (const l of leases) console.log(`  [dry-run] ${l.id} (path=${(l as any).signed_pdf_path ?? "null"})`);
    return { ok: 0, skipped: leases.length, failed: 0 };
  }

  return processInBatches(leases, async (lease) => {
    try {
      const result = await generateSignedLeasePdf((lease as any).id, { force: args.force });
      return {
        ok: result.regenerated,
        id: (lease as any).id,
        info: result.regenerated ? `${result.bytes} bytes` : "already-pdf",
      };
    } catch (err) {
      throw new Error(`${(lease as any).id} : ${err instanceof Error ? err.message : String(err)}`);
    }
  });
}

async function backfillEdl(args: Args) {
  const supabase = getServiceClient();
  console.log("\n=== Backfill EDL ===");

  // Candidates : EDL signees (toutes les signatures collectees) qui pointent
  // vers un document EDL_entree/EDL_sortie dont le storage_path finit par .html
  let query = supabase
    .from("documents")
    .select("id, type, storage_path, lease_id, metadata")
    .in("type", ["EDL_entree", "EDL_sortie"] as any);

  if (args.edlId) {
    query = query.eq("metadata->>edl_id", args.edlId);
  } else {
    query = query.or(
      "storage_path.ilike.%.html,storage_path.ilike.%signed_document.html,mime_type.eq.text/html"
    );
  }

  const { data: docs, error } = await query;
  if (error) throw error;

  const candidates = (docs ?? [])
    .map((d) => ({
      edlId: (d as any)?.metadata?.edl_id as string | undefined,
      docId: (d as any).id as string,
      storagePath: (d as any).storage_path as string,
    }))
    .filter((c) => !!c.edlId);

  if (candidates.length === 0) {
    console.log("Aucun EDL a traiter.");
    return { ok: 0, skipped: 0, failed: 0 };
  }
  console.log(`${candidates.length} EDL(s) a traiter.`);

  if (args.dryRun) {
    for (const c of candidates) console.log(`  [dry-run] edl=${c.edlId} doc=${c.docId} (path=${c.storagePath})`);
    return { ok: 0, skipped: candidates.length, failed: 0 };
  }

  return processInBatches(candidates, async (c) => {
    try {
      const result = await generateSignedEdlPdf(c.edlId!, { force: args.force });
      return {
        ok: result.regenerated,
        id: c.edlId!,
        info: result.regenerated ? `${result.kind} ${result.bytes} bytes` : "already-pdf",
      };
    } catch (err) {
      throw new Error(`${c.edlId} : ${err instanceof Error ? err.message : String(err)}`);
    }
  });
}

async function main() {
  const args = parseArgs();
  console.log("Args:", args);

  const shouldRunLeases = !args.only || args.only === "leases";
  const shouldRunEdl = !args.only || args.only === "edl";

  const reports: Record<string, any> = {};
  if (shouldRunLeases && !args.edlId) reports.leases = await backfillLeases(args);
  if (shouldRunEdl && !args.leaseId) reports.edl = await backfillEdl(args);

  console.log("\n=== Rapport final ===");
  console.log(JSON.stringify(reports, null, 2));

  const anyFailures = Object.values(reports).some((r: any) => r?.failed > 0);
  process.exit(anyFailures ? 1 : 0);
}

main().catch((err) => {
  console.error("[backfill] Fatal:", err);
  process.exit(1);
});

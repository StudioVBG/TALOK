#!/usr/bin/env npx tsx
/**
 * Backfill des quittances manquantes
 *
 * Usage : npx tsx scripts/backfill-receipts.ts [--lease-id=<uuid>] [--dry-run]
 *
 * Cible les factures qui remplissent TOUTES ces conditions :
 *   - statut = 'paid'
 *   - receipt_generated IS NULL ou false
 *   - au moins un payment succeeded
 *
 * Pour chaque facture : appelle ensureReceiptDocument(payment.id) qui est
 * idempotent (si une quittance existe deja, rien n'est regenere).
 *
 * Applique aussi receipt_document_id + receipt_generated_at via la mise a
 * jour ajoutee dans lib/services/final-documents.service.ts.
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { ensureReceiptDocument } from "@/lib/services/final-documents.service";

dotenv.config({ path: ".env.local" });

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const leaseArg = args.find((a) => a.startsWith("--lease-id="));
const leaseIdFilter = leaseArg ? leaseArg.split("=")[1] : null;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Variables d'environnement manquantes (.env.local)");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

interface InvoiceRow {
  id: string;
  lease_id: string | null;
  periode: string | null;
  statut: string | null;
  receipt_generated: boolean | null;
}

interface PaymentRow {
  id: string;
  invoice_id: string;
  statut: string;
  date_paiement: string | null;
}

async function main() {
  console.log(
    dryRun
      ? "Mode dry-run : aucune ecriture."
      : "Mode execute : generations reelles."
  );
  if (leaseIdFilter) {
    console.log(`Filtre lease_id = ${leaseIdFilter}`);
  }

  let query = supabase
    .from("invoices")
    .select("id, lease_id, periode, statut, receipt_generated")
    .eq("statut", "paid")
    .or("receipt_generated.is.null,receipt_generated.eq.false");

  if (leaseIdFilter) {
    query = query.eq("lease_id", leaseIdFilter);
  }

  const { data: invoices, error } = await query;

  if (error) {
    console.error("Erreur lecture invoices :", error.message);
    process.exit(1);
  }

  const list = (invoices ?? []) as InvoiceRow[];

  if (list.length === 0) {
    console.log(
      "Toutes les factures payees ont deja une quittance (receipt_generated = true)."
    );
    return;
  }

  console.log(`${list.length} facture(s) payee(s) sans quittance :`);

  let generated = 0;
  let skipped = 0;
  let failed = 0;

  for (const inv of list) {
    const { data: payment, error: pErr } = await supabase
      .from("payments")
      .select("id, invoice_id, statut, date_paiement")
      .eq("invoice_id", inv.id)
      .eq("statut", "succeeded")
      .order("date_paiement", { ascending: false })
      .limit(1)
      .maybeSingle<PaymentRow>();

    if (pErr) {
      console.error(
        `  [${inv.periode ?? inv.id}] lecture payment : ${pErr.message}`
      );
      failed++;
      continue;
    }

    if (!payment) {
      console.log(
        `  [${inv.periode ?? inv.id}] aucun payment succeeded, skip`
      );
      skipped++;
      continue;
    }

    if (dryRun) {
      console.log(
        `  [${inv.periode ?? inv.id}] payment ${payment.id} -> genererait une quittance`
      );
      continue;
    }

    try {
      const result = await ensureReceiptDocument(supabase as any, payment.id);
      if (!result) {
        console.log(
          `  [${inv.periode ?? inv.id}] donnees insuffisantes (lease/tenant/property introuvable)`
        );
        skipped++;
      } else if (result.created) {
        console.log(
          `  [${inv.periode ?? inv.id}] quittance generee : document ${result.documentId}`
        );
        generated++;
      } else {
        console.log(
          `  [${inv.periode ?? inv.id}] deja existante : document ${result.documentId}`
        );
        skipped++;
      }
    } catch (err) {
      console.error(
        `  [${inv.periode ?? inv.id}] erreur generation :`,
        err instanceof Error ? err.message : err
      );
      failed++;
    }
  }

  console.log("---");
  console.log(
    `Resume : ${generated} generee(s), ${skipped} ignoree(s), ${failed} echec(s)`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Erreur fatale :", err);
    process.exit(1);
  });

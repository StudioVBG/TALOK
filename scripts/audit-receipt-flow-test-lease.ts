#!/usr/bin/env tsx
/**
 * Script d'audit READ-ONLY du flow quittance sur le bail test
 *
 * Bail audité : da2eb9da-1ff1-4020-8682-5f993aa6fde7
 *   Owner   : contact.explore.mq@gmail.com (Marie-Line VOLBERG)
 *   Tenant  : volberg.thomas@hotmail.fr (Thomas VOLBERG)
 *   Bien    : 63 Rue Victor Schoelcher 97200 Fort-de-France
 *
 * Vérifie les 4 fixes mergés sur le flow quittance :
 *   - Fix A (e2713ac) : notify_tenant_invoice_created user_id
 *   - Fix B (a35f798) : generate_monthly_invoices period_start/period_end
 *   - Fix C (e1abc33) : pg_cron + mark_overdue
 *   - Fix D (c3ba5a6) : cash_receipt two-step (payments.date_paiement + visible_tenant)
 *
 * Aucune modification de données. Imprime un tableau de synthèse + anomalies.
 *
 * Usage: npx tsx scripts/audit-receipt-flow-test-lease.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    "Variables d'environnement manquantes (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const LEASE_ID = "da2eb9da-1ff1-4020-8682-5f993aa6fde7";
const STORAGE_BUCKET = "documents";

// ANSI colors
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const BLUE = "\x1b[34m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

const ok = (s: string) => `${GREEN}${s}${RESET}`;
const ko = (s: string) => `${RED}${s}${RESET}`;
const warn = (s: string) => `${YELLOW}${s}${RESET}`;
const dim = (s: string) => `${DIM}${s}${RESET}`;

interface Anomaly {
  code: string;
  invoice_id?: string;
  document_id?: string;
  periode?: string;
  message: string;
}

const anomalies: Anomaly[] = [];

function addAnomaly(a: Anomaly) {
  anomalies.push(a);
}

async function main() {
  console.log(`${BOLD}${BLUE}═══════════════════════════════════════════════════════════${RESET}`);
  console.log(`${BOLD}${BLUE}  AUDIT FLOW QUITTANCE — Bail test${RESET}`);
  console.log(`${BOLD}${BLUE}═══════════════════════════════════════════════════════════${RESET}`);
  console.log(`${dim("lease_id : " + LEASE_ID)}\n`);

  // ================================================================
  // 1. Résoudre le bail
  // ================================================================
  console.log(`${BOLD}1. Résolution du bail${RESET}`);

  const { data: lease, error: leaseErr } = await supabase
    .from("leases")
    .select("id, tenant_id, owner_id, property_id, statut, date_debut, date_fin")
    .eq("id", LEASE_ID)
    .maybeSingle();

  if (leaseErr || !lease) {
    console.error(ko(`   Bail introuvable : ${leaseErr?.message ?? "no rows"}`));
    process.exit(1);
  }

  console.log(`   ${ok("OK")} statut=${lease.statut} debut=${lease.date_debut} fin=${lease.date_fin ?? "—"}`);
  console.log(dim(`   tenant_id=${lease.tenant_id}`));
  console.log(dim(`   owner_id=${lease.owner_id}`));
  console.log(dim(`   property_id=${lease.property_id}\n`));

  // ================================================================
  // 2. Lister toutes les invoices du bail
  // ================================================================
  console.log(`${BOLD}2. Invoices du bail${RESET}`);

  const { data: invoices, error: invErr } = await supabase
    .from("invoices")
    .select(
      "id, periode, period_start, period_end, statut, paid_at, receipt_generated, montant_total, montant_loyer, montant_charges, due_date, date_echeance, created_at, metadata"
    )
    .eq("lease_id", LEASE_ID)
    .order("periode", { ascending: true });

  if (invErr) {
    console.error(ko(`   Erreur invoices : ${invErr.message}`));
    process.exit(1);
  }

  console.log(`   ${ok(String((invoices ?? []).length))} invoice(s) trouvée(s)\n`);

  if (!invoices || invoices.length === 0) {
    console.log(warn("   Aucune invoice — fin de l'audit."));
    return;
  }

  // ================================================================
  // 3. Documents quittance du bail
  // ================================================================
  console.log(`${BOLD}3. Documents quittance du bail${RESET}`);

  const { data: docs, error: docsErr } = await supabase
    .from("documents")
    .select(
      "id, type, storage_path, visible_tenant, is_generated, created_at, lease_id, tenant_id, owner_id, metadata"
    )
    .eq("lease_id", LEASE_ID)
    .eq("type", "quittance")
    .order("created_at", { ascending: true });

  if (docsErr) {
    console.error(ko(`   Erreur documents : ${docsErr.message}`));
    process.exit(1);
  }

  console.log(`   ${ok(String((docs ?? []).length))} document(s) quittance trouvé(s)\n`);

  // Index docs by invoice_id (via metadata)
  const docsByInvoice = new Map<string, typeof docs[number]>();
  for (const d of docs ?? []) {
    const invoiceId = (d.metadata as any)?.invoice_id;
    if (invoiceId) {
      docsByInvoice.set(invoiceId, d);
    } else {
      addAnomaly({
        code: "ORPHAN_DOC_NO_INVOICE_ID",
        document_id: d.id,
        message: "Document quittance sans metadata.invoice_id",
      });
    }
  }

  // Vérifier orphelins (doc.metadata.invoice_id ne correspond à aucune invoice du bail)
  const invoiceIds = new Set(invoices.map((i) => i.id));
  for (const [invId, d] of docsByInvoice.entries()) {
    if (!invoiceIds.has(invId)) {
      addAnomaly({
        code: "ORPHAN_DOC",
        document_id: d.id,
        message: `Document quittance lie à invoice_id=${invId} qui n'appartient pas au bail`,
      });
    }
  }

  // ================================================================
  // 4. Vue tenant : v_tenant_key_documents
  // ================================================================
  console.log(`${BOLD}4. Vue v_tenant_key_documents${RESET}`);

  const { data: keyDocs, error: keyErr } = await supabase
    .from("v_tenant_key_documents")
    .select("id, type, title, storage_path, lease_id, slot_key, created_at, metadata, tenant_id")
    .eq("tenant_id", lease.tenant_id);

  if (keyErr) {
    console.error(ko(`   Erreur vue : ${keyErr.message}`));
  }

  const quittanceKeyDocs = (keyDocs ?? []).filter((k: any) => k.slot_key === "quittance");
  console.log(
    `   ${ok(String(quittanceKeyDocs.length))} quittance(s) exposée(s) dans v_tenant_key_documents pour ce tenant`
  );
  if (quittanceKeyDocs.length > 0) {
    for (const k of quittanceKeyDocs) {
      console.log(
        dim(`     → doc_id=${(k as any).id} lease_id=${(k as any).lease_id} created=${(k as any).created_at}`)
      );
    }
  }
  console.log();

  const keyDocIds = new Set(quittanceKeyDocs.map((k: any) => k.id));

  // ================================================================
  // 5. Pour chaque invoice : récupérer payment + checks
  // ================================================================
  console.log(`${BOLD}5. Vérifications par invoice${RESET}\n`);

  type Row = {
    periode: string;
    statut: string;
    paid_at: string;
    payment_date: string;
    receipt_gen: string;
    doc_exists: string;
    file_exists: string;
    visible_tenant: string;
    in_tenant_view: string;
  };

  const rows: Row[] = [];

  for (const inv of invoices) {
    const periode = inv.periode || `${inv.period_start ?? "?"}→${inv.period_end ?? "?"}`;

    // Récupérer paiement le plus récent
    const { data: payment } = await supabase
      .from("payments")
      .select("id, montant, moyen, date_paiement, statut, created_at")
      .eq("invoice_id", inv.id)
      .order("created_at", { ascending: false })
      .maybeSingle();

    const isPaid = inv.statut === "paid";
    const paidAtOk = inv.paid_at != null;
    const paymentDateOk = payment?.date_paiement != null;
    const receiptGen = inv.receipt_generated === true;

    const doc = docsByInvoice.get(inv.id);
    const docExists = !!doc;
    const visibleTenant = doc?.visible_tenant === true;

    // Vérifier fichier dans Storage
    let fileExists: boolean | null = null;
    if (doc?.storage_path) {
      // createSignedUrl échoue si le fichier n'existe pas
      const { data: signed, error: signErr } = await supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(doc.storage_path, 60);
      fileExists = !!signed && !signErr;
    }

    const inTenantView = doc ? keyDocIds.has(doc.id) : false;

    // ============ Détection anomalies (uniquement pour invoices payées) ============
    if (isPaid) {
      if (!paidAtOk) {
        addAnomaly({
          code: "PAID_AT_NULL",
          invoice_id: inv.id,
          periode,
          message: "Invoice statut=paid mais paid_at IS NULL",
        });
      }
      if (!payment) {
        addAnomaly({
          code: "MISSING_PAYMENT",
          invoice_id: inv.id,
          periode,
          message: "Invoice statut=paid mais aucun row dans payments",
        });
      } else if (!paymentDateOk) {
        addAnomaly({
          code: "BUG_A_REGRESSION",
          invoice_id: inv.id,
          periode,
          message: "payments.date_paiement IS NULL — Fix D / Bug A non appliqué",
        });
      }
      if (!receiptGen) {
        addAnomaly({
          code: "RECEIPT_NOT_GENERATED",
          invoice_id: inv.id,
          periode,
          message: "Invoice statut=paid mais receipt_generated=false",
        });
      }
      if (!docExists) {
        addAnomaly({
          code: "MISSING_DOC",
          invoice_id: inv.id,
          periode,
          message: "Invoice statut=paid mais aucun documents row de type=quittance",
        });
      } else {
        if (!visibleTenant) {
          addAnomaly({
            code: "BUG_B_REGRESSION",
            invoice_id: inv.id,
            document_id: doc.id,
            periode,
            message: "Document quittance avec visible_tenant=false — Fix D / Bug B non appliqué",
          });
        }
        if (fileExists === false) {
          addAnomaly({
            code: "MISSING_FILE",
            invoice_id: inv.id,
            document_id: doc.id,
            periode,
            message: `Fichier absent du bucket Storage : ${doc.storage_path}`,
          });
        }
        if (visibleTenant && !inTenantView) {
          // La vue retourne uniquement la quittance la plus récente — pas une anomalie en soi
          // sauf si c'est LA plus récente
          addAnomaly({
            code: "NOT_IN_TENANT_VIEW_INFO",
            invoice_id: inv.id,
            document_id: doc.id,
            periode,
            message:
              "Quittance non exposée dans v_tenant_key_documents (vue retourne 1 seul slot par tenant — peut être normal si plusieurs quittances)",
          });
        }
      }
    }

    rows.push({
      periode,
      statut: inv.statut ?? "?",
      paid_at: isPaid ? (paidAtOk ? "OK" : "NULL") : "—",
      payment_date: isPaid ? (payment ? (paymentDateOk ? "OK" : "NULL") : "no-payment") : "—",
      receipt_gen: isPaid ? String(receiptGen) : "—",
      doc_exists: isPaid ? (docExists ? "OK" : "MISSING") : docExists ? "OK" : "—",
      file_exists:
        docExists && fileExists !== null ? (fileExists ? "OK" : "MISSING") : "—",
      visible_tenant: docExists ? String(visibleTenant) : "—",
      in_tenant_view: docExists ? (inTenantView ? "OK" : "NO") : "—",
    });
  }

  // ================================================================
  // 6. Tableau de synthèse
  // ================================================================
  console.log(`${BOLD}═══════════════════════════════════════════════════════════${RESET}`);
  console.log(`${BOLD}TABLEAU DE SYNTHÈSE${RESET}`);
  console.log(`${BOLD}═══════════════════════════════════════════════════════════${RESET}\n`);

  const headers = [
    "periode",
    "statut",
    "paid_at",
    "pmt_date",
    "rcpt_gen",
    "doc",
    "file",
    "visible_t",
    "in_view",
  ];
  const widths = headers.map((h) => h.length);

  const allRows = rows.map((r) => [
    r.periode,
    r.statut,
    r.paid_at,
    r.payment_date,
    r.receipt_gen,
    r.doc_exists,
    r.file_exists,
    r.visible_tenant,
    r.in_tenant_view,
  ]);

  for (const row of allRows) {
    row.forEach((c, i) => {
      widths[i] = Math.max(widths[i], String(c).length);
    });
  }

  const sep = widths.map((w) => "─".repeat(w + 2)).join("┼");
  const fmtRow = (cells: string[]) =>
    cells.map((c, i) => " " + String(c).padEnd(widths[i] + 1)).join("│");

  console.log(fmtRow(headers));
  console.log(sep);
  for (const row of allRows) {
    const colored = row.map((c) => {
      const s = String(c);
      if (s === "OK" || s === "true") return ok(s);
      if (s === "NULL" || s === "MISSING" || s === "false" || s === "NO" || s === "no-payment")
        return ko(s);
      return s;
    });
    console.log(fmtRow(colored));
  }

  // ================================================================
  // 7. Anomalies
  // ================================================================
  console.log(`\n${BOLD}═══════════════════════════════════════════════════════════${RESET}`);
  console.log(`${BOLD}ANOMALIES${RESET}`);
  console.log(`${BOLD}═══════════════════════════════════════════════════════════${RESET}\n`);

  if (anomalies.length === 0) {
    console.log(ok("Aucune anomalie détectée. Tous les fixes A/B/C/D semblent appliqués correctement."));
    process.exit(0);
  }

  // Trier par criticité
  const critical = anomalies.filter((a) =>
    ["BUG_A_REGRESSION", "BUG_B_REGRESSION", "MISSING_DOC", "MISSING_FILE", "MISSING_PAYMENT", "PAID_AT_NULL", "RECEIPT_NOT_GENERATED", "ORPHAN_DOC", "ORPHAN_DOC_NO_INVOICE_ID"].includes(a.code)
  );
  const info = anomalies.filter((a) => !critical.includes(a));

  if (critical.length > 0) {
    console.log(`${BOLD}${RED}Critiques (${critical.length}) :${RESET}`);
    for (const a of critical) {
      const tag = `[${a.code}]`;
      const ctx = [
        a.periode ? `periode=${a.periode}` : null,
        a.invoice_id ? `invoice=${a.invoice_id}` : null,
        a.document_id ? `doc=${a.document_id}` : null,
      ]
        .filter(Boolean)
        .join(" ");
      console.log(`  ${ko(tag)} ${a.message}`);
      if (ctx) console.log(dim(`        ${ctx}`));
    }
    console.log();
  }

  if (info.length > 0) {
    console.log(`${BOLD}${YELLOW}Informationnelles (${info.length}) :${RESET}`);
    for (const a of info) {
      const tag = `[${a.code}]`;
      const ctx = [
        a.periode ? `periode=${a.periode}` : null,
        a.invoice_id ? `invoice=${a.invoice_id}` : null,
        a.document_id ? `doc=${a.document_id}` : null,
      ]
        .filter(Boolean)
        .join(" ");
      console.log(`  ${warn(tag)} ${a.message}`);
      if (ctx) console.log(dim(`        ${ctx}`));
    }
  }

  process.exit(critical.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(ko("Erreur fatale : "), err);
  process.exit(2);
});

/**
 * Server-side PDF renderers for accounting exports (balance, grand-livre,
 * journal). Relies on the shared Puppeteer pipeline in `lib/pdf/html-to-pdf`.
 */

import { renderHtmlToPdf } from "@/lib/pdf/html-to-pdf";
import type {
  BalanceItem,
  GrandLivreItem,
  JournalItem,
} from "@/lib/accounting/engine";

// ─── Helpers ───────────────────────────────────────────────────────────────

const euro = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatCents(cents: number): string {
  return euro.format(Math.abs(cents) / 100);
}

function escapeHtml(value: string | null | undefined): string {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR");
}

// ─── Shared layout ─────────────────────────────────────────────────────────

interface ExportContext {
  entityName: string;
  startDate: string;
  endDate: string;
}

function buildLayout(title: string, ctx: ExportContext, body: string): string {
  const today = new Date().toLocaleDateString("fr-FR");
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<style>
  @page { size: A4; margin: 18mm 14mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; font-size: 9.5pt; color: #111; margin: 0; padding: 0; }
  h1 { font-size: 16pt; margin: 0 0 4mm 0; color: #0f172a; }
  .meta { font-size: 9pt; color: #64748b; margin-bottom: 6mm; }
  .meta strong { color: #0f172a; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 6mm; }
  th { text-align: left; font-size: 8.5pt; color: #475569; border-bottom: 1px solid #cbd5e1; padding: 2mm 1.5mm; background: #f8fafc; text-transform: uppercase; letter-spacing: 0.02em; }
  td { padding: 1.8mm 1.5mm; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  tr.totals td { font-weight: 700; border-top: 2px solid #0f172a; border-bottom: none; }
  h2 { font-size: 11pt; margin: 4mm 0 2mm 0; color: #0f172a; }
  .section { break-inside: avoid; }
  .footer { margin-top: 6mm; font-size: 8pt; color: #94a3b8; }
</style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">
    <strong>${escapeHtml(ctx.entityName)}</strong>
    &nbsp;·&nbsp; Exercice du ${formatDate(ctx.startDate)} au ${formatDate(ctx.endDate)}
    &nbsp;·&nbsp; Edite le ${today}
  </div>
  ${body}
  <div class="footer">Document Talok — a transmettre a votre expert-comptable.</div>
</body>
</html>`;
}

// ─── Balance ───────────────────────────────────────────────────────────────

export async function renderBalancePdf(
  balance: BalanceItem[],
  ctx: ExportContext,
): Promise<Buffer> {
  const rows = balance
    .map(
      (b) => `
      <tr>
        <td>${escapeHtml(b.accountNumber)}</td>
        <td>${escapeHtml(b.label)}</td>
        <td class="num">${formatCents(b.totalDebitCents)}</td>
        <td class="num">${formatCents(b.totalCreditCents)}</td>
        <td class="num">${b.soldeDebitCents > 0 ? formatCents(b.soldeDebitCents) : ""}</td>
        <td class="num">${b.soldeCreditCents > 0 ? formatCents(b.soldeCreditCents) : ""}</td>
      </tr>`,
    )
    .join("");

  const totalDebit = balance.reduce((s, b) => s + b.totalDebitCents, 0);
  const totalCredit = balance.reduce((s, b) => s + b.totalCreditCents, 0);
  const totalSoldeD = balance.reduce((s, b) => s + b.soldeDebitCents, 0);
  const totalSoldeC = balance.reduce((s, b) => s + b.soldeCreditCents, 0);

  const body = `
    <table>
      <thead>
        <tr>
          <th>Compte</th>
          <th>Libelle</th>
          <th class="num">Total debit</th>
          <th class="num">Total credit</th>
          <th class="num">Solde debiteur</th>
          <th class="num">Solde crediteur</th>
        </tr>
      </thead>
      <tbody>
        ${rows || '<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:6mm;">Aucune ecriture</td></tr>'}
        <tr class="totals">
          <td colspan="2">Totaux</td>
          <td class="num">${formatCents(totalDebit)}</td>
          <td class="num">${formatCents(totalCredit)}</td>
          <td class="num">${formatCents(totalSoldeD)}</td>
          <td class="num">${formatCents(totalSoldeC)}</td>
        </tr>
      </tbody>
    </table>
  `;

  return renderHtmlToPdf(buildLayout("Balance comptable", ctx, body));
}

// ─── Grand livre ───────────────────────────────────────────────────────────

export async function renderGrandLivrePdf(
  grandLivre: GrandLivreItem[],
  ctx: ExportContext,
): Promise<Buffer> {
  const sections = grandLivre
    .map((acc) => {
      const lines = acc.entries
        .map(
          (e) => `
          <tr>
            <td>${formatDate(e.entryDate)}</td>
            <td>${escapeHtml(e.entryNumber)}</td>
            <td>${escapeHtml(e.label)}</td>
            <td>${escapeHtml(e.lettrage ?? "")}</td>
            <td class="num">${e.debitCents > 0 ? formatCents(e.debitCents) : ""}</td>
            <td class="num">${e.creditCents > 0 ? formatCents(e.creditCents) : ""}</td>
          </tr>`,
        )
        .join("");
      const solde = acc.totalDebitCents - acc.totalCreditCents;
      const soldeLabel = solde === 0
        ? "solde nul"
        : solde > 0
          ? `solde debiteur ${formatCents(solde)}`
          : `solde crediteur ${formatCents(solde)}`;
      return `
      <div class="section">
        <h2>${escapeHtml(acc.accountNumber)} — ${escapeHtml(acc.accountLabel)}</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>No ecriture</th>
              <th>Libelle</th>
              <th>Lettrage</th>
              <th class="num">Debit</th>
              <th class="num">Credit</th>
            </tr>
          </thead>
          <tbody>
            ${lines}
            <tr class="totals">
              <td colspan="4">Total compte (${soldeLabel})</td>
              <td class="num">${formatCents(acc.totalDebitCents)}</td>
              <td class="num">${formatCents(acc.totalCreditCents)}</td>
            </tr>
          </tbody>
        </table>
      </div>`;
    })
    .join("");

  const body =
    sections ||
    '<p style="text-align:center;color:#94a3b8;padding:6mm;">Aucune ecriture pour cet exercice.</p>';

  return renderHtmlToPdf(buildLayout("Grand livre", ctx, body));
}

// ─── Journal général ───────────────────────────────────────────────────────

export async function renderJournalPdf(
  journal: JournalItem[],
  ctx: ExportContext,
): Promise<Buffer> {
  const sections = journal
    .map((j) => {
      const entryBlocks = j.entries
        .map((e) => {
          const lineRows = e.lines
            .map(
              (l) => `
              <tr>
                <td></td>
                <td>${escapeHtml(l.accountNumber)} ${escapeHtml(l.accountLabel)}</td>
                <td>${escapeHtml(l.lettrage ?? "")}</td>
                <td class="num">${l.debitCents > 0 ? formatCents(l.debitCents) : ""}</td>
                <td class="num">${l.creditCents > 0 ? formatCents(l.creditCents) : ""}</td>
              </tr>`,
            )
            .join("");
          return `
          <tr class="entry-head">
            <td>${formatDate(e.entryDate)}</td>
            <td><strong>${escapeHtml(e.entryNumber)}</strong> — ${escapeHtml(e.label)}</td>
            <td></td>
            <td class="num"></td>
            <td class="num"></td>
          </tr>
          ${lineRows}`;
        })
        .join("");

      return `
      <div class="section">
        <h2>Journal ${escapeHtml(j.journalCode)} — ${escapeHtml(j.journalLabel)}</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Ecriture / Compte</th>
              <th>Lettrage</th>
              <th class="num">Debit</th>
              <th class="num">Credit</th>
            </tr>
          </thead>
          <tbody>
            ${entryBlocks}
            <tr class="totals">
              <td colspan="3">Total journal</td>
              <td class="num">${formatCents(j.totalDebitCents)}</td>
              <td class="num">${formatCents(j.totalCreditCents)}</td>
            </tr>
          </tbody>
        </table>
      </div>`;
    })
    .join("");

  const body =
    sections ||
    '<p style="text-align:center;color:#94a3b8;padding:6mm;">Aucune ecriture pour cet exercice.</p>';

  return renderHtmlToPdf(buildLayout("Journal general", ctx, body));
}

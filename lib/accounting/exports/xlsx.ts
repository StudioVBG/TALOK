/**
 * ExcelJS workbook builders for accounting exports.
 * Each function returns a Node Buffer ready to stream back to the client.
 */

import type {
  BalanceItem,
  GrandLivreItem,
  JournalItem,
} from "@/lib/accounting/engine";

// Dynamic import so ExcelJS is only pulled in when an XLSX is actually asked
// for — keeps cold-start time low on routes that almost always serve JSON.
async function loadWorkbook() {
  const { default: ExcelJS } = await import("exceljs");
  return new ExcelJS.Workbook();
}

const NUM_FORMAT = "#,##0.00";

function cents(n: number): number {
  return n / 100;
}

// ─── Balance ───────────────────────────────────────────────────────────────

export async function buildBalanceWorkbook(
  balance: BalanceItem[],
): Promise<Buffer> {
  const wb = await loadWorkbook();
  const ws = wb.addWorksheet("Balance");

  ws.columns = [
    { header: "Compte", key: "account", width: 12 },
    { header: "Libellé", key: "label", width: 38 },
    { header: "Total débit", key: "totalDebit", width: 16, style: { numFmt: NUM_FORMAT } },
    { header: "Total crédit", key: "totalCredit", width: 16, style: { numFmt: NUM_FORMAT } },
    { header: "Solde débiteur", key: "soldeDebit", width: 16, style: { numFmt: NUM_FORMAT } },
    { header: "Solde créditeur", key: "soldeCredit", width: 16, style: { numFmt: NUM_FORMAT } },
  ];
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.getRow(1).font = { bold: true };

  for (const row of balance) {
    ws.addRow({
      account: row.accountNumber,
      label: row.label,
      totalDebit: cents(row.totalDebitCents),
      totalCredit: cents(row.totalCreditCents),
      soldeDebit: row.soldeDebitCents > 0 ? cents(row.soldeDebitCents) : null,
      soldeCredit: row.soldeCreditCents > 0 ? cents(row.soldeCreditCents) : null,
    });
  }

  const totalDebit = balance.reduce((s, b) => s + b.totalDebitCents, 0);
  const totalCredit = balance.reduce((s, b) => s + b.totalCreditCents, 0);
  const totalSoldeD = balance.reduce((s, b) => s + b.soldeDebitCents, 0);
  const totalSoldeC = balance.reduce((s, b) => s + b.soldeCreditCents, 0);
  const totalRow = ws.addRow({
    account: "",
    label: "Totaux",
    totalDebit: cents(totalDebit),
    totalCredit: cents(totalCredit),
    soldeDebit: cents(totalSoldeD),
    soldeCredit: cents(totalSoldeC),
  });
  totalRow.font = { bold: true };
  totalRow.border = { top: { style: "medium" } };

  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ─── Grand livre ───────────────────────────────────────────────────────────

export async function buildGrandLivreWorkbook(
  grandLivre: GrandLivreItem[],
): Promise<Buffer> {
  const wb = await loadWorkbook();
  const ws = wb.addWorksheet("Grand livre");

  ws.columns = [
    { header: "Compte", key: "account", width: 12 },
    { header: "Libellé compte", key: "accountLabel", width: 32 },
    { header: "Date", key: "date", width: 12 },
    { header: "N° écriture", key: "entryNum", width: 14 },
    { header: "Libellé", key: "label", width: 36 },
    { header: "Lettrage", key: "lettrage", width: 10 },
    { header: "Débit", key: "debit", width: 14, style: { numFmt: NUM_FORMAT } },
    { header: "Crédit", key: "credit", width: 14, style: { numFmt: NUM_FORMAT } },
  ];
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.getRow(1).font = { bold: true };

  for (const acc of grandLivre) {
    for (const e of acc.entries) {
      ws.addRow({
        account: acc.accountNumber,
        accountLabel: acc.accountLabel,
        date: e.entryDate,
        entryNum: e.entryNumber,
        label: e.label,
        lettrage: e.lettrage ?? "",
        debit: e.debitCents > 0 ? cents(e.debitCents) : null,
        credit: e.creditCents > 0 ? cents(e.creditCents) : null,
      });
    }
    const subTotal = ws.addRow({
      account: acc.accountNumber,
      accountLabel: `Total ${acc.accountLabel}`,
      date: "",
      entryNum: "",
      label: "",
      lettrage: "",
      debit: cents(acc.totalDebitCents),
      credit: cents(acc.totalCreditCents),
    });
    subTotal.font = { italic: true, bold: true };
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ─── Journal général ───────────────────────────────────────────────────────

export async function buildJournalWorkbook(
  journal: JournalItem[],
): Promise<Buffer> {
  const wb = await loadWorkbook();

  for (const j of journal) {
    const ws = wb.addWorksheet(`${j.journalCode}`.slice(0, 31));
    ws.columns = [
      { header: "Date", key: "date", width: 12 },
      { header: "N° écriture", key: "entryNum", width: 14 },
      { header: "Libellé", key: "label", width: 36 },
      { header: "Compte", key: "account", width: 12 },
      { header: "Libellé compte", key: "accountLabel", width: 32 },
      { header: "Lettrage", key: "lettrage", width: 10 },
      { header: "Débit", key: "debit", width: 14, style: { numFmt: NUM_FORMAT } },
      { header: "Crédit", key: "credit", width: 14, style: { numFmt: NUM_FORMAT } },
    ];
    ws.views = [{ state: "frozen", ySplit: 1 }];
    ws.getRow(1).font = { bold: true };

    for (const e of j.entries) {
      for (const l of e.lines) {
        ws.addRow({
          date: e.entryDate,
          entryNum: e.entryNumber,
          label: e.label,
          account: l.accountNumber,
          accountLabel: l.accountLabel,
          lettrage: l.lettrage ?? "",
          debit: l.debitCents > 0 ? cents(l.debitCents) : null,
          credit: l.creditCents > 0 ? cents(l.creditCents) : null,
        });
      }
    }

    const totalRow = ws.addRow({
      date: "",
      entryNum: "",
      label: `Total journal ${j.journalCode}`,
      account: "",
      accountLabel: "",
      lettrage: "",
      debit: cents(j.totalDebitCents),
      credit: cents(j.totalCreditCents),
    });
    totalRow.font = { bold: true };
    totalRow.border = { top: { style: "medium" } };
  }

  if (wb.worksheets.length === 0) {
    const ws = wb.addWorksheet("Journal");
    ws.addRow(["Aucune écriture pour cet exercice"]);
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}

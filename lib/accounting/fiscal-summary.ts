/**
 * Générateur de récapitulatif fiscal annuel — PDF
 * Utilise pdf-lib
 *
 * Contenu :
 * - Header : "Récapitulatif fiscal {année}" + nom entité
 * - Section 1 : Revenus fonciers bruts
 * - Section 2 : Charges déductibles
 * - Section 3 : Revenu foncier net imposable
 * - Section 4 : Détail mensuel
 * - Section 5 : Détail par bien
 * - Footer : mention informative
 */

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const COLORS = {
  primary: rgb(0.145, 0.388, 0.922), // #2563EB
  text: rgb(0.067, 0.067, 0.067),
  gray: rgb(0.42, 0.45, 0.5),
  lightGray: rgb(0.92, 0.93, 0.95),
  green: rgb(0.063, 0.647, 0.447),
  red: rgb(0.863, 0.078, 0.235),
};

function fmtEur(v: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(v);
}

const MONTHS_FR = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

export interface FiscalSummaryData {
  year: number;
  ownerName: string;
  siren?: string;
  totalRentCollected: number;
  totalChargesCollected: number;
  totalCommissions: number;
  totalExpenses: number;
  netIncome: number;
  monthlyBreakdown: Array<{
    month: number;
    rentCollected: number;
    expenses: number;
    netIncome: number;
  }>;
  byProperty: Array<{
    propertyName: string;
    rentCollected: number;
    unpaidAmount: number;
  }>;
}

export async function generateFiscalSummaryPDF(
  data: FiscalSummaryData
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const page = doc.addPage([595, 842]); // A4
  const { width, height } = page.getSize();
  const margin = 50;
  let y = height - margin;

  // ── Header ──
  page.drawText("TALOK", {
    x: margin,
    y,
    size: 10,
    font: fontBold,
    color: COLORS.primary,
  });
  y -= 30;

  page.drawText(`Récapitulatif fiscal ${data.year}`, {
    x: margin,
    y,
    size: 20,
    font: fontBold,
    color: COLORS.text,
  });
  y -= 22;

  page.drawText(data.ownerName + (data.siren ? ` — SIREN ${data.siren}` : ""), {
    x: margin,
    y,
    size: 10,
    font,
    color: COLORS.gray,
  });
  y -= 35;

  // ── Section 1: Revenus fonciers bruts ──
  page.drawText("1. Revenus fonciers bruts", {
    x: margin,
    y,
    size: 13,
    font: fontBold,
    color: COLORS.primary,
  });
  y -= 22;

  const s1Lines = [
    ["Loyers encaissés", fmtEur(data.totalRentCollected)],
    ["Charges récupérables", fmtEur(data.totalChargesCollected)],
    [
      "Total revenus bruts",
      fmtEur(data.totalRentCollected + data.totalChargesCollected),
    ],
  ];
  for (const [label, value] of s1Lines) {
    page.drawText(label, { x: margin + 10, y, size: 10, font, color: COLORS.text });
    page.drawText(value, {
      x: width - margin - font.widthOfTextAtSize(value, 10),
      y,
      size: 10,
      font: label.startsWith("Total") ? fontBold : font,
      color: COLORS.text,
    });
    y -= 16;
  }
  y -= 12;

  // ── Section 2: Charges déductibles ──
  page.drawText("2. Charges déductibles", {
    x: margin,
    y,
    size: 13,
    font: fontBold,
    color: COLORS.primary,
  });
  y -= 22;

  const s2Lines = [
    ["Commissions de gestion", fmtEur(data.totalCommissions)],
    ["Travaux et réparations", fmtEur(data.totalExpenses)],
    [
      "Total charges déductibles",
      fmtEur(data.totalCommissions + data.totalExpenses),
    ],
  ];
  for (const [label, value] of s2Lines) {
    page.drawText(label, { x: margin + 10, y, size: 10, font, color: COLORS.text });
    page.drawText(value, {
      x: width - margin - font.widthOfTextAtSize(value, 10),
      y,
      size: 10,
      font: label.startsWith("Total") ? fontBold : font,
      color: COLORS.text,
    });
    y -= 16;
  }
  y -= 12;

  // ── Section 3: Revenu net imposable ──
  page.drawRectangle({
    x: margin,
    y: y - 8,
    width: width - 2 * margin,
    height: 30,
    color: COLORS.lightGray,
  });
  page.drawText("3. Revenu foncier net imposable", {
    x: margin + 10,
    y: y + 2,
    size: 12,
    font: fontBold,
    color: COLORS.text,
  });
  const netStr = fmtEur(data.netIncome);
  page.drawText(netStr, {
    x: width - margin - 10 - fontBold.widthOfTextAtSize(netStr, 14),
    y,
    size: 14,
    font: fontBold,
    color: data.netIncome >= 0 ? COLORS.green : COLORS.red,
  });
  y -= 40;

  // ── Section 4: Détail mensuel ──
  page.drawText("4. Détail mensuel", {
    x: margin,
    y,
    size: 13,
    font: fontBold,
    color: COLORS.primary,
  });
  y -= 20;

  // Table header
  const cols = [margin + 10, margin + 130, margin + 260, margin + 390];
  const headers4 = ["Mois", "Encaissé", "Charges", "Net"];
  for (let i = 0; i < headers4.length; i++) {
    page.drawText(headers4[i], {
      x: cols[i],
      y,
      size: 9,
      font: fontBold,
      color: COLORS.gray,
    });
  }
  y -= 14;

  for (const m of data.monthlyBreakdown) {
    if (y < 80) break; // avoid overflow
    page.drawText(MONTHS_FR[m.month - 1] || String(m.month), {
      x: cols[0],
      y,
      size: 9,
      font,
      color: COLORS.text,
    });
    page.drawText(fmtEur(m.rentCollected), {
      x: cols[1],
      y,
      size: 9,
      font,
      color: COLORS.text,
    });
    page.drawText(fmtEur(m.expenses), {
      x: cols[2],
      y,
      size: 9,
      font,
      color: COLORS.text,
    });
    page.drawText(fmtEur(m.netIncome), {
      x: cols[3],
      y,
      size: 9,
      font,
      color: m.netIncome >= 0 ? COLORS.text : COLORS.red,
    });
    y -= 14;
  }
  y -= 10;

  // ── Section 5: Détail par bien ──
  if (y > 140 && data.byProperty.length > 0) {
    page.drawText("5. Détail par bien", {
      x: margin,
      y,
      size: 13,
      font: fontBold,
      color: COLORS.primary,
    });
    y -= 20;

    const colsP = [margin + 10, margin + 250, margin + 380];
    page.drawText("Bien", { x: colsP[0], y, size: 9, font: fontBold, color: COLORS.gray });
    page.drawText("Encaissé", { x: colsP[1], y, size: 9, font: fontBold, color: COLORS.gray });
    page.drawText("Impayé", { x: colsP[2], y, size: 9, font: fontBold, color: COLORS.gray });
    y -= 14;

    for (const p of data.byProperty) {
      if (y < 80) break;
      const name =
        p.propertyName.length > 40
          ? p.propertyName.slice(0, 37) + "..."
          : p.propertyName;
      page.drawText(name, { x: colsP[0], y, size: 9, font, color: COLORS.text });
      page.drawText(fmtEur(p.rentCollected), {
        x: colsP[1],
        y,
        size: 9,
        font,
        color: COLORS.text,
      });
      page.drawText(fmtEur(p.unpaidAmount), {
        x: colsP[2],
        y,
        size: 9,
        font,
        color: p.unpaidAmount > 0 ? COLORS.red : COLORS.text,
      });
      y -= 14;
    }
  }

  // ── Footer ──
  page.drawText(
    "Document généré automatiquement par Talok — à usage informatif, ne remplace pas l'avis d'un expert-comptable.",
    {
      x: margin,
      y: 40,
      size: 7,
      font,
      color: COLORS.gray,
    }
  );
  page.drawText(
    `Généré le ${new Date().toLocaleDateString("fr-FR")}`,
    {
      x: margin,
      y: 28,
      size: 7,
      font,
      color: COLORS.gray,
    }
  );

  return doc.save();
}

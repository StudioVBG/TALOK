/**
 * CERFA 2044 — Declaration des revenus fonciers (regime reel).
 *
 * Renders a pre-filled, CERFA-styled A4 PDF from the values computed by
 * /api/accounting/declarations/2044. All amounts are in EUR cents in the
 * input and converted to euros for display.
 *
 * Note: this is an *aide au remplissage* — the user still has to recopy
 * the values onto the official CERFA form (or submit via impots.gouv.fr).
 * Disclaimer printed in the footer.
 */

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const COLORS = {
  primary: rgb(0.145, 0.388, 0.922),
  navy: rgb(0.106, 0.165, 0.42),
  text: rgb(0.067, 0.067, 0.067),
  gray: rgb(0.42, 0.45, 0.5),
  lightGray: rgb(0.94, 0.95, 0.97),
  highlight: rgb(0.969, 0.953, 0.835),
  green: rgb(0.063, 0.647, 0.447),
  red: rgb(0.863, 0.078, 0.235),
};

function eurFromCents(cents: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

export interface Cerfa2044Data {
  year: number;
  ownerName: string;
  siren?: string;
  ligne_215_cents: number;
  ligne_221_cents: number;
  ligne_222_cents: number;
  ligne_223_cents: number;
  ligne_224_cents: number;
  ligne_227_cents: number;
  ligne_229_cents: number;
  ligne_230_cents: number;
  case_4BA_cents: number;
  case_4BB_cents: number;
  case_4BC_cents: number;
}

const LINE_LABELS: Record<string, string> = {
  ligne_215: "Ligne 215 — Loyers bruts encaisses",
  ligne_221: "Ligne 221 — Frais d'administration et de gestion (forfait)",
  ligne_222: "Ligne 222 — Primes d'assurance",
  ligne_223: "Ligne 223 — Travaux d'entretien et de reparation",
  ligne_224: "Ligne 224 — Interets d'emprunt",
  ligne_227: "Ligne 227 — Taxes foncieres et autres impositions",
  ligne_229: "Ligne 229 — Total des charges deductibles",
  ligne_230: "Ligne 230 — Resultat foncier (215 - 229)",
  case_4BA: "Case 4BA — Benefice foncier imposable",
  case_4BB: "Case 4BB — Deficit imputable sur revenu global (plafonne 10 700 EUR)",
  case_4BC: "Case 4BC — Deficit reportable (excedent + interets emprunt)",
};

export async function generateCerfa2044Pdf(
  data: Cerfa2044Data,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const page = doc.addPage([595, 842]); // A4
  const { width, height } = page.getSize();
  const margin = 48;
  let y = height - margin;

  // ─── Header ───────────────────────────────────────────────
  page.drawText("TALOK", {
    x: margin,
    y,
    size: 11,
    font: fontBold,
    color: COLORS.primary,
  });
  page.drawText("Aide au remplissage CERFA 2044", {
    x: margin + 60,
    y,
    size: 11,
    font,
    color: COLORS.gray,
  });
  y -= 28;

  page.drawText(`Declaration des revenus fonciers ${data.year}`, {
    x: margin,
    y,
    size: 19,
    font: fontBold,
    color: COLORS.navy,
  });
  y -= 22;

  page.drawText("Regime reel — Formulaire 2044", {
    x: margin,
    y,
    size: 11,
    font,
    color: COLORS.gray,
  });
  y -= 18;

  page.drawText(
    data.ownerName + (data.siren ? ` — SIREN ${data.siren}` : ""),
    { x: margin, y, size: 10, font, color: COLORS.text },
  );
  y -= 30;

  // ─── Section Revenus ──────────────────────────────────────
  page.drawRectangle({
    x: margin,
    y: y - 4,
    width: width - 2 * margin,
    height: 22,
    color: COLORS.lightGray,
  });
  page.drawText("REVENUS BRUTS", {
    x: margin + 8,
    y: y + 4,
    size: 11,
    font: fontBold,
    color: COLORS.navy,
  });
  y -= 28;

  const drawLine = (
    code: string,
    cents: number,
    opts: { bold?: boolean; highlight?: boolean } = {},
  ) => {
    if (opts.highlight) {
      page.drawRectangle({
        x: margin,
        y: y - 4,
        width: width - 2 * margin,
        height: 18,
        color: COLORS.highlight,
      });
    }
    const label = LINE_LABELS[code] ?? code;
    const value = eurFromCents(cents);
    const valueWidth = (opts.bold ? fontBold : font).widthOfTextAtSize(value, 10);
    page.drawText(label, {
      x: margin + 8,
      y,
      size: 10,
      font: opts.bold ? fontBold : font,
      color: COLORS.text,
    });
    page.drawText(value, {
      x: width - margin - 8 - valueWidth,
      y,
      size: 10,
      font: opts.bold ? fontBold : font,
      color: COLORS.text,
    });
    y -= 16;
  };

  drawLine("ligne_215", data.ligne_215_cents, { bold: true });
  y -= 8;

  // ─── Section Charges ──────────────────────────────────────
  page.drawRectangle({
    x: margin,
    y: y - 4,
    width: width - 2 * margin,
    height: 22,
    color: COLORS.lightGray,
  });
  page.drawText("CHARGES DEDUCTIBLES", {
    x: margin + 8,
    y: y + 4,
    size: 11,
    font: fontBold,
    color: COLORS.navy,
  });
  y -= 28;

  drawLine("ligne_221", data.ligne_221_cents);
  drawLine("ligne_222", data.ligne_222_cents);
  drawLine("ligne_223", data.ligne_223_cents);
  drawLine("ligne_224", data.ligne_224_cents);
  drawLine("ligne_227", data.ligne_227_cents);
  drawLine("ligne_229", data.ligne_229_cents, { bold: true });
  y -= 8;

  // ─── Section Resultat ─────────────────────────────────────
  page.drawRectangle({
    x: margin,
    y: y - 4,
    width: width - 2 * margin,
    height: 22,
    color: COLORS.lightGray,
  });
  page.drawText("RESULTAT FONCIER", {
    x: margin + 8,
    y: y + 4,
    size: 11,
    font: fontBold,
    color: COLORS.navy,
  });
  y -= 28;

  drawLine("ligne_230", data.ligne_230_cents, {
    bold: true,
    highlight: true,
  });
  y -= 8;

  // ─── Section Reports 2042 ────────────────────────────────
  page.drawRectangle({
    x: margin,
    y: y - 4,
    width: width - 2 * margin,
    height: 22,
    color: COLORS.lightGray,
  });
  page.drawText("A REPORTER SUR FORMULAIRE 2042", {
    x: margin + 8,
    y: y + 4,
    size: 11,
    font: fontBold,
    color: COLORS.navy,
  });
  y -= 28;

  drawLine("case_4BA", data.case_4BA_cents, { bold: true });
  drawLine("case_4BB", data.case_4BB_cents, { bold: true });
  drawLine("case_4BC", data.case_4BC_cents, { bold: true });
  y -= 16;

  // ─── Methodology box ─────────────────────────────────────
  if (y > 140) {
    page.drawRectangle({
      x: margin,
      y: y - 70,
      width: width - 2 * margin,
      height: 70,
      borderColor: COLORS.primary,
      borderWidth: 0.6,
    });
    const lines = [
      "Methodologie",
      "• Loyers bruts = total credits comptes 706 sur l'exercice.",
      "• Forfait gestion = 20 EUR par local declare (ligne 221).",
      "• Travaux = total debits 615; assurances = 616; interets = 661; taxes = 635.",
      "• Deficit foncier impute sur revenu global plafonne a 10 700 EUR (hors interets).",
    ];
    let ly = y - 12;
    for (const txt of lines) {
      const isTitle = txt === "Methodologie";
      page.drawText(txt, {
        x: margin + 8,
        y: ly,
        size: isTitle ? 9 : 8,
        font: isTitle ? fontBold : font,
        color: isTitle ? COLORS.primary : COLORS.text,
      });
      ly -= isTitle ? 14 : 12;
    }
  }

  // ─── Footer ───────────────────────────────────────────────
  page.drawText(
    "Document genere par TALOK a usage informatif. Ne remplace pas l'avis d'un expert-comptable",
    { x: margin, y: 36, size: 7, font, color: COLORS.gray },
  );
  page.drawText("ni la declaration officielle a deposer sur impots.gouv.fr.", {
    x: margin,
    y: 28,
    size: 7,
    font,
    color: COLORS.gray,
  });
  page.drawText(
    `Genere le ${new Date().toLocaleDateString("fr-FR")} — TALOK Comptabilite`,
    { x: margin, y: 16, size: 7, font, color: COLORS.gray },
  );

  return doc.save();
}

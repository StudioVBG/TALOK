/**
 * CERFA 2072 — Declaration des resultats d'une SCI a l'IR.
 *
 * Aide au remplissage : la SCI calcule un resultat foncier puis le repartit
 * entre ses associes au prorata de leur quote-part. Chaque associe reporte
 * sa fraction sur sa propre 2044/2042.
 *
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

export interface Cerfa2072Data {
  year: number;
  ownerName: string;
  siren?: string;
  revenus_bruts_cents: number;
  charges_deductibles_cents: number;
  resultat_cents: number;
  associates: Array<{
    name: string;
    quotePartPct: number;
    resultatCents: number;
  }>;
}

export async function generateCerfa2072Pdf(
  data: Cerfa2072Data,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const page = doc.addPage([595, 842]);
  const { width, height } = page.getSize();
  const margin = 48;
  let y = height - margin;

  // Header
  page.drawText("TALOK", {
    x: margin,
    y,
    size: 11,
    font: fontBold,
    color: COLORS.primary,
  });
  page.drawText("Aide au remplissage CERFA 2072", {
    x: margin + 60,
    y,
    size: 11,
    font,
    color: COLORS.gray,
  });
  y -= 28;

  page.drawText(`Declaration SCI a l'IR — exercice ${data.year}`, {
    x: margin,
    y,
    size: 19,
    font: fontBold,
    color: COLORS.navy,
  });
  y -= 22;

  page.drawText("Formulaire 2072-S — Resultat de la societe civile", {
    x: margin,
    y,
    size: 11,
    font,
    color: COLORS.gray,
  });
  y -= 18;

  page.drawText(
    `${data.ownerName}${data.siren ? ` — SIREN ${data.siren}` : ""}`,
    { x: margin, y, size: 10, font, color: COLORS.text },
  );
  y -= 30;

  // Section: Resultat de la societe
  page.drawRectangle({
    x: margin,
    y: y - 4,
    width: width - 2 * margin,
    height: 22,
    color: COLORS.lightGray,
  });
  page.drawText("RESULTAT DE LA SOCIETE", {
    x: margin + 8,
    y: y + 4,
    size: 11,
    font: fontBold,
    color: COLORS.navy,
  });
  y -= 28;

  const drawRow = (
    label: string,
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
      color: cents < 0 && opts.highlight ? COLORS.red : COLORS.text,
    });
    y -= 16;
  };

  drawRow("Revenus bruts (loyers encaisses)", data.revenus_bruts_cents);
  drawRow("Charges deductibles", -data.charges_deductibles_cents);
  drawRow("Resultat foncier", data.resultat_cents, {
    bold: true,
    highlight: true,
  });
  y -= 16;

  // Section: Repartition associes
  page.drawRectangle({
    x: margin,
    y: y - 4,
    width: width - 2 * margin,
    height: 22,
    color: COLORS.lightGray,
  });
  page.drawText("REPARTITION ENTRE ASSOCIES", {
    x: margin + 8,
    y: y + 4,
    size: 11,
    font: fontBold,
    color: COLORS.navy,
  });
  y -= 24;

  // Header table
  const cols = [margin + 10, margin + 280, margin + 360];
  page.drawText("Associe", {
    x: cols[0],
    y,
    size: 9,
    font: fontBold,
    color: COLORS.gray,
  });
  page.drawText("Quote-part", {
    x: cols[1],
    y,
    size: 9,
    font: fontBold,
    color: COLORS.gray,
  });
  page.drawText("Quote-part resultat", {
    x: cols[2],
    y,
    size: 9,
    font: fontBold,
    color: COLORS.gray,
  });
  y -= 6;
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 0.5,
    color: COLORS.gray,
  });
  y -= 12;

  let associatesTotal = 0;
  for (const associate of data.associates) {
    if (y < 120) break;
    const value = eurFromCents(associate.resultatCents);
    const valueWidth = font.widthOfTextAtSize(value, 10);
    page.drawText(
      associate.name.length > 38
        ? associate.name.slice(0, 35) + "..."
        : associate.name,
      { x: cols[0], y, size: 10, font, color: COLORS.text },
    );
    page.drawText(`${associate.quotePartPct.toFixed(2)} %`, {
      x: cols[1],
      y,
      size: 10,
      font,
      color: COLORS.text,
    });
    page.drawText(value, {
      x: width - margin - 10 - valueWidth,
      y,
      size: 10,
      font,
      color: associate.resultatCents < 0 ? COLORS.red : COLORS.text,
    });
    associatesTotal += associate.resultatCents;
    y -= 14;
  }

  // Total associes (sanity check)
  y -= 6;
  page.drawLine({
    start: { x: margin, y: y + 4 },
    end: { x: width - margin, y: y + 4 },
    thickness: 0.5,
    color: COLORS.gray,
  });
  const totalLabel = "Total reparti";
  const totalValue = eurFromCents(associatesTotal);
  const totalValueWidth = fontBold.widthOfTextAtSize(totalValue, 10);
  page.drawText(totalLabel, {
    x: cols[0],
    y,
    size: 10,
    font: fontBold,
    color: COLORS.text,
  });
  page.drawText(totalValue, {
    x: width - margin - 10 - totalValueWidth,
    y,
    size: 10,
    font: fontBold,
    color: COLORS.text,
  });
  y -= 24;

  // Methodology box
  if (y > 130) {
    page.drawRectangle({
      x: margin,
      y: y - 75,
      width: width - 2 * margin,
      height: 75,
      borderColor: COLORS.primary,
      borderWidth: 0.6,
    });
    const lines = [
      "Methodologie",
      "• Resultat foncier = (706 credits) − (615 + 616 + 635 + 661 debits).",
      "• Quote-part associe = quote_part_pct (entity_associates).",
      "• Le total reparti doit egaler le resultat de la societe.",
      "• Chaque associe reporte sa fraction sur sa propre 2044 + 2042 (case 4BA).",
      "• Pour SCI a l'IS, utiliser plutot la 2065 (en cours de mise en place).",
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
      ly -= isTitle ? 14 : 11;
    }
  }

  // Footer
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

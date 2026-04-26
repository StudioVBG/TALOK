/**
 * CERFA 2031 — Declaration BIC reel (location meublee LMP / LMNP).
 *
 * Aide au remplissage. Les recettes sont traitees comme commerciales,
 * les charges et amortissements sont deductibles, le resultat suit le
 * regime LMP (impute sur revenu global) ou LMNP (impute sur revenus
 * BIC seulement).
 */

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const COLORS = {
  primary: rgb(0.145, 0.388, 0.922),
  navy: rgb(0.106, 0.165, 0.42),
  text: rgb(0.067, 0.067, 0.067),
  gray: rgb(0.42, 0.45, 0.5),
  lightGray: rgb(0.94, 0.95, 0.97),
  highlight: rgb(0.969, 0.953, 0.835),
  red: rgb(0.863, 0.078, 0.235),
};

const eur = (cents: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(cents / 100);

export interface Cerfa2031Data {
  year: number;
  ownerName: string;
  siren?: string;
  recettes_bic: number;
  charges: {
    externes: number;
    impots_taxes: number;
    financieres: number;
    dotations_amortissements: number;
    total: number;
  };
  resultat_bic: number;
  deficit_lmnp_reportable: number;
}

export async function generateCerfa2031Pdf(
  data: Cerfa2031Data,
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
  page.drawText("Aide au remplissage CERFA 2031", {
    x: margin + 60,
    y,
    size: 11,
    font,
    color: COLORS.gray,
  });
  y -= 28;

  page.drawText(`Declaration BIC reel — exercice ${data.year}`, {
    x: margin,
    y,
    size: 19,
    font: fontBold,
    color: COLORS.navy,
  });
  y -= 22;

  page.drawText("Formulaire 2031 — Location meublee (LMP / LMNP)", {
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

  const drawRow = (
    label: string,
    cents: number,
    opts: { bold?: boolean; highlight?: boolean; indent?: number } = {},
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
    const value = eur(cents);
    const valueWidth = (opts.bold ? fontBold : font).widthOfTextAtSize(value, 10);
    page.drawText(label, {
      x: margin + 8 + (opts.indent ?? 0),
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
      color: cents < 0 ? COLORS.red : COLORS.text,
    });
    y -= 16;
  };

  const drawSection = (title: string) => {
    page.drawRectangle({
      x: margin,
      y: y - 4,
      width: width - 2 * margin,
      height: 22,
      color: COLORS.lightGray,
    });
    page.drawText(title, {
      x: margin + 8,
      y: y + 4,
      size: 11,
      font: fontBold,
      color: COLORS.navy,
    });
    y -= 28;
  };

  drawSection("RECETTES BIC");
  drawRow("Loyers + charges recuperees", data.recettes_bic, { bold: true });
  y -= 6;

  drawSection("CHARGES DEDUCTIBLES");
  drawRow("Services exterieurs (61, 62)", data.charges.externes, { indent: 10 });
  drawRow("Impots et taxes (63)", data.charges.impots_taxes, { indent: 10 });
  drawRow("Charges financieres (66)", data.charges.financieres, { indent: 10 });
  drawRow(
    "Dotations aux amortissements (681)",
    data.charges.dotations_amortissements,
    { indent: 10 },
  );
  drawRow("Total charges", data.charges.total, { bold: true });
  y -= 6;

  drawSection("RESULTAT");
  drawRow("Resultat BIC", data.resultat_bic, { bold: true, highlight: true });
  if (data.deficit_lmnp_reportable > 0) {
    drawRow(
      "Deficit reportable (LMNP, 10 ans)",
      data.deficit_lmnp_reportable,
      { indent: 10 },
    );
  }
  y -= 12;

  // Methodology + LMP/LMNP guidance
  if (y > 150) {
    page.drawRectangle({
      x: margin,
      y: y - 110,
      width: width - 2 * margin,
      height: 110,
      borderColor: COLORS.primary,
      borderWidth: 0.6,
    });
    const lines = [
      "Methodologie & regime LMP / LMNP",
      "• Recettes = comptes 706 + 708 (credit).",
      "• Charges = 61 + 62 + 63 + 66 + 681 (debit).",
      "• L'amortissement du bien est tres puissant en location meublee :",
      "  il neutralise souvent le resultat sans creer de deficit imputable.",
      "• LMP (recettes > 23 000 EUR ET > 50% des revenus du foyer) :",
      "  deficit imputable sur revenu global, plus-value pro a la sortie.",
      "• LMNP : deficit reportable 10 ans sur BIC seulement, plus-value",
      "  des particuliers (abattements pour duree de detention).",
      "• Le bascul LMP ↔ LMNP s'apprecie chaque annee — verifier avec l'EC.",
    ];
    let ly = y - 12;
    for (const txt of lines) {
      const isTitle = txt === "Methodologie & regime LMP / LMNP";
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

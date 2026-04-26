/**
 * CERFA 2065 — Declaration des resultats d'une societe a l'IS.
 *
 * Aide au remplissage : compte de resultat agrege + estimation IS au
 * taux reduit (15% jusqu'a 42 500 EUR) et taux normal (25%). Le calcul
 * exact reste a la charge de l'EC : reintegrations, amortissements
 * derogatoires et provisions reglementees ne sont pas trackes par TALOK.
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

const eur = (cents: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(cents / 100);

export interface Cerfa2065Data {
  year: number;
  ownerName: string;
  siren?: string;
  produits: {
    loyers: number;
    charges_recuperees: number;
    financiers: number;
    exceptionnels: number;
    total: number;
  };
  charges: {
    externes: number;
    impots_taxes: number;
    personnel: number;
    financieres: number;
    dotations_amortissements: number;
    exceptionnelles: number;
    total: number;
  };
  resultat_avant_impot: number;
  is_taux_reduit_cents: number;
  is_taux_normal_cents: number;
  is_total_cents: number;
  resultat_apres_impot: number;
}

export async function generateCerfa2065Pdf(
  data: Cerfa2065Data,
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
  page.drawText("Aide au remplissage CERFA 2065", {
    x: margin + 60,
    y,
    size: 11,
    font,
    color: COLORS.gray,
  });
  y -= 28;

  page.drawText(`Declaration IS — exercice ${data.year}`, {
    x: margin,
    y,
    size: 19,
    font: fontBold,
    color: COLORS.navy,
  });
  y -= 22;

  page.drawText("Formulaire 2065 — Resultat fiscal au taux normal et reduit", {
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

  drawSection("PRODUITS D'EXPLOITATION");
  drawRow("Loyers", data.produits.loyers, { indent: 10 });
  drawRow("Charges recuperees sur locataires", data.produits.charges_recuperees, {
    indent: 10,
  });
  drawRow("Produits financiers", data.produits.financiers, { indent: 10 });
  drawRow("Produits exceptionnels", data.produits.exceptionnels, { indent: 10 });
  drawRow("Total produits", data.produits.total, { bold: true });
  y -= 6;

  drawSection("CHARGES");
  drawRow("Services exterieurs (61, 62)", data.charges.externes, { indent: 10 });
  drawRow("Impots et taxes (63)", data.charges.impots_taxes, { indent: 10 });
  drawRow("Charges de personnel (64)", data.charges.personnel, { indent: 10 });
  drawRow("Charges financieres (66)", data.charges.financieres, { indent: 10 });
  drawRow(
    "Dotations aux amortissements (681)",
    data.charges.dotations_amortissements,
    { indent: 10 },
  );
  drawRow("Charges exceptionnelles (67)", data.charges.exceptionnelles, {
    indent: 10,
  });
  drawRow("Total charges", data.charges.total, { bold: true });
  y -= 6;

  drawSection("RESULTAT FISCAL");
  drawRow("Resultat avant impot", data.resultat_avant_impot, {
    bold: true,
    highlight: true,
  });
  y -= 4;

  drawSection("ESTIMATION DE L'IMPOT SUR LES SOCIETES");
  drawRow("IS au taux reduit 15% (jusqu'a 42 500 EUR)", data.is_taux_reduit_cents, {
    indent: 10,
  });
  drawRow("IS au taux normal 25% (au-dela)", data.is_taux_normal_cents, {
    indent: 10,
  });
  drawRow("IS estime total", data.is_total_cents, { bold: true });
  drawRow("Resultat net apres impot", data.resultat_apres_impot, {
    bold: true,
    highlight: true,
  });
  y -= 16;

  // Methodology
  if (y > 130) {
    page.drawRectangle({
      x: margin,
      y: y - 80,
      width: width - 2 * margin,
      height: 80,
      borderColor: COLORS.primary,
      borderWidth: 0.6,
    });
    const lines = [
      "Methodologie",
      "• Produits = comptes 706 + 708 + 76 + 77 (credit).",
      "• Charges = comptes 61 + 62 + 63 + 64 + 66 + 681 + 67 (debit).",
      "• Le taux reduit IS est conditionne au CA < 10 M EUR et au capital",
      "  detenu a 75% par des personnes physiques (verifier eligibilite).",
      "• L'EC peut avoir besoin de reintegrer charges non deductibles",
      "  (amende, fraction TVS, repas non justifies, etc.).",
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

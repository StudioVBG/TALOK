/**
 * Service d'export PDF pour les documents comptables
 *
 * Génère les PDFs pour:
 * - Compte Rendu de Gestion (CRG)
 * - Balance des mandants
 * - Récapitulatif fiscal
 * - Régularisation des charges
 */

import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

// ============================================================================
// Types
// ============================================================================

interface PDFConfig {
  title: string;
  subtitle?: string;
  date?: string;
}

// ============================================================================
// Helpers
// ============================================================================

const colors = {
  primary: rgb(0.145, 0.388, 0.922),
  text: rgb(0.067, 0.067, 0.067),
  gray: rgb(0.42, 0.45, 0.5),
  lightGray: rgb(0.9, 0.9, 0.9),
  green: rgb(0.133, 0.545, 0.133),
  red: rgb(0.863, 0.078, 0.235),
  background: rgb(0.98, 0.98, 0.98),
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

function splitTextIntoLines(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);

    if (testWidth > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

// ============================================================================
// CRG PDF
// ============================================================================

export async function generateCRGPDF(crg: any): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const { width, height } = page.getSize();
  const margin = 50;
  let y = height - margin;

  // En-tête
  page.drawText("COMPTE RENDU DE GESTION", {
    x: margin,
    y,
    size: 20,
    font: helveticaBold,
    color: colors.primary,
  });

  y -= 25;
  page.drawText(crg.periode?.libelle || "", {
    x: margin,
    y,
    size: 12,
    font: helvetica,
    color: colors.gray,
  });

  // Numéro et date
  const refText = `N° ${crg.numero} - ${format(new Date(), "dd/MM/yyyy")}`;
  const refWidth = helvetica.widthOfTextAtSize(refText, 10);
  page.drawText(refText, {
    x: width - margin - refWidth,
    y: height - margin,
    size: 10,
    font: helvetica,
    color: colors.gray,
  });

  // Ligne de séparation
  y -= 15;
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 1,
    color: colors.lightGray,
  });

  // Informations parties
  y -= 35;
  const colWidth = (width - 2 * margin) / 2;

  // Gestionnaire
  page.drawText("GESTIONNAIRE", {
    x: margin,
    y,
    size: 9,
    font: helveticaBold,
    color: colors.gray,
  });
  y -= 15;
  page.drawText(crg.gestionnaire?.raison_sociale || "TALOK GESTION", {
    x: margin,
    y,
    size: 11,
    font: helveticaBold,
    color: colors.text,
  });
  y -= 12;
  page.drawText(crg.gestionnaire?.adresse || "", {
    x: margin,
    y,
    size: 9,
    font: helvetica,
    color: colors.text,
  });

  // Propriétaire (colonne droite)
  const ownerY = height - margin - 50;
  page.drawText("PROPRIÉTAIRE", {
    x: margin + colWidth,
    y: ownerY,
    size: 9,
    font: helveticaBold,
    color: colors.gray,
  });
  const ownerName = crg.proprietaire?.raison_sociale ||
    `${crg.proprietaire?.prenom || ""} ${crg.proprietaire?.nom || ""}`.trim();
  page.drawText(ownerName, {
    x: margin + colWidth,
    y: ownerY - 15,
    size: 11,
    font: helveticaBold,
    color: colors.text,
  });

  // Bien
  y -= 35;
  page.drawText("BIEN", {
    x: margin,
    y,
    size: 9,
    font: helveticaBold,
    color: colors.gray,
  });
  y -= 15;
  page.drawText(crg.bien?.adresse || "", {
    x: margin,
    y,
    size: 10,
    font: helvetica,
    color: colors.text,
  });
  y -= 12;
  page.drawText(`${crg.bien?.code_postal || ""} ${crg.bien?.ville || ""}`, {
    x: margin,
    y,
    size: 10,
    font: helvetica,
    color: colors.text,
  });

  // Locataire
  if (crg.locataire) {
    y -= 25;
    page.drawText("LOCATAIRE", {
      x: margin,
      y,
      size: 9,
      font: helveticaBold,
      color: colors.gray,
    });
    y -= 15;
    page.drawText(
      `${crg.locataire.prenom || ""} ${crg.locataire.nom || ""}`.trim(),
      {
        x: margin,
        y,
        size: 10,
        font: helvetica,
        color: colors.text,
      }
    );
  }

  // Résumé financier
  y -= 40;
  page.drawRectangle({
    x: margin,
    y: y - 80,
    width: width - 2 * margin,
    height: 80,
    color: colors.background,
    borderColor: colors.lightGray,
    borderWidth: 1,
  });

  const boxY = y - 20;
  const boxColWidth = (width - 2 * margin) / 4;

  // Encaissements
  page.drawText("Encaissements", {
    x: margin + 15,
    y: boxY,
    size: 9,
    font: helvetica,
    color: colors.gray,
  });
  page.drawText(formatCurrency(crg.totaux?.total_credits || 0), {
    x: margin + 15,
    y: boxY - 18,
    size: 14,
    font: helveticaBold,
    color: colors.green,
  });

  // Débits
  page.drawText("Débits", {
    x: margin + boxColWidth + 15,
    y: boxY,
    size: 9,
    font: helvetica,
    color: colors.gray,
  });
  page.drawText(formatCurrency(crg.totaux?.total_debits || 0), {
    x: margin + boxColWidth + 15,
    y: boxY - 18,
    size: 14,
    font: helveticaBold,
    color: colors.red,
  });

  // Honoraires
  page.drawText("Honoraires", {
    x: margin + boxColWidth * 2 + 15,
    y: boxY,
    size: 9,
    font: helvetica,
    color: colors.gray,
  });
  page.drawText(formatCurrency(crg.recapitulatif?.honoraires_preleves || 0), {
    x: margin + boxColWidth * 2 + 15,
    y: boxY - 18,
    size: 14,
    font: helveticaBold,
    color: colors.text,
  });

  // Solde
  page.drawText("Solde", {
    x: margin + boxColWidth * 3 + 15,
    y: boxY,
    size: 9,
    font: helvetica,
    color: colors.gray,
  });
  page.drawText(formatCurrency(crg.solde_fin_periode || 0), {
    x: margin + boxColWidth * 3 + 15,
    y: boxY - 18,
    size: 14,
    font: helveticaBold,
    color: crg.solde_fin_periode >= 0 ? colors.green : colors.red,
  });

  // Tableau des mouvements
  y -= 120;
  page.drawText("DÉTAIL DES MOUVEMENTS", {
    x: margin,
    y,
    size: 11,
    font: helveticaBold,
    color: colors.text,
  });

  y -= 20;
  const tableHeaders = ["Date", "Libellé", "Débit", "Crédit"];
  const tableCols = [70, 280, 80, 80];

  // En-tête tableau
  page.drawRectangle({
    x: margin,
    y: y - 18,
    width: width - 2 * margin,
    height: 20,
    color: colors.lightGray,
  });

  let tableX = margin + 5;
  for (let i = 0; i < tableHeaders.length; i++) {
    page.drawText(tableHeaders[i], {
      x: tableX,
      y: y - 13,
      size: 9,
      font: helveticaBold,
      color: colors.text,
    });
    tableX += tableCols[i];
  }

  // Lignes du tableau
  y -= 20;
  const mouvements = (crg.mouvements || []).slice(0, 15); // Limiter à 15 lignes

  for (const mouvement of mouvements) {
    y -= 18;
    if (y < 100) break; // Marge de sécurité

    tableX = margin + 5;

    // Date
    page.drawText(format(new Date(mouvement.date), "dd/MM/yyyy"), {
      x: tableX,
      y,
      size: 9,
      font: helvetica,
      color: colors.text,
    });
    tableX += tableCols[0];

    // Libellé (tronqué si nécessaire)
    const libelle = mouvement.libelle?.substring(0, 40) || "";
    page.drawText(libelle, {
      x: tableX,
      y,
      size: 9,
      font: helvetica,
      color: colors.text,
    });
    tableX += tableCols[1];

    // Débit
    if (mouvement.type === "debit") {
      page.drawText(formatCurrency(mouvement.montant), {
        x: tableX,
        y,
        size: 9,
        font: helvetica,
        color: colors.red,
      });
    }
    tableX += tableCols[2];

    // Crédit
    if (mouvement.type === "credit") {
      page.drawText(formatCurrency(mouvement.montant), {
        x: tableX,
        y,
        size: 9,
        font: helvetica,
        color: colors.green,
      });
    }
  }

  // Footer
  const footerY = 40;
  page.drawText(`Document généré le ${format(new Date(), "dd/MM/yyyy à HH:mm")}`, {
    x: margin,
    y: footerY,
    size: 8,
    font: helvetica,
    color: colors.gray,
  });

  page.drawText("Talok - Gestion locative", {
    x: width - margin - 100,
    y: footerY,
    size: 8,
    font: helveticaBold,
    color: colors.primary,
  });

  return await pdfDoc.save();
}

// ============================================================================
// Balance PDF
// ============================================================================

export async function generateBalancePDF(balance: any): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const { width, height } = page.getSize();
  const margin = 50;
  let y = height - margin;

  // En-tête
  page.drawText("BALANCE DES MANDANTS", {
    x: margin,
    y,
    size: 20,
    font: helveticaBold,
    color: colors.primary,
  });

  y -= 25;
  page.drawText(`Au ${format(new Date(balance.date), "dd MMMM yyyy", { locale: fr })}`, {
    x: margin,
    y,
    size: 12,
    font: helvetica,
    color: colors.gray,
  });

  y -= 40;

  // Comptes propriétaires
  page.drawText("COMPTES PROPRIÉTAIRES", {
    x: margin,
    y,
    size: 11,
    font: helveticaBold,
    color: colors.text,
  });

  y -= 25;
  const propHeaders = ["Compte", "Propriétaire", "Débit", "Crédit"];
  const propCols = [80, 220, 80, 80];

  // En-tête
  page.drawRectangle({
    x: margin,
    y: y - 15,
    width: width - 2 * margin,
    height: 18,
    color: colors.lightGray,
  });

  let tableX = margin + 5;
  for (let i = 0; i < propHeaders.length; i++) {
    page.drawText(propHeaders[i], {
      x: tableX,
      y: y - 10,
      size: 9,
      font: helveticaBold,
      color: colors.text,
    });
    tableX += propCols[i];
  }

  y -= 18;

  for (const compte of (balance.comptes_proprietaires || []).slice(0, 10)) {
    y -= 16;
    if (y < 200) break;

    tableX = margin + 5;
    page.drawText(compte.compte || "", { x: tableX, y, size: 8, font: helvetica, color: colors.text });
    tableX += propCols[0];
    page.drawText((compte.nom || "").substring(0, 30), { x: tableX, y, size: 8, font: helvetica, color: colors.text });
    tableX += propCols[1];
    page.drawText(formatCurrency(compte.debit || 0), { x: tableX, y, size: 8, font: helvetica, color: colors.text });
    tableX += propCols[2];
    page.drawText(formatCurrency(compte.credit || 0), { x: tableX, y, size: 8, font: helvetica, color: colors.text });
  }

  // Total propriétaires
  y -= 20;
  page.drawText("TOTAL", { x: margin + 5, y, size: 9, font: helveticaBold, color: colors.text });
  page.drawText(formatCurrency(balance.total_proprietaires?.debit || 0), {
    x: margin + propCols[0] + propCols[1] + 5,
    y,
    size: 9,
    font: helveticaBold,
    color: colors.text,
  });
  page.drawText(formatCurrency(balance.total_proprietaires?.credit || 0), {
    x: margin + propCols[0] + propCols[1] + propCols[2] + 5,
    y,
    size: 9,
    font: helveticaBold,
    color: colors.text,
  });

  // Vérification d'équilibre
  y -= 60;
  page.drawRectangle({
    x: margin,
    y: y - 40,
    width: width - 2 * margin,
    height: 50,
    color: balance.verification?.equilibre ? rgb(0.9, 1, 0.9) : rgb(1, 0.9, 0.9),
    borderColor: balance.verification?.equilibre ? colors.green : colors.red,
    borderWidth: 1,
  });

  page.drawText("VÉRIFICATION D'ÉQUILIBRE", {
    x: margin + 15,
    y: y - 15,
    size: 10,
    font: helveticaBold,
    color: colors.text,
  });

  page.drawText(
    balance.verification?.equilibre
      ? "✓ Balance équilibrée"
      : `✗ Écart de ${formatCurrency(balance.verification?.ecart || 0)}`,
    {
      x: margin + 15,
      y: y - 32,
      size: 11,
      font: helvetica,
      color: balance.verification?.equilibre ? colors.green : colors.red,
    }
  );

  // Footer
  page.drawText(`Document généré le ${format(new Date(), "dd/MM/yyyy à HH:mm")}`, {
    x: margin,
    y: 40,
    size: 8,
    font: helvetica,
    color: colors.gray,
  });

  return await pdfDoc.save();
}

// ============================================================================
// Récap Fiscal PDF
// ============================================================================

export async function generateFiscalPDF(recap: any): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const { width, height } = page.getSize();
  const margin = 50;
  let y = height - margin;

  // En-tête
  page.drawText(`RÉCAPITULATIF FISCAL ${recap.annee}`, {
    x: margin,
    y,
    size: 20,
    font: helveticaBold,
    color: colors.primary,
  });

  y -= 25;
  page.drawText("Aide au remplissage de la déclaration 2044", {
    x: margin,
    y,
    size: 11,
    font: helvetica,
    color: colors.gray,
  });

  // Propriétaire
  y -= 40;
  const ownerName = recap.proprietaire?.raison_sociale ||
    `${recap.proprietaire?.prenom || ""} ${recap.proprietaire?.nom || ""}`.trim();
  page.drawText(`Propriétaire: ${ownerName}`, {
    x: margin,
    y,
    size: 11,
    font: helvetica,
    color: colors.text,
  });

  // Revenus bruts
  y -= 40;
  page.drawText("REVENUS BRUTS (Ligne 211)", {
    x: margin,
    y,
    size: 12,
    font: helveticaBold,
    color: colors.text,
  });

  y -= 25;
  page.drawText(`Loyers bruts: ${formatCurrency(recap.revenus_bruts?.loyers || 0)}`, {
    x: margin + 20,
    y,
    size: 10,
    font: helvetica,
    color: colors.text,
  });

  y -= 16;
  page.drawText(`Charges récupérées: ${formatCurrency(recap.revenus_bruts?.charges_recuperees || 0)}`, {
    x: margin + 20,
    y,
    size: 10,
    font: helvetica,
    color: colors.text,
  });

  y -= 20;
  page.drawText(`TOTAL: ${formatCurrency(recap.revenus_bruts?.total || 0)}`, {
    x: margin + 20,
    y,
    size: 11,
    font: helveticaBold,
    color: colors.green,
  });

  // Charges déductibles
  y -= 40;
  page.drawText("CHARGES DÉDUCTIBLES", {
    x: margin,
    y,
    size: 12,
    font: helveticaBold,
    color: colors.text,
  });

  const charges = recap.charges_deductibles || {};
  const chargeLines = [
    { label: "Ligne 221 - Honoraires de gestion", value: charges.ligne_221_honoraires_gestion || 0 },
    { label: "Ligne 222 - Frais de gestion forfaitaires", value: charges.ligne_222_frais_gestion_forfait || 0 },
    { label: "Ligne 223 - Assurances", value: charges.ligne_223_assurances || 0 },
    { label: "Ligne 224 - Réparations et entretien", value: charges.ligne_224_total || 0 },
    { label: "Ligne 227 - Taxe foncière", value: charges.ligne_227_taxe_fonciere || 0 },
    { label: "Ligne 229 - Provisions copropriété", value: charges.ligne_229_provisions_copro || 0 },
  ];

  for (const line of chargeLines) {
    y -= 18;
    page.drawText(line.label, { x: margin + 20, y, size: 10, font: helvetica, color: colors.text });
    page.drawText(formatCurrency(line.value), { x: width - margin - 100, y, size: 10, font: helvetica, color: colors.text });
  }

  y -= 25;
  page.drawText(`TOTAL CHARGES: ${formatCurrency(charges.total || 0)}`, {
    x: margin + 20,
    y,
    size: 11,
    font: helveticaBold,
    color: colors.red,
  });

  // Revenu net
  y -= 50;
  page.drawRectangle({
    x: margin,
    y: y - 35,
    width: width - 2 * margin,
    height: 45,
    color: colors.background,
    borderColor: colors.primary,
    borderWidth: 2,
  });

  page.drawText("REVENU FONCIER NET", {
    x: margin + 20,
    y: y - 15,
    size: 12,
    font: helveticaBold,
    color: colors.text,
  });

  page.drawText(formatCurrency(recap.revenu_foncier_net || 0), {
    x: width - margin - 120,
    y: y - 15,
    size: 16,
    font: helveticaBold,
    color: recap.revenu_foncier_net >= 0 ? colors.green : colors.red,
  });

  // Disclaimer
  y -= 80;
  const disclaimer = "Ce document est fourni à titre indicatif pour vous aider à remplir votre déclaration 2044. Veuillez vérifier les montants avec votre expert-comptable.";
  const disclaimerLines = splitTextIntoLines(disclaimer, helvetica, 9, width - 2 * margin);
  for (const line of disclaimerLines) {
    page.drawText(line, { x: margin, y, size: 9, font: helvetica, color: colors.gray });
    y -= 12;
  }

  // Footer
  page.drawText(`Document généré le ${format(new Date(), "dd/MM/yyyy à HH:mm")}`, {
    x: margin,
    y: 40,
    size: 8,
    font: helvetica,
    color: colors.gray,
  });

  return await pdfDoc.save();
}

// ============================================================================
// Export du module
// ============================================================================

export const pdfExportService = {
  generateCRGPDF,
  generateBalancePDF,
  generateFiscalPDF,
};

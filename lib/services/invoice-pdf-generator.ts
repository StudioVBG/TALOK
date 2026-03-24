/**
 * Service de génération de factures locatives en PDF
 *
 * Utilise pdf-lib pour générer des PDFs professionnels conformes
 * à la législation française (loi du 6 juillet 1989).
 *
 * Pattern identique à receipt-generator.ts (quittances).
 */

import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

// ─── Types ───────────────────────────────────────────────────────────

export interface InvoiceData {
  // === Informations propriétaire ===
  ownerName: string;
  ownerAddress: string;
  ownerSiret?: string;

  // === Informations locataire ===
  tenantName: string;

  // === Informations logement ===
  propertyAddress: string;
  propertyCity: string;
  propertyPostalCode: string;

  // === Informations facture ===
  invoiceNumber: string;
  invoiceDate: string; // ISO date string
  dueDate: string; // ISO date string

  // === Période ===
  periodStart: string; // ISO date string
  periodEnd: string; // ISO date string

  // === Montants ===
  montantLoyer: number;
  montantCharges: number;
  depotDeGarantie: number;
  montantTotal: number;

  // === Métadonnées ===
  isProrated: boolean;
  prorataDays?: number;
  totalDaysInMonth?: number;
  isInitialInvoice: boolean;
  leaseId: string;
  invoiceId: string;
  statut: string;
}

// ─── Génération PDF ──────────────────────────────────────────────────

export async function generateInvoicePDF(data: InvoiceData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4

  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Couleurs (identiques receipt-generator.ts)
  const primaryColor = rgb(0.145, 0.388, 0.922); // #2563eb (Talok blue)
  const textColor = rgb(0.067, 0.067, 0.067); // #111
  const grayColor = rgb(0.42, 0.45, 0.5); // #6b7280
  const lightBg = rgb(0.98, 0.98, 0.98);
  const borderColor = rgb(0.9, 0.9, 0.9);

  const { width, height } = page.getSize();
  const margin = 50;
  let y = height - margin;

  // ═══════════════════════════════════════════════════════════
  // HEADER
  // ═══════════════════════════════════════════════════════════

  page.drawText("FACTURE", {
    x: margin,
    y,
    size: 26,
    font: helveticaBold,
    color: primaryColor,
  });

  if (data.isInitialInvoice) {
    const badgeText = "FACTURE INITIALE";
    const badgeWidth = helveticaBold.widthOfTextAtSize(badgeText, 9);
    page.drawRectangle({
      x: margin + 140,
      y: y - 2,
      width: badgeWidth + 16,
      height: 20,
      color: rgb(0.94, 0.97, 1.0),
      borderColor: primaryColor,
      borderWidth: 0.5,
    });
    page.drawText(badgeText, {
      x: margin + 148,
      y: y + 3,
      size: 9,
      font: helveticaBold,
      color: primaryColor,
    });
  }

  // Numéro de facture (droite)
  const refText = `N° ${data.invoiceNumber}`;
  const refWidth = helveticaBold.widthOfTextAtSize(refText, 11);
  page.drawText(refText, {
    x: width - margin - refWidth,
    y,
    size: 11,
    font: helveticaBold,
    color: textColor,
  });

  // Date d'émission
  y -= 22;
  const dateText = `Émise le ${formatDateFR(data.invoiceDate)}`;
  const dateWidth = helvetica.widthOfTextAtSize(dateText, 10);
  page.drawText(dateText, {
    x: width - margin - dateWidth,
    y,
    size: 10,
    font: helvetica,
    color: grayColor,
  });

  // Date d'échéance
  y -= 16;
  const dueText = `Échéance : ${formatDateFR(data.dueDate)}`;
  const dueWidth = helvetica.widthOfTextAtSize(dueText, 10);
  page.drawText(dueText, {
    x: width - margin - dueWidth,
    y,
    size: 10,
    font: helveticaBold,
    color: textColor,
  });

  // Période
  y -= 5;
  const periodText = formatPeriod(data.periodStart, data.periodEnd);
  page.drawText(periodText, {
    x: margin,
    y: y + 16,
    size: 13,
    font: helvetica,
    color: textColor,
  });

  // Séparation header
  y -= 15;
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 1,
    color: borderColor,
  });

  // ═══════════════════════════════════════════════════════════
  // BLOC BAILLEUR
  // ═══════════════════════════════════════════════════════════

  y -= 35;
  page.drawText("BAILLEUR", {
    x: margin,
    y,
    size: 10,
    font: helveticaBold,
    color: grayColor,
  });

  y -= 18;
  page.drawText(data.ownerName, {
    x: margin,
    y,
    size: 12,
    font: helveticaBold,
    color: textColor,
  });

  if (data.ownerAddress) {
    const addressLines = splitTextIntoLines(data.ownerAddress, helvetica, 10, (width - 2 * margin) / 2);
    for (const line of addressLines) {
      y -= 15;
      page.drawText(line, {
        x: margin,
        y,
        size: 10,
        font: helvetica,
        color: textColor,
      });
    }
  }

  if (data.ownerSiret) {
    y -= 15;
    page.drawText(`SIRET : ${data.ownerSiret}`, {
      x: margin,
      y,
      size: 9,
      font: helvetica,
      color: grayColor,
    });
  }

  // ═══════════════════════════════════════════════════════════
  // BLOC LOCATAIRE
  // ═══════════════════════════════════════════════════════════

  y -= 30;
  page.drawText("LOCATAIRE", {
    x: margin,
    y,
    size: 10,
    font: helveticaBold,
    color: grayColor,
  });

  y -= 18;
  page.drawText(data.tenantName, {
    x: margin,
    y,
    size: 12,
    font: helveticaBold,
    color: textColor,
  });

  // ═══════════════════════════════════════════════════════════
  // BLOC LOGEMENT
  // ═══════════════════════════════════════════════════════════

  y -= 30;
  page.drawText("LOGEMENT LOUÉ", {
    x: margin,
    y,
    size: 10,
    font: helveticaBold,
    color: grayColor,
  });

  y -= 18;
  page.drawText(data.propertyAddress, {
    x: margin,
    y,
    size: 11,
    font: helvetica,
    color: textColor,
  });

  y -= 16;
  page.drawText(`${data.propertyPostalCode} ${data.propertyCity}`, {
    x: margin,
    y,
    size: 11,
    font: helvetica,
    color: textColor,
  });

  // ═══════════════════════════════════════════════════════════
  // TABLEAU DES MONTANTS
  // ═══════════════════════════════════════════════════════════

  y -= 40;

  const hasDeposit = data.depotDeGarantie > 0;
  const hasProrata = data.isProrated;
  let rowCount = 2; // loyer + charges
  if (hasDeposit) rowCount++;
  const tableHeight = 50 + rowCount * 22 + 30; // header + rows + total

  // Fond du tableau
  page.drawRectangle({
    x: margin,
    y: y - tableHeight,
    width: width - 2 * margin,
    height: tableHeight,
    color: lightBg,
    borderColor,
    borderWidth: 1,
  });

  const colDesignation = margin + 15;
  const colMontant = margin + (width - 2 * margin) * 0.65;

  // En-tête tableau
  page.drawText("DÉSIGNATION", {
    x: colDesignation,
    y: y - 22,
    size: 9,
    font: helveticaBold,
    color: grayColor,
  });

  page.drawText("MONTANT", {
    x: colMontant,
    y: y - 22,
    size: 9,
    font: helveticaBold,
    color: grayColor,
  });

  // Ligne séparation header
  page.drawLine({
    start: { x: margin + 10, y: y - 32 },
    end: { x: width - margin - 10, y: y - 32 },
    thickness: 0.5,
    color: borderColor,
  });

  // Lignes de détail
  let rowY = y - 52;

  // Loyer
  const loyerLabel = hasProrata
    ? `Loyer (prorata ${data.prorataDays}/${data.totalDaysInMonth} jours)`
    : "Loyer principal (hors charges)";

  page.drawText(loyerLabel, {
    x: colDesignation,
    y: rowY,
    size: 11,
    font: helvetica,
    color: textColor,
  });
  page.drawText(formatEuro(data.montantLoyer), {
    x: colMontant,
    y: rowY,
    size: 11,
    font: helvetica,
    color: textColor,
  });

  // Charges
  rowY -= 22;
  const chargesLabel = hasProrata
    ? `Charges forfaitaires (prorata)`
    : "Charges forfaitaires";

  page.drawText(chargesLabel, {
    x: colDesignation,
    y: rowY,
    size: 11,
    font: helvetica,
    color: textColor,
  });
  page.drawText(formatEuro(data.montantCharges), {
    x: colMontant,
    y: rowY,
    size: 11,
    font: helvetica,
    color: textColor,
  });

  // Dépôt de garantie
  if (hasDeposit) {
    rowY -= 22;
    page.drawText("Dépôt de garantie", {
      x: colDesignation,
      y: rowY,
      size: 11,
      font: helvetica,
      color: textColor,
    });
    page.drawText(formatEuro(data.depotDeGarantie), {
      x: colMontant,
      y: rowY,
      size: 11,
      font: helvetica,
      color: textColor,
    });
  }

  // Ligne séparation total
  const totalSepY = y - tableHeight + 25;
  page.drawLine({
    start: { x: margin + 10, y: totalSepY },
    end: { x: width - margin - 10, y: totalSepY },
    thickness: 0.5,
    color: borderColor,
  });

  // Total
  page.drawText("TOTAL À PAYER", {
    x: colDesignation,
    y: y - tableHeight + 8,
    size: 13,
    font: helveticaBold,
    color: textColor,
  });
  page.drawText(formatEuro(data.montantTotal), {
    x: colMontant,
    y: y - tableHeight + 8,
    size: 15,
    font: helveticaBold,
    color: primaryColor,
  });

  // ═══════════════════════════════════════════════════════════
  // STATUT
  // ═══════════════════════════════════════════════════════════

  y -= tableHeight + 30;

  const statutLabel = getStatutLabel(data.statut);
  const statutColor = getStatutColor(data.statut);

  page.drawText(`Statut : ${statutLabel}`, {
    x: margin,
    y,
    size: 11,
    font: helveticaBold,
    color: statutColor,
  });

  // ═══════════════════════════════════════════════════════════
  // MENTIONS LÉGALES
  // ═══════════════════════════════════════════════════════════

  y -= 40;
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 0.5,
    color: borderColor,
  });

  y -= 20;
  const legalText =
    "Cette facture est établie conformément à la loi n°89-462 du 6 juillet 1989 " +
    "tendant à améliorer les rapports locatifs. Le paiement est dû à la date d'échéance " +
    "indiquée ci-dessus. En cas de retard de paiement, des pénalités pourront être " +
    "appliquées conformément aux dispositions légales en vigueur.";

  const legalLines = splitTextIntoLines(legalText, helvetica, 9, width - 2 * margin);
  for (const line of legalLines) {
    page.drawText(line, {
      x: margin,
      y,
      size: 9,
      font: helvetica,
      color: grayColor,
    });
    y -= 14;
  }

  if (data.isInitialInvoice && data.depotDeGarantie > 0) {
    y -= 6;
    const depositLegal =
      `Le dépôt de garantie de ${formatEuro(data.depotDeGarantie)} sera restitué dans un ` +
      "délai maximal de deux mois à compter de la remise des clés, déduction faite des " +
      "sommes restant dues au bailleur (art. 22 loi du 6 juillet 1989).";

    const depositLines = splitTextIntoLines(depositLegal, helvetica, 9, width - 2 * margin);
    for (const line of depositLines) {
      page.drawText(line, {
        x: margin,
        y,
        size: 9,
        font: helvetica,
        color: grayColor,
      });
      y -= 14;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // PIED DE PAGE
  // ═══════════════════════════════════════════════════════════

  const footerY = 40;
  page.drawLine({
    start: { x: margin, y: footerY + 10 },
    end: { x: width - margin, y: footerY + 10 },
    thickness: 0.5,
    color: borderColor,
  });

  const footerText = "Généré par Talok — talok.fr";
  const footerWidth = helvetica.widthOfTextAtSize(footerText, 8);
  page.drawText(footerText, {
    x: (width - footerWidth) / 2,
    y: footerY - 5,
    size: 8,
    font: helvetica,
    color: grayColor,
  });

  return pdfDoc.save();
}

// ─── Helpers ─────────────────────────────────────────────────────────

function formatDateFR(dateStr: string): string {
  try {
    return format(new Date(dateStr), "d MMMM yyyy", { locale: fr });
  } catch {
    return dateStr;
  }
}

function formatPeriod(start: string, end: string): string {
  try {
    const startFormatted = format(new Date(start), "d MMMM yyyy", { locale: fr });
    const endFormatted = format(new Date(end), "d MMMM yyyy", { locale: fr });
    return `Période du ${startFormatted} au ${endFormatted}`;
  } catch {
    return `Période : ${start} — ${end}`;
  }
}

function formatEuro(amount: number): string {
  return `${amount.toFixed(2)} €`;
}

function getStatutLabel(statut: string): string {
  switch (statut) {
    case "draft":
      return "Brouillon";
    case "sent":
      return "En attente de paiement";
    case "paid":
      return "Payée";
    case "partial":
      return "Partiellement payée";
    case "late":
    case "overdue":
      return "En retard";
    case "cancelled":
      return "Annulée";
    default:
      return statut;
  }
}

function getStatutColor(statut: string) {
  switch (statut) {
    case "paid":
      return rgb(0.13, 0.55, 0.13); // green
    case "late":
    case "overdue":
      return rgb(0.8, 0.2, 0.2); // red
    case "sent":
      return rgb(0.8, 0.5, 0.0); // orange
    default:
      return rgb(0.42, 0.45, 0.5); // gray
  }
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

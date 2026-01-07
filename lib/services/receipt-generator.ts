/**
 * Service de génération de quittances de loyer en PDF
 * 
 * Utilise pdf-lib pour générer des PDFs professionnels
 */

import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export interface ReceiptData {
  // Informations propriétaire
  ownerName: string;
  ownerAddress: string;
  ownerSiret?: string;
  
  // Informations locataire
  tenantName: string;
  tenantAddress?: string;
  
  // Informations logement
  propertyAddress: string;
  propertyCity: string;
  propertyPostalCode: string;
  
  // Informations paiement
  period: string; // Format: "2024-01"
  rentAmount: number;
  chargesAmount: number;
  totalAmount: number;
  paymentDate: string;
  paymentMethod: string;
  
  // Références
  invoiceId: string;
  paymentId: string;
  leaseId: string;
}

/**
 * Génère un PDF de quittance de loyer
 */
export async function generateReceiptPDF(data: ReceiptData): Promise<Uint8Array> {
  // Créer le document PDF
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  
  // Charger les fonts
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  // Couleurs
  const primaryColor = rgb(0.145, 0.388, 0.922); // #2563eb
  const textColor = rgb(0.067, 0.067, 0.067); // #111
  const grayColor = rgb(0.42, 0.45, 0.5); // #6b7280
  
  // Dimensions
  const { width, height } = page.getSize();
  const margin = 50;
  let y = height - margin;
  
  // === HEADER ===
  // Titre
  page.drawText("QUITTANCE DE LOYER", {
    x: margin,
    y: y,
    size: 24,
    font: helveticaBold,
    color: primaryColor,
  });
  
  // Période
  const periodFormatted = formatPeriod(data.period);
  y -= 35;
  page.drawText(periodFormatted, {
    x: margin,
    y: y,
    size: 14,
    font: helvetica,
    color: textColor,
  });
  
  // Numéro de référence (aligné à droite)
  const refText = `Réf: ${data.paymentId.slice(0, 8).toUpperCase()}`;
  const refWidth = helvetica.widthOfTextAtSize(refText, 10);
  page.drawText(refText, {
    x: width - margin - refWidth,
    y: height - margin,
    size: 10,
    font: helvetica,
    color: grayColor,
  });
  
  // Ligne de séparation
  y -= 20;
  page.drawLine({
    start: { x: margin, y: y },
    end: { x: width - margin, y: y },
    thickness: 1,
    color: rgb(0.9, 0.9, 0.9),
  });
  
  // === SECTION PROPRIÉTAIRE ===
  y -= 40;
  page.drawText("PROPRIÉTAIRE", {
    x: margin,
    y: y,
    size: 10,
    font: helveticaBold,
    color: grayColor,
  });
  
  y -= 20;
  page.drawText(data.ownerName, {
    x: margin,
    y: y,
    size: 12,
    font: helveticaBold,
    color: textColor,
  });
  
  if (data.ownerAddress) {
    y -= 16;
    page.drawText(data.ownerAddress, {
      x: margin,
      y: y,
      size: 10,
      font: helvetica,
      color: textColor,
    });
  }
  
  if (data.ownerSiret) {
    y -= 16;
    page.drawText(`SIRET: ${data.ownerSiret}`, {
      x: margin,
      y: y,
      size: 10,
      font: helvetica,
      color: grayColor,
    });
  }
  
  // === SECTION LOCATAIRE ===
  y -= 35;
  page.drawText("LOCATAIRE", {
    x: margin,
    y: y,
    size: 10,
    font: helveticaBold,
    color: grayColor,
  });
  
  y -= 20;
  page.drawText(data.tenantName, {
    x: margin,
    y: y,
    size: 12,
    font: helveticaBold,
    color: textColor,
  });
  
  // === SECTION LOGEMENT ===
  y -= 35;
  page.drawText("LOGEMENT", {
    x: margin,
    y: y,
    size: 10,
    font: helveticaBold,
    color: grayColor,
  });
  
  y -= 20;
  page.drawText(data.propertyAddress, {
    x: margin,
    y: y,
    size: 11,
    font: helvetica,
    color: textColor,
  });
  
  y -= 16;
  page.drawText(`${data.propertyPostalCode} ${data.propertyCity}`, {
    x: margin,
    y: y,
    size: 11,
    font: helvetica,
    color: textColor,
  });
  
  // === TABLEAU DES MONTANTS ===
  y -= 50;
  
  // Fond du tableau
  const tableHeight = 100;
  page.drawRectangle({
    x: margin,
    y: y - tableHeight,
    width: width - 2 * margin,
    height: tableHeight,
    color: rgb(0.98, 0.98, 0.98),
    borderColor: rgb(0.9, 0.9, 0.9),
    borderWidth: 1,
  });
  
  // En-tête du tableau
  const colWidth = (width - 2 * margin) / 2;
  page.drawText("DÉSIGNATION", {
    x: margin + 15,
    y: y - 25,
    size: 9,
    font: helveticaBold,
    color: grayColor,
  });
  
  page.drawText("MONTANT", {
    x: margin + colWidth + 15,
    y: y - 25,
    size: 9,
    font: helveticaBold,
    color: grayColor,
  });
  
  // Ligne de séparation
  page.drawLine({
    start: { x: margin + 10, y: y - 35 },
    end: { x: width - margin - 10, y: y - 35 },
    thickness: 0.5,
    color: rgb(0.9, 0.9, 0.9),
  });
  
  // Loyer
  page.drawText("Loyer", {
    x: margin + 15,
    y: y - 55,
    size: 11,
    font: helvetica,
    color: textColor,
  });
  
  page.drawText(`${data.rentAmount.toFixed(2)} €`, {
    x: margin + colWidth + 15,
    y: y - 55,
    size: 11,
    font: helvetica,
    color: textColor,
  });
  
  // Charges
  page.drawText("Charges", {
    x: margin + 15,
    y: y - 75,
    size: 11,
    font: helvetica,
    color: textColor,
  });
  
  page.drawText(`${data.chargesAmount.toFixed(2)} €`, {
    x: margin + colWidth + 15,
    y: y - 75,
    size: 11,
    font: helvetica,
    color: textColor,
  });
  
  // Total
  page.drawLine({
    start: { x: margin + 10, y: y - 85 },
    end: { x: width - margin - 10, y: y - 85 },
    thickness: 0.5,
    color: rgb(0.9, 0.9, 0.9),
  });
  
  page.drawText("TOTAL", {
    x: margin + 15,
    y: y - tableHeight + 5,
    size: 12,
    font: helveticaBold,
    color: textColor,
  });
  
  page.drawText(`${data.totalAmount.toFixed(2)} €`, {
    x: margin + colWidth + 15,
    y: y - tableHeight + 5,
    size: 14,
    font: helveticaBold,
    color: primaryColor,
  });
  
  // === ATTESTATION ===
  y -= tableHeight + 40;
  
  const paymentDateFormatted = format(new Date(data.paymentDate), "d MMMM yyyy", { locale: fr });
  const paymentMethodFormatted = formatPaymentMethod(data.paymentMethod);
  
  const attestationText = `Je soussigné(e) ${data.ownerName}, propriétaire du logement désigné ci-dessus, déclare avoir reçu de ${data.tenantName} la somme de ${data.totalAmount.toFixed(2)} euros, au titre du paiement du loyer et des charges pour la période ${periodFormatted}.`;
  
  // Découper le texte en lignes
  const maxLineWidth = width - 2 * margin;
  const attestationLines = splitTextIntoLines(attestationText, helvetica, 11, maxLineWidth);
  
  for (const line of attestationLines) {
    page.drawText(line, {
      x: margin,
      y: y,
      size: 11,
      font: helvetica,
      color: textColor,
    });
    y -= 18;
  }
  
  y -= 10;
  page.drawText(`Paiement reçu le ${paymentDateFormatted} par ${paymentMethodFormatted}.`, {
    x: margin,
    y: y,
    size: 11,
    font: helvetica,
    color: textColor,
  });
  
  // === MENTION LÉGALE ===
  y -= 50;
  const legalText = "Cette quittance annule tous les reçus qui auraient pu être établis précédemment pour la même période. Ce document est une quittance de loyer conformément à l'article 21 de la loi n°89-462 du 6 juillet 1989.";
  
  const legalLines = splitTextIntoLines(legalText, helvetica, 9, maxLineWidth);
  for (const line of legalLines) {
    page.drawText(line, {
      x: margin,
      y: y,
      size: 9,
      font: helvetica,
      color: grayColor,
    });
    y -= 14;
  }
  
  // === SIGNATURE ===
  y -= 30;
  page.drawText("Le propriétaire,", {
    x: width - margin - 150,
    y: y,
    size: 10,
    font: helvetica,
    color: textColor,
  });
  
  y -= 50;
  page.drawText(data.ownerName, {
    x: width - margin - 150,
    y: y,
    size: 10,
    font: helveticaBold,
    color: textColor,
  });
  
  // === FOOTER ===
  const footerY = 40;
  const dateGenerated = format(new Date(), "dd/MM/yyyy à HH:mm", { locale: fr });
  
  page.drawText(`Document généré le ${dateGenerated}`, {
    x: margin,
    y: footerY,
    size: 8,
    font: helvetica,
    color: grayColor,
  });
  
  page.drawText("Talok", {
    x: width - margin - 80,
    y: footerY,
    size: 8,
    font: helveticaBold,
    color: primaryColor,
  });
  
  // Générer le PDF
  return await pdfDoc.save();
}

/**
 * Formate la période en texte lisible
 */
function formatPeriod(period: string): string {
  try {
    const [year, month] = period.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return format(date, "MMMM yyyy", { locale: fr }).toUpperCase();
  } catch {
    return period;
  }
}

/**
 * Formate la méthode de paiement
 */
function formatPaymentMethod(method: string): string {
  const methods: Record<string, string> = {
    cb: "carte bancaire",
    card: "carte bancaire",
    virement: "virement bancaire",
    prelevement: "prélèvement automatique",
    especes: "espèces",
    cheque: "chèque",
  };
  return methods[method] || method;
}

/**
 * Découpe le texte en lignes selon la largeur maximale
 */
function splitTextIntoLines(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
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

/**
 * Générateur d'attestation de paiement en espèces en PDF.
 *
 * Produit un document PDF conforme à l'article 21 de la loi n°89-462 du
 * 6 juillet 1989 et au décret n°2015-587 du 6 mai 2015. Utilisé côté
 * serveur via l'API route /api/payments/cash-receipt/[id]/pdf.
 *
 * Contenu :
 * - En-tête TALOK + titre "Attestation de paiement en espèces"
 * - Parties (locataire, propriétaire, logement, période)
 * - Montant en chiffres + en toutes lettres
 * - Signatures base64 PNG des deux parties avec horodatage
 * - Mention légale
 *
 * Utilise pdf-lib (déjà installé, même dépendance que le PV de remise
 * des clés et les quittances).
 */

import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from "pdf-lib";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export interface CashReceiptAttestationData {
  receiptNumber: string;
  amount: number;
  amountWords: string | null;
  periode: string;
  propertyAddress: string;
  ownerName: string;
  tenantName: string;
  /** Data URL `data:image/png;base64,…` ou base64 brut */
  ownerSignatureBase64: string | null;
  /** Data URL `data:image/png;base64,…` ou base64 brut */
  tenantSignatureBase64: string | null;
  ownerSignedAt: string | null;
  tenantSignedAt: string | null;
  notes: string | null;
}

const PRIMARY_COLOR = rgb(0.145, 0.388, 0.922);
const TEXT_COLOR = rgb(0.067, 0.067, 0.067);
const GRAY_COLOR = rgb(0.42, 0.45, 0.5);
const LIGHT_BORDER = rgb(0.85, 0.85, 0.85);

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

export async function buildCashReceiptAttestationPDF(
  data: CashReceiptAttestationData,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);

  let y = 790;

  // ── Header: TALOK ──
  page.drawText("TALOK", {
    x: MARGIN,
    y,
    size: 14,
    font: boldFont,
    color: PRIMARY_COLOR,
  });

  page.drawText(`N° ${data.receiptNumber}`, {
    x: PAGE_WIDTH - MARGIN - boldFont.widthOfTextAtSize(`N° ${data.receiptNumber}`, 10),
    y,
    size: 10,
    font,
    color: GRAY_COLOR,
  });

  // ── Title ──
  y -= 34;
  page.drawText("ATTESTATION DE PAIEMENT EN ESPÈCES", {
    x: MARGIN,
    y,
    size: 18,
    font: boldFont,
    color: TEXT_COLOR,
  });

  y -= 10;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 2,
    color: PRIMARY_COLOR,
  });

  // ── Parties ──
  y -= 28;
  drawSectionTitle(page, boldFont, "PARTIES", MARGIN, y);
  y -= 18;

  drawLabelValue(page, font, boldFont, "Propriétaire", data.ownerName, MARGIN, y);
  y -= 16;
  drawLabelValue(page, font, boldFont, "Locataire", data.tenantName, MARGIN, y);

  // ── Logement ──
  y -= 24;
  drawSectionTitle(page, boldFont, "LOGEMENT", MARGIN, y);
  y -= 18;
  drawWrappedText(page, font, data.propertyAddress, MARGIN, y, CONTENT_WIDTH, 10, TEXT_COLOR);

  // ── Période + montant ──
  y -= 34;
  drawSectionTitle(page, boldFont, "LOYER RÉGLÉ", MARGIN, y);
  y -= 18;

  drawLabelValue(
    page,
    font,
    boldFont,
    "Période",
    formatPeriode(data.periode),
    MARGIN,
    y,
  );
  y -= 16;
  drawLabelValue(
    page,
    font,
    boldFont,
    "Montant",
    `${data.amount.toLocaleString("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} €`,
    MARGIN,
    y,
  );
  if (data.amountWords) {
    y -= 14;
    page.drawText(`(${data.amountWords})`, {
      x: MARGIN + 100,
      y,
      size: 9,
      font,
      color: GRAY_COLOR,
    });
  }

  // ── Signatures ──
  y -= 34;
  drawSectionTitle(page, boldFont, "SIGNATURES", MARGIN, y);
  y -= 20;

  const sigColWidth = CONTENT_WIDTH / 2 - 10;
  const leftX = MARGIN;
  const rightX = MARGIN + sigColWidth + 20;

  // Colonnes : propriétaire (gauche), locataire (droite)
  page.drawText("Le propriétaire atteste", {
    x: leftX,
    y,
    size: 10,
    font: boldFont,
    color: TEXT_COLOR,
  });
  page.drawText("Le locataire atteste", {
    x: rightX,
    y,
    size: 10,
    font: boldFont,
    color: TEXT_COLOR,
  });

  y -= 14;
  drawWrappedText(
    page,
    font,
    "avoir reçu ce paiement en espèces",
    leftX,
    y,
    sigColWidth,
    9,
    GRAY_COLOR,
  );
  drawWrappedText(
    page,
    font,
    "avoir effectué ce paiement en espèces",
    rightX,
    y,
    sigColWidth,
    9,
    GRAY_COLOR,
  );

  y -= 16;
  page.drawText(data.ownerName, {
    x: leftX,
    y,
    size: 9,
    font,
    color: TEXT_COLOR,
  });
  page.drawText(data.tenantName, {
    x: rightX,
    y,
    size: 9,
    font,
    color: TEXT_COLOR,
  });

  // Embed signatures (base64 PNG)
  const signatureBoxTop = y - 8;
  const signatureBoxHeight = 70;

  if (data.ownerSignatureBase64) {
    await embedSignature(
      pdf,
      page,
      data.ownerSignatureBase64,
      leftX,
      signatureBoxTop - signatureBoxHeight,
      sigColWidth,
      signatureBoxHeight,
    );
  }

  if (data.tenantSignatureBase64) {
    await embedSignature(
      pdf,
      page,
      data.tenantSignatureBase64,
      rightX,
      signatureBoxTop - signatureBoxHeight,
      sigColWidth,
      signatureBoxHeight,
    );
  }

  y = signatureBoxTop - signatureBoxHeight - 14;

  page.drawText(`Signé le ${formatDateTime(data.ownerSignedAt)}`, {
    x: leftX,
    y,
    size: 8,
    font,
    color: GRAY_COLOR,
  });
  page.drawText(`Signé le ${formatDateTime(data.tenantSignedAt)}`, {
    x: rightX,
    y,
    size: 8,
    font,
    color: GRAY_COLOR,
  });

  // ── Notes éventuelles ──
  if (data.notes && data.notes.trim().length > 0) {
    y -= 24;
    drawSectionTitle(page, boldFont, "NOTES", MARGIN, y);
    y -= 16;
    drawWrappedText(page, font, data.notes, MARGIN, y, CONTENT_WIDTH, 9, TEXT_COLOR);
  }

  // ── Footer légal ──
  const footerY = 90;
  page.drawLine({
    start: { x: MARGIN, y: footerY + 28 },
    end: { x: PAGE_WIDTH - MARGIN, y: footerY + 28 },
    thickness: 0.5,
    color: LIGHT_BORDER,
  });

  page.drawText(
    "Ce document atteste du paiement en espèces du loyer. Il a valeur de reçu.",
    {
      x: MARGIN,
      y: footerY + 14,
      size: 9,
      font: boldFont,
      color: TEXT_COLOR,
    },
  );

  page.drawText(
    "Art. 21 loi n°89-462 du 6 juillet 1989 · Décret n°2015-587 du 6 mai 2015.",
    {
      x: MARGIN,
      y: footerY,
      size: 8,
      font,
      color: GRAY_COLOR,
    },
  );

  page.drawText(
    "Document généré électroniquement par Talok — signature horodatée.",
    {
      x: MARGIN,
      y: footerY - 12,
      size: 8,
      font,
      color: GRAY_COLOR,
    },
  );

  return pdf.save();
}

// ── Helpers ──

function drawSectionTitle(
  page: PDFPage,
  boldFont: PDFFont,
  text: string,
  x: number,
  y: number,
): void {
  page.drawText(text, {
    x,
    y,
    size: 11,
    font: boldFont,
    color: PRIMARY_COLOR,
  });
}

function drawLabelValue(
  page: PDFPage,
  font: PDFFont,
  boldFont: PDFFont,
  label: string,
  value: string,
  x: number,
  y: number,
): void {
  page.drawText(`${label} :`, {
    x,
    y,
    size: 10,
    font,
    color: GRAY_COLOR,
  });
  page.drawText(value, {
    x: x + 100,
    y,
    size: 10,
    font: boldFont,
    color: TEXT_COLOR,
  });
}

function drawWrappedText(
  page: PDFPage,
  font: PDFFont,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  size: number,
  color: ReturnType<typeof rgb>,
): void {
  const words = text.split(/\s+/);
  let line = "";
  let currentY = y;
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    const width = font.widthOfTextAtSize(candidate, size);
    if (width > maxWidth && line) {
      page.drawText(line, { x, y: currentY, size, font, color });
      currentY -= size + 2;
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) {
    page.drawText(line, { x, y: currentY, size, font, color });
  }
}

async function embedSignature(
  pdf: PDFDocument,
  page: PDFPage,
  base64: string,
  x: number,
  y: number,
  maxWidth: number,
  maxHeight: number,
): Promise<void> {
  try {
    const clean = base64.startsWith("data:") ? base64.split(",")[1] ?? "" : base64;
    if (!clean) return;
    const bytes = Uint8Array.from(atob(clean), (c) => c.charCodeAt(0));
    const image = await pdf.embedPng(bytes);
    const dims = image.scaleToFit(maxWidth, maxHeight);
    page.drawImage(image, {
      x,
      y,
      width: dims.width,
      height: dims.height,
    });
  } catch {
    // Signature illisible → on skip silencieusement, le PDF reste valide
    // avec juste le nom des parties comme identifiant.
  }
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    return format(new Date(value), "d MMMM yyyy 'à' HH:mm", { locale: fr });
  } catch {
    return value;
  }
}

function formatPeriode(periode: string): string {
  // Formats acceptés : "2026-01", "2026-01-01", etc.
  try {
    const normalized = periode.length === 7 ? `${periode}-01` : periode;
    const d = new Date(normalized);
    if (Number.isNaN(d.getTime())) return periode;
    return format(d, "MMMM yyyy", { locale: fr });
  } catch {
    return periode;
  }
}

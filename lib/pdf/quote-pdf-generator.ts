/**
 * Générateur PDF pour les devis prestataire.
 *
 * Format A4 portrait avec :
 *   - Bloc emetteur (prestataire + logo si dispo + SIRET)
 *   - Bloc destinataire (client / proprietaire)
 *   - Reference + date emission + date validite
 *   - Tableau des lignes (description, qty, unit, PU HT, TVA, total HT)
 *   - Recap : sous-total HT, TVA detaillee, total TTC
 *   - Conditions / mentions legales
 *
 * Aucune dependance externe au-dela de pdf-lib (deja utilise par
 * receipt-generator, lease-pdf-generator, fiscal-summary).
 */

import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";

export interface QuotePdfItem {
  description: string;
  quantity: number;
  unit?: string | null;
  /** Prix unitaire HT en euros */
  unit_price: number;
  /** Taux de TVA (0-100) */
  tax_rate: number;
}

export interface QuotePdfData {
  // Reference & dates
  reference: string;
  title: string;
  description?: string | null;
  issueDate: string;
  validUntil?: string | null;

  // Emetteur (prestataire)
  providerName: string;
  providerSiret?: string | null;
  providerEmail?: string | null;
  providerPhone?: string | null;
  providerAddress?: string | null;

  // Destinataire (client)
  clientName?: string | null;
  clientEmail?: string | null;
  propertyAddress?: string | null;

  // Lignes
  items: QuotePdfItem[];

  // Conditions
  termsAndConditions?: string | null;
  paymentConditions?: string | null;
}

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const MARGIN = 40;

// Couleurs prestataire (orange / amber Talok)
const PRIMARY = rgb(0.976, 0.451, 0.086); // #F97316
const ACCENT = rgb(0.961, 0.62, 0.043); // #F59E0B
const TEXT = rgb(0.067, 0.067, 0.067);
const MUTED = rgb(0.42, 0.45, 0.5);
const BORDER = rgb(0.898, 0.906, 0.922); // #E5E7EB
const HEADER_BG = rgb(1, 0.969, 0.929); // #FFF7ED

function formatEur(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDateFr(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function drawText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  font: PDFFont,
  size: number,
  color = TEXT,
) {
  page.drawText(text, { x, y, size, font, color });
}

function wrapText(text: string, maxWidth: number, font: PDFFont, size: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

export async function generateQuotePDF(data: QuotePdfData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
  const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helvB = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let y = A4_HEIGHT - MARGIN;

  // ===== HEADER =====
  page.drawRectangle({
    x: 0,
    y: A4_HEIGHT - 80,
    width: A4_WIDTH,
    height: 80,
    color: PRIMARY,
  });
  drawText(page, "DEVIS", MARGIN, A4_HEIGHT - 50, helvB, 24, rgb(1, 1, 1));
  drawText(
    page,
    data.reference,
    A4_WIDTH - MARGIN - helv.widthOfTextAtSize(data.reference, 14),
    A4_HEIGHT - 45,
    helvB,
    14,
    rgb(1, 1, 1),
  );
  drawText(
    page,
    "Talok — gestion locative",
    A4_WIDTH - MARGIN - helv.widthOfTextAtSize("Talok — gestion locative", 9),
    A4_HEIGHT - 65,
    helv,
    9,
    rgb(1, 0.969, 0.929),
  );

  y = A4_HEIGHT - 110;

  // ===== EMETTEUR / DESTINATAIRE (2 colonnes) =====
  const colWidth = (A4_WIDTH - 2 * MARGIN - 20) / 2;

  drawText(page, "ÉMETTEUR", MARGIN, y, helvB, 9, MUTED);
  drawText(page, "DESTINATAIRE", MARGIN + colWidth + 20, y, helvB, 9, MUTED);
  y -= 14;

  drawText(page, data.providerName, MARGIN, y, helvB, 11);
  if (data.clientName) {
    drawText(page, data.clientName, MARGIN + colWidth + 20, y, helvB, 11);
  }
  y -= 14;

  const emitterLines: string[] = [];
  if (data.providerSiret) emitterLines.push(`SIRET ${data.providerSiret}`);
  if (data.providerAddress) emitterLines.push(data.providerAddress);
  if (data.providerEmail) emitterLines.push(data.providerEmail);
  if (data.providerPhone) emitterLines.push(data.providerPhone);

  const recipientLines: string[] = [];
  if (data.clientEmail) recipientLines.push(data.clientEmail);
  if (data.propertyAddress) recipientLines.push(data.propertyAddress);

  const maxRows = Math.max(emitterLines.length, recipientLines.length);
  let blockY = y;
  for (let i = 0; i < maxRows; i++) {
    if (emitterLines[i]) drawText(page, emitterLines[i], MARGIN, blockY, helv, 9, MUTED);
    if (recipientLines[i])
      drawText(page, recipientLines[i], MARGIN + colWidth + 20, blockY, helv, 9, MUTED);
    blockY -= 12;
  }
  y = blockY - 8;

  // ===== Bloc dates =====
  page.drawRectangle({
    x: MARGIN,
    y: y - 50,
    width: A4_WIDTH - 2 * MARGIN,
    height: 50,
    color: HEADER_BG,
    borderColor: BORDER,
    borderWidth: 1,
  });

  const colDateW = (A4_WIDTH - 2 * MARGIN) / 3;

  drawText(page, "Émission", MARGIN + 16, y - 18, helv, 8, MUTED);
  drawText(page, formatDateFr(data.issueDate), MARGIN + 16, y - 36, helvB, 11);

  drawText(page, "Validité", MARGIN + colDateW + 16, y - 18, helv, 8, MUTED);
  drawText(
    page,
    data.validUntil ? formatDateFr(data.validUntil) : "—",
    MARGIN + colDateW + 16,
    y - 36,
    helvB,
    11,
  );

  drawText(page, "Référence", MARGIN + 2 * colDateW + 16, y - 18, helv, 8, MUTED);
  drawText(page, data.reference, MARGIN + 2 * colDateW + 16, y - 36, helvB, 11);

  y -= 70;

  // ===== Titre du devis =====
  drawText(page, "Objet", MARGIN, y, helv, 9, MUTED);
  y -= 14;
  drawText(page, data.title, MARGIN, y, helvB, 13, ACCENT);
  y -= 16;

  if (data.description) {
    const descLines = wrapText(data.description, A4_WIDTH - 2 * MARGIN, helv, 10);
    for (const line of descLines.slice(0, 4)) {
      drawText(page, line, MARGIN, y, helv, 10, MUTED);
      y -= 12;
    }
  }

  y -= 12;

  // ===== TABLEAU LIGNES =====
  const tableX = MARGIN;
  const tableW = A4_WIDTH - 2 * MARGIN;
  const colDescW = tableW * 0.46;
  const colQtyW = tableW * 0.1;
  const colPuW = tableW * 0.16;
  const colTvaW = tableW * 0.1;
  const colTotalW = tableW * 0.18;

  // Header ligne
  page.drawRectangle({
    x: tableX,
    y: y - 22,
    width: tableW,
    height: 22,
    color: PRIMARY,
  });
  drawText(page, "Description", tableX + 8, y - 16, helvB, 9, rgb(1, 1, 1));
  drawText(page, "Qté", tableX + colDescW + 4, y - 16, helvB, 9, rgb(1, 1, 1));
  drawText(page, "PU HT", tableX + colDescW + colQtyW + 4, y - 16, helvB, 9, rgb(1, 1, 1));
  drawText(
    page,
    "TVA",
    tableX + colDescW + colQtyW + colPuW + 4,
    y - 16,
    helvB,
    9,
    rgb(1, 1, 1),
  );
  drawText(
    page,
    "Total HT",
    tableX + tableW - colTotalW + 4,
    y - 16,
    helvB,
    9,
    rgb(1, 1, 1),
  );
  y -= 22;

  // Aggregation TVA par taux
  const taxBuckets = new Map<number, number>(); // rate -> base HT
  let subtotal = 0;

  for (let i = 0; i < data.items.length; i++) {
    const it = data.items[i];
    const lineHt = it.quantity * it.unit_price;
    subtotal += lineHt;
    taxBuckets.set(it.tax_rate, (taxBuckets.get(it.tax_rate) || 0) + lineHt);

    // Line wrap pour description longue
    const descLines = wrapText(it.description, colDescW - 12, helv, 9);
    const rowHeight = Math.max(20, descLines.length * 11 + 6);

    if (y - rowHeight < MARGIN + 120) {
      // Page break si trop bas — on cree une page suite
      page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
      y = A4_HEIGHT - MARGIN;
    }

    // Bandeau alterne
    if (i % 2 === 1) {
      page.drawRectangle({
        x: tableX,
        y: y - rowHeight,
        width: tableW,
        height: rowHeight,
        color: rgb(0.98, 0.98, 0.98),
      });
    }

    let lineY = y - 13;
    for (const line of descLines) {
      drawText(page, line, tableX + 8, lineY, helv, 9, TEXT);
      lineY -= 11;
    }

    drawText(
      page,
      `${it.quantity}${it.unit ? " " + it.unit : ""}`,
      tableX + colDescW + 4,
      y - 13,
      helv,
      9,
      TEXT,
    );
    drawText(
      page,
      formatEur(it.unit_price),
      tableX + colDescW + colQtyW + 4,
      y - 13,
      helv,
      9,
      TEXT,
    );
    drawText(
      page,
      `${it.tax_rate}%`,
      tableX + colDescW + colQtyW + colPuW + 4,
      y - 13,
      helv,
      9,
      TEXT,
    );

    const totalText = formatEur(lineHt);
    drawText(
      page,
      totalText,
      tableX + tableW - 8 - helv.widthOfTextAtSize(totalText, 9),
      y - 13,
      helvB,
      9,
      TEXT,
    );

    // Border bottom
    page.drawLine({
      start: { x: tableX, y: y - rowHeight },
      end: { x: tableX + tableW, y: y - rowHeight },
      thickness: 0.5,
      color: BORDER,
    });

    y -= rowHeight;
  }

  y -= 12;

  // ===== TOTAUX =====
  const totalsX = A4_WIDTH - MARGIN - 220;
  const labelX = totalsX;
  const valueX = A4_WIDTH - MARGIN - 8;

  drawText(page, "Sous-total HT", labelX, y, helv, 10, MUTED);
  const sub = formatEur(subtotal);
  drawText(page, sub, valueX - helv.widthOfTextAtSize(sub, 10), y, helvB, 10);
  y -= 16;

  let totalTaxes = 0;
  for (const [rate, base] of Array.from(taxBuckets.entries()).sort((a, b) => a[0] - b[0])) {
    const tax = base * (rate / 100);
    totalTaxes += tax;
    const label = `TVA ${rate}%`;
    const value = formatEur(tax);
    drawText(page, label, labelX, y, helv, 10, MUTED);
    drawText(page, value, valueX - helv.widthOfTextAtSize(value, 10), y, helv, 10);
    y -= 14;
  }

  y -= 4;
  page.drawLine({
    start: { x: labelX, y },
    end: { x: valueX, y },
    thickness: 1,
    color: BORDER,
  });
  y -= 16;

  const totalTtc = subtotal + totalTaxes;
  drawText(page, "Total TTC", labelX, y, helvB, 12, ACCENT);
  const tot = formatEur(totalTtc);
  drawText(page, tot, valueX - helvB.widthOfTextAtSize(tot, 14), y, helvB, 14, PRIMARY);
  y -= 30;

  // ===== CONDITIONS =====
  if (data.termsAndConditions || data.paymentConditions) {
    if (y < MARGIN + 120) {
      page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
      y = A4_HEIGHT - MARGIN;
    }
    drawText(page, "Conditions", MARGIN, y, helvB, 10, ACCENT);
    y -= 14;

    const block = [data.termsAndConditions, data.paymentConditions]
      .filter(Boolean)
      .join("\n\n");
    const condLines = wrapText(block, A4_WIDTH - 2 * MARGIN, helv, 9);
    for (const line of condLines.slice(0, 14)) {
      drawText(page, line, MARGIN, y, helv, 9, TEXT);
      y -= 12;
    }
    y -= 8;
  }

  // ===== FOOTER =====
  const footerY = MARGIN - 8;
  drawText(
    page,
    `Devis généré via Talok — ${formatDateFr(data.issueDate)}`,
    MARGIN,
    footerY,
    helv,
    8,
    MUTED,
  );
  const footerRight = "talok.fr";
  drawText(
    page,
    footerRight,
    A4_WIDTH - MARGIN - helv.widthOfTextAtSize(footerRight, 8),
    footerY,
    helv,
    8,
    MUTED,
  );

  return await pdfDoc.save();
}

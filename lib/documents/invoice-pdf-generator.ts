/**
 * Générateur PDF de facture conforme française
 *
 * Génère un PDF professionnel avec pdf-lib, l'uploade dans Supabase Storage
 * et crée l'entrée dans la table documents.
 */

import { PDFDocument, StandardFonts, rgb, PDFFont } from "pdf-lib";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { getServiceClient } from "@/lib/supabase/service-client";

// ============================================
// TYPES
// ============================================

interface GeneratedDocument {
  id: string;
  storage_path: string;
  type: string;
  title: string;
}

// ============================================
// HELPERS
// ============================================

function formatCurrency(value: number): string {
  return value.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function safeDateFormat(
  value: string | null | undefined,
  pattern = "d MMMM yyyy"
): string {
  if (!value) return "Non renseignée";
  try {
    return format(new Date(value), pattern, { locale: fr });
  } catch {
    return "Date invalide";
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
  if (currentLine) lines.push(currentLine);
  return lines;
}

// ============================================
// MAIN FUNCTION
// ============================================

/**
 * Génère un PDF de facture conforme et l'uploade dans Supabase Storage.
 */
export async function generateInvoicePDF(
  invoiceId: string
): Promise<GeneratedDocument> {
  const serviceClient = getServiceClient();

  // 1. Récupérer la facture avec ses relations
  const { data: invoice, error: invoiceError } = await serviceClient
    .from("invoices")
    .select(
      `
      id, reference, periode, montant_total, montant_loyer, montant_charges,
      montant_paye, statut, date_echeance, date_emission, date_paiement,
      lease_id, tenant_id, owner_id, type, metadata
    `
    )
    .eq("id", invoiceId)
    .single();

  if (invoiceError || !invoice) {
    throw new Error(
      `Facture non trouvée : ${invoiceError?.message ?? "introuvable"}`
    );
  }

  // 2. Récupérer le bail pour l'adresse du bien
  let propertyAddress = "";
  let propertyCity = "";
  let propertyPostalCode = "";
  let leaseId = (invoice as any).lease_id;

  if (leaseId) {
    const { data: lease } = await serviceClient
      .from("leases")
      .select(
        `
        property:properties!leases_property_id_fkey(
          adresse_complete, ville, code_postal
        )
      `
      )
      .eq("id", leaseId)
      .single();

    if (lease) {
      const prop = (lease as any).property;
      propertyAddress = prop?.adresse_complete || "";
      propertyCity = prop?.ville || "";
      propertyPostalCode = prop?.code_postal || "";
    }
  }

  // 3. Récupérer les profils bailleur et locataire
  const ownerId = (invoice as any).owner_id;
  const tenantId = (invoice as any).tenant_id;

  let ownerName = "Propriétaire";
  let ownerAddress = "";
  let ownerSiret = "";

  if (ownerId) {
    const { data: owner } = await serviceClient
      .from("profiles")
      .select("prenom, nom, adresse, siret, raison_sociale, type")
      .eq("id", ownerId)
      .single();

    if (owner) {
      ownerName =
        (owner as any).raison_sociale ||
        `${(owner as any).prenom || ""} ${(owner as any).nom || ""}`.trim() ||
        "Propriétaire";
      ownerAddress = (owner as any).adresse || "";
      ownerSiret = (owner as any).siret || "";
    }
  }

  let tenantName = "Locataire";
  if (tenantId) {
    const { data: tenant } = await serviceClient
      .from("profiles")
      .select("prenom, nom")
      .eq("id", tenantId)
      .single();

    if (tenant) {
      tenantName =
        `${(tenant as any).prenom || ""} ${(tenant as any).nom || ""}`.trim() ||
        "Locataire";
    }
  }

  // 4. Générer le PDF
  const inv = invoice as any;
  const pdfBytes = await buildInvoicePDF({
    reference: inv.reference || `F-${invoiceId.substring(0, 8).toUpperCase()}`,
    periode: inv.periode || "",
    montantLoyer: Number(inv.montant_loyer) || 0,
    montantCharges: Number(inv.montant_charges) || 0,
    montantTotal: Number(inv.montant_total) || 0,
    dateEmission: inv.date_emission,
    dateEcheance: inv.date_echeance,
    datePaiement: inv.date_paiement,
    statut: inv.statut,
    depositAmount: inv.metadata?.deposit_amount
      ? Number(inv.metadata.deposit_amount)
      : 0,
    ownerName,
    ownerAddress,
    ownerSiret,
    tenantName,
    propertyAddress,
    propertyCity,
    propertyPostalCode,
  });

  // 5. Déterminer le chemin de stockage
  const periodSlug = inv.periode || format(new Date(), "yyyy-MM");
  const storagePath = `documents/factures/${leaseId || "misc"}/${periodSlug}.pdf`;

  const { error: uploadError } = await serviceClient.storage
    .from("documents")
    .upload(storagePath, pdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Erreur upload facture PDF : ${uploadError.message}`);
  }

  // 6. INSERT dans la table documents
  const title = `Facture ${inv.reference || invoiceId.substring(0, 8)} — ${inv.periode || ""}`;

  const { data: doc, error: docError } = await serviceClient
    .from("documents")
    .insert({
      type: "facture" as any,
      lease_id: leaseId || null,
      owner_id: ownerId || null,
      tenant_id: tenantId || null,
      storage_path: storagePath,
      title,
      original_filename: `facture_${inv.reference || invoiceId.substring(0, 8)}.pdf`,
      mime_type: "application/pdf",
      file_size: pdfBytes.length,
      visible_tenant: true,
      is_generated: true,
      metadata: {
        generated_at: new Date().toISOString(),
        invoice_id: invoiceId,
        generator: "invoice-pdf-generator",
      },
    })
    .select("id")
    .single();

  if (docError) {
    throw new Error(`Erreur création document facture : ${docError.message}`);
  }

  return {
    id: doc.id,
    storage_path: storagePath,
    type: "facture",
    title,
  };
}

// ============================================
// PDF BUILDER
// ============================================

interface InvoicePDFData {
  reference: string;
  periode: string;
  montantLoyer: number;
  montantCharges: number;
  montantTotal: number;
  dateEmission: string | null;
  dateEcheance: string | null;
  datePaiement: string | null;
  statut: string;
  depositAmount: number;
  ownerName: string;
  ownerAddress: string;
  ownerSiret: string;
  tenantName: string;
  propertyAddress: string;
  propertyCity: string;
  propertyPostalCode: string;
}

async function buildInvoicePDF(data: InvoicePDFData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4

  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const primaryColor = rgb(0.145, 0.388, 0.922);
  const textColor = rgb(0.067, 0.067, 0.067);
  const grayColor = rgb(0.42, 0.45, 0.5);
  const greenColor = rgb(0.02, 0.59, 0.41);

  const { width, height } = page.getSize();
  const margin = 50;
  const maxTextWidth = width - 2 * margin;
  let y = height - margin;

  // ======== EN-TÊTE ========
  page.drawText("TALOK", {
    x: margin,
    y,
    size: 18,
    font: helveticaBold,
    color: primaryColor,
  });

  page.drawText("FACTURE", {
    x: margin,
    y: y - 30,
    size: 24,
    font: helveticaBold,
    color: textColor,
  });

  // Numéro de facture (droite)
  const refText = `N° ${data.reference}`;
  const refWidth = helveticaBold.widthOfTextAtSize(refText, 12);
  page.drawText(refText, {
    x: width - margin - refWidth,
    y,
    size: 12,
    font: helveticaBold,
    color: textColor,
  });

  // Statut badge
  const statusLabel =
    data.statut === "paid"
      ? "PAYÉE"
      : data.statut === "late"
        ? "EN RETARD"
        : data.statut === "partial"
          ? "PARTIELLE"
          : "À RÉGLER";
  const statusColor =
    data.statut === "paid"
      ? greenColor
      : data.statut === "late"
        ? rgb(0.86, 0.15, 0.15)
        : primaryColor;

  const statusWidth = helveticaBold.widthOfTextAtSize(statusLabel, 10);
  page.drawRectangle({
    x: width - margin - statusWidth - 16,
    y: y - 35,
    width: statusWidth + 16,
    height: 20,
    color: statusColor,
    borderWidth: 0,
  });
  page.drawText(statusLabel, {
    x: width - margin - statusWidth - 8,
    y: y - 30,
    size: 10,
    font: helveticaBold,
    color: rgb(1, 1, 1),
  });

  y -= 60;

  // Période
  if (data.periode) {
    page.drawText(`Période : ${data.periode}`, {
      x: margin,
      y,
      size: 11,
      font: helvetica,
      color: grayColor,
    });
    y -= 20;
  }

  // Séparateur
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 1,
    color: rgb(0.9, 0.9, 0.9),
  });

  // ======== BAILLEUR & LOCATAIRE (2 colonnes) ========
  y -= 35;

  // Bailleur (gauche)
  page.drawText("BAILLEUR", {
    x: margin,
    y,
    size: 9,
    font: helveticaBold,
    color: grayColor,
  });
  y -= 18;
  page.drawText(data.ownerName, {
    x: margin,
    y,
    size: 11,
    font: helveticaBold,
    color: textColor,
  });
  if (data.ownerAddress) {
    y -= 15;
    const addrLines = splitTextIntoLines(
      data.ownerAddress,
      helvetica,
      10,
      maxTextWidth / 2 - 20
    );
    for (const line of addrLines) {
      page.drawText(line, {
        x: margin,
        y,
        size: 10,
        font: helvetica,
        color: textColor,
      });
      y -= 14;
    }
  }
  if (data.ownerSiret) {
    page.drawText(`SIRET : ${data.ownerSiret}`, {
      x: margin,
      y,
      size: 9,
      font: helvetica,
      color: grayColor,
    });
    y -= 14;
  }

  // Locataire (droite) — on repart d'un y fixe
  const rightColX = width / 2 + 20;
  let yRight = height - margin - 95;

  page.drawText("LOCATAIRE", {
    x: rightColX,
    y: yRight,
    size: 9,
    font: helveticaBold,
    color: grayColor,
  });
  yRight -= 18;
  page.drawText(data.tenantName, {
    x: rightColX,
    y: yRight,
    size: 11,
    font: helveticaBold,
    color: textColor,
  });
  if (data.propertyAddress) {
    yRight -= 15;
    const propLines = splitTextIntoLines(
      data.propertyAddress,
      helvetica,
      10,
      maxTextWidth / 2 - 20
    );
    for (const line of propLines) {
      page.drawText(line, {
        x: rightColX,
        y: yRight,
        size: 10,
        font: helvetica,
        color: textColor,
      });
      yRight -= 14;
    }
    if (data.propertyPostalCode || data.propertyCity) {
      page.drawText(
        `${data.propertyPostalCode} ${data.propertyCity}`.trim(),
        {
          x: rightColX,
          y: yRight,
          size: 10,
          font: helvetica,
          color: textColor,
        }
      );
      yRight -= 14;
    }
  }

  // Prendre le y le plus bas des deux colonnes
  y = Math.min(y, yRight) - 20;

  // ======== DATES ========
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 0.5,
    color: rgb(0.9, 0.9, 0.9),
  });
  y -= 20;

  const dateItems = [
    { label: "Date d'émission", value: safeDateFormat(data.dateEmission, "dd/MM/yyyy") },
    { label: "Date d'échéance", value: safeDateFormat(data.dateEcheance, "dd/MM/yyyy") },
  ];
  if (data.datePaiement) {
    dateItems.push({
      label: "Date de paiement",
      value: safeDateFormat(data.datePaiement, "dd/MM/yyyy"),
    });
  }

  const colSpacing = maxTextWidth / dateItems.length;
  for (let i = 0; i < dateItems.length; i++) {
    const x = margin + i * colSpacing;
    page.drawText(dateItems[i].label, {
      x,
      y,
      size: 9,
      font: helveticaBold,
      color: grayColor,
    });
    page.drawText(dateItems[i].value, {
      x,
      y: y - 15,
      size: 11,
      font: helvetica,
      color: textColor,
    });
  }

  y -= 45;

  // ======== TABLEAU DES MONTANTS ========
  const hasDeposit = data.depositAmount > 0;
  const tableRows: Array<{ label: string; amount: number; bold?: boolean }> = [];

  tableRows.push({ label: "Loyer (hors charges)", amount: data.montantLoyer });
  tableRows.push({ label: "Charges", amount: data.montantCharges });
  if (hasDeposit) {
    tableRows.push({
      label: "Dépôt de garantie",
      amount: data.depositAmount,
    });
  }
  tableRows.push({ label: "TOTAL TTC", amount: data.montantTotal, bold: true });

  // Table header
  const tableTop = y;
  const rowHeight = 28;
  const tableHeight = (tableRows.length + 1) * rowHeight;

  // Header background
  page.drawRectangle({
    x: margin,
    y: tableTop - rowHeight,
    width: maxTextWidth,
    height: rowHeight,
    color: rgb(0.96, 0.96, 0.98),
  });

  page.drawText("DÉSIGNATION", {
    x: margin + 15,
    y: tableTop - 20,
    size: 10,
    font: helveticaBold,
    color: grayColor,
  });
  page.drawText("MONTANT", {
    x: width - margin - 100,
    y: tableTop - 20,
    size: 10,
    font: helveticaBold,
    color: grayColor,
  });

  // Rows
  for (let i = 0; i < tableRows.length; i++) {
    const row = tableRows[i];
    const rowY = tableTop - (i + 2) * rowHeight;

    if (row.bold) {
      page.drawRectangle({
        x: margin,
        y: rowY,
        width: maxTextWidth,
        height: rowHeight,
        color: rgb(0.97, 0.97, 0.99),
      });
    }

    // Ligne séparatrice
    page.drawLine({
      start: { x: margin, y: rowY + rowHeight },
      end: { x: width - margin, y: rowY + rowHeight },
      thickness: 0.5,
      color: rgb(0.92, 0.92, 0.92),
    });

    const font = row.bold ? helveticaBold : helvetica;
    const fontSize = row.bold ? 12 : 11;
    const color = row.bold ? primaryColor : textColor;

    page.drawText(row.label, {
      x: margin + 15,
      y: rowY + 8,
      size: fontSize,
      font,
      color: row.bold ? textColor : textColor,
    });

    const amountText = `${formatCurrency(row.amount)} €`;
    const amountWidth = font.widthOfTextAtSize(amountText, fontSize);
    page.drawText(amountText, {
      x: width - margin - amountWidth - 15,
      y: rowY + 8,
      size: fontSize,
      font,
      color,
    });
  }

  // Table border
  page.drawRectangle({
    x: margin,
    y: tableTop - tableHeight,
    width: maxTextWidth,
    height: tableHeight,
    borderColor: rgb(0.9, 0.9, 0.9),
    borderWidth: 1,
    color: undefined,
  });

  y = tableTop - tableHeight - 40;

  // ======== CONDITIONS DE PAIEMENT ========
  page.drawText("CONDITIONS DE PAIEMENT", {
    x: margin,
    y,
    size: 10,
    font: helveticaBold,
    color: grayColor,
  });
  y -= 20;

  const conditionsText =
    "Le paiement est dû à la date d'échéance indiquée. " +
    "En cas de retard, des pénalités de 3 fois le taux d'intérêt légal seront appliquées. " +
    "Pas d'escompte pour paiement anticipé.";

  const condLines = splitTextIntoLines(
    conditionsText,
    helvetica,
    10,
    maxTextWidth
  );
  for (const line of condLines) {
    page.drawText(line, {
      x: margin,
      y,
      size: 10,
      font: helvetica,
      color: textColor,
    });
    y -= 15;
  }

  // ======== FOOTER ========
  const footerY = 40;

  page.drawLine({
    start: { x: margin, y: footerY + 15 },
    end: { x: width - margin, y: footerY + 15 },
    thickness: 0.5,
    color: rgb(0.9, 0.9, 0.9),
  });

  const dateGenerated = format(new Date(), "dd/MM/yyyy 'à' HH:mm", {
    locale: fr,
  });
  page.drawText(`Document généré le ${dateGenerated}`, {
    x: margin,
    y: footerY,
    size: 8,
    font: helvetica,
    color: grayColor,
  });

  page.drawText("Talok — Gestion locative", {
    x: width - margin - 100,
    y: footerY,
    size: 8,
    font: helveticaBold,
    color: primaryColor,
  });

  // Metadata PDF
  pdfDoc.setTitle(`Facture ${data.reference}`);
  pdfDoc.setAuthor("Talok — Gestion locative");
  pdfDoc.setCreator("Talok Invoice PDF Generator");
  pdfDoc.setProducer("pdf-lib");
  pdfDoc.setCreationDate(new Date());

  return pdfDoc.save();
}

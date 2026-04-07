/**
 * Générateur PDF d'attestation de remise des clés
 *
 * Génère un PDF Talok avec pdf-lib, l'uploade dans Supabase Storage
 * et crée l'entrée dans la table documents.
 *
 * Idempotent : skip si un document attestation_remise_cles existe déjà pour ce handover.
 */

import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { getServiceClient } from "@/lib/supabase/service-client";

// ============================================
// TYPES
// ============================================

export interface KeyHandoverAttestationResult {
  id: string;
  storage_path: string;
  created: boolean;
}

interface KeyItem {
  type?: string;
  label?: string;
  quantite?: number;
  quantity?: number;
  observations?: string;
}

interface HandoverData {
  id: string;
  lease_id: string;
  property_id: string;
  owner_profile_id: string;
  tenant_profile_id: string;
  keys_list: KeyItem[];
  confirmed_at: string;
  geolocation?: { lat?: number; lng?: number; accuracy?: number } | null;
  proof_id?: string | null;
  tenant_ip?: string | null;
  lease: {
    property: {
      adresse_complete: string;
      ville: string;
      code_postal: string;
    };
  };
}

// ============================================
// HELPERS
// ============================================

function safeDateFormat(value: string | null | undefined, pattern = "d MMMM yyyy 'à' HH:mm"): string {
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
    if (font.widthOfTextAtSize(testLine, fontSize) > maxWidth && currentLine) {
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
 * Génère et stocke le PDF d'attestation de remise des clés.
 * Idempotent : si le document existe déjà, retourne son path sans régénérer.
 */
export async function generateKeyHandoverAttestation(
  handoverId: string
): Promise<KeyHandoverAttestationResult | null> {
  const serviceClient = getServiceClient();

  // ── Idempotence ────────────────────────────────────────────────
  const { data: existing } = await serviceClient
    .from("documents")
    .select("id, storage_path")
    .eq("type", "attestation_remise_cles" as any)
    .filter("metadata->handover_id", "eq", handoverId)
    .maybeSingle();

  if (existing) {
    return {
      id: (existing as any).id,
      storage_path: (existing as any).storage_path,
      created: false,
    };
  }

  // ── Récupérer les données ───────────────────────────────────────
  const { data: handover, error } = await serviceClient
    .from("key_handovers" as any)
    .select(`
      id,
      lease_id,
      property_id,
      owner_profile_id,
      tenant_profile_id,
      keys_list,
      confirmed_at,
      geolocation,
      proof_id,
      tenant_ip,
      lease:leases!inner(
        id,
        property:properties!inner(
          id,
          adresse_complete,
          ville,
          code_postal
        )
      )
    `)
    .eq("id", handoverId)
    .single();

  if (error || !handover) {
    throw new Error(`Remise des clés introuvable : ${error?.message ?? "id=${handoverId}"}`);
  }

  const h = handover as unknown as HandoverData;

  if (!h.confirmed_at) {
    console.warn("[keys-handover-generator] Handover non confirmé, skip:", handoverId);
    return null;
  }

  // ── Récupérer les profils ───────────────────────────────────────
  const [{ data: ownerProfile }, { data: tenantProfile }] = await Promise.all([
    serviceClient.from("profiles").select("prenom, nom").eq("id", h.owner_profile_id).single(),
    serviceClient.from("profiles").select("prenom, nom").eq("id", h.tenant_profile_id).single(),
  ]);

  const ownerName = `${ownerProfile?.prenom || ""} ${ownerProfile?.nom || ""}`.trim() || "Propriétaire";
  const tenantName = `${tenantProfile?.prenom || ""} ${tenantProfile?.nom || ""}`.trim() || "Locataire";
  const property = h.lease?.property;
  const propertyAddress = property
    ? `${property.adresse_complete}, ${property.code_postal} ${property.ville}`
    : "Adresse non renseignée";

  // ── Générer le PDF ──────────────────────────────────────────────
  const pdfBytes = await buildAttestationPDF({
    handoverId: h.id,
    leaseId: h.lease_id,
    ownerName,
    tenantName,
    propertyAddress,
    confirmedAt: h.confirmed_at,
    keys: Array.isArray(h.keys_list) ? h.keys_list : [],
    proofId: h.proof_id || null,
    geolocation: h.geolocation || null,
  });

  // ── Upload Storage ──────────────────────────────────────────────
  const storagePath = `key-handover/${h.lease_id}/${handoverId}/attestation.pdf`;

  const { error: uploadError } = await serviceClient.storage
    .from("documents")
    .upload(storagePath, Buffer.from(pdfBytes), {
      contentType: "application/pdf",
      upsert: true,
      cacheControl: "31536000",
    });

  if (uploadError) {
    throw new Error(`Erreur upload attestation : ${uploadError.message}`);
  }

  // ── INSERT documents ────────────────────────────────────────────
  const { data: doc, error: docError } = await serviceClient
    .from("documents")
    .insert({
      type: "attestation_remise_cles" as any,
      property_id: h.property_id,
      lease_id: h.lease_id,
      owner_id: h.owner_profile_id,
      tenant_id: h.tenant_profile_id,
      title: "Attestation de remise des clés",
      original_filename: `attestation_remise_cles_${handoverId.substring(0, 8)}.pdf`,
      storage_path: storagePath,
      mime_type: "application/pdf",
      file_size: pdfBytes.length,
      visible_tenant: true,
      is_generated: true,
      metadata: {
        handover_id: handoverId,
        confirmed_at: h.confirmed_at,
        keys_count: Array.isArray(h.keys_list) ? h.keys_list.length : 0,
        proof_id: h.proof_id || null,
        generator: "keys-handover-generator",
        final: true,
      },
    } as any)
    .select("id")
    .single();

  if (docError) {
    throw new Error(`Erreur création document attestation : ${docError.message}`);
  }

  return {
    id: (doc as any).id,
    storage_path: storagePath,
    created: true,
  };
}

// ============================================
// PDF BUILDER
// ============================================

async function buildAttestationPDF(data: {
  handoverId: string;
  leaseId: string;
  ownerName: string;
  tenantName: string;
  propertyAddress: string;
  confirmedAt: string;
  keys: KeyItem[];
  proofId: string | null;
  geolocation: { lat?: number; lng?: number; accuracy?: number } | null;
}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const primaryColor = rgb(0.145, 0.388, 0.922); // #2563eb
  const textColor = rgb(0.067, 0.067, 0.067);
  const grayColor = rgb(0.42, 0.45, 0.5);
  const emeraldColor = rgb(0.02, 0.59, 0.41);

  const margin = 50;
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const maxTextWidth = pageWidth - 2 * margin;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;
  let pageNum = 1;

  function ensureSpace(needed: number) {
    if (y - needed < margin + 40) {
      drawFooter(page, pageNum, helvetica, grayColor, margin, pageWidth, data.handoverId);
      pageNum++;
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
  }

  function drawSection(title: string) {
    ensureSpace(40);
    y -= 22;
    page.drawLine({
      start: { x: margin, y },
      end: { x: pageWidth - margin, y },
      thickness: 0.5,
      color: rgb(0.9, 0.9, 0.9),
    });
    y -= 18;
    page.drawText(title, {
      x: margin,
      y,
      size: 12,
      font: helveticaBold,
      color: primaryColor,
    });
    y -= 18;
  }

  function drawKeyValue(key: string, value: string) {
    ensureSpace(20);
    page.drawText(key, {
      x: margin,
      y,
      size: 10,
      font: helveticaBold,
      color: grayColor,
    });
    const lines = splitTextIntoLines(value, helvetica, 10, maxTextWidth - 180);
    for (const line of lines) {
      page.drawText(line, {
        x: margin + 180,
        y,
        size: 10,
        font: helvetica,
        color: textColor,
      });
      y -= 16;
    }
    if (lines.length === 0) y -= 16;
  }

  // ── EN-TÊTE ────────────────────────────────────────────────────
  page.drawText("TALOK", {
    x: margin,
    y,
    size: 20,
    font: helveticaBold,
    color: primaryColor,
  });
  const rightLabel = "Gestion locative";
  const rightLabelW = helvetica.widthOfTextAtSize(rightLabel, 10);
  page.drawText(rightLabel, {
    x: pageWidth - margin - rightLabelW,
    y: y + 4,
    size: 10,
    font: helvetica,
    color: grayColor,
  });

  y -= 35;
  page.drawText("ATTESTATION DE REMISE DES CLÉS", {
    x: margin,
    y,
    size: 20,
    font: helveticaBold,
    color: textColor,
  });
  y -= 20;

  const refText = `Réf. ${data.handoverId.substring(0, 8).toUpperCase()}`;
  page.drawText(refText, {
    x: margin,
    y,
    size: 10,
    font: helvetica,
    color: grayColor,
  });

  // ── PARTIES ─────────────────────────────────────────────────────
  drawSection("PARTIES");

  drawKeyValue("Propriétaire (bailleur)", data.ownerName);
  drawKeyValue("Locataire", data.tenantName);
  drawKeyValue("Bien loué", data.propertyAddress);

  // ── DATE ET LIEU ─────────────────────────────────────────────────
  drawSection("DATE ET CIRCONSTANCES");

  drawKeyValue("Date de remise", safeDateFormat(data.confirmedAt));
  if (data.geolocation?.lat && data.geolocation?.lng) {
    drawKeyValue(
      "Géolocalisation",
      `Lat ${data.geolocation.lat.toFixed(5)}, Lng ${data.geolocation.lng.toFixed(5)}${data.geolocation.accuracy ? ` (±${Math.round(data.geolocation.accuracy)} m)` : ""}`
    );
  }

  // ── CLÉS REMISES ─────────────────────────────────────────────────
  drawSection("CLÉS REMISES");

  if (data.keys.length === 0) {
    ensureSpace(20);
    page.drawText("Aucune clé renseignée dans l'EDL.", {
      x: margin,
      y,
      size: 10,
      font: helvetica,
      color: grayColor,
    });
    y -= 18;
  } else {
    for (const key of data.keys) {
      ensureSpace(24);
      const label = key.label || key.type || "Clé";
      const qty = key.quantite || key.quantity || 1;
      const obs = key.observations ? ` — ${key.observations}` : "";

      page.drawCircle({ x: margin + 6, y: y + 3, size: 3, color: primaryColor });
      page.drawText(`${label}${obs}`, {
        x: margin + 18,
        y,
        size: 10,
        font: helvetica,
        color: textColor,
      });
      const qtyLabel = `×${qty}`;
      const qtyW = helveticaBold.widthOfTextAtSize(qtyLabel, 10);
      page.drawText(qtyLabel, {
        x: pageWidth - margin - qtyW,
        y,
        size: 10,
        font: helveticaBold,
        color: primaryColor,
      });
      y -= 20;
    }
  }

  // ── CERTIFICATION ────────────────────────────────────────────────
  drawSection("CERTIFICATION ÉLECTRONIQUE");

  // Cadre vert
  ensureSpace(90);
  page.drawRectangle({
    x: margin,
    y: y - 70,
    width: maxTextWidth,
    height: 80,
    color: rgb(0.94, 0.99, 0.96),
    borderColor: rgb(0.6, 0.9, 0.75),
    borderWidth: 0.75,
  });

  y -= 15;
  page.drawText("Document certifié électroniquement", {
    x: margin + 15,
    y,
    size: 11,
    font: helveticaBold,
    color: emeraldColor,
  });
  y -= 18;
  page.drawText(
    `Le locataire a confirmé la réception des clés via son compte Talok authentifié, le ${safeDateFormat(data.confirmedAt)}.`,
    {
      x: margin + 15,
      y,
      size: 9,
      font: helvetica,
      color: textColor,
    }
  );
  y -= 14;
  page.drawText(
    "La signature manuscrite numérique et la preuve cryptographique sont conservées par Talok.",
    {
      x: margin + 15,
      y,
      size: 9,
      font: helvetica,
      color: textColor,
    }
  );

  if (data.proofId) {
    y -= 14;
    page.drawText(`ID de preuve : ${data.proofId}`, {
      x: margin + 15,
      y,
      size: 8,
      font: helvetica,
      color: grayColor,
    });
  }

  y -= 30;

  // ── CLAUSE LÉGALE ───────────────────────────────────────────────
  drawSection("VALEUR JURIDIQUE");

  ensureSpace(50);
  const clauseText =
    "La présente attestation, générée automatiquement par la plateforme Talok à la date de confirmation, " +
    "constitue la preuve de la remise effective des clés du logement. Elle est opposable entre les parties " +
    "conformément aux articles 1366 et 1367 du Code civil relatifs à l'écrit et à la signature électronique.";
  const clauseLines = splitTextIntoLines(clauseText, helvetica, 9, maxTextWidth);
  for (const line of clauseLines) {
    ensureSpace(14);
    page.drawText(line, { x: margin, y, size: 9, font: helvetica, color: grayColor });
    y -= 14;
  }

  // Footer dernière page
  drawFooter(page, pageNum, helvetica, grayColor, margin, pageWidth, data.handoverId);

  pdfDoc.setTitle(`Attestation remise des clés — ${data.handoverId.substring(0, 8).toUpperCase()}`);
  pdfDoc.setAuthor("Talok — Gestion locative");
  pdfDoc.setCreator("Talok PDF Generator");
  pdfDoc.setProducer("pdf-lib");
  pdfDoc.setCreationDate(new Date());

  return pdfDoc.save();
}

function drawFooter(
  page: PDFPage,
  pageNum: number,
  font: PDFFont,
  color: ReturnType<typeof rgb>,
  margin: number,
  pageWidth: number,
  handoverId: string
) {
  const footerY = 30;
  page.drawLine({
    start: { x: margin, y: footerY + 10 },
    end: { x: pageWidth - margin, y: footerY + 10 },
    thickness: 0.5,
    color: rgb(0.9, 0.9, 0.9),
  });
  page.drawText(`Remise ${handoverId.substring(0, 8).toUpperCase()}`, {
    x: margin,
    y: footerY,
    size: 8,
    font,
    color,
  });
  page.drawText("Talok — Gestion locative", {
    x: pageWidth / 2 - 40,
    y: footerY,
    size: 8,
    font,
    color,
  });
  const pageText = `Page ${pageNum}`;
  const w = font.widthOfTextAtSize(pageText, 8);
  page.drawText(pageText, {
    x: pageWidth - margin - w,
    y: footerY,
    size: 8,
    font,
    color,
  });
}

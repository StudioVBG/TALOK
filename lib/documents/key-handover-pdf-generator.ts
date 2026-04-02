/**
 * Générateur de Procès-verbal de remise des clés en PDF
 *
 * Génère un PV conforme à l'article 22 de la loi du 6 juillet 1989
 * Utilise pdf-lib (déjà installé dans le projet)
 */

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { getServiceClient } from "@/lib/supabase/service-client";

interface KeyHandoverPDFData {
  leaseId: string;
  handoverId: string;
  propertyAddress: string;
  leaseType: string;
  leaseStartDate: string;
  ownerName: string;
  tenantName: string;
  keys: Array<{ type?: string; quantite?: number; quantity?: number; observations?: string }>;
  confirmedAt: string;
  ownerSignaturePath?: string | null;
  tenantSignaturePath?: string | null;
}

async function buildKeyHandoverPDF(data: KeyHandoverPDFData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]); // A4
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);

  const primaryColor = rgb(0.145, 0.388, 0.922);
  const textColor = rgb(0.067, 0.067, 0.067);
  const grayColor = rgb(0.42, 0.45, 0.5);
  const margin = 50;
  const pageWidth = 595.28;
  const contentWidth = pageWidth - margin * 2;
  let y = 790;

  // ── Header: TALOK + Title ──
  page.drawText("TALOK", {
    x: margin,
    y,
    size: 14,
    font: boldFont,
    color: primaryColor,
  });

  y -= 30;
  page.drawText("Procès-verbal de remise des clés", {
    x: margin,
    y,
    size: 20,
    font: boldFont,
    color: textColor,
  });

  y -= 10;
  page.drawLine({
    start: { x: margin, y },
    end: { x: pageWidth - margin, y },
    thickness: 2,
    color: primaryColor,
  });

  // ── Bail info ──
  y -= 30;
  page.drawText("INFORMATIONS DU BAIL", {
    x: margin,
    y,
    size: 11,
    font: boldFont,
    color: primaryColor,
  });

  y -= 20;
  const bailLines = [
    `Adresse du bien : ${data.propertyAddress}`,
    `Type de bail : ${data.leaseType}`,
    `Date de début : ${formatDate(data.leaseStartDate)}`,
  ];
  for (const line of bailLines) {
    page.drawText(line, { x: margin, y, size: 10, font, color: textColor });
    y -= 16;
  }

  // ── Parties ──
  y -= 14;
  page.drawText("PARTIES", {
    x: margin,
    y,
    size: 11,
    font: boldFont,
    color: primaryColor,
  });

  y -= 20;
  page.drawText(`Propriétaire : ${data.ownerName}`, {
    x: margin,
    y,
    size: 10,
    font,
    color: textColor,
  });
  y -= 16;
  page.drawText(`Locataire : ${data.tenantName}`, {
    x: margin,
    y,
    size: 10,
    font,
    color: textColor,
  });

  // ── Keys list ──
  y -= 24;
  page.drawText("CLÉS REMISES", {
    x: margin,
    y,
    size: 11,
    font: boldFont,
    color: primaryColor,
  });

  y -= 6;

  if (data.keys.length > 0) {
    // Table header
    y -= 16;
    page.drawRectangle({
      x: margin,
      y: y - 4,
      width: contentWidth,
      height: 20,
      color: rgb(0.95, 0.95, 0.97),
    });
    page.drawText("Type", { x: margin + 8, y, size: 9, font: boldFont, color: grayColor });
    page.drawText("Quantité", { x: margin + 250, y, size: 9, font: boldFont, color: grayColor });
    page.drawText("Observations", { x: margin + 340, y, size: 9, font: boldFont, color: grayColor });

    for (const key of data.keys) {
      y -= 20;
      page.drawText(key.type || "Clé", { x: margin + 8, y, size: 10, font, color: textColor });
      page.drawText(`${key.quantite || key.quantity || 1}`, { x: margin + 265, y, size: 10, font, color: textColor });
      if (key.observations) {
        page.drawText(key.observations, { x: margin + 340, y, size: 9, font, color: grayColor });
      }
    }
  } else {
    y -= 16;
    page.drawText("Aucune clé spécifiée", { x: margin, y, size: 10, font, color: grayColor });
  }

  // ── Date and time ──
  y -= 30;
  page.drawText("DATE ET HEURE DE LA REMISE", {
    x: margin,
    y,
    size: 11,
    font: boldFont,
    color: primaryColor,
  });
  y -= 20;
  page.drawText(formatDateTime(data.confirmedAt), {
    x: margin,
    y,
    size: 10,
    font,
    color: textColor,
  });

  // ── Signatures ──
  y -= 34;
  page.drawText("SIGNATURES", {
    x: margin,
    y,
    size: 11,
    font: boldFont,
    color: primaryColor,
  });

  y -= 20;
  const sigColWidth = contentWidth / 2;

  // Owner signature
  page.drawText("Le propriétaire", { x: margin, y, size: 10, font: boldFont, color: textColor });
  page.drawText(data.ownerName, { x: margin, y: y - 14, size: 9, font, color: grayColor });

  // Tenant signature
  page.drawText("Le locataire", { x: margin + sigColWidth, y, size: 10, font: boldFont, color: textColor });
  page.drawText(data.tenantName, { x: margin + sigColWidth, y: y - 14, size: 9, font, color: grayColor });

  // Embed signature images if available
  if (data.ownerSignaturePath || data.tenantSignaturePath) {
    const serviceClient = getServiceClient();
    if (data.ownerSignaturePath) {
      try {
        const { data: sigData } = await serviceClient.storage
          .from("documents")
          .download(data.ownerSignaturePath);
        if (sigData) {
          const sigBytes = new Uint8Array(await sigData.arrayBuffer());
          const sigImage = await pdf.embedPng(sigBytes);
          const sigDims = sigImage.scaleToFit(120, 50);
          page.drawImage(sigImage, {
            x: margin,
            y: y - 70,
            width: sigDims.width,
            height: sigDims.height,
          });
        }
      } catch {
        // Signature non disponible, pas bloquant
      }
    }
    if (data.tenantSignaturePath) {
      try {
        const { data: sigData } = await serviceClient.storage
          .from("documents")
          .download(data.tenantSignaturePath);
        if (sigData) {
          const sigBytes = new Uint8Array(await sigData.arrayBuffer());
          const sigImage = await pdf.embedPng(sigBytes);
          const sigDims = sigImage.scaleToFit(120, 50);
          page.drawImage(sigImage, {
            x: margin + sigColWidth,
            y: y - 70,
            width: sigDims.width,
            height: sigDims.height,
          });
        }
      } catch {
        // Signature non disponible, pas bloquant
      }
    }
    y -= 80;
  } else {
    y -= 30;
  }

  // ── Legal notice ──
  y -= 20;
  page.drawLine({
    start: { x: margin, y: y + 10 },
    end: { x: pageWidth - margin, y: y + 10 },
    thickness: 0.5,
    color: rgb(0.85, 0.85, 0.85),
  });

  const legalText =
    "Ce document vaut procès-verbal de remise des clés conformément à l'article 22 de la loi du 6 juillet 1989.";
  page.drawText(legalText, {
    x: margin,
    y,
    size: 8,
    font,
    color: grayColor,
    maxWidth: contentWidth,
  });

  y -= 16;
  page.drawText("Document généré électroniquement par Talok — signature horodatée et géolocalisée.", {
    x: margin,
    y,
    size: 8,
    font,
    color: grayColor,
  });

  return pdf.save();
}

function formatDate(value?: string | null): string {
  if (!value) return "Non renseignée";
  try {
    return format(new Date(value), "d MMMM yyyy", { locale: fr });
  } catch {
    return value;
  }
}

function formatDateTime(value?: string | null): string {
  if (!value) return "Non renseignée";
  try {
    return format(new Date(value), "d MMMM yyyy 'à' HH:mm", { locale: fr });
  } catch {
    return value;
  }
}

const LEASE_TYPE_LABELS: Record<string, string> = {
  habitation_vide: "Habitation vide",
  habitation_meuble: "Habitation meublée",
  colocation: "Colocation",
  etudiant: "Étudiant",
  mobilite: "Mobilité",
  saisonnier: "Saisonnier",
  professionnel: "Professionnel",
  parking: "Parking",
};

/**
 * Génère le PV de remise des clés et l'enregistre dans le storage + table documents
 */
export async function generateKeyHandoverPDF(leaseId: string): Promise<void> {
  const serviceClient = getServiceClient();

  // Récupérer la remise des clés confirmée
  const { data: handover } = await (serviceClient.from("key_handovers") as any)
    .select(`
      id,
      lease_id,
      property_id,
      owner_profile_id,
      tenant_profile_id,
      keys_list,
      confirmed_at,
      tenant_signature_path
    `)
    .eq("lease_id", leaseId)
    .not("confirmed_at", "is", null)
    .order("confirmed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!handover?.confirmed_at) {
    throw new Error("Aucune remise des clés confirmée trouvée pour ce bail");
  }

  // Vérifier qu'un PV n'existe pas déjà
  const { data: existingDoc } = await serviceClient
    .from("documents")
    .select("id")
    .eq("type", "pv_remise_cles")
    .eq("lease_id", leaseId)
    .filter("metadata->>handover_id", "eq", handover.id)
    .maybeSingle();

  if ((existingDoc as { id?: string } | null)?.id) {
    return; // PV déjà généré
  }

  // Récupérer les infos du bail
  const { data: lease } = await serviceClient
    .from("leases")
    .select(`
      id,
      type_bail,
      date_debut,
      property_id,
      properties!leases_property_id_fkey(
        id,
        adresse_complete,
        owner_id
      )
    `)
    .eq("id", leaseId)
    .single();

  if (!lease) {
    throw new Error("Bail introuvable");
  }

  // Récupérer les profils
  const [ownerProfile, tenantProfile] = await Promise.all([
    serviceClient
      .from("profiles")
      .select("id, prenom, nom")
      .eq("id", handover.owner_profile_id)
      .single(),
    serviceClient
      .from("profiles")
      .select("id, prenom, nom")
      .eq("id", handover.tenant_profile_id)
      .single(),
  ]);

  const ownerName = `${ownerProfile.data?.prenom || ""} ${ownerProfile.data?.nom || ""}`.trim() || "Propriétaire";
  const tenantName = `${tenantProfile.data?.prenom || ""} ${tenantProfile.data?.nom || ""}`.trim() || "Locataire";

  // Chercher la signature du proprio (si elle existe)
  const { data: ownerHandoverSig } = await (serviceClient.from("key_handovers") as any)
    .select("owner_signature_path")
    .eq("id", handover.id)
    .maybeSingle();

  const pdfData: KeyHandoverPDFData = {
    leaseId,
    handoverId: handover.id,
    propertyAddress: (lease as any).properties?.adresse_complete || "Adresse non renseignée",
    leaseType: LEASE_TYPE_LABELS[(lease as any).type_bail] || (lease as any).type_bail || "Non spécifié",
    leaseStartDate: (lease as any).date_debut,
    ownerName,
    tenantName,
    keys: Array.isArray(handover.keys_list) ? handover.keys_list : [],
    confirmedAt: handover.confirmed_at,
    ownerSignaturePath: (ownerHandoverSig as any)?.owner_signature_path || null,
    tenantSignaturePath: handover.tenant_signature_path || null,
  };

  const pdfBytes = await buildKeyHandoverPDF(pdfData);
  const storagePath = `documents/remise-cles/${leaseId}/pv-remise-cles.pdf`;
  const sha256 = await computeSHA256(pdfBytes);

  const { error: uploadError } = await serviceClient.storage
    .from("documents")
    .upload(storagePath, Buffer.from(pdfBytes), {
      contentType: "application/pdf",
      upsert: true,
      cacheControl: "31536000",
    });

  if (uploadError) {
    throw new Error(uploadError.message || "Erreur lors du stockage du PV de remise des clés");
  }

  await serviceClient.from("documents").insert({
    type: "pv_remise_cles",
    category: "bail",
    title: "Procès-verbal de remise des clés",
    original_filename: "pv-remise-cles.pdf",
    storage_path: storagePath,
    sha256,
    lease_id: leaseId,
    property_id: handover.property_id || (lease as any).property_id,
    owner_id: handover.owner_profile_id,
    tenant_id: handover.tenant_profile_id,
    is_generated: true,
    visible_tenant: true,
    is_archived: false,
    status: "valid",
    metadata: {
      handover_id: handover.id,
      confirmed_at: handover.confirmed_at,
      keys_count: Array.isArray(handover.keys_list) ? handover.keys_list.length : 0,
      final: true,
    },
  });
}

async function computeSHA256(data: Uint8Array): Promise<string> {
  const { createHash } = await import("crypto");
  return createHash("sha256").update(data).digest("hex");
}

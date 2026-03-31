/**
 * Générateur PDF de contrat de bail signé
 *
 * Génère un PDF conforme avec pdf-lib, l'uploade dans Supabase Storage
 * et crée l'entrée dans la table documents.
 */

import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { getServiceClient } from "@/lib/supabase/service-client";
import { TYPE_TO_LABEL } from "@/lib/documents/constants";

// ============================================
// TYPES
// ============================================

interface GeneratedDocument {
  id: string;
  storage_path: string;
  type: string;
  title: string;
}

interface LeaseDataForPDF {
  id: string;
  type_bail: string;
  date_debut: string;
  date_fin?: string | null;
  loyer: number;
  charges: number;
  depot_garantie: number;
  statut: string;
  sealed_at?: string | null;
  property_id: string;
}

interface PropertyDataForPDF {
  id: string;
  adresse_complete: string;
  ville: string;
  code_postal: string;
  surface?: number | null;
  surface_habitable_m2?: number | null;
  nb_pieces?: number | null;
  type_bien?: string | null;
  owner_id: string;
}

interface ProfileForPDF {
  id: string;
  prenom: string;
  nom: string;
  email?: string | null;
  adresse?: string | null;
  telephone?: string | null;
  type?: string | null;
  raison_sociale?: string | null;
  siret?: string | null;
}

interface SignerForPDF {
  role: string;
  signature_status: string;
  signed_at?: string | null;
  profile?: ProfileForPDF | null;
}

// ============================================
// HELPERS
// ============================================

const TYPE_BAIL_LABELS: Record<string, string> = {
  nu: "Bail d'habitation non meublé",
  meuble: "Bail d'habitation meublé",
  colocation: "Bail de colocation",
  saisonnier: "Bail saisonnier",
  mobilite: "Bail mobilité",
  etudiant: "Bail étudiant",
  commercial: "Bail commercial",
  professionnel: "Bail professionnel",
  parking: "Bail de parking / garage",
};

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

function formatCurrency(value: number): string {
  return value.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function safeDateFormat(value: string | null | undefined, pattern = "d MMMM yyyy"): string {
  if (!value) return "Non renseignée";
  try {
    return format(new Date(value), pattern, { locale: fr });
  } catch {
    return "Date invalide";
  }
}

// ============================================
// MAIN FUNCTION
// ============================================

/**
 * Génère un PDF de contrat de bail signé et l'uploade dans Supabase Storage.
 * Crée l'entrée document correspondante.
 */
export async function generateSignedLeasePDF(
  leaseId: string
): Promise<GeneratedDocument> {
  const serviceClient = getServiceClient();

  // 1. Récupérer les données complètes
  const { data: lease, error: leaseError } = await serviceClient
    .from("leases")
    .select(
      `
      id, type_bail, date_debut, date_fin, loyer, charges,
      depot_garantie, statut, sealed_at, property_id,
      property:properties!leases_property_id_fkey(
        id, adresse_complete, ville, code_postal,
        surface, surface_habitable_m2, nb_pieces, type_bien, owner_id
      ),
      signers:lease_signers(
        role, signature_status, signed_at,
        profile:profiles(id, prenom, nom, email, adresse, telephone, type, raison_sociale, siret)
      )
    `
    )
    .eq("id", leaseId)
    .single();

  if (leaseError || !lease) {
    throw new Error(`Bail non trouvé : ${leaseError?.message ?? "introuvable"}`);
  }

  const leaseData = lease as unknown as LeaseDataForPDF & {
    property: PropertyDataForPDF;
    signers: SignerForPDF[];
  };
  const property = leaseData.property;
  const signers = leaseData.signers || [];

  // Résoudre proprio et locataire
  const ownerSigner = signers.find(
    (s) =>
      s.role === "proprietaire" || s.role === "owner" || s.role === "bailleur"
  );
  const tenantSigner = signers.find(
    (s) =>
      s.role === "locataire_principal" ||
      s.role === "locataire" ||
      s.role === "tenant" ||
      s.role === "principal"
  );

  const ownerProfile: ProfileForPDF = ownerSigner?.profile || {
    id: property.owner_id,
    prenom: "",
    nom: "Propriétaire",
  };
  const tenantProfile: ProfileForPDF = tenantSigner?.profile || {
    id: "",
    prenom: "",
    nom: "Locataire",
  };

  // 2. Générer le PDF
  const pdfBytes = await buildLeasePDF(leaseData, property, ownerProfile, tenantProfile, signers);

  // 3. Upload dans Supabase Storage
  const storagePath = `documents/bails/${leaseId}/contrat_signe.pdf`;

  const { error: uploadError } = await serviceClient.storage
    .from("documents")
    .upload(storagePath, pdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Erreur upload PDF : ${uploadError.message}`);
  }

  // 4. INSERT dans la table documents
  const title = `Contrat de bail signé — ${TYPE_BAIL_LABELS[leaseData.type_bail] || leaseData.type_bail}`;

  const { data: doc, error: docError } = await serviceClient
    .from("documents")
    .insert({
      type: "bail" as any,
      lease_id: leaseId,
      property_id: property.id,
      owner_id: property.owner_id,
      storage_path: storagePath,
      title,
      original_filename: `contrat_signe_${leaseId.substring(0, 8)}.pdf`,
      mime_type: "application/pdf",
      file_size: pdfBytes.length,
      visible_tenant: true,
      is_generated: true,
      metadata: {
        generated_at: new Date().toISOString(),
        type_bail: leaseData.type_bail,
        sealed_at: leaseData.sealed_at,
        generator: "lease-pdf-generator",
      },
    })
    .select("id")
    .single();

  if (docError) {
    throw new Error(`Erreur création document : ${docError.message}`);
  }

  return {
    id: doc.id,
    storage_path: storagePath,
    type: "bail",
    title,
  };
}

// ============================================
// PDF BUILDER
// ============================================

async function buildLeasePDF(
  lease: LeaseDataForPDF,
  property: PropertyDataForPDF,
  owner: ProfileForPDF,
  tenant: ProfileForPDF,
  signers: SignerForPDF[]
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const primaryColor = rgb(0.145, 0.388, 0.922); // #2563eb
  const textColor = rgb(0.067, 0.067, 0.067);
  const grayColor = rgb(0.42, 0.45, 0.5);

  const margin = 50;
  const pageWidth = 595.28; // A4
  const pageHeight = 841.89;
  const maxTextWidth = pageWidth - 2 * margin;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;
  let pageNum = 1;

  function ensureSpace(needed: number) {
    if (y - needed < margin + 40) {
      drawFooter(page, pageNum, helvetica, grayColor, margin, pageWidth, lease.id);
      pageNum++;
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
  }

  function drawSection(title: string) {
    ensureSpace(40);
    y -= 25;
    page.drawLine({
      start: { x: margin, y },
      end: { x: pageWidth - margin, y },
      thickness: 0.5,
      color: rgb(0.9, 0.9, 0.9),
    });
    y -= 20;
    page.drawText(title, {
      x: margin,
      y,
      size: 13,
      font: helveticaBold,
      color: primaryColor,
    });
    y -= 20;
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

  function drawParagraph(text: string, fontSize = 10) {
    const lines = splitTextIntoLines(text, helvetica, fontSize, maxTextWidth);
    for (const line of lines) {
      ensureSpace(16);
      page.drawText(line, {
        x: margin,
        y,
        size: fontSize,
        font: helvetica,
        color: textColor,
      });
      y -= 16;
    }
  }

  // ======== EN-TÊTE ========
  // Logo text
  page.drawText("TALOK", {
    x: margin,
    y,
    size: 20,
    font: helveticaBold,
    color: primaryColor,
  });

  const typeBailLabel = TYPE_BAIL_LABELS[lease.type_bail] || "Contrat de bail";
  const labelWidth = helveticaBold.widthOfTextAtSize(typeBailLabel, 11);
  page.drawText(typeBailLabel, {
    x: pageWidth - margin - labelWidth,
    y,
    size: 11,
    font: helveticaBold,
    color: textColor,
  });

  y -= 30;
  page.drawText("CONTRAT DE BAIL", {
    x: margin,
    y,
    size: 22,
    font: helveticaBold,
    color: textColor,
  });

  y -= 20;
  const refText = `Réf. ${lease.id.substring(0, 8).toUpperCase()}`;
  page.drawText(refText, {
    x: margin,
    y,
    size: 10,
    font: helvetica,
    color: grayColor,
  });

  // ======== PARTIES ========
  drawSection("PARTIES AU CONTRAT");

  // Bailleur
  y -= 5;
  page.drawText("LE BAILLEUR", {
    x: margin,
    y,
    size: 10,
    font: helveticaBold,
    color: grayColor,
  });
  y -= 18;

  const ownerName =
    owner.raison_sociale ||
    `${owner.prenom || ""} ${owner.nom || ""}`.trim() ||
    "Propriétaire";
  page.drawText(ownerName, {
    x: margin,
    y,
    size: 12,
    font: helveticaBold,
    color: textColor,
  });
  y -= 16;

  if (owner.adresse) {
    page.drawText(owner.adresse, {
      x: margin,
      y,
      size: 10,
      font: helvetica,
      color: textColor,
    });
    y -= 16;
  }
  if (owner.email) {
    page.drawText(owner.email, {
      x: margin,
      y,
      size: 10,
      font: helvetica,
      color: grayColor,
    });
    y -= 16;
  }
  if (owner.siret) {
    page.drawText(`SIRET : ${owner.siret}`, {
      x: margin,
      y,
      size: 10,
      font: helvetica,
      color: grayColor,
    });
    y -= 16;
  }

  // Locataire
  y -= 10;
  page.drawText("LE LOCATAIRE", {
    x: margin,
    y,
    size: 10,
    font: helveticaBold,
    color: grayColor,
  });
  y -= 18;

  const tenantName =
    `${tenant.prenom || ""} ${tenant.nom || ""}`.trim() || "Locataire";
  page.drawText(tenantName, {
    x: margin,
    y,
    size: 12,
    font: helveticaBold,
    color: textColor,
  });
  y -= 16;

  if (tenant.email) {
    page.drawText(tenant.email, {
      x: margin,
      y,
      size: 10,
      font: helvetica,
      color: grayColor,
    });
    y -= 16;
  }

  // ======== LOGEMENT ========
  drawSection("DÉSIGNATION DU LOGEMENT");

  drawKeyValue("Adresse", property.adresse_complete);
  drawKeyValue("Ville", `${property.code_postal} ${property.ville}`);

  const surface = property.surface_habitable_m2 || property.surface;
  if (surface && surface > 0) {
    drawKeyValue("Surface habitable", `${surface} m²`);
  }
  if (property.nb_pieces && property.nb_pieces > 0) {
    drawKeyValue("Nombre de pièces", `${property.nb_pieces}`);
  }
  if (property.type_bien) {
    drawKeyValue("Type de bien", property.type_bien);
  }

  // ======== CONDITIONS FINANCIÈRES ========
  drawSection("CONDITIONS FINANCIÈRES");

  drawKeyValue("Loyer mensuel (HC)", `${formatCurrency(lease.loyer)} €`);
  drawKeyValue("Charges mensuelles", `${formatCurrency(lease.charges)} €`);
  drawKeyValue(
    "Total mensuel",
    `${formatCurrency(lease.loyer + lease.charges)} €`
  );
  drawKeyValue("Dépôt de garantie", `${formatCurrency(lease.depot_garantie)} €`);

  // ======== DURÉE DU BAIL ========
  drawSection("DURÉE DU BAIL");

  drawKeyValue("Date de début", safeDateFormat(lease.date_debut));
  if (lease.date_fin) {
    drawKeyValue("Date de fin", safeDateFormat(lease.date_fin));
  }

  // ======== CLAUSES STANDARD ========
  drawSection("CLAUSES ET CONDITIONS");

  const clauses = [
    "Le loyer est payable mensuellement, d'avance, avant le 5 de chaque mois, par tout moyen de paiement accepté par le bailleur.",
    "Le locataire s'engage à jouir paisiblement des locaux et à les maintenir en bon état d'entretien courant.",
    "Le locataire s'engage à souscrire une assurance habitation couvrant les risques locatifs (incendie, dégât des eaux, responsabilité civile).",
    "Toute transformation des locaux nécessite l'accord écrit préalable du bailleur. Les améliorations réalisées resteront acquises sans indemnité.",
    "Le bail est soumis aux dispositions de la loi n°89-462 du 6 juillet 1989 modifiée par la loi ALUR du 24 mars 2014 et la loi ELAN du 23 novembre 2018.",
    "Le congé doit être délivré par lettre recommandée avec accusé de réception, acte d'huissier ou remise en main propre contre récépissé.",
  ];

  for (const clause of clauses) {
    ensureSpace(50);
    drawParagraph(`• ${clause}`);
    y -= 6;
  }

  // ======== CACHET SIGNATURE ========
  drawSection("SIGNATURES ÉLECTRONIQUES");

  const signedSigners = signers.filter((s) => s.signature_status === "signed");
  if (signedSigners.length > 0) {
    ensureSpace(60);
    // Fond gris
    page.drawRectangle({
      x: margin,
      y: y - 50,
      width: maxTextWidth,
      height: 60,
      color: rgb(0.97, 0.97, 0.97),
      borderColor: rgb(0.88, 0.88, 0.88),
      borderWidth: 0.5,
    });

    y -= 15;
    page.drawText("Document signé électroniquement", {
      x: margin + 15,
      y,
      size: 11,
      font: helveticaBold,
      color: rgb(0.02, 0.59, 0.41), // emerald-600
    });

    for (const signer of signedSigners) {
      y -= 16;
      ensureSpace(20);
      const name =
        `${signer.profile?.prenom || ""} ${signer.profile?.nom || ""}`.trim() ||
        signer.role;
      const dateStr = signer.signed_at
        ? safeDateFormat(signer.signed_at, "d MMMM yyyy 'à' HH:mm")
        : "";
      page.drawText(`${name} (${signer.role}) — signé le ${dateStr}`, {
        x: margin + 15,
        y,
        size: 9,
        font: helvetica,
        color: textColor,
      });
    }
    y -= 20;
  } else {
    drawParagraph("En attente de signature des parties.");
  }

  // Footer dernière page
  drawFooter(page, pageNum, helvetica, grayColor, margin, pageWidth, lease.id);

  // Metadata PDF
  pdfDoc.setTitle(`Contrat de bail — ${lease.id.substring(0, 8).toUpperCase()}`);
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
  leaseId: string
) {
  const footerY = 30;

  page.drawLine({
    start: { x: margin, y: footerY + 10 },
    end: { x: pageWidth - margin, y: footerY + 10 },
    thickness: 0.5,
    color: rgb(0.9, 0.9, 0.9),
  });

  page.drawText(`Bail ${leaseId.substring(0, 8).toUpperCase()}`, {
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

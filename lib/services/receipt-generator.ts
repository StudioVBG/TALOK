/**
 * Service de génération de quittances de loyer en PDF
 * 
 * Utilise pdf-lib pour générer des PDFs professionnels
 */

import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

/**
 * Interface de données pour génération de quittance
 * Conforme à la loi ALUR et au Décret n°2015-587
 *
 * @see Art. 21 loi n°89-462 du 6 juillet 1989
 * @see Décret n°2015-587 du 6 mai 2015
 */
export interface ReceiptData {
  // === Informations propriétaire (OBLIGATOIRES ALUR) ===
  /** Nom complet du bailleur (personne physique ou morale) */
  ownerName: string;
  /** Adresse de correspondance du bailleur - OBLIGATOIRE ALUR */
  ownerAddress: string;
  /** SIRET si personne morale */
  ownerSiret?: string;

  // === Informations locataire (OBLIGATOIRES) ===
  /** Nom complet du locataire */
  tenantName: string;
  /** Adresse de correspondance si différente du logement */
  tenantAddress?: string;

  // === Informations logement (OBLIGATOIRES) ===
  /** Adresse complète du logement loué */
  propertyAddress: string;
  /** Ville du logement */
  propertyCity: string;
  /** Code postal (France métropolitaine + DOM-TOM) */
  propertyPostalCode: string;

  // === Période de location (OBLIGATOIRE ALUR - détaillée) ===
  /**
   * Période au format "YYYY-MM" (rétrocompatibilité)
   * @deprecated Utiliser periodeDebut et periodeFin pour conformité ALUR
   */
  period: string;
  /** Date de début de la période (YYYY-MM-DD) - NOUVEAU ALUR */
  periodeDebut?: string;
  /** Date de fin de la période (YYYY-MM-DD) - NOUVEAU ALUR */
  periodeFin?: string;

  // === Montants détaillés (OBLIGATOIRE ALUR) ===
  /**
   * Montant du loyer principal (hors charges)
   * ALUR impose la distinction loyer nu / charges
   */
  rentAmount: number;
  /** Alias pour rétrocompatibilité */
  loyerPrincipal?: number;

  /**
   * Montant des charges (provision ou forfait)
   * ALUR impose l'affichage séparé
   */
  chargesAmount: number;
  /** Alias pour rétrocompatibilité */
  provisionCharges?: number;

  /**
   * Régularisation annuelle des charges (si applicable)
   * Peut être positif (complément) ou négatif (trop-perçu)
   */
  regularisationCharges?: number;

  /** Montant total (loyer + charges + régularisation) */
  totalAmount: number;

  // === Informations paiement ===
  /** Date du paiement effectif (YYYY-MM-DD) */
  paymentDate: string;
  /** Moyen de paiement utilisé */
  paymentMethod: string;

  // === Références documentaires ===
  /**
   * Numéro unique de quittance
   * Format recommandé: Q-{owner_short}-YYYY-NNNN
   */
  numeroQuittance?: string;
  /** ID facture Talok */
  invoiceId: string;
  /** ID paiement Talok */
  paymentId: string;
  /** ID bail Talok */
  leaseId: string;

  // === Métadonnées ===
  /** Date d'émission de la quittance (YYYY-MM-DD) */
  dateEmission?: string;
}

/**
 * Génère un PDF de quittance de loyer conforme ALUR
 * @see Art. 21 loi n°89-462 du 6 juillet 1989
 * @see Décret n°2015-587 du 6 mai 2015
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

  // Utiliser les champs ALUR si disponibles, sinon fallback
  const loyerPrincipal = data.loyerPrincipal ?? data.rentAmount;
  const provisionCharges = data.provisionCharges ?? data.chargesAmount;
  const regularisation = data.regularisationCharges ?? 0;

  // === HEADER ===
  // Titre
  page.drawText("QUITTANCE DE LOYER", {
    x: margin,
    y: y,
    size: 24,
    font: helveticaBold,
    color: primaryColor,
  });

  // Numéro de quittance (aligné à droite)
  const refText = data.numeroQuittance
    ? `N° ${data.numeroQuittance}`
    : `Réf: ${data.paymentId.slice(0, 8).toUpperCase()}`;
  const refWidth = helvetica.widthOfTextAtSize(refText, 10);
  page.drawText(refText, {
    x: width - margin - refWidth,
    y: height - margin,
    size: 10,
    font: helveticaBold,
    color: textColor,
  });

  // Période détaillée (ALUR)
  y -= 35;
  const periodFormatted = formatPeriodALUR(data);
  page.drawText(periodFormatted, {
    x: margin,
    y: y,
    size: 14,
    font: helvetica,
    color: textColor,
  });

  // Date d'émission
  if (data.dateEmission) {
    const emissionText = `Émise le ${format(new Date(data.dateEmission), "d MMMM yyyy", { locale: fr })}`;
    const emissionWidth = helvetica.widthOfTextAtSize(emissionText, 9);
    page.drawText(emissionText, {
      x: width - margin - emissionWidth,
      y: y,
      size: 9,
      font: helvetica,
      color: grayColor,
    });
  }

  // Ligne de séparation
  y -= 20;
  page.drawLine({
    start: { x: margin, y: y },
    end: { x: width - margin, y: y },
    thickness: 1,
    color: rgb(0.9, 0.9, 0.9),
  });

  // === SECTION PROPRIÉTAIRE (BAILLEUR) - OBLIGATOIRE ALUR ===
  y -= 40;
  page.drawText("BAILLEUR", {
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

  // Adresse bailleur - OBLIGATOIRE ALUR
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

  // === SECTION LOGEMENT LOUÉ ===
  y -= 35;
  page.drawText("LOGEMENT LOUÉ", {
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

  // === TABLEAU DES MONTANTS - CONFORME ALUR ===
  y -= 45;

  // Calcul hauteur tableau selon régularisation
  const hasRegularisation = regularisation !== 0;
  const tableHeight = hasRegularisation ? 120 : 100;

  // Fond du tableau
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

  // Ligne de séparation header
  page.drawLine({
    start: { x: margin + 10, y: y - 35 },
    end: { x: width - margin - 10, y: y - 35 },
    thickness: 0.5,
    color: rgb(0.9, 0.9, 0.9),
  });

  // Loyer principal (nu) - OBLIGATOIRE ALUR
  page.drawText("Loyer principal (hors charges)", {
    x: margin + 15,
    y: y - 55,
    size: 11,
    font: helvetica,
    color: textColor,
  });

  page.drawText(`${loyerPrincipal.toFixed(2)} €`, {
    x: margin + colWidth + 15,
    y: y - 55,
    size: 11,
    font: helvetica,
    color: textColor,
  });

  // Provision/forfait charges - OBLIGATOIRE ALUR
  page.drawText("Provision pour charges", {
    x: margin + 15,
    y: y - 75,
    size: 11,
    font: helvetica,
    color: textColor,
  });

  page.drawText(`${provisionCharges.toFixed(2)} €`, {
    x: margin + colWidth + 15,
    y: y - 75,
    size: 11,
    font: helvetica,
    color: textColor,
  });

  let totalLineY = y - 85;

  // Régularisation (si applicable)
  if (hasRegularisation) {
    const regLabel = regularisation > 0
      ? "Régularisation charges (complément)"
      : "Régularisation charges (trop-perçu)";
    page.drawText(regLabel, {
      x: margin + 15,
      y: y - 95,
      size: 11,
      font: helvetica,
      color: regularisation < 0 ? rgb(0.13, 0.55, 0.13) : textColor,
    });

    page.drawText(`${regularisation > 0 ? "+" : ""}${regularisation.toFixed(2)} €`, {
      x: margin + colWidth + 15,
      y: y - 95,
      size: 11,
      font: helvetica,
      color: regularisation < 0 ? rgb(0.13, 0.55, 0.13) : textColor,
    });

    totalLineY = y - 105;
  }

  // Ligne de séparation total
  page.drawLine({
    start: { x: margin + 10, y: totalLineY },
    end: { x: width - margin - 10, y: totalLineY },
    thickness: 0.5,
    color: rgb(0.9, 0.9, 0.9),
  });

  // Total
  page.drawText("TOTAL ACQUITTÉ", {
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

  // === ATTESTATION DE PAIEMENT ===
  y -= tableHeight + 40;

  const paymentDateFormatted = format(new Date(data.paymentDate), "d MMMM yyyy", { locale: fr });
  const paymentMethodFormatted = formatPaymentMethod(data.paymentMethod);

  // Texte d'attestation ALUR compliant
  const attestationText = `Je soussigné(e) ${data.ownerName}, bailleur du logement désigné ci-dessus, déclare avoir reçu de ${data.tenantName} la somme de ${data.totalAmount.toFixed(2)} euros (dont ${loyerPrincipal.toFixed(2)} € de loyer et ${provisionCharges.toFixed(2)} € de charges${hasRegularisation ? ` et ${regularisation.toFixed(2)} € de régularisation` : ""}) au titre du paiement pour la période ${periodFormatted}.`;

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

  // === MENTION LÉGALE ALUR ===
  y -= 45;
  const legalText = "Cette quittance annule tous les reçus qui auraient pu être établis précédemment pour la même période. Conformément à l'article 21 de la loi n°89-462 du 6 juillet 1989 modifiée par la loi ALUR du 24 mars 2014, le bailleur est tenu de transmettre gratuitement une quittance au locataire qui en fait la demande.";

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
  y -= 25;
  page.drawText("Le bailleur,", {
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

  // Référence unique
  const refFooter = `Réf: ${data.invoiceId.slice(0, 8)}`;
  page.drawText(refFooter, {
    x: margin,
    y: footerY - 12,
    size: 7,
    font: helvetica,
    color: grayColor,
  });

  page.drawText("Talok - Gestion locative", {
    x: width - margin - 100,
    y: footerY,
    size: 8,
    font: helveticaBold,
    color: primaryColor,
  });

  // Générer le PDF
  return await pdfDoc.save();
}

/**
 * Formate la période en texte lisible (legacy)
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
 * Formate la période conforme ALUR avec dates exactes
 * @example "du 1er janvier au 31 janvier 2024"
 */
function formatPeriodALUR(data: ReceiptData): string {
  try {
    // Si dates ALUR disponibles
    if (data.periodeDebut && data.periodeFin) {
      const debut = new Date(data.periodeDebut);
      const fin = new Date(data.periodeFin);
      const debutStr = format(debut, "d MMMM", { locale: fr });
      const finStr = format(fin, "d MMMM yyyy", { locale: fr });
      return `Période du ${debutStr} au ${finStr}`;
    }

    // Fallback sur période YYYY-MM
    if (data.period) {
      const [year, month] = data.period.split("-");
      const yearNum = parseInt(year);
      const monthNum = parseInt(month) - 1;

      // Calculer premier et dernier jour du mois
      const debut = new Date(yearNum, monthNum, 1);
      const fin = new Date(yearNum, monthNum + 1, 0); // Dernier jour du mois

      const debutStr = format(debut, "d", { locale: fr });
      const finStr = format(fin, "d MMMM yyyy", { locale: fr });
      return `Période du ${debutStr} au ${finStr}`;
    }

    return "Période non spécifiée";
  } catch {
    return data.period || "Période non spécifiée";
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

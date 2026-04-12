export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/payments/cash-receipt/[id]/pdf
 *
 * Génère l'attestation PDF de paiement en espèces avec les deux signatures.
 * Accessible au propriétaire, au locataire, ou à un admin — uniquement si
 * le reçu est dans un statut où les 2 signatures sont présentes.
 *
 * @see Art. 21 loi n°89-462 du 6 juillet 1989
 * @see Décret n°2015-587 du 6 mai 2015
 */

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";
import { PDFDocument, PDFImage, StandardFonts, rgb } from "pdf-lib";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

function sanitizeText(input: string | null | undefined): string {
  // pdf-lib/WinAnsi ne supporte pas tous les caractères unicode (emoji, etc.)
  // On strip les non-printables et on garde les caractères latin-1.
  if (!input) return "";
  return input
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/[\uD800-\uDFFF]/g, "")
    .trim();
}

function formatCurrency(amount: number | string | null): string {
  const n = typeof amount === "string" ? parseFloat(amount) : amount ?? 0;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(n);
}

function formatFrenchDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return format(d, "dd/MM/yyyy 'à' HH:mm", { locale: fr });
}

/**
 * Embed une signature base64 (data URL PNG) dans un PDFDocument.
 * Retourne null si la signature est absente ou invalide.
 */
async function embedSignature(
  pdfDoc: PDFDocument,
  dataUrl: string | null
): Promise<{ image: PDFImage; width: number; height: number } | null> {
  if (!dataUrl || !dataUrl.startsWith("data:image/")) return null;
  try {
    const base64 = dataUrl.split(",")[1];
    if (!base64) return null;
    const bytes = Buffer.from(base64, "base64");
    const img = await pdfDoc.embedPng(bytes);
    // Dimensions max à respecter dans le PDF
    const maxW = 180;
    const maxH = 60;
    const ratio = Math.min(maxW / img.width, maxH / img.height, 1);
    return {
      image: img,
      width: img.width * ratio,
      height: img.height * ratio,
    };
  } catch {
    return null;
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: receiptId } = await params;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const serviceClient = getServiceClient();

    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // Charger le reçu avec toutes les données liées
    const { data: receipt, error: receiptError } = await serviceClient
      .from("cash_receipts")
      .select(
        `
        id,
        receipt_number,
        status,
        amount,
        amount_words,
        periode,
        owner_id,
        tenant_id,
        owner_signature,
        tenant_signature,
        owner_signed_at,
        tenant_signed_at,
        latitude,
        longitude,
        tenant_signature_latitude,
        tenant_signature_longitude,
        notes,
        document_hash,
        created_at,
        owner:profiles!cash_receipts_owner_id_fkey(id, prenom, nom),
        tenant:profiles!cash_receipts_tenant_id_fkey(id, prenom, nom),
        property:properties(id, adresse_complete, ville, code_postal),
        invoice:invoices(id, periode, montant_total, date_emission)
      `
      )
      .eq("id", receiptId)
      .single();

    if (receiptError || !receipt) {
      return NextResponse.json({ error: "Reçu non trouvé" }, { status: 404 });
    }

    const r = receipt as any;

    // Autorisation : propriétaire, locataire concernés ou admin
    const isOwner = r.owner_id === profile.id;
    const isTenant = r.tenant_id === profile.id;
    const isAdmin = profile.role === "admin" || profile.role === "platform_admin";

    if (!isOwner && !isTenant && !isAdmin) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // L'attestation n'est téléchargeable que lorsque les DEUX parties ont signé
    if (r.status !== "signed" && r.status !== "sent" && r.status !== "archived") {
      return NextResponse.json(
        {
          error:
            "L'attestation n'est disponible qu'une fois les deux signatures apposées.",
          code: "BOTH_SIGNATURES_REQUIRED",
        },
        { status: 409 }
      );
    }

    if (!r.owner_signature || !r.tenant_signature) {
      return NextResponse.json(
        {
          error: "Signatures manquantes — le reçu n'est pas complet.",
          code: "INCOMPLETE_SIGNATURES",
        },
        { status: 409 }
      );
    }

    // Préparer les valeurs à afficher
    const ownerName =
      sanitizeText(`${r.owner?.prenom ?? ""} ${r.owner?.nom ?? ""}`.trim()) ||
      "Propriétaire";
    const tenantName =
      sanitizeText(`${r.tenant?.prenom ?? ""} ${r.tenant?.nom ?? ""}`.trim()) ||
      "Locataire";
    const propertyAddress = sanitizeText(r.property?.adresse_complete) || "—";
    const propertyCity = sanitizeText(r.property?.ville) || "";
    const propertyPostal = sanitizeText(r.property?.code_postal) || "";
    const propertyFullAddress = [propertyAddress, `${propertyPostal} ${propertyCity}`.trim()]
      .filter(Boolean)
      .join(", ");
    const periode = sanitizeText(r.periode) || sanitizeText(r.invoice?.periode) || "—";
    const amount = formatCurrency(r.amount);
    const amountWords = sanitizeText(r.amount_words) || "";
    const receiptNumber = sanitizeText(r.receipt_number) || receiptId.slice(0, 8);
    const ownerSignedAt = formatFrenchDateTime(r.owner_signed_at);
    const tenantSignedAt = formatFrenchDateTime(r.tenant_signed_at);
    const notes = sanitizeText(r.notes);
    const documentHash = sanitizeText(r.document_hash);

    // Construction du PDF
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

    const page = pdfDoc.addPage([595, 842]); // A4 portrait
    const { width, height } = page.getSize();
    const margin = 50;
    let y = height - margin;

    const navy = rgb(0.12, 0.18, 0.32);
    const blue = rgb(0.145, 0.388, 0.921); // #2563EB
    const gray = rgb(0.4, 0.42, 0.48);
    const light = rgb(0.93, 0.95, 0.98);
    const border = rgb(0.85, 0.87, 0.92);

    // === HEADER ===
    page.drawRectangle({
      x: 0,
      y: height - 90,
      width,
      height: 90,
      color: light,
    });

    page.drawText("TALOK", {
      x: margin,
      y: height - 55,
      size: 22,
      font: fontBold,
      color: blue,
    });

    page.drawText("Plateforme de gestion locative", {
      x: margin,
      y: height - 75,
      size: 9,
      font,
      color: gray,
    });

    page.drawText(`Reçu N° ${receiptNumber}`, {
      x: width - margin - 160,
      y: height - 55,
      size: 10,
      font,
      color: gray,
    });
    page.drawText(format(new Date(), "dd/MM/yyyy"), {
      x: width - margin - 160,
      y: height - 70,
      size: 10,
      font,
      color: gray,
    });

    y = height - 130;

    // === TITRE ===
    const title = "ATTESTATION DE PAIEMENT EN ESPÈCES";
    const titleWidth = fontBold.widthOfTextAtSize(title, 16);
    page.drawText(title, {
      x: (width - titleWidth) / 2,
      y,
      size: 16,
      font: fontBold,
      color: navy,
    });
    y -= 30;

    // === BANDEAU MONTANT ===
    page.drawRectangle({
      x: margin,
      y: y - 50,
      width: width - 2 * margin,
      height: 50,
      color: rgb(0.92, 0.95, 1),
      borderColor: blue,
      borderWidth: 1.5,
    });
    const amountText = `Montant : ${amount}`;
    const amountWidth = fontBold.widthOfTextAtSize(amountText, 18);
    page.drawText(amountText, {
      x: (width - amountWidth) / 2,
      y: y - 25,
      size: 18,
      font: fontBold,
      color: blue,
    });
    if (amountWords) {
      const wordsTrunc =
        amountWords.length > 70 ? amountWords.slice(0, 67) + "..." : amountWords;
      const wordsWidth = fontItalic.widthOfTextAtSize(wordsTrunc, 9);
      page.drawText(`(${wordsTrunc})`, {
        x: (width - wordsWidth) / 2,
        y: y - 42,
        size: 9,
        font: fontItalic,
        color: gray,
      });
    }
    y -= 80;

    // === BLOC PARTIES ===
    const drawLabelValue = (
      label: string,
      value: string,
      labelX: number,
      valueX: number,
      py: number
    ) => {
      page.drawText(label, {
        x: labelX,
        y: py,
        size: 9,
        font,
        color: gray,
      });
      page.drawText(value, {
        x: valueX,
        y: py,
        size: 11,
        font: fontBold,
        color: navy,
      });
    };

    page.drawText("PARTIES CONCERNÉES", {
      x: margin,
      y,
      size: 10,
      font: fontBold,
      color: blue,
    });
    y -= 5;
    page.drawLine({
      start: { x: margin, y },
      end: { x: width - margin, y },
      thickness: 0.5,
      color: border,
    });
    y -= 20;

    drawLabelValue("Propriétaire / Bailleur", ownerName, margin, margin + 130, y);
    y -= 18;
    drawLabelValue("Locataire", tenantName, margin, margin + 130, y);
    y -= 18;
    drawLabelValue("Logement", propertyFullAddress, margin, margin + 130, y);
    y -= 18;
    drawLabelValue("Période concernée", periode, margin, margin + 130, y);
    y -= 30;

    // === BLOC SIGNATURES ===
    page.drawText("SIGNATURES", {
      x: margin,
      y,
      size: 10,
      font: fontBold,
      color: blue,
    });
    y -= 5;
    page.drawLine({
      start: { x: margin, y },
      end: { x: width - margin, y },
      thickness: 0.5,
      color: border,
    });
    y -= 15;

    const signatureBoxHeight = 120;
    const halfWidth = (width - 2 * margin - 20) / 2;

    // Boîte signature propriétaire (gauche)
    page.drawRectangle({
      x: margin,
      y: y - signatureBoxHeight,
      width: halfWidth,
      height: signatureBoxHeight,
      borderColor: border,
      borderWidth: 0.5,
      color: rgb(0.99, 0.99, 1),
    });
    page.drawText("Le propriétaire atteste avoir reçu le paiement", {
      x: margin + 8,
      y: y - 14,
      size: 8,
      font: fontItalic,
      color: gray,
    });
    page.drawText(ownerName, {
      x: margin + 8,
      y: y - 28,
      size: 9,
      font: fontBold,
      color: navy,
    });

    const ownerImg = await embedSignature(pdfDoc, r.owner_signature);
    if (ownerImg) {
      const imgX = margin + (halfWidth - ownerImg.width) / 2;
      const imgY = y - signatureBoxHeight + 25;
      page.drawImage(ownerImg.image, {
        x: imgX,
        y: imgY,
        width: ownerImg.width,
        height: ownerImg.height,
      });
    }
    page.drawText(`Signé le ${ownerSignedAt}`, {
      x: margin + 8,
      y: y - signatureBoxHeight + 10,
      size: 7,
      font,
      color: gray,
    });

    // Boîte signature locataire (droite)
    const rightX = margin + halfWidth + 20;
    page.drawRectangle({
      x: rightX,
      y: y - signatureBoxHeight,
      width: halfWidth,
      height: signatureBoxHeight,
      borderColor: border,
      borderWidth: 0.5,
      color: rgb(0.99, 0.99, 1),
    });
    page.drawText("Le locataire atteste avoir effectué le paiement", {
      x: rightX + 8,
      y: y - 14,
      size: 8,
      font: fontItalic,
      color: gray,
    });
    page.drawText(tenantName, {
      x: rightX + 8,
      y: y - 28,
      size: 9,
      font: fontBold,
      color: navy,
    });

    const tenantImg = await embedSignature(pdfDoc, r.tenant_signature);
    if (tenantImg) {
      const imgX = rightX + (halfWidth - tenantImg.width) / 2;
      const imgY = y - signatureBoxHeight + 25;
      page.drawImage(tenantImg.image, {
        x: imgX,
        y: imgY,
        width: tenantImg.width,
        height: tenantImg.height,
      });
    }
    page.drawText(`Signé le ${tenantSignedAt}`, {
      x: rightX + 8,
      y: y - signatureBoxHeight + 10,
      size: 7,
      font,
      color: gray,
    });

    y -= signatureBoxHeight + 20;

    // === NOTES ===
    if (notes) {
      page.drawText("NOTES", {
        x: margin,
        y,
        size: 9,
        font: fontBold,
        color: blue,
      });
      y -= 14;
      const notesTrunc = notes.length > 300 ? notes.slice(0, 297) + "..." : notes;
      // Simple wrap 90 caractères
      const lines: string[] = [];
      let current = "";
      for (const word of notesTrunc.split(/\s+/)) {
        if ((current + " " + word).trim().length > 90) {
          lines.push(current.trim());
          current = word;
        } else {
          current = (current + " " + word).trim();
        }
      }
      if (current) lines.push(current);
      for (const line of lines.slice(0, 4)) {
        page.drawText(line, {
          x: margin,
          y,
          size: 9,
          font,
          color: gray,
        });
        y -= 12;
      }
      y -= 10;
    }

    // === MENTION LÉGALE ===
    const legalText =
      "Ce document atteste du paiement en espèces du loyer. Il a valeur de reçu. " +
      "Conforme à l'art. 21 de la loi n° 89-462 du 6 juillet 1989 et au décret n° 2015-587 " +
      "du 6 mai 2015. Toute fausse déclaration est passible des sanctions prévues à " +
      "l'article 441-1 du Code pénal.";

    page.drawRectangle({
      x: margin,
      y: 90,
      width: width - 2 * margin,
      height: 60,
      color: light,
      borderColor: border,
      borderWidth: 0.5,
    });
    page.drawText("MENTION LÉGALE", {
      x: margin + 10,
      y: 135,
      size: 8,
      font: fontBold,
      color: blue,
    });

    // Simple wrap légal
    const legalLines: string[] = [];
    let curLegal = "";
    for (const word of legalText.split(/\s+/)) {
      if ((curLegal + " " + word).trim().length > 110) {
        legalLines.push(curLegal.trim());
        curLegal = word;
      } else {
        curLegal = (curLegal + " " + word).trim();
      }
    }
    if (curLegal) legalLines.push(curLegal);

    let legalY = 120;
    for (const line of legalLines.slice(0, 4)) {
      page.drawText(line, {
        x: margin + 10,
        y: legalY,
        size: 7,
        font,
        color: gray,
      });
      legalY -= 9;
    }

    // === FOOTER (hash d'intégrité) ===
    if (documentHash) {
      const hashText = `Hash d'intégrité : ${documentHash.slice(0, 32)}...`;
      page.drawText(hashText, {
        x: margin,
        y: 60,
        size: 7,
        font,
        color: gray,
      });
    }
    page.drawText("Document généré par Talok — talok.fr", {
      x: margin,
      y: 45,
      size: 7,
      font: fontItalic,
      color: gray,
    });

    const pdfBytes = await pdfDoc.save();

    // Persistance fire-and-forget : marquer pdf_generated_at sur le reçu
    void (async () => {
      try {
        await serviceClient
          .from("cash_receipts")
          .update({ pdf_generated_at: new Date().toISOString() })
          .eq("id", receiptId);
      } catch (err) {
        console.warn("[cash-receipt/pdf] pdf_generated_at update failed:", err);
      }
    })();

    const filename = `attestation-paiement-especes-${receiptNumber}.pdf`;
    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: unknown) {
    console.error("[cash-receipt/pdf] Erreur génération:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Erreur serveur",
      },
      { status: 500 }
    );
  }
}

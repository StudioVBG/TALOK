/**
 * Template email : Justificatif analyse par OCR
 *
 * Envoye au proprietaire apres analyse reussie d'un document comptable.
 * Contient le resume (type, montant, fournisseur) et un CTA pour valider.
 */

import { escapeHtml } from "@/lib/utils/escape-html";

export interface OcrAnalyzedEmailData {
  ownerName: string;
  documentType: string;
  montantTtcCents: number;
  supplierName: string;
  suggestedCategory: string;
  confidence: number;
  analysisId: string;
  verifyUrl: string;
}

export function ocrAnalyzedTemplate(data: OcrAnalyzedEmailData) {
  const montantFormatted = (data.montantTtcCents / 100).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const categoryLabel = escapeHtml(data.suggestedCategory || "Non categorise");
  const confidencePercent = Math.round((data.confidence ?? 0) * 100);

  return {
    subject: `Justificatif analyse - ${montantFormatted} EUR - ${data.suggestedCategory || "Non categorise"}`,
    html: `
      <h1>Justificatif analyse</h1>
      <p>Bonjour ${escapeHtml(data.ownerName)},</p>
      <p>Nous avons analyse votre document et voici ce que nous avons detecte :</p>
      <table style="width:100%;border-collapse:collapse;margin:24px 0;">
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:14px;">Type de document</td>
          <td style="padding:12px 0;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:500;color:#111827;font-size:14px;">${escapeHtml(data.documentType)}</td>
        </tr>
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:14px;">Fournisseur</td>
          <td style="padding:12px 0;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:500;color:#111827;font-size:14px;">${escapeHtml(data.supplierName)}</td>
        </tr>
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:14px;">Montant TTC</td>
          <td style="padding:12px 0;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:700;color:#2563eb;font-size:18px;">${montantFormatted} EUR</td>
        </tr>
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:14px;">Categorie suggeree</td>
          <td style="padding:12px 0;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:500;color:#111827;font-size:14px;">${categoryLabel}</td>
        </tr>
        <tr>
          <td style="padding:12px 0;color:#6b7280;font-size:14px;">Confiance</td>
          <td style="padding:12px 0;text-align:right;font-weight:500;color:${confidencePercent >= 80 ? "#10b981" : "#f59e0b"};font-size:14px;">${confidencePercent}%</td>
        </tr>
      </table>
      <p>Verifiez les informations et validez l'ecriture comptable :</p>
      <div style="text-align:center;margin:24px 0;">
        <a href="${data.verifyUrl}" style="display:inline-block;background:linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:16px;">Verifier et valider</a>
      </div>
    `,
  };
}

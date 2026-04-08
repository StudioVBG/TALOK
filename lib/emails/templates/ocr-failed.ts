/**
 * Template email : Document illisible (OCR echoue)
 *
 * Envoye au proprietaire quand l'analyse OCR d'un document echoue.
 * Invite a saisir manuellement les informations comptables.
 */

import { escapeHtml } from "@/lib/utils/escape-html";

export interface OcrFailedEmailData {
  ownerName: string;
  fileName?: string;
  uploadUrl: string;
}

export function ocrFailedTemplate(data: OcrFailedEmailData) {
  const fileInfo = data.fileName
    ? `<p style="color:#6b7280;font-size:14px;">Fichier concerne : <strong>${escapeHtml(data.fileName)}</strong></p>`
    : "";

  return {
    subject: "Document illisible - saisie manuelle necessaire",
    html: `
      <h1>Document illisible</h1>
      <p>Bonjour ${escapeHtml(data.ownerName)},</p>
      <p>Nous n'avons pas pu lire automatiquement votre document. Cela peut arriver lorsque le fichier est de mauvaise qualite, protege ou dans un format non supporte.</p>
      ${fileInfo}
      <div style="background-color:#fef3c7;border-left:4px solid #f59e0b;padding:20px 24px;margin:24px 0;border-radius:0 8px 8px 0;">
        <p style="margin:0;color:#92400e;font-weight:500;">Veuillez saisir les informations manuellement pour completer votre comptabilite.</p>
      </div>
      <div style="text-align:center;margin:24px 0;">
        <a href="${data.uploadUrl}" style="display:inline-block;background:linear-gradient(135deg,#f59e0b 0%,#d97706 100%);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:16px;">Saisir manuellement</a>
      </div>
    `,
  };
}

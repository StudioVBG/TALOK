/**
 * Template email : Justificatifs manquants (hebdomadaire)
 *
 * Envoye chaque semaine au proprietaire pour lui rappeler
 * les ecritures comptables sans justificatif depuis plus de 7 jours.
 */

import { escapeHtml } from "@/lib/utils/escape-html";

export interface MissingReceiptEntry {
  label: string;
  date: string;
  montantTtcCents: number;
}

export interface MissingReceiptsEmailData {
  ownerName: string;
  entries: MissingReceiptEntry[];
  entriesUrl: string;
}

export function missingReceiptsTemplate(data: MissingReceiptsEmailData) {
  const count = data.entries.length;

  const entriesRows = data.entries
    .slice(0, 10) // Limiter a 10 lignes dans l'email
    .map((entry) => {
      const montant = (entry.montantTtcCents / 100).toLocaleString("fr-FR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      return `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#111827;font-size:14px;">${escapeHtml(entry.label)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:14px;">${escapeHtml(entry.date)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:500;color:#111827;font-size:14px;">${montant} EUR</td>
        </tr>`;
    })
    .join("");

  const remainingCount = count > 10 ? count - 10 : 0;
  const remainingNote = remainingCount > 0
    ? `<p style="color:#6b7280;font-size:13px;text-align:center;margin-top:8px;">... et ${remainingCount} autre(s) ecriture(s)</p>`
    : "";

  return {
    subject: `${count} charge${count > 1 ? "s" : ""} sans justificatif`,
    html: `
      <h1>${count} charge${count > 1 ? "s" : ""} sans justificatif</h1>
      <p>Bonjour ${escapeHtml(data.ownerName)},</p>
      <p>Les ecritures suivantes n'ont toujours pas de justificatif rattache depuis plus de 7 jours :</p>
      <table style="width:100%;border-collapse:collapse;margin:24px 0;">
        <thead>
          <tr style="background-color:#f9fafb;">
            <th style="padding:10px 12px;text-align:left;color:#6b7280;font-size:13px;font-weight:500;border-bottom:2px solid #e5e7eb;">Libelle</th>
            <th style="padding:10px 12px;text-align:left;color:#6b7280;font-size:13px;font-weight:500;border-bottom:2px solid #e5e7eb;">Date</th>
            <th style="padding:10px 12px;text-align:right;color:#6b7280;font-size:13px;font-weight:500;border-bottom:2px solid #e5e7eb;">Montant</th>
          </tr>
        </thead>
        <tbody>
          ${entriesRows}
        </tbody>
      </table>
      ${remainingNote}
      <p>Pensez a joindre vos justificatifs pour une comptabilite complete et conforme.</p>
      <div style="text-align:center;margin:24px 0;">
        <a href="${data.entriesUrl}" style="display:inline-block;background:linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:16px;">Voir les ecritures</a>
      </div>
    `,
  };
}

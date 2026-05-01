/**
 * Email : votre facture prestataire est disponible (vue propriétaire).
 *
 * Envoyé automatiquement après paiement intégral du work_order : la facture
 * légalement numérotée (FAC-AAAA-XXXXXX) a été générée à partir du devis
 * accepté, et la pièce jointe PDF est attachée à cet email.
 *
 * Layout bleu Talok (charte owner).
 */

export interface OwnerInvoiceIssuedParams {
  recipientName: string;
  invoiceNumber: string;
  invoiceTitle: string;
  providerName: string;
  propertyAddress?: string | null;
  totalAmountEuros: number;
  workOrderId: string;
  appUrl?: string;
}

function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatEur(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function getAppUrl(override?: string | null): string {
  return override || "https://app.talok.fr";
}

export function ownerInvoiceIssuedEmail(params: OwnerInvoiceIssuedParams): {
  subject: string;
  html: string;
} {
  const subject = `Facture ${params.invoiceNumber} — ${params.providerName}`;
  const detailUrl = `${getAppUrl(params.appUrl)}/owner/work-orders/${params.workOrderId}`;

  const propertyLine = params.propertyAddress
    ? `<p style="margin:0 0 4px 0;"><strong>Bien concerné :</strong> ${escapeHtml(params.propertyAddress)}</p>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;font-family:'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background-color:#F3F4F6;color:#111827;line-height:1.5;">
  <div style="max-width:600px;margin:0 auto;padding:24px 12px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
      <tr>
        <td style="background:linear-gradient(135deg,#2563EB 0%,#1D4ED8 100%);padding:28px 32px;">
          <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;font-family:'Manrope',sans-serif;">
            Facture disponible
          </h1>
          <p style="margin:6px 0 0 0;font-size:13px;color:#E0E7FF;">Espace propriétaire Talok</p>
        </td>
      </tr>
      <tr>
        <td style="padding:32px;">
          <p style="margin:0 0 16px 0;font-size:15px;color:#111827;">Bonjour ${escapeHtml(params.recipientName)},</p>

          <p style="margin:0 0 16px 0;font-size:14px;color:#374151;">
            Suite au paiement intégral de l'intervention,
            <strong>${escapeHtml(params.providerName)}</strong> vous a émis la facture
            <strong>${escapeHtml(params.invoiceNumber)}</strong>.
            Vous la trouverez en pièce jointe et pouvez la consulter à tout moment dans votre espace.
          </p>

          <div style="background:#EFF6FF;border-left:3px solid #2563EB;padding:14px 18px;margin:16px 0;border-radius:6px;">
            <p style="margin:0 0 6px 0;font-size:15px;color:#1E3A8A;font-weight:600;">
              ${escapeHtml(params.invoiceTitle)}
            </p>
            <p style="margin:0 0 4px 0;font-size:13px;color:#374151;">
              <strong>Numéro :</strong> ${escapeHtml(params.invoiceNumber)}
            </p>
            ${propertyLine}
            <p style="margin:0;"><strong>Montant TTC :</strong> ${escapeHtml(formatEur(params.totalAmountEuros))}</p>
          </div>

          <p style="margin:16px 0 8px 0;font-size:13px;color:#6B7280;">
            La facture est automatiquement intégrée à votre comptabilité Talok :
            écriture d'achat (615100/445660) et de paiement (401000/512100) déjà posées.
          </p>

          <div style="text-align:center;margin:24px 0;">
            <a href="${escapeHtml(detailUrl)}"
               style="display:inline-block;background:linear-gradient(135deg,#2563EB 0%,#1D4ED8 100%);color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-family:'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;">
              Voir l'intervention
            </a>
          </div>

          <p style="margin:16px 0 0 0;color:#6B7280;font-size:12px;">
            Conservez cette facture : elle peut servir de justificatif comptable
            et fiscal pendant 10 ans.
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 32px;background:#F9FAFB;border-top:1px solid #E5E7EB;text-align:center;">
          <p style="margin:0;font-size:11px;color:#6B7280;">
            Envoyé via <strong style="color:#2563EB;">Talok</strong> — Plateforme de gestion locative.
          </p>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`;

  return { subject, html };
}

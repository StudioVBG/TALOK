/**
 * Email : un prestataire vient de vous envoyer un devis (vue proprietaire).
 *
 * Compagnon de provider-quote-approved.ts (cote prestataire) — celui-ci est
 * envoye au PROPRIETAIRE quand le prestataire fait POST /api/provider/quotes/[id]/send.
 *
 * Layout bleu Talok (charte owner) au lieu du orange/amber prestataire.
 */

export interface OwnerQuoteReceivedParams {
  recipientName: string;
  /** Reference visible (ex: DEV-2026-0042) */
  quoteReference: string;
  /** Titre du devis */
  quoteTitle: string;
  /** Nom du prestataire (raison sociale ou prenom + nom) */
  providerName: string;
  /** Adresse du bien concerne */
  propertyAddress?: string | null;
  /** Montant total TTC en euros */
  totalAmountEuros: number;
  /** Date de validite (ISO) */
  validUntil?: string | null;
  /** UUID du devis pour la deep-link vers /owner/provider-quotes/[id] */
  quoteId: string;
  /** Override URL app */
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

function formatFrenchDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function getAppUrl(override?: string | null): string {
  return override || "https://app.talok.fr";
}

export function ownerQuoteReceivedEmail(params: OwnerQuoteReceivedParams): {
  subject: string;
  html: string;
} {
  const subject = `Nouveau devis reçu de ${params.providerName} — ${params.quoteReference}`;
  const detailUrl = `${getAppUrl(params.appUrl)}/owner/provider-quotes/${params.quoteId}`;

  const propertyLine = params.propertyAddress
    ? `<p style="margin:0 0 4px 0;"><strong>Bien concerné :</strong> ${escapeHtml(params.propertyAddress)}</p>`
    : "";

  const validUntilLine = params.validUntil
    ? `<p style="margin:0;"><strong>Valable jusqu'au :</strong> ${escapeHtml(formatFrenchDate(params.validUntil))}</p>`
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
            Nouveau devis reçu
          </h1>
          <p style="margin:6px 0 0 0;font-size:13px;color:#E0E7FF;">Espace propriétaire Talok</p>
        </td>
      </tr>
      <tr>
        <td style="padding:32px;">
          <p style="margin:0 0 16px 0;font-size:15px;color:#111827;">Bonjour ${escapeHtml(params.recipientName)},</p>

          <p style="margin:0 0 16px 0;font-size:14px;color:#374151;">
            <strong>${escapeHtml(params.providerName)}</strong> vient de vous envoyer un devis.
            Vous pouvez l'examiner et l'accepter ou le refuser depuis votre espace.
          </p>

          <div style="background:#EFF6FF;border-left:3px solid #2563EB;padding:14px 18px;margin:16px 0;border-radius:6px;">
            <p style="margin:0 0 6px 0;font-size:15px;color:#1E3A8A;font-weight:600;">
              ${escapeHtml(params.quoteTitle)}
            </p>
            <p style="margin:0 0 4px 0;font-size:13px;color:#374151;">
              <strong>Référence :</strong> ${escapeHtml(params.quoteReference)}
            </p>
            ${propertyLine}
            <p style="margin:0 0 4px 0;"><strong>Montant TTC :</strong> ${escapeHtml(formatEur(params.totalAmountEuros))}</p>
            ${validUntilLine}
          </div>

          <div style="text-align:center;margin:24px 0;">
            <a href="${escapeHtml(detailUrl)}"
               style="display:inline-block;background:linear-gradient(135deg,#2563EB 0%,#1D4ED8 100%);color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-family:'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;">
              Examiner le devis
            </a>
          </div>

          <p style="margin:16px 0 0 0;color:#6B7280;font-size:12px;">
            Si vous n'attendiez pas ce devis, vous pouvez simplement ignorer cet email
            ou le refuser depuis votre espace.
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 32px;background:#F9FAFB;border-top:1px solid #E5E7EB;text-align:center;">
          <p style="margin:0;font-size:11px;color:#6B7280;">
            Envoyé via <strong style="color:#2563EB;">Talok</strong> — Plateforme de gestion locative.
          </p>
          <p style="margin:6px 0 0 0;font-size:11px;color:#9CA3AF;">
            Vous recevez cet email car un prestataire vous a envoyé un devis sur Talok.
          </p>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`;

  return { subject, html };
}

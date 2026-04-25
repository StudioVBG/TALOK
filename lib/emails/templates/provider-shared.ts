/**
 * Helpers partagés pour les templates email prestataire (provider).
 *
 * Pattern aligné sur copro-shared.ts : layout HTML inline, max 600px,
 * mobile-first, footer Talok. Header gradient orange/amber pour matcher
 * la charte UI prestataire (page settings, dashboard, etc.).
 */

export interface ProviderInfo {
  /** Raison sociale ou prénom + nom */
  displayName: string;
  /** Email de contact */
  emailContact?: string | null;
  /** Téléphone de contact */
  telephone?: string | null;
  /** SIRET pour signature */
  siret?: string | null;
  /** URL publique du logo entreprise (optionnel — affiché en header) */
  companyLogoUrl?: string | null;
}

export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatEur(amountEuros: number | string | null | undefined): string {
  const n = typeof amountEuros === "string" ? parseFloat(amountEuros) : amountEuros ?? 0;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

export function formatFrenchDate(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = iso instanceof Date ? iso : new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const DEFAULT_APP_URL = "https://app.talok.fr";

export function getAppUrl(override?: string | null): string {
  return override || DEFAULT_APP_URL;
}

interface ProviderLayoutParams {
  title: string;
  recipientName?: string | null;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
  /** Mention de pied (ex : "Vous recevez cet email car..."). */
  footerNote?: string;
}

export function renderProviderEmailLayout({
  title,
  recipientName,
  bodyHtml,
  ctaLabel,
  ctaUrl,
  footerNote,
}: ProviderLayoutParams): string {
  const safeTitle = escapeHtml(title);
  const greeting = recipientName
    ? `Bonjour ${escapeHtml(recipientName)},`
    : "Bonjour,";

  const ctaHtml =
    ctaLabel && ctaUrl
      ? `<div style="text-align:center;margin:24px 0;">
           <a href="${escapeHtml(ctaUrl)}"
              style="display:inline-block;background:linear-gradient(135deg,#F97316 0%,#F59E0B 100%);color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-family:'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;">
             ${escapeHtml(ctaLabel)}
           </a>
         </div>`
      : "";

  const safeFooterNote = escapeHtml(
    footerNote ?? "Vous recevez cet email car vous avez un compte prestataire sur Talok.",
  );

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>${safeTitle}</title>
</head>
<body style="margin:0;padding:0;font-family:'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background-color:#F3F4F6;color:#111827;line-height:1.5;">
  <div style="max-width:600px;margin:0 auto;padding:24px 12px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
      <tr>
        <td style="background:linear-gradient(135deg,#F97316 0%,#F59E0B 100%);padding:28px 32px;">
          <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;font-family:'Manrope',sans-serif;">
            ${safeTitle}
          </h1>
          <p style="margin:6px 0 0 0;font-size:13px;color:#FEF3C7;">Espace prestataire Talok</p>
        </td>
      </tr>
      <tr>
        <td style="padding:32px;">
          <p style="margin:0 0 16px 0;font-size:15px;color:#111827;">${greeting}</p>
          <div style="font-size:14px;color:#374151;">${bodyHtml}</div>
          ${ctaHtml}
        </td>
      </tr>
      <tr>
        <td style="padding:16px 32px;background:#F9FAFB;border-top:1px solid #E5E7EB;text-align:center;">
          <p style="margin:0;font-size:11px;color:#6B7280;">
            Envoyé via <strong style="color:#F97316;">Talok</strong> — Plateforme de gestion locative.
          </p>
          <p style="margin:6px 0 0 0;font-size:11px;color:#9CA3AF;">
            ${safeFooterNote}
          </p>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`;
}

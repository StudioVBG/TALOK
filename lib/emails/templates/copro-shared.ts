/**
 * Helpers partagés pour les templates email copropriété.
 *
 * Sprint 3 — S3-3
 *
 * Fournit :
 *   - Un layout HTML responsive commun (header Talok, corps, CTA, signature
 *     syndic personnalisée, footer).
 *   - Des types stricts pour chaque template (fini le Record<string, string>).
 *   - Un échappeur HTML pour éviter les injections.
 *
 * Le service d'envoi (lib/emails/resend.service.ts) supporte déjà les
 * `attachments` via SendEmailOptions.attachments. Les templates ci-dessous
 * n'ont qu'à retourner { subject, html } — c'est le caller qui attache les
 * pièces jointes PDF le cas échéant (convocation, appel de fonds, annexes
 * comptables…).
 *
 * Terminologie : "prélèvement automatique" (jamais Stripe), DROM-COM
 * (jamais DOM-TOM).
 */

// ============================================
// TYPES
// ============================================

/** Informations syndic pour la signature en pied d'email. */
export interface SyndicInfo {
  /** Raison sociale ou prénom + nom du syndic */
  displayName: string;
  /** Type de syndic — utilisé pour afficher ou non la carte pro */
  typeSyndic: "professionnel" | "benevole" | "cooperatif";
  /** Numéro de carte professionnelle (loi Hoguet — pros uniquement) */
  numeroCartePro?: string | null;
  /** Email de contact public */
  emailContact?: string | null;
  /** Téléphone de contact public */
  telephone?: string | null;
  /** Adresse postale (1 ligne, déjà formatée) */
  adresse?: string | null;
}

/** Informations site (copropriété) pour identifier la source du message. */
export interface CoproSiteInfo {
  name: string;
  address?: string | null;
}

// ============================================
// HELPERS
// ============================================

/** Échappe les caractères HTML spéciaux pour éviter les injections. */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Format "1 234,56 €" pour les montants en cents. */
export function formatEurCents(cents: number | string | null | undefined): string {
  const n = typeof cents === "string" ? parseInt(cents, 10) : cents ?? 0;
  const euros = n / 100;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(euros);
}

/** Format "12 avril 2026" depuis une date ISO. */
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

// ============================================
// LAYOUT HTML COMMUN
// ============================================

interface CoproLayoutParams {
  /** Titre court affiché dans le header bleu (H1) */
  title: string;
  /** Nom du destinataire affiché dans la salutation (ex: "Jean Dupont") */
  recipientName?: string | null;
  /** Corps HTML principal (déjà échappé ou généré) */
  bodyHtml: string;
  /** Texte du CTA principal (optionnel) */
  ctaLabel?: string;
  /** URL du CTA principal */
  ctaUrl?: string;
  /** Signature syndic en pied (optionnelle) */
  syndic?: SyndicInfo | null;
  /** Site concerné (optionnel) — affiché en sous-titre */
  site?: CoproSiteInfo | null;
}

/**
 * Génère le HTML complet de l'email à partir du layout partagé.
 * Inline CSS uniquement (max compatibilité clients email).
 * Max-width 600px, mobile-first.
 */
export function renderCoproEmailLayout({
  title,
  recipientName,
  bodyHtml,
  ctaLabel,
  ctaUrl,
  syndic,
  site,
}: CoproLayoutParams): string {
  const safeTitle = escapeHtml(title);
  const greeting = recipientName
    ? `Bonjour ${escapeHtml(recipientName)},`
    : "Bonjour,";

  const siteHeader = site
    ? `<p style="margin:4px 0 0 0;font-size:13px;color:#E0E7FF;">
         ${escapeHtml(site.name)}${
        site.address ? ` · ${escapeHtml(site.address)}` : ""
      }
       </p>`
    : "";

  const ctaHtml =
    ctaLabel && ctaUrl
      ? `<div style="text-align:center;margin:24px 0;">
           <a href="${escapeHtml(ctaUrl)}"
              style="display:inline-block;background:#2563EB;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-family:'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;">
             ${escapeHtml(ctaLabel)}
           </a>
         </div>`
      : "";

  const syndicSignature = syndic ? renderSyndicSignature(syndic) : "";

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
      <!-- Header bleu Talok -->
      <tr>
        <td style="background:linear-gradient(135deg,#2563EB 0%,#1D4ED8 100%);padding:28px 32px;">
          <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;font-family:'Manrope',sans-serif;">
            ${safeTitle}
          </h1>
          ${siteHeader}
        </td>
      </tr>
      <!-- Corps -->
      <tr>
        <td style="padding:32px;">
          <p style="margin:0 0 16px 0;font-size:15px;color:#111827;">${greeting}</p>
          <div style="font-size:14px;color:#374151;">${bodyHtml}</div>
          ${ctaHtml}
        </td>
      </tr>
      ${
        syndicSignature
          ? `<!-- Signature syndic -->
      <tr>
        <td style="padding:0 32px 24px 32px;">
          ${syndicSignature}
        </td>
      </tr>`
          : ""
      }
      <!-- Footer Talok -->
      <tr>
        <td style="padding:16px 32px;background:#F9FAFB;border-top:1px solid #E5E7EB;text-align:center;">
          <p style="margin:0;font-size:11px;color:#6B7280;">
            Envoyé via <strong style="color:#2563EB;">Talok</strong> — Plateforme de gestion locative.
          </p>
          <p style="margin:6px 0 0 0;font-size:11px;color:#9CA3AF;">
            Vous recevez cet email car vous êtes concerné par cette copropriété.
          </p>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`;
}

/**
 * Rend la signature syndic en pied d'email.
 * - Pour un pro : carte S obligatoire (loi Hoguet)
 * - Pour un bénévole/coopératif : mention du type uniquement
 */
export function renderSyndicSignature(syndic: SyndicInfo): string {
  const lines: string[] = [];

  lines.push(`<strong style="color:#111827;font-size:14px;">${escapeHtml(
    syndic.displayName
  )}</strong>`);

  if (syndic.typeSyndic === "professionnel" && syndic.numeroCartePro) {
    lines.push(
      `<span style="color:#6B7280;font-size:12px;">Carte S n° ${escapeHtml(
        syndic.numeroCartePro
      )}</span>`
    );
  } else if (syndic.typeSyndic === "benevole") {
    lines.push(
      `<span style="color:#6B7280;font-size:12px;">Syndic bénévole</span>`
    );
  } else if (syndic.typeSyndic === "cooperatif") {
    lines.push(
      `<span style="color:#6B7280;font-size:12px;">Syndic coopératif</span>`
    );
  }

  const contactParts: string[] = [];
  if (syndic.emailContact) contactParts.push(escapeHtml(syndic.emailContact));
  if (syndic.telephone) contactParts.push(escapeHtml(syndic.telephone));
  if (contactParts.length > 0) {
    lines.push(
      `<span style="color:#6B7280;font-size:12px;">${contactParts.join(
        " · "
      )}</span>`
    );
  }

  if (syndic.adresse) {
    lines.push(
      `<span style="color:#9CA3AF;font-size:11px;">${escapeHtml(
        syndic.adresse
      )}</span>`
    );
  }

  return `
    <div style="padding:16px 0;border-top:1px solid #E5E7EB;">
      <div style="display:flex;flex-direction:column;gap:4px;">
        ${lines.map((l) => `<div>${l}</div>`).join("")}
      </div>
    </div>
  `;
}

// ============================================
// CTAs partagés
// ============================================

const DEFAULT_APP_URL = "https://talok.fr";

export function getAppUrl(override?: string | null): string {
  return override || DEFAULT_APP_URL;
}

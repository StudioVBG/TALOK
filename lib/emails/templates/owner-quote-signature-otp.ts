/**
 * Email : code OTP de signature pour acceptation d'un devis prestataire.
 *
 * Envoye au proprietaire quand il demande a signer un devis depasse le
 * seuil de signature avancee (eIDAS niveau 2).
 *
 * IMPORTANT : ne JAMAIS reveler le code dans le sujet (les previews mail
 * client / notifications systeme exposent souvent le sujet).
 */

export interface OwnerQuoteSignatureOtpParams {
  recipientName: string;
  /** Code OTP a 6 chiffres (en clair, jamais stocke ainsi en DB) */
  code: string;
  /** Reference visible du devis */
  quoteReference: string;
  /** Titre du devis */
  quoteTitle: string;
  /** Montant total TTC en euros */
  totalAmountEuros: number;
  /** Validite du code en minutes (defaut 10) */
  expiresInMinutes?: number;
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

export function ownerQuoteSignatureOtpEmail(
  params: OwnerQuoteSignatureOtpParams,
): { subject: string; html: string } {
  const subject = `Votre code de signature pour le devis ${params.quoteReference}`;
  const expires = params.expiresInMinutes ?? 10;
  const codeChars = params.code.split("").map((c) => escapeHtml(c)).join(
    `<span style="display:inline-block;width:6px;"></span>`,
  );

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
            Code de signature
          </h1>
          <p style="margin:6px 0 0 0;font-size:13px;color:#E0E7FF;">Signature electronique avancee</p>
        </td>
      </tr>
      <tr>
        <td style="padding:32px;">
          <p style="margin:0 0 16px 0;font-size:15px;color:#111827;">Bonjour ${escapeHtml(params.recipientName)},</p>

          <p style="margin:0 0 16px 0;font-size:14px;color:#374151;">
            Vous avez demande a signer electroniquement le devis
            <strong>${escapeHtml(params.quoteReference)}</strong>
            (${escapeHtml(params.quoteTitle)}) pour un montant de
            <strong>${escapeHtml(formatEur(params.totalAmountEuros))}</strong>.
          </p>

          <p style="margin:0 0 12px 0;font-size:14px;color:#374151;">
            Saisissez ce code dans la fenetre d'acceptation pour valider votre signature :
          </p>

          <div style="text-align:center;margin:24px 0;padding:24px;background:#EFF6FF;border:2px dashed #2563EB;border-radius:12px;">
            <p style="margin:0;font-family:'SF Mono','Monaco','Inconsolata','Roboto Mono',monospace;font-size:36px;font-weight:700;letter-spacing:8px;color:#1E3A8A;">
              ${codeChars}
            </p>
          </div>

          <p style="margin:0 0 8px 0;font-size:13px;color:#6B7280;">
            Ce code expire dans <strong>${expires} minutes</strong> et ne peut etre utilise qu'une seule fois.
          </p>

          <div style="background:#FEF3C7;border-left:3px solid #F59E0B;padding:12px 16px;margin:16px 0;border-radius:6px;">
            <p style="margin:0;font-size:13px;color:#78350F;">
              <strong>Si vous n'etes pas a l'origine de cette demande</strong>,
              ignorez cet email. Personne ne pourra signer en votre nom sans ce code.
            </p>
          </div>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 32px;background:#F9FAFB;border-top:1px solid #E5E7EB;text-align:center;">
          <p style="margin:0;font-size:11px;color:#6B7280;">
            Envoye via <strong style="color:#2563EB;">Talok</strong> — Plateforme de gestion locative.
          </p>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`;

  return { subject, html };
}

/**
 * Email : un de vos devis vient d'être accepté par le client.
 *
 * Envoyé au prestataire quand provider_quotes.status passe à 'accepted'.
 */

import {
  escapeHtml,
  formatEur,
  formatFrenchDate,
  getAppUrl,
  renderProviderEmailLayout,
} from "./provider-shared";

export interface ProviderQuoteApprovedParams {
  recipientName: string;
  /** Référence visible (ex: DEV-2026-0042) */
  quoteReference: string;
  /** Titre du devis */
  quoteTitle: string;
  /** Nom du client (propriétaire ou locataire) */
  clientName?: string | null;
  /** Adresse du bien concerné */
  propertyAddress?: string | null;
  /** Montant total TTC en euros */
  totalAmountEuros: number;
  /** Date d'acceptation (ISO) */
  acceptedAt: string | Date;
  /** UUID du devis pour la deep-link */
  quoteId: string;
  appUrl?: string;
}

export function providerQuoteApprovedEmail(
  params: ProviderQuoteApprovedParams,
): { subject: string; html: string } {
  const subject = `Votre devis ${params.quoteReference} a été accepté`;
  const detailUrl = `${getAppUrl(params.appUrl)}/provider/quotes/${params.quoteId}`;

  const clientLine = params.clientName
    ? `<p style="margin:0 0 4px 0;"><strong>Client :</strong> ${escapeHtml(params.clientName)}</p>`
    : "";
  const addressLine = params.propertyAddress
    ? `<p style="margin:0 0 4px 0;"><strong>Adresse :</strong> ${escapeHtml(params.propertyAddress)}</p>`
    : "";

  const bodyHtml = `
    <p style="margin:0 0 16px 0;">
      Bonne nouvelle : votre devis <strong>${escapeHtml(params.quoteReference)}</strong>
      vient d'être accepté.
    </p>

    <div style="background:#FFF7ED;border-left:3px solid #F97316;padding:14px 18px;margin:16px 0;border-radius:6px;">
      <p style="margin:0 0 6px 0;font-size:15px;color:#7C2D12;font-weight:600;">
        ${escapeHtml(params.quoteTitle)}
      </p>
      ${clientLine}
      ${addressLine}
      <p style="margin:0 0 4px 0;"><strong>Montant TTC :</strong> ${escapeHtml(formatEur(params.totalAmountEuros))}</p>
      <p style="margin:0;"><strong>Accepté le :</strong> ${escapeHtml(formatFrenchDate(params.acceptedAt))}</p>
    </div>

    <p style="margin:16px 0 8px 0;"><strong>Prochaines étapes :</strong></p>
    <ol style="margin:0 0 16px 0;padding-left:20px;color:#374151;font-size:14px;line-height:1.7;">
      <li>Planifiez l'intervention dans votre calendrier Talok</li>
      <li>Confirmez la date au client via la messagerie intégrée</li>
      <li>Une fois l'intervention terminée, convertissez le devis en facture en un clic</li>
    </ol>

    <p style="margin:0;color:#6B7280;font-size:13px;">
      Astuce : ajoutez des photos avant/après dans votre portfolio pour valoriser votre travail
      auprès des prochains clients.
    </p>
  `;

  return {
    subject,
    html: renderProviderEmailLayout({
      title: "Devis accepté",
      recipientName: params.recipientName,
      bodyHtml,
      ctaLabel: "Voir le devis",
      ctaUrl: detailUrl,
      footerNote:
        "Vous recevez cet email car votre client a accepté votre devis sur Talok.",
    }),
  };
}

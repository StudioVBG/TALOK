/**
 * Email : rappel d'expiration d'un document compliance prestataire.
 *
 * Envoyé J-30 et J-7 avant l'expiration de :
 *   - assurance décennale
 *   - RC Pro (responsabilité civile professionnelle)
 *   - Kbis
 *   - autres documents avec expiration_date
 *
 * Si déjà expiré, le ton est plus ferme et indique le risque de suspension
 * du compte.
 */

import {
  escapeHtml,
  formatFrenchDate,
  getAppUrl,
  renderProviderEmailLayout,
} from "./provider-shared";

export interface ProviderComplianceReminderParams {
  recipientName: string;
  /** Libellé humain du document (ex: "Assurance décennale") */
  documentLabel: string;
  /** Date d'expiration du document */
  expirationDate: string | Date;
  /** Jours restants avant expiration (négatif si déjà expiré) */
  daysUntilExpiration: number;
  appUrl?: string;
}

export function providerComplianceReminderEmail(
  params: ProviderComplianceReminderParams,
): { subject: string; html: string } {
  const isExpired = params.daysUntilExpiration < 0;
  const detailUrl = `${getAppUrl(params.appUrl)}/provider/compliance`;

  const subject = isExpired
    ? `Document expiré : ${params.documentLabel} — action requise`
    : `Rappel : ${params.documentLabel} expire dans ${params.daysUntilExpiration} jour${
        params.daysUntilExpiration > 1 ? "s" : ""
      }`;

  const headerTitle = isExpired
    ? "Document expiré"
    : `${params.documentLabel} expire bientôt`;

  const urgencyBanner = isExpired
    ? `<div style="background:#FEE2E2;border-left:3px solid #DC2626;padding:14px 18px;margin:16px 0;border-radius:6px;">
         <p style="margin:0;font-size:14px;color:#7F1D1D;">
           <strong>Votre ${escapeHtml(params.documentLabel.toLowerCase())} a expiré le ${escapeHtml(formatFrenchDate(params.expirationDate))}.</strong>
           Sans mise à jour, votre compte peut être suspendu et vous ne pourrez plus
           recevoir de nouvelles missions.
         </p>
       </div>`
    : `<div style="background:#FEF3C7;border-left:3px solid #F59E0B;padding:14px 18px;margin:16px 0;border-radius:6px;">
         <p style="margin:0;font-size:14px;color:#78350F;">
           <strong>Votre ${escapeHtml(params.documentLabel.toLowerCase())} expire le ${escapeHtml(formatFrenchDate(params.expirationDate))}</strong>
           — soit dans ${params.daysUntilExpiration} jour${params.daysUntilExpiration > 1 ? "s" : ""}.
         </p>
       </div>`;

  const bodyHtml = `
    <p style="margin:0 0 8px 0;">
      Pour continuer à recevoir des missions et garantir votre conformité, mettez à jour
      ce document dès que possible.
    </p>

    ${urgencyBanner}

    <p style="margin:16px 0 8px 0;"><strong>Comment faire :</strong></p>
    <ol style="margin:0 0 16px 0;padding-left:20px;color:#374151;font-size:14px;line-height:1.7;">
      <li>Connectez-vous à votre espace prestataire</li>
      <li>Rendez-vous dans la section <strong>Conformité</strong></li>
      <li>Téléversez la nouvelle version du document avec sa date d'expiration mise à jour</li>
    </ol>

    <p style="margin:0;color:#6B7280;font-size:13px;">
      Documents acceptés : PDF, JPEG ou PNG (10 MB max). Le traitement est généralement
      automatique en quelques minutes.
    </p>
  `;

  return {
    subject,
    html: renderProviderEmailLayout({
      title: headerTitle,
      recipientName: params.recipientName,
      bodyHtml,
      ctaLabel: "Mettre à jour mes documents",
      ctaUrl: detailUrl,
      footerNote:
        "Vous recevez cet email car un de vos documents de conformité expire bientôt.",
    }),
  };
}

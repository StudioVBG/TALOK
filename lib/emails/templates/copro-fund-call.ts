/**
 * Email template : appel de fonds copropriété.
 *
 * Sprint 3 — S3-3 : refonte avec layout partagé, signature syndic,
 * attachment du PDF d'appel de fonds (passé via SendEmailOptions.attachments).
 */

import {
  escapeHtml,
  formatEurCents,
  formatFrenchDate,
  getAppUrl,
  renderCoproEmailLayout,
  type CoproSiteInfo,
  type SyndicInfo,
} from "./copro-shared";

export interface CoproFundCallParams {
  /** Nom du copropriétaire destinataire */
  recipientName: string;
  /** Période concernée (ex: "1er trimestre 2026") */
  periodLabel: string;
  /** Numéro de lot */
  lotNumber: string;
  /** Tantièmes du lot */
  tantiemes: number;
  /** Montant total en centimes */
  amountCents: number;
  /** Date d'échéance du paiement */
  dueDate: string | Date;
  /** Site concerné */
  site: CoproSiteInfo;
  /** Signature syndic */
  syndic: SyndicInfo;
  /** Override optionnel de l'URL app */
  appUrl?: string;
}

export function coproFundCallEmail(
  params: CoproFundCallParams
): { subject: string; html: string } {
  const amountLabel = formatEurCents(params.amountCents);
  const dueDateLabel = formatFrenchDate(params.dueDate);
  const subject = `Appel de fonds ${params.periodLabel} — ${amountLabel}`;

  const bodyHtml = `
    <p>Vous recevez votre appel de fonds pour la copropriété
    <strong>${escapeHtml(params.site.name)}</strong>.</p>

    <div style="background:#F3F4F6;border-radius:8px;padding:16px;margin:16px 0;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="font-size:14px;">
        <tr>
          <td style="padding:6px 0;color:#6B7280;">Période</td>
          <td style="padding:6px 0;text-align:right;font-weight:600;">${escapeHtml(
            params.periodLabel
          )}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#6B7280;">Lot</td>
          <td style="padding:6px 0;text-align:right;font-weight:600;">${escapeHtml(
            params.lotNumber
          )}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#6B7280;">Tantièmes</td>
          <td style="padding:6px 0;text-align:right;font-weight:600;">${params.tantiemes}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#6B7280;">Échéance</td>
          <td style="padding:6px 0;text-align:right;font-weight:600;">${dueDateLabel}</td>
        </tr>
        <tr>
          <td style="padding:12px 0 6px 0;color:#111827;border-top:1px solid #E5E7EB;font-size:15px;">
            <strong>Montant à régler</strong>
          </td>
          <td style="padding:12px 0 6px 0;text-align:right;border-top:1px solid #E5E7EB;font-size:20px;font-weight:700;color:#2563EB;">
            ${amountLabel}
          </td>
        </tr>
      </table>
    </div>

    <p>Le détail de cet appel de fonds (répartition par compte comptable,
    budget prévisionnel de référence) est disponible en pièce jointe et
    depuis votre espace copropriétaire.</p>

    <p style="color:#6B7280;font-size:12px;margin-top:16px;">
      Modes de paiement acceptés : virement, chèque, ou prélèvement
      automatique si vous avez donné mandat au syndic.
    </p>
  `;

  return {
    subject,
    html: renderCoproEmailLayout({
      title: `Appel de fonds ${params.periodLabel}`,
      recipientName: params.recipientName,
      bodyHtml,
      ctaLabel: "Consulter mon appel de fonds",
      ctaUrl: `${getAppUrl(params.appUrl)}/owner/copro/charges`,
      syndic: params.syndic,
      site: params.site,
    }),
  };
}

// ============================================
// Legacy adapter
// ============================================
export function coprofundcallEmail(params: Record<string, string>) {
  const amountCents = params.amountCents
    ? parseInt(params.amountCents, 10)
    : Math.round((parseFloat(params.amount || "0") || 0) * 100);

  return coproFundCallEmail({
    recipientName: params.userName || params.recipientName || "copropriétaire",
    periodLabel: params.period || params.periodLabel || "",
    lotNumber: params.lotNumber || "",
    tantiemes: parseInt(params.tantiemes || "0", 10),
    amountCents,
    dueDate: params.dueDate || new Date(),
    site: {
      name: params.siteName || "Copropriété",
      address: params.siteAddress || null,
    },
    syndic: {
      displayName: params.syndicName || "Syndic",
      typeSyndic: (params.syndicType as any) || "benevole",
      numeroCartePro: params.syndicCartePro || null,
      emailContact: params.syndicEmail || null,
      telephone: params.syndicTelephone || null,
      adresse: params.syndicAdresse || null,
    },
    appUrl: params.appUrl,
  });
}

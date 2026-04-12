/**
 * Email template : clôture d'exercice comptable copropriété.
 *
 * Sprint 3 — S3-3 : refonte avec layout partagé, annexes comptables
 * en pièces jointes (passées via SendEmailOptions.attachments).
 */

import {
  escapeHtml,
  formatEurCents,
  getAppUrl,
  renderCoproEmailLayout,
  type CoproSiteInfo,
  type SyndicInfo,
} from "./copro-shared";

export interface CoproExerciseClosedParams {
  /** Nom du copropriétaire destinataire */
  recipientName: string;
  /** Année de l'exercice clôturé */
  fiscalYear: number;
  /** Total des charges réelles (centimes) */
  chargesCents: number;
  /** Total des provisions appelées (centimes) */
  provisionsCents: number;
  /** Solde (peut être négatif = remboursement) */
  balanceCents: number;
  /** Site concerné */
  site: CoproSiteInfo;
  /** Signature syndic */
  syndic: SyndicInfo;
  /** Override optionnel de l'URL app */
  appUrl?: string;
}

export function coproExerciseClosedEmail(
  params: CoproExerciseClosedParams
): { subject: string; html: string } {
  const chargesLabel = formatEurCents(params.chargesCents);
  const provisionsLabel = formatEurCents(params.provisionsCents);
  const balanceLabel = formatEurCents(Math.abs(params.balanceCents));
  const isRefund = params.balanceCents < 0;
  const subject = `Clôture exercice ${params.fiscalYear} — ${
    isRefund ? "Solde en votre faveur" : "Régularisation"
  } ${balanceLabel}`;

  const bodyHtml = `
    <p>L'exercice comptable <strong>${params.fiscalYear}</strong> de la
    copropriété <strong>${escapeHtml(params.site.name)}</strong> a été
    clôturé et approuvé en assemblée générale.</p>

    <div style="background:#F3F4F6;border-radius:8px;padding:16px;margin:16px 0;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="font-size:14px;">
        <tr>
          <td style="padding:8px 0;color:#6B7280;">Total des charges réelles</td>
          <td style="padding:8px 0;text-align:right;font-weight:600;">${chargesLabel}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#6B7280;border-bottom:1px solid #E5E7EB;">Total des provisions appelées</td>
          <td style="padding:8px 0;text-align:right;font-weight:600;border-bottom:1px solid #E5E7EB;">${provisionsLabel}</td>
        </tr>
        <tr>
          <td style="padding:12px 0 6px 0;color:#111827;font-size:15px;">
            <strong>${isRefund ? "Solde en votre faveur" : "Solde à régler"}</strong>
          </td>
          <td style="padding:12px 0 6px 0;text-align:right;font-size:20px;font-weight:700;color:${
            isRefund ? "#10B981" : "#2563EB"
          };">
            ${isRefund ? "+" : "-"}${balanceLabel}
          </td>
        </tr>
      </table>
    </div>

    <p>Les annexes comptables complètes (grand livre, balance générale,
    répartition par clé) sont disponibles en pièces jointes et depuis
    votre espace copropriétaire.</p>

    <p style="color:#6B7280;font-size:12px;margin-top:16px;">
      ${
        isRefund
          ? "Le remboursement sera effectué par virement bancaire dans les 30 jours, ou déduit de votre prochain appel de fonds."
          : "Le solde fera l'objet d'un appel de régularisation séparé dans les prochaines semaines."
      }
    </p>
  `;

  return {
    subject,
    html: renderCoproEmailLayout({
      title: `Clôture de l'exercice ${params.fiscalYear}`,
      recipientName: params.recipientName,
      bodyHtml,
      ctaLabel: "Consulter les comptes",
      ctaUrl: `${getAppUrl(params.appUrl)}/owner/copro/accounting`,
      syndic: params.syndic,
      site: params.site,
    }),
  };
}

// ============================================
// Legacy adapter
// ============================================
export function coproexerciseclosedEmail(params: Record<string, string>) {
  const chargesCents = params.chargesCents
    ? parseInt(params.chargesCents, 10)
    : Math.round((parseFloat(params.charges || "0") || 0) * 100);
  const provisionsCents = params.provisionsCents
    ? parseInt(params.provisionsCents, 10)
    : Math.round((parseFloat(params.provisions || "0") || 0) * 100);
  const balanceCents = params.balanceCents
    ? parseInt(params.balanceCents, 10)
    : Math.round((parseFloat(params.balance || "0") || 0) * 100);

  return coproExerciseClosedEmail({
    recipientName: params.userName || params.recipientName || "copropriétaire",
    fiscalYear: parseInt(params.year || params.fiscalYear || "2026", 10),
    chargesCents,
    provisionsCents,
    balanceCents,
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

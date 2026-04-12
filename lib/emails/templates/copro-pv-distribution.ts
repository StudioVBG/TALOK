/**
 * Email template : distribution du procès-verbal après signature.
 *
 * Sprint 3 — S3-3 : nouveau template.
 *
 * Envoyé automatiquement par le cron `copro-pv-distribution` (S3-1)
 * aux copropriétaires après signature du PV par le président.
 *
 * Conformité : art. 42 loi n° 65-557 du 10 juillet 1965 — délai de
 * contestation de 2 mois à compter de la notification du PV.
 */

import {
  escapeHtml,
  formatFrenchDate,
  getAppUrl,
  renderCoproEmailLayout,
  type CoproSiteInfo,
  type SyndicInfo,
} from "./copro-shared";

export interface CoproPvDistributionParams {
  /** Nom du copropriétaire destinataire */
  recipientName: string;
  /** Identifiant de l'assemblée pour lien direct */
  assemblyId: string;
  /** Date de tenue de l'AG */
  assemblyHeldAt: string | Date;
  /** Type d'AG */
  assemblyType?: "ordinaire" | "extraordinaire" | "concertation" | "consultation_ecrite";
  /** Numéro de référence de l'AG */
  referenceNumber?: string | null;
  /** Date limite de contestation (2 mois après distribution) */
  contestationDeadline: string | Date;
  /** Nombre de résolutions votées */
  resolutionsCount?: number;
  /** Site concerné */
  site: CoproSiteInfo;
  /** Signature syndic */
  syndic: SyndicInfo;
  /** Override optionnel de l'URL app */
  appUrl?: string;
}

export function coproPvDistributionEmail(
  params: CoproPvDistributionParams
): { subject: string; html: string } {
  const heldAtLabel = formatFrenchDate(params.assemblyHeldAt);
  const deadlineLabel = formatFrenchDate(params.contestationDeadline);
  const typeLabel = {
    ordinaire: "ordinaire",
    extraordinaire: "extraordinaire",
    concertation: "de concertation",
    consultation_ecrite: "par consultation écrite",
  }[params.assemblyType || "ordinaire"];

  const subject = `Procès-verbal de l'AG ${typeLabel} du ${heldAtLabel} — ${params.site.name}`;

  const referenceHtml = params.referenceNumber
    ? `<p style="margin:0 0 8px 0;"><strong>Référence :</strong> ${escapeHtml(
        params.referenceNumber
      )}</p>`
    : "";

  const resolutionsHtml =
    typeof params.resolutionsCount === "number" && params.resolutionsCount > 0
      ? `<p style="margin:0 0 8px 0;"><strong>Résolutions votées :</strong> ${params.resolutionsCount}</p>`
      : "";

  const bodyHtml = `
    <p>Le procès-verbal de l'Assemblée Générale ${typeLabel} qui s'est
    tenue le <strong>${heldAtLabel}</strong> est désormais disponible.</p>

    <div style="background:#F3F4F6;border-left:3px solid #2563EB;padding:12px 16px;margin:16px 0;border-radius:4px;">
      ${referenceHtml}
      <p style="margin:0 0 8px 0;"><strong>Date de l'AG :</strong> ${heldAtLabel}</p>
      ${resolutionsHtml}
      <p style="margin:0;"><strong>Date limite de contestation :</strong>
        <span style="color:#DC2626;font-weight:600;">${deadlineLabel}</span>
      </p>
    </div>

    <p>Vous trouverez le PV complet en pièce jointe et depuis votre espace
    copropriétaire. Il contient :</p>
    <ul style="margin:8px 0 16px 0;padding-left:20px;color:#374151;font-size:13px;">
      <li>La liste des présents et représentés (tantièmes)</li>
      <li>Le détail de chaque résolution et son résultat de vote</li>
      <li>Les signatures du président, du secrétaire et des scrutateurs</li>
    </ul>

    <div style="background:#FEF3C7;border-left:3px solid #F59E0B;padding:12px 16px;margin:16px 0;border-radius:4px;font-size:13px;">
      <strong style="color:#92400E;">⚠️ Délai de contestation</strong><br />
      Conformément à l'article 42 de la loi n° 65-557 du 10 juillet 1965,
      vous disposez d'un délai de <strong>deux mois</strong> à compter de la
      notification de ce PV pour contester une décision devant le tribunal
      judiciaire. Passé le ${deadlineLabel}, les décisions deviennent
      définitives.
    </div>
  `;

  return {
    subject,
    html: renderCoproEmailLayout({
      title: "Procès-verbal de l'Assemblée Générale",
      recipientName: params.recipientName,
      bodyHtml,
      ctaLabel: "Consulter le procès-verbal",
      ctaUrl: `${getAppUrl(params.appUrl)}/syndic/assemblies/${params.assemblyId}`,
      syndic: params.syndic,
      site: params.site,
    }),
  };
}

/**
 * Email template : convocation à une Assemblée Générale de copropriété.
 *
 * Sprint 3 — S3-3 : refonte avec layout partagé, signature syndic,
 * attachment (le PDF de convocation est passé séparément via
 * SendEmailOptions.attachments).
 *
 * Conformité : Art. 9 décret n° 67-223 du 17 mars 1967 — convocation
 * 21 jours minimum avant l'AG, obligatoire par écrit (email avec
 * accusé explicite ou LRAR).
 */

import {
  escapeHtml,
  formatFrenchDate,
  getAppUrl,
  renderCoproEmailLayout,
  type CoproSiteInfo,
  type SyndicInfo,
} from "./copro-shared";

export interface CoproAgConvocationParams {
  /** Nom du copropriétaire destinataire */
  recipientName: string;
  /** Identifiant de l'assemblée (pour lien direct) */
  assemblyId: string;
  /** Date prévue de l'AG (ISO ou Date) */
  assemblyDate: string | Date;
  /** Lieu physique ou "Visioconférence" */
  assemblyLocation?: string | null;
  /** Type d'AG — affiché en badge */
  assemblyType?: "ordinaire" | "extraordinaire" | "concertation" | "consultation_ecrite";
  /** Numéro de référence interne (ex: AGO-2026-001) */
  referenceNumber?: string | null;
  /** Nombre de résolutions à l'ordre du jour */
  resolutionsCount?: number;
  /** Site concerné */
  site: CoproSiteInfo;
  /** Signature syndic */
  syndic: SyndicInfo;
  /** Override optionnel de l'URL app */
  appUrl?: string;
}

export function coproAgConvocationEmail(
  params: CoproAgConvocationParams
): { subject: string; html: string } {
  const dateLabel = formatFrenchDate(params.assemblyDate);
  const typeLabel = {
    ordinaire: "ordinaire",
    extraordinaire: "extraordinaire",
    concertation: "de concertation",
    consultation_ecrite: "par consultation écrite",
  }[params.assemblyType || "ordinaire"];

  const subject = `Convocation à l'Assemblée Générale ${typeLabel} du ${dateLabel} — ${params.site.name}`;

  const referenceHtml = params.referenceNumber
    ? `<p style="margin:0 0 12px 0;"><strong>Référence :</strong> ${escapeHtml(
        params.referenceNumber
      )}</p>`
    : "";

  const locationHtml = params.assemblyLocation
    ? `<p style="margin:0 0 12px 0;"><strong>Lieu :</strong> ${escapeHtml(
        params.assemblyLocation
      )}</p>`
    : "";

  const resolutionsHtml =
    typeof params.resolutionsCount === "number" && params.resolutionsCount > 0
      ? `<p style="margin:0 0 12px 0;"><strong>Ordre du jour :</strong> ${params.resolutionsCount} résolution${
          params.resolutionsCount > 1 ? "s" : ""
        } à voter</p>`
      : "";

  const bodyHtml = `
    <p>Vous êtes convoqué(e) à l'Assemblée Générale ${typeLabel} de la copropriété
    <strong>${escapeHtml(params.site.name)}</strong> qui se tiendra le
    <strong>${dateLabel}</strong>.</p>

    <div style="background:#F3F4F6;border-left:3px solid #2563EB;padding:12px 16px;margin:16px 0;border-radius:4px;">
      ${referenceHtml}
      <p style="margin:0 0 12px 0;"><strong>Date :</strong> ${dateLabel}</p>
      ${locationHtml}
      ${resolutionsHtml}
    </div>

    <p>L'ordre du jour complet, les documents annexes et le pouvoir de vote
    (si vous ne pouvez pas assister à l'AG) sont disponibles en pièce jointe
    et accessibles depuis votre espace copropriétaire.</p>

    <p style="color:#6B7280;font-size:12px;margin-top:20px;">
      Conformément à l'article 9 du décret n° 67-223 du 17 mars 1967, vous
      disposez d'un délai de 21 jours minimum avant la tenue de l'assemblée
      pour consulter les documents et préparer votre vote.
    </p>
  `;

  return {
    subject,
    html: renderCoproEmailLayout({
      title: "Convocation à l'Assemblée Générale",
      recipientName: params.recipientName,
      bodyHtml,
      ctaLabel: "Voir l'ordre du jour",
      ctaUrl: `${getAppUrl(params.appUrl)}/syndic/assemblies/${params.assemblyId}`,
      syndic: params.syndic,
      site: params.site,
    }),
  };
}

// ============================================
// Legacy adapter — à supprimer quand plus aucun caller n'utilise
// l'ancienne signature flat Record<string, string>.
// ============================================
export function coproagconvocationEmail(params: Record<string, string>) {
  return coproAgConvocationEmail({
    recipientName: params.userName || params.recipientName || "copropriétaire",
    assemblyId: params.assemblyId || "",
    assemblyDate: params.agDate || params.assemblyDate || new Date(),
    assemblyLocation: params.location || null,
    assemblyType: (params.assemblyType as any) || "ordinaire",
    referenceNumber: params.referenceNumber || null,
    resolutionsCount: params.resolutionsCount
      ? Number(params.resolutionsCount)
      : undefined,
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

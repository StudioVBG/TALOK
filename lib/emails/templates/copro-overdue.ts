/**
 * Email template : relance d'appel de fonds impayé.
 *
 * Sprint 3 — S3-3 : trois niveaux de relance :
 *   - J+10 (amiable)
 *   - J+30 (mise en demeure)
 *   - J+60 (pré-contentieux)
 *
 * Pas de pièce jointe (relance email simple). Si le syndic veut envoyer
 * une LRAR pour la mise en demeure, ça passe par le service LRAR (S3-2),
 * pas par cet email.
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

export type CoproOverdueLevel = "friendly" | "reminder" | "urgent";

export interface CoproOverdueParams {
  /** Nom du copropriétaire destinataire */
  recipientName: string;
  /** Niveau de relance */
  level: CoproOverdueLevel;
  /** Période de l'appel de fonds */
  periodLabel: string;
  /** Montant total en centimes */
  amountCents: number;
  /** Date d'échéance initiale */
  dueDate: string | Date;
  /** Nombre de jours de retard */
  daysOverdue: number;
  /** Site concerné */
  site: CoproSiteInfo;
  /** Signature syndic */
  syndic: SyndicInfo;
  /** Override optionnel de l'URL app */
  appUrl?: string;
}

const LEVEL_META: Record<
  CoproOverdueLevel,
  { subjectPrefix: string; title: string; tone: string }
> = {
  friendly: {
    subjectPrefix: "Rappel amiable",
    title: "Rappel amiable — Appel de fonds impayé",
    tone:
      "Nous constatons que votre appel de fonds n'est pas encore réglé à ce jour. Il s'agit probablement d'un oubli, et nous vous remercions de bien vouloir procéder au règlement dans les meilleurs délais.",
  },
  reminder: {
    subjectPrefix: "Mise en demeure",
    title: "Mise en demeure — Appel de fonds impayé",
    tone:
      "Malgré notre précédent rappel, votre appel de fonds reste impayé. Nous vous mettons en demeure de régulariser cette situation sous 8 jours à compter de la réception de ce courrier, à défaut de quoi le conseil syndical sera saisi.",
  },
  urgent: {
    subjectPrefix: "Procédure contentieuse imminente",
    title: "Procédure contentieuse imminente",
    tone:
      "Votre appel de fonds est en retard de plus de 60 jours malgré plusieurs relances. Sans règlement sous 15 jours, le dossier sera transmis pour recouvrement contentieux, avec les frais et intérêts de retard prévus par le règlement de copropriété.",
  },
};

export function coproOverdueEmail(
  params: CoproOverdueParams
): { subject: string; html: string } {
  const meta = LEVEL_META[params.level];
  const amountLabel = formatEurCents(params.amountCents);
  const dueDateLabel = formatFrenchDate(params.dueDate);
  const subject = `${meta.subjectPrefix} — ${params.periodLabel} (${amountLabel})`;

  const bodyHtml = `
    <p>${meta.tone}</p>

    <div style="background:${
      params.level === "urgent"
        ? "#FEF2F2;border-left:3px solid #DC2626"
        : params.level === "reminder"
        ? "#FFF7ED;border-left:3px solid #EA580C"
        : "#FFFBEB;border-left:3px solid #F59E0B"
    };padding:12px 16px;margin:16px 0;border-radius:4px;">
      <p style="margin:0 0 8px 0;"><strong>Période :</strong> ${escapeHtml(
        params.periodLabel
      )}</p>
      <p style="margin:0 0 8px 0;"><strong>Échéance initiale :</strong> ${dueDateLabel}</p>
      <p style="margin:0 0 8px 0;"><strong>Retard :</strong> ${params.daysOverdue} jour${
    params.daysOverdue > 1 ? "s" : ""
  }</p>
      <p style="margin:0;"><strong>Montant à régler :</strong>
        <span style="color:#DC2626;font-size:18px;font-weight:700;">${amountLabel}</span>
      </p>
    </div>

    <p>Vous pouvez régulariser votre situation directement depuis votre espace
    copropriétaire, par virement bancaire, chèque, ou prélèvement automatique
    si vous avez donné mandat au syndic.</p>

    ${
      params.level === "urgent"
        ? `<p style="color:#DC2626;font-size:12px;font-weight:600;margin-top:16px;">
             Pour éviter le recouvrement contentieux, merci de nous contacter
             au plus vite si vous rencontrez des difficultés de paiement.
           </p>`
        : ""
    }
  `;

  return {
    subject,
    html: renderCoproEmailLayout({
      title: meta.title,
      recipientName: params.recipientName,
      bodyHtml,
      ctaLabel: "Régulariser mon appel de fonds",
      ctaUrl: `${getAppUrl(params.appUrl)}/owner/copro/charges`,
      syndic: params.syndic,
      site: params.site,
    }),
  };
}

// ============================================
// Legacy adapter
// ============================================
export function coprooverdueEmail(params: Record<string, string>) {
  const amountCents = params.amountCents
    ? parseInt(params.amountCents, 10)
    : Math.round((parseFloat(params.amount || "0") || 0) * 100);

  return coproOverdueEmail({
    recipientName: params.userName || params.recipientName || "copropriétaire",
    level: (params.level as CoproOverdueLevel) || "friendly",
    periodLabel: params.period || params.periodLabel || "",
    amountCents,
    dueDate: params.dueDate || new Date(),
    daysOverdue: parseInt(params.daysLate || params.daysOverdue || "0", 10),
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

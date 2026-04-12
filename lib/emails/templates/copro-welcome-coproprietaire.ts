/**
 * Email template : invitation d'un copropriétaire à rejoindre Talok.
 *
 * Sprint 3 — S3-3 : nouveau template.
 *
 * Envoyé quand le syndic invite un copropriétaire via
 * `/api/copro/invites` avec `send_emails: true`. Remplace l'email HTML
 * inline pré-existant dans `/api/copro/invites/route.ts` (legacy).
 */

import {
  escapeHtml,
  getAppUrl,
  renderCoproEmailLayout,
  type CoproSiteInfo,
  type SyndicInfo,
} from "./copro-shared";

export interface CoproWelcomeCoproprietaireParams {
  /** Prénom (ou prénom + nom) du copropriétaire destinataire */
  recipientName: string;
  /** Token d'invitation pour le lien d'acceptation */
  inviteToken: string;
  /** Rôle cible sur le site (coproprietaire_occupant, bailleur, etc.) */
  targetRole?: string;
  /** Numéro de lot (optionnel, si l'invitation cible un lot spécifique) */
  lotNumber?: string | null;
  /** Message personnel du syndic (optionnel) */
  personalMessage?: string | null;
  /** Site concerné */
  site: CoproSiteInfo;
  /** Signature syndic */
  syndic: SyndicInfo;
  /** Override optionnel de l'URL app */
  appUrl?: string;
}

export function coproWelcomeCoproprietaireEmail(
  params: CoproWelcomeCoproprietaireParams
): { subject: string; html: string } {
  const subject = `Invitation à rejoindre la copropriété ${params.site.name} sur Talok`;

  const lotHtml = params.lotNumber
    ? `<p style="margin:0 0 8px 0;"><strong>Lot concerné :</strong> ${escapeHtml(
        params.lotNumber
      )}</p>`
    : "";

  const personalMessageHtml = params.personalMessage
    ? `<div style="background:#EFF6FF;border-left:3px solid #2563EB;padding:12px 16px;margin:16px 0;border-radius:4px;">
         <p style="margin:0 0 4px 0;font-size:12px;color:#6B7280;">Message du syndic :</p>
         <p style="margin:0;font-style:italic;color:#1E3A8A;">${escapeHtml(
           params.personalMessage
         )}</p>
       </div>`
    : "";

  const bodyHtml = `
    <p>Vous avez été invité(e) à rejoindre la copropriété
    <strong>${escapeHtml(params.site.name)}</strong>${
    params.site.address ? ` (${escapeHtml(params.site.address)})` : ""
  } sur Talok.</p>

    ${lotHtml}

    <p>Talok est la plateforme de gestion de copropriété utilisée par votre
    syndic. En créant votre compte, vous aurez accès à :</p>

    <ul style="margin:8px 0 16px 0;padding-left:20px;color:#374151;font-size:13px;">
      <li>Vos appels de fonds et historique de paiement</li>
      <li>Les convocations et procès-verbaux d'assemblée générale</li>
      <li>Les documents officiels (règlement, diagnostics, carnet d'entretien)</li>
      <li>Le suivi des travaux et du fonds travaux loi ALUR</li>
      <li>Le vote en ligne lors des assemblées (si activé par le syndic)</li>
    </ul>

    ${personalMessageHtml}

    <p style="color:#6B7280;font-size:12px;margin-top:16px;">
      Ce lien d'invitation est personnel et expire dans 30 jours. Si vous
      ne parvenez pas à cliquer sur le bouton ci-dessus, copiez-collez cette
      URL dans votre navigateur :<br />
      <span style="color:#2563EB;word-break:break-all;">${escapeHtml(
        `${getAppUrl(params.appUrl)}/invite/copro?token=${params.inviteToken}`
      )}</span>
    </p>
  `;

  return {
    subject,
    html: renderCoproEmailLayout({
      title: "Bienvenue sur Talok Copropriété",
      recipientName: params.recipientName,
      bodyHtml,
      ctaLabel: "Créer mon compte",
      ctaUrl: `${getAppUrl(params.appUrl)}/invite/copro?token=${params.inviteToken}`,
      syndic: params.syndic,
      site: params.site,
    }),
  };
}

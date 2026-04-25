/**
 * Email : bienvenue prestataire après création de compte.
 *
 * Envoyé après confirmation d'email + signup. Liste les 4 étapes
 * d'onboarding (profil, services, ops, review) et incite à les compléter
 * pour activer le compte.
 */

import {
  escapeHtml,
  getAppUrl,
  renderProviderEmailLayout,
} from "./provider-shared";

export interface ProviderWelcomeParams {
  recipientName: string;
  /** Override URL app (test/dev) */
  appUrl?: string;
}

export function providerWelcomeEmail(params: ProviderWelcomeParams): {
  subject: string;
  html: string;
} {
  const subject = "Bienvenue sur Talok — activez votre compte prestataire";
  const dashboardUrl = `${getAppUrl(params.appUrl)}/provider/onboarding/profile`;

  const bodyHtml = `
    <p style="margin:0 0 16px 0;">
      Votre compte prestataire est créé. Pour commencer à recevoir des missions
      via Talok, complétez votre profil en 4 étapes rapides :
    </p>

    <ol style="margin:8px 0 16px 0;padding-left:20px;color:#374151;font-size:14px;line-height:1.7;">
      <li><strong>Profil entreprise</strong> — type d'activité, SIRET, RC Pro</li>
      <li><strong>Services</strong> — vos spécialités (plomberie, électricité, etc.)</li>
      <li><strong>Zones d'intervention</strong> — où vous intervenez et vos disponibilités</li>
      <li><strong>Validation</strong> — vérification de vos informations</li>
    </ol>

    <p style="margin:16px 0;">
      Une fois votre compte activé, vous pourrez :
    </p>

    <ul style="margin:8px 0 16px 0;padding-left:20px;color:#374151;font-size:14px;line-height:1.7;">
      <li>Recevoir des demandes d'intervention de propriétaires et locataires</li>
      <li>Envoyer des devis professionnels et factures conformes</li>
      <li>Construire votre portfolio avec photos avant/après</li>
      <li>Recevoir des paiements directement sur votre compte bancaire</li>
    </ul>

    <p style="margin:16px 0 0 0;color:#6B7280;font-size:13px;">
      Une question ? Répondez simplement à cet email ou consultez notre
      <a href="${escapeHtml(getAppUrl(params.appUrl))}/provider/help" style="color:#F97316;font-weight:600;text-decoration:none;">centre d'aide prestataire</a>.
    </p>
  `;

  return {
    subject,
    html: renderProviderEmailLayout({
      title: "Bienvenue sur Talok",
      recipientName: params.recipientName,
      bodyHtml,
      ctaLabel: "Compléter mon profil",
      ctaUrl: dashboardUrl,
      footerNote:
        "Vous recevez cet email car vous venez de créer un compte prestataire sur Talok.",
    }),
  };
}

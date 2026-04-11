/**
 * Templates d'emails HTML professionnels
 * Design moderne et responsive pour tous les types de notifications
 */

import { escapeHtml } from "@/lib/utils/escape-html";

// Couleurs du design system
const COLORS = {
  primary: '#2563eb',
  primaryDark: '#1d4ed8',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    500: '#6b7280',
    700: '#374151',
    900: '#111827',
  }
};

/**
 * Layout de base pour tous les emails
 */
export function baseLayout(content: string, preheader?: string): string {
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Talok</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap');

    body {
      margin: 0;
      padding: 0;
      font-family: 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      background-color: ${COLORS.gray[100]};
      -webkit-font-smoothing: antialiased;
    }
    
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    
    .card {
      background-color: #ffffff;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }
    
    .header {
      background: linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.primaryDark} 100%);
      padding: 32px 40px;
      text-align: center;
    }
    
    .logo {
      font-size: 24px;
      font-weight: 700;
      color: #ffffff;
      text-decoration: none;
      letter-spacing: -0.5px;
    }
    
    .content {
      padding: 40px;
    }
    
    h1 {
      margin: 0 0 16px 0;
      font-size: 24px;
      font-weight: 700;
      color: ${COLORS.gray[900]};
      line-height: 1.3;
    }
    
    p {
      margin: 0 0 16px 0;
      font-size: 16px;
      color: ${COLORS.gray[700]};
      line-height: 1.6;
    }
    
    .highlight-box {
      background-color: ${COLORS.gray[50]};
      border-left: 4px solid ${COLORS.primary};
      padding: 20px 24px;
      margin: 24px 0;
      border-radius: 0 8px 8px 0;
    }
    
    .highlight-box p {
      margin: 0;
    }
    
    .amount {
      font-size: 32px;
      font-weight: 700;
      color: ${COLORS.primary};
      margin: 8px 0;
    }
    
    .button {
      display: inline-block;
      background: linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.primaryDark} 100%);
      color: #ffffff !important;
      text-decoration: none;
      padding: 14px 32px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      margin: 24px 0;
      transition: transform 0.2s;
    }
    
    .button:hover {
      transform: translateY(-1px);
    }
    
    .button-success {
      background: linear-gradient(135deg, ${COLORS.success} 0%, #059669 100%);
    }
    
    .button-warning {
      background: linear-gradient(135deg, ${COLORS.warning} 0%, #d97706 100%);
    }
    
    .info-grid {
      margin: 24px 0;
    }
    
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 12px 0;
      border-bottom: 1px solid ${COLORS.gray[200]};
    }
    
    .info-row:last-child {
      border-bottom: none;
    }
    
    .info-label {
      color: ${COLORS.gray[500]};
      font-size: 14px;
    }
    
    .info-value {
      color: ${COLORS.gray[900]};
      font-weight: 500;
      font-size: 14px;
    }
    
    .footer {
      padding: 24px 40px;
      background-color: ${COLORS.gray[50]};
      text-align: center;
    }
    
    .footer p {
      font-size: 13px;
      color: ${COLORS.gray[500]};
      margin: 0;
    }
    
    .footer a {
      color: ${COLORS.primary};
      text-decoration: none;
    }
    
    .divider {
      height: 1px;
      background-color: ${COLORS.gray[200]};
      margin: 24px 0;
    }
    
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .badge-success {
      background-color: #d1fae5;
      color: #065f46;
    }
    
    .badge-warning {
      background-color: #fef3c7;
      color: #92400e;
    }
    
    .badge-error {
      background-color: #fee2e2;
      color: #991b1b;
    }
    
    .badge-info {
      background-color: #dbeafe;
      color: #1e40af;
    }
    
    @media only screen and (max-width: 600px) {
      .container {
        padding: 20px 10px;
      }
      .content {
        padding: 24px;
      }
      .header {
        padding: 24px;
      }
      h1 {
        font-size: 20px;
      }
      .amount {
        font-size: 28px;
      }
    }
  </style>
</head>
<body>
  ${preheader ? `<div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${preheader}</div>` : ''}
  <div class="container">
    <div class="card">
      <div class="header">
        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://talok.fr'}" class="logo">
          <img src="https://talok.fr/images/talok-logo-horizontal.png" alt="TALOK" style="height: 40px; width: auto;" />
        </a>
      </div>
      ${content}
      <div class="footer">
        <p>
          © ${new Date().getFullYear()} Talok. Tous droits réservés.<br>
          <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://talok.fr'}/legal/privacy">Politique de confidentialité</a> · 
          <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://talok.fr'}/legal/cgu">Conditions d'utilisation</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Templates d'emails
 */
export const emailTemplates = {
  /**
   * Nouvelle facture disponible
   */
  newInvoice: (data: {
    tenantName: string;
    propertyAddress: string;
    period: string;
    amount: number;
    dueDate: string;
    invoiceUrl: string;
  }) => ({
    subject: `🧾 Nouvelle facture - ${data.period}`,
    html: baseLayout(`
      <div class="content">
        <h1>Nouvelle facture disponible</h1>
        <p>Bonjour ${escapeHtml(data.tenantName)},</p>
        <p>Votre facture de loyer pour la période de <strong>${data.period}</strong> est maintenant disponible.</p>
        
        <div class="highlight-box">
          <p style="color: ${COLORS.gray[500]}; font-size: 14px; margin-bottom: 4px;">Montant à payer</p>
          <div class="amount">${data.amount.toLocaleString('fr-FR')} €</div>
          <p style="color: ${COLORS.gray[500]}; font-size: 14px;">Date limite : ${data.dueDate}</p>
        </div>
        
        <div class="info-grid">
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
            <tr>
              <td style="padding: 12px 0; border-bottom: 1px solid ${COLORS.gray[200]};">
                <span style="color: ${COLORS.gray[500]}; font-size: 14px;">Logement</span>
              </td>
              <td style="padding: 12px 0; border-bottom: 1px solid ${COLORS.gray[200]}; text-align: right;">
                <span style="color: ${COLORS.gray[900]}; font-weight: 500; font-size: 14px;">${escapeHtml(data.propertyAddress)}</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 0;">
                <span style="color: ${COLORS.gray[500]}; font-size: 14px;">Période</span>
              </td>
              <td style="padding: 12px 0; text-align: right;">
                <span style="color: ${COLORS.gray[900]}; font-weight: 500; font-size: 14px;">${data.period}</span>
              </td>
            </tr>
          </table>
        </div>
        
        <div style="text-align: center;">
          <a href="${data.invoiceUrl}" class="button">Voir et payer ma facture</a>
        </div>
      </div>
    `, `Votre facture de ${data.amount}€ pour ${data.period} est disponible.`),
  }),

  /**
   * Confirmation de paiement
   */
  paymentConfirmation: (data: {
    tenantName: string;
    amount: number;
    paymentDate: string;
    paymentMethod: string;
    period: string;
    receiptUrl: string;
  }) => ({
    subject: `✅ Paiement confirmé - ${data.amount.toLocaleString('fr-FR')} €`,
    html: baseLayout(`
      <div class="content">
        <div style="text-align: center; margin-bottom: 24px;">
          <span class="badge badge-success">PAIEMENT CONFIRMÉ</span>
        </div>
        
        <h1 style="text-align: center;">Merci pour votre paiement !</h1>
        <p style="text-align: center;">Bonjour ${escapeHtml(data.tenantName)}, votre paiement a été traité avec succès.</p>
        
        <div class="highlight-box" style="border-left-color: ${COLORS.success};">
          <p style="color: ${COLORS.gray[500]}; font-size: 14px; margin-bottom: 4px;">Montant payé</p>
          <div class="amount" style="color: ${COLORS.success};">${data.amount.toLocaleString('fr-FR')} €</div>
        </div>
        
        <div class="info-grid">
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
            <tr>
              <td style="padding: 12px 0; border-bottom: 1px solid ${COLORS.gray[200]};">
                <span style="color: ${COLORS.gray[500]}; font-size: 14px;">Date du paiement</span>
              </td>
              <td style="padding: 12px 0; border-bottom: 1px solid ${COLORS.gray[200]}; text-align: right;">
                <span style="color: ${COLORS.gray[900]}; font-weight: 500; font-size: 14px;">${data.paymentDate}</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 0; border-bottom: 1px solid ${COLORS.gray[200]};">
                <span style="color: ${COLORS.gray[500]}; font-size: 14px;">Mode de paiement</span>
              </td>
              <td style="padding: 12px 0; border-bottom: 1px solid ${COLORS.gray[200]}; text-align: right;">
                <span style="color: ${COLORS.gray[900]}; font-weight: 500; font-size: 14px;">${data.paymentMethod}</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 0;">
                <span style="color: ${COLORS.gray[500]}; font-size: 14px;">Période</span>
              </td>
              <td style="padding: 12px 0; text-align: right;">
                <span style="color: ${COLORS.gray[900]}; font-weight: 500; font-size: 14px;">${data.period}</span>
              </td>
            </tr>
          </table>
        </div>
        
        <div style="text-align: center;">
          <a href="${data.receiptUrl}" class="button button-success">Télécharger ma quittance</a>
        </div>
      </div>
    `, `Votre paiement de ${data.amount}€ a été confirmé.`),
  }),

  /**
   * Rappel de paiement
   */
  paymentReminder: (data: {
    tenantName: string;
    amount: number;
    dueDate: string;
    daysLate: number;
    invoiceUrl: string;
  }) => ({
    subject: `⚠️ Rappel : Loyer ${data.daysLate > 0 ? 'en retard' : 'à venir'}`,
    html: baseLayout(`
      <div class="content">
        <div style="text-align: center; margin-bottom: 24px;">
          <span class="badge ${data.daysLate > 0 ? 'badge-error' : 'badge-warning'}">
            ${data.daysLate > 0 ? `RETARD DE ${data.daysLate} JOURS` : 'RAPPEL'}
          </span>
        </div>
        
        <h1>Rappel de paiement</h1>
        <p>Bonjour ${escapeHtml(data.tenantName)},</p>
        <p>${data.daysLate > 0 
          ? `Votre loyer est en retard de ${data.daysLate} jours. Nous vous invitons à régulariser votre situation dans les plus brefs délais.`
          : `Nous vous rappelons que votre loyer arrive à échéance le ${data.dueDate}.`
        }</p>
        
        <div class="highlight-box" style="border-left-color: ${data.daysLate > 0 ? COLORS.error : COLORS.warning};">
          <p style="color: ${COLORS.gray[500]}; font-size: 14px; margin-bottom: 4px;">Montant dû</p>
          <div class="amount" style="color: ${data.daysLate > 0 ? COLORS.error : COLORS.warning};">${data.amount.toLocaleString('fr-FR')} €</div>
          <p style="color: ${COLORS.gray[500]}; font-size: 14px;">Date limite : ${data.dueDate}</p>
        </div>
        
        <div style="text-align: center;">
          <a href="${data.invoiceUrl}" class="button ${data.daysLate > 0 ? '' : 'button-warning'}">Payer maintenant</a>
        </div>
        
        <p style="font-size: 14px; color: ${COLORS.gray[500]};">
          Si vous avez déjà effectué ce paiement, veuillez ignorer cet email. 
          En cas de difficulté, n'hésitez pas à contacter votre propriétaire.
        </p>
      </div>
    `, `Rappel : ${data.amount}€ à payer${data.daysLate > 0 ? ' - En retard' : ''}.`),
  }),

  /**
   * Nouveau ticket de maintenance
   */
  newTicket: (data: {
    recipientName: string;
    ticketTitle: string;
    ticketDescription: string;
    priority: 'basse' | 'normale' | 'haute';
    propertyAddress: string;
    createdBy: string;
    ticketUrl: string;
  }) => ({
    subject: `🔧 Nouveau ticket : ${escapeHtml(data.ticketTitle)}`,
    html: baseLayout(`
      <div class="content">
        <div style="text-align: center; margin-bottom: 24px;">
          <span class="badge ${
            data.priority === 'haute' ? 'badge-error' : 
            data.priority === 'normale' ? 'badge-warning' : 'badge-info'
          }">
            PRIORITÉ ${data.priority.toUpperCase()}
          </span>
        </div>
        
        <h1>Nouveau ticket de maintenance</h1>
        <p>Bonjour ${escapeHtml(data.recipientName)},</p>
        <p>Un nouveau ticket de maintenance a été créé par ${data.createdBy}.</p>
        
        <div class="highlight-box">
          <p style="font-weight: 600; color: ${COLORS.gray[900]}; margin-bottom: 8px;">${escapeHtml(data.ticketTitle)}</p>
          <p style="color: ${COLORS.gray[700]}; font-size: 14px;">${data.ticketDescription}</p>
        </div>
        
        <div class="info-grid">
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
            <tr>
              <td style="padding: 12px 0; border-bottom: 1px solid ${COLORS.gray[200]};">
                <span style="color: ${COLORS.gray[500]}; font-size: 14px;">Logement</span>
              </td>
              <td style="padding: 12px 0; border-bottom: 1px solid ${COLORS.gray[200]}; text-align: right;">
                <span style="color: ${COLORS.gray[900]}; font-weight: 500; font-size: 14px;">${escapeHtml(data.propertyAddress)}</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 0;">
                <span style="color: ${COLORS.gray[500]}; font-size: 14px;">Créé par</span>
              </td>
              <td style="padding: 12px 0; text-align: right;">
                <span style="color: ${COLORS.gray[900]}; font-weight: 500; font-size: 14px;">${data.createdBy}</span>
              </td>
            </tr>
          </table>
        </div>
        
        <div style="text-align: center;">
          <a href="${data.ticketUrl}" class="button">Voir le ticket</a>
        </div>
      </div>
    `, `Nouveau ticket de maintenance : ${escapeHtml(data.ticketTitle)}`),
  }),

  /**
   * Ticket mis à jour
   */
  ticketUpdated: (data: {
    recipientName: string;
    ticketTitle: string;
    newStatus: string;
    updatedBy: string;
    comment?: string;
    ticketUrl: string;
  }) => ({
    subject: `🔔 Ticket mis à jour : ${escapeHtml(data.ticketTitle)}`,
    html: baseLayout(`
      <div class="content">
        <h1>Mise à jour de votre ticket</h1>
        <p>Bonjour ${escapeHtml(data.recipientName)},</p>
        <p>Le ticket "<strong>${escapeHtml(data.ticketTitle)}</strong>" a été mis à jour par ${data.updatedBy}.</p>
        
        <div class="highlight-box">
          <p style="color: ${COLORS.gray[500]}; font-size: 14px; margin-bottom: 4px;">Nouveau statut</p>
          <p style="font-weight: 600; color: ${COLORS.gray[900]}; font-size: 18px; margin: 0;">${data.newStatus}</p>
        </div>
        
        ${data.comment ? `
        <div style="background-color: ${COLORS.gray[50]}; padding: 16px; border-radius: 8px; margin: 24px 0;">
          <p style="color: ${COLORS.gray[500]}; font-size: 12px; margin-bottom: 8px;">COMMENTAIRE</p>
          <p style="color: ${COLORS.gray[700]}; margin: 0;">${data.comment}</p>
        </div>
        ` : ''}
        
        <div style="text-align: center;">
          <a href="${data.ticketUrl}" class="button">Voir le ticket</a>
        </div>
      </div>
    `, `Ticket mis à jour : ${data.newStatus}`),
  }),

  /**
   * Demande de signature de bail
   */
  signatureRequest: (data: {
    signerName: string;
    ownerName: string;
    propertyAddress: string;
    leaseType: string;
    signatureUrl: string;
  }) => ({
    subject: `✍️ Signature de bail requise`,
    html: baseLayout(`
      <div class="content">
        <div style="text-align: center; margin-bottom: 24px;">
          <span class="badge badge-info">ACTION REQUISE</span>
        </div>
        
        <h1>Signature de bail requise</h1>
        <p>Bonjour ${escapeHtml(data.signerName)},</p>
        <p>${escapeHtml(data.ownerName)} vous invite à signer le bail pour le logement suivant :</p>
        
        <div class="highlight-box">
          <p style="font-weight: 600; color: ${COLORS.gray[900]}; margin-bottom: 8px;">${escapeHtml(data.propertyAddress)}</p>
          <p style="color: ${COLORS.gray[500]}; font-size: 14px; margin: 0;">Type de bail : ${data.leaseType}</p>
        </div>
        
        <p>Veuillez examiner et signer le bail en cliquant sur le bouton ci-dessous. Vous aurez besoin de :</p>
        <ul style="color: ${COLORS.gray[700]};">
          <li>Une pièce d'identité valide</li>
          <li>Quelques minutes pour lire et signer le document</li>
        </ul>
        
        <div style="text-align: center;">
          <a href="${data.signatureUrl}" class="button">Signer le bail</a>
        </div>
        
        <p style="font-size: 14px; color: ${COLORS.gray[500]};">
          Ce lien est valable pendant 7 jours. Si vous avez des questions, contactez directement ${escapeHtml(data.ownerName)}.
        </p>
      </div>
    `, `Vous êtes invité à signer un bail pour ${escapeHtml(data.propertyAddress)}`),
  }),

  /**
   * Bail signé - notification au propriétaire
   */
  leaseSignedNotification: (data: {
    ownerName: string;
    signerName: string;
    signerRole: string;
    propertyAddress: string;
    allSigned: boolean;
    leaseUrl: string;
  }) => ({
    subject: data.allSigned 
      ? `🎉 Bail entièrement signé - ${escapeHtml(data.propertyAddress)}`
      : `✅ Nouvelle signature - ${escapeHtml(data.signerName)}`,
    html: baseLayout(`
      <div class="content">
        <div style="text-align: center; margin-bottom: 24px;">
          <span class="badge badge-success">${data.allSigned ? 'BAIL ACTIF' : 'SIGNATURE REÇUE'}</span>
        </div>
        
        <h1>${data.allSigned ? 'Bail entièrement signé !' : 'Nouvelle signature reçue'}</h1>
        <p>Bonjour ${escapeHtml(data.ownerName)},</p>
        <p>${data.allSigned 
          ? `Excellente nouvelle ! Toutes les parties ont signé le bail pour <strong>${escapeHtml(data.propertyAddress)}</strong>. Le bail est maintenant actif.`
          : `<strong>${escapeHtml(data.signerName)}</strong> (${escapeHtml(data.signerRole)}) a signé le bail pour <strong>${escapeHtml(data.propertyAddress)}</strong>.`
        }</p>
        
        ${data.allSigned ? `
        <div class="highlight-box" style="border-left-color: ${COLORS.success};">
          <p style="font-weight: 600; color: ${COLORS.success}; font-size: 18px; margin: 0;">✓ Bail activé avec succès</p>
        </div>
        ` : ''}
        
        <div style="text-align: center;">
          <a href="${data.leaseUrl}" class="button ${data.allSigned ? 'button-success' : ''}">Voir le bail</a>
        </div>
      </div>
    `, data.allSigned ? 'Votre bail est maintenant actif !' : `${escapeHtml(data.signerName)} a signé le bail.`),
  }),

  /**
   * Invitation à rejoindre un logement
   */
  propertyInvitation: (data: {
    tenantName: string;
    ownerName: string;
    propertyAddress: string;
    propertyCode: string;
    inviteUrl: string;
  }) => ({
    subject: `🏠 Invitation à rejoindre un logement`,
    html: baseLayout(`
      <div class="content">
        <h1>Vous êtes invité !</h1>
        <p>Bonjour ${escapeHtml(data.tenantName)},</p>
        <p><strong>${escapeHtml(data.ownerName)}</strong> vous invite à rejoindre le logement suivant sur Talok :</p>
        
        <div class="highlight-box">
          <p style="font-weight: 600; color: ${COLORS.gray[900]}; margin-bottom: 8px;">${escapeHtml(data.propertyAddress)}</p>
          <p style="color: ${COLORS.gray[500]}; font-size: 14px; margin: 0;">Code du logement : <strong>${data.propertyCode}</strong></p>
        </div>
        
        <p>En acceptant cette invitation, vous pourrez :</p>
        <ul style="color: ${COLORS.gray[700]};">
          <li>Consulter et signer votre bail en ligne</li>
          <li>Payer votre loyer et télécharger vos quittances</li>
          <li>Créer des demandes de maintenance</li>
          <li>Communiquer avec votre propriétaire</li>
        </ul>
        
        <div style="text-align: center;">
          <a href="${data.inviteUrl}" class="button">Accepter l'invitation</a>
        </div>
        
        <p style="font-size: 14px; color: ${COLORS.gray[500]};">
          Vous pouvez également utiliser le code <strong>${data.propertyCode}</strong> pour rejoindre le logement manuellement depuis votre espace.
        </p>
      </div>
    `, `${escapeHtml(data.ownerName)} vous invite à rejoindre ${escapeHtml(data.propertyAddress)}`),
  }),

  /**
   * Réinitialisation de mot de passe
   */
  passwordReset: (data: {
    userName: string;
    resetUrl: string;
    expiresIn: string;
  }) => {
    const safeResetUrl = escapeHtml(data.resetUrl);
    return {
    subject: `Réinitialisation de votre mot de passe Talok`,
    html: baseLayout(`
      <div class="content">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="display: inline-block; width: 64px; height: 64px; background: ${COLORS.gray[50]}; border-radius: 50%; line-height: 64px; font-size: 32px;">🔐</div>
        </div>

        <h1 style="text-align: center;">Réinitialisation de mot de passe</h1>
        <p>Bonjour ${escapeHtml(data.userName)},</p>
        <p>Vous avez demandé à réinitialiser votre mot de passe sur Talok. Cliquez sur le bouton ci-dessous pour accéder à votre page sécurisée de changement de mot de passe :</p>

        <div style="text-align: center; margin: 32px 0;">
          <a href="${safeResetUrl}" class="button">Réinitialiser mon mot de passe</a>
        </div>

        <div class="highlight-box">
          <p style="font-size: 14px; color: ${COLORS.gray[500]}; margin: 0;">
            ⏱ Ce lien expire dans <strong>${escapeHtml(data.expiresIn)}</strong>. Passé ce délai, vous devrez effectuer une nouvelle demande.
          </p>
        </div>

        <div class="divider"></div>

        <p style="font-size: 13px; color: ${COLORS.gray[500]};">
          Si le bouton ne fonctionne pas, copiez-collez ce lien dans votre navigateur&nbsp;:<br>
          <a href="${safeResetUrl}" style="color: ${COLORS.primary}; word-break: break-all; font-size: 12px;">${safeResetUrl}</a>
        </p>

        <p style="font-size: 13px; color: ${COLORS.gray[500]};">
          Ce lien est unique et à usage limité. Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet email. Votre mot de passe ne sera pas modifié.
        </p>
      </div>
    `, 'Réinitialisez votre mot de passe Talok — ce lien expire dans ' + data.expiresIn + '.'),
    };
  },

  /**
   * Confirmation de changement de mot de passe
   */
  passwordChanged: (data: {
    userName: string;
    loginUrl: string;
  }) => {
    const safeLoginUrl = escapeHtml(data.loginUrl);
    return {
    subject: "Votre mot de passe Talok a été modifié",
    html: baseLayout(`
      <div class="content">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="display: inline-block; width: 64px; height: 64px; background: #d1fae5; border-radius: 50%; line-height: 64px; font-size: 32px;">✅</div>
        </div>

        <h1 style="text-align: center;">Mot de passe mis à jour</h1>
        <p>Bonjour ${escapeHtml(data.userName)},</p>
        <p>Le mot de passe de votre compte Talok vient d'être modifié avec succès.</p>
        <p>Si vous êtes bien à l'origine de cette opération, vous pouvez vous reconnecter via le bouton ci-dessous.</p>

        <div style="text-align: center; margin: 32px 0;">
          <a href="${safeLoginUrl}" class="button">Se reconnecter</a>
        </div>

        <div class="highlight-box">
          <p style="font-size: 14px; color: ${COLORS.gray[500]}; margin: 0;">
            Si vous n'êtes pas à l'origine de ce changement, contactez immédiatement le support et sécurisez votre compte.
          </p>
        </div>
      </div>
    `, "Votre mot de passe Talok a été modifié. Si ce n'était pas vous, contactez immédiatement le support."),
    text: `Bonjour ${data.userName},\n\nLe mot de passe de votre compte Talok vient d'être modifié.\n\nReconnectez-vous ici : ${data.loginUrl}\n\nSi vous n'êtes pas à l'origine de ce changement, contactez immédiatement le support.`,
    };
  },

  /**
   * Notification de changement de tarif d'abonnement
   */
  priceChange: (data: {
    userName: string;
    planName: string;
    oldPriceMonthly: number;
    newPriceMonthly: number;
    oldPriceYearly: number;
    newPriceYearly: number;
    effectiveDate: string;
    grandfatheredUntil: string;
    changeReason: string;
    manageUrl: string;
  }) => {
    const priceIncrease = data.newPriceMonthly > data.oldPriceMonthly;
    
    return {
      subject: `📢 Évolution de votre abonnement ${escapeHtml(data.planName)}`,
      html: baseLayout(`
        <div class="content">
          <div style="text-align: center; margin-bottom: 24px;">
            <span class="badge ${priceIncrease ? 'badge-warning' : 'badge-info'}">
              MODIFICATION TARIFAIRE
            </span>
          </div>
          
          <h1>Évolution de votre abonnement</h1>
          <p>Bonjour ${escapeHtml(data.userName)},</p>
          <p>Conformément à l'article L121-84 du Code de la consommation, nous vous informons d'une évolution des tarifs de votre plan <strong>${escapeHtml(data.planName)}</strong>.</p>
          
          <div class="divider"></div>
          
          <h2 style="font-size: 18px; margin-bottom: 16px;">Modification tarifaire</h2>
          
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 24px;">
            <tr>
              <td style="padding: 16px; background: ${COLORS.gray[50]}; border-radius: 8px 0 0 8px; text-align: center; width: 45%;">
                <p style="color: ${COLORS.gray[500]}; font-size: 12px; margin: 0 0 8px 0;">ANCIEN TARIF</p>
                <p style="text-decoration: line-through; color: ${(COLORS.gray as Record<number, string>)[400] ?? COLORS.gray[300]}; font-size: 24px; font-weight: 600; margin: 0;">
                  ${(data.oldPriceMonthly / 100).toFixed(2)}€
                </p>
                <p style="color: ${COLORS.gray[500]}; font-size: 12px; margin: 4px 0 0 0;">/mois</p>
              </td>
              <td style="padding: 16px; background: ${COLORS.gray[50]}; text-align: center; width: 10%;">
                <span style="font-size: 20px;">→</span>
              </td>
              <td style="padding: 16px; background: ${COLORS.gray[50]}; border-radius: 0 8px 8px 0; text-align: center; width: 45%;">
                <p style="color: ${COLORS.gray[500]}; font-size: 12px; margin: 0 0 8px 0;">NOUVEAU TARIF</p>
                <p style="color: ${COLORS.primary}; font-size: 24px; font-weight: 700; margin: 0;">
                  ${(data.newPriceMonthly / 100).toFixed(2)}€
                </p>
                <p style="color: ${COLORS.gray[500]}; font-size: 12px; margin: 4px 0 0 0;">/mois</p>
              </td>
            </tr>
          </table>
          
          <div class="highlight-box">
            <p style="font-weight: 600; color: ${COLORS.gray[900]}; margin-bottom: 8px;">📋 Raison de ce changement</p>
            <p style="color: ${COLORS.gray[700]}; margin: 0;">${data.changeReason}</p>
          </div>
          
          <div style="background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%); padding: 20px; border-radius: 12px; margin: 24px 0;">
            <p style="font-weight: 600; color: #065f46; margin: 0 0 8px 0;">🛡️ Garantie de maintien de tarif</p>
            <p style="color: #047857; margin: 0; font-size: 15px;">
              Votre tarif actuel est <strong>garanti jusqu'au ${data.grandfatheredUntil}</strong>.<br>
              Vous ne paierez le nouveau tarif qu'après cette date.
            </p>
          </div>
          
          <div class="divider"></div>
          
          <h2 style="font-size: 18px; margin-bottom: 16px;">Vos options</h2>
          
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
            <tr>
              <td style="padding: 12px 0; border-bottom: 1px solid ${COLORS.gray[200]};">
                <span style="color: ${COLORS.success}; font-size: 18px; margin-right: 12px;">✓</span>
                <span style="color: ${COLORS.gray[700]};">
                  <strong>Accepter les nouvelles conditions</strong> et continuer à profiter du service
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 0; border-bottom: 1px solid ${COLORS.gray[200]};">
                <span style="color: ${COLORS.warning}; font-size: 18px; margin-right: 12px;">↩</span>
                <span style="color: ${COLORS.gray[700]};">
                  <strong>Résilier sans frais</strong> avant le ${data.effectiveDate}
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 0;">
                <span style="color: ${COLORS.primary}; font-size: 18px; margin-right: 12px;">💬</span>
                <span style="color: ${COLORS.gray[700]};">
                  <strong>Nous contacter</strong> pour toute question
                </span>
              </td>
            </tr>
          </table>
          
          <div style="text-align: center; margin-top: 32px;">
            <a href="${data.manageUrl}" class="button">Gérer mon abonnement</a>
          </div>
          
          <div class="divider"></div>
          
          <p style="font-size: 13px; color: ${COLORS.gray[500]}; text-align: center;">
            Conformément à l'article L121-84 du Code de la consommation, vous disposez d'un droit de résiliation 
            sans frais en cas de modification des conditions contractuelles défavorables, exercable avant la date 
            d'entrée en vigueur des nouvelles conditions.
          </p>
        </div>
      `, `Évolution tarifaire de votre plan ${escapeHtml(data.planName)} - Action requise`),
    };
  },

  /**
   * Notification de mise à jour des CGU
   */
  cguUpdate: (data: {
    userName: string;
    version: string;
    changesSummary: string;
    effectiveDate: string;
    acceptUrl: string;
  }) => ({
    subject: `📜 Mise à jour des Conditions Générales d'Utilisation`,
    html: baseLayout(`
      <div class="content">
        <div style="text-align: center; margin-bottom: 24px;">
          <span class="badge badge-info">MISE À JOUR CGU v${data.version}</span>
        </div>

        <h1>Mise à jour de nos conditions</h1>
        <p>Bonjour ${escapeHtml(data.userName)},</p>
        <p>Nous avons mis à jour nos Conditions Générales d'Utilisation. Ces modifications entreront en vigueur le <strong>${data.effectiveDate}</strong>.</p>

        <div class="highlight-box">
          <p style="font-weight: 600; color: ${COLORS.gray[900]}; margin-bottom: 8px;">📋 Résumé des changements</p>
          <p style="color: ${COLORS.gray[700]}; margin: 0;">${data.changesSummary}</p>
        </div>

        <p>En continuant à utiliser nos services après cette date, vous acceptez les nouvelles conditions. Vous pouvez également consulter et accepter explicitement les nouvelles CGU depuis votre espace.</p>

        <div style="text-align: center;">
          <a href="${data.acceptUrl}" class="button">Consulter les nouvelles CGU</a>
        </div>

        <p style="font-size: 14px; color: ${COLORS.gray[500]};">
          Si vous n'acceptez pas ces modifications, vous pouvez résilier votre compte avant la date d'entrée en vigueur sans aucun frais.
        </p>
      </div>
    `, `Mise à jour de nos CGU - Version ${data.version}`),
  }),

  // ============================================
  // VISIT SCHEDULING EMAILS - SOTA 2026
  // ============================================

  /**
   * Nouvelle demande de visite (pour le propriétaire)
   */
  visitBookingRequest: (data: {
    ownerName: string;
    tenantName: string;
    propertyAddress: string;
    visitDate: string;
    visitTime: string;
    tenantMessage?: string;
    bookingsUrl: string;
  }) => ({
    subject: `📅 Nouvelle demande de visite - ${escapeHtml(data.propertyAddress)}`,
    html: baseLayout(`
      <div class="content">
        <div style="text-align: center; margin-bottom: 24px;">
          <span class="badge badge-warning">DEMANDE DE VISITE</span>
        </div>

        <h1>Nouvelle demande de visite</h1>
        <p>Bonjour ${escapeHtml(data.ownerName)},</p>
        <p><strong>${escapeHtml(data.tenantName)}</strong> souhaite visiter votre bien.</p>

        <div class="info-grid">
          <div class="info-row">
            <span class="info-label">📍 Bien</span>
            <span class="info-value">${escapeHtml(data.propertyAddress)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">📅 Date</span>
            <span class="info-value">${data.visitDate}</span>
          </div>
          <div class="info-row">
            <span class="info-label">🕐 Horaire</span>
            <span class="info-value">${data.visitTime}</span>
          </div>
        </div>

        ${data.tenantMessage ? `
        <div class="highlight-box">
          <p style="font-weight: 600; color: ${COLORS.gray[900]}; margin-bottom: 8px;">💬 Message du candidat</p>
          <p style="color: ${COLORS.gray[700]}; margin: 0;">${escapeHtml(data.tenantMessage)}</p>
        </div>
        ` : ''}

        <div style="text-align: center;">
          <a href="${data.bookingsUrl}" class="button">Voir les demandes de visite</a>
        </div>

        <p style="font-size: 14px; color: ${COLORS.gray[500]}; text-align: center;">
          Confirmez ou refusez cette demande depuis votre espace propriétaire.
        </p>
      </div>
    `, `Nouvelle demande de visite de ${escapeHtml(data.tenantName)}`),
  }),

  /**
   * Confirmation de visite (pour le locataire)
   */
  visitBookingConfirmed: (data: {
    tenantName: string;
    propertyAddress: string;
    visitDate: string;
    visitTime: string;
    ownerName: string;
    ownerPhone?: string;
    bookingUrl: string;
  }) => ({
    subject: `✅ Visite confirmée - ${escapeHtml(data.propertyAddress)}`,
    html: baseLayout(`
      <div class="content">
        <div style="text-align: center; margin-bottom: 24px;">
          <span class="badge badge-success">VISITE CONFIRMÉE</span>
        </div>

        <h1>Votre visite est confirmée !</h1>
        <p>Bonjour ${escapeHtml(data.tenantName)},</p>
        <p>Bonne nouvelle ! Le propriétaire a confirmé votre demande de visite.</p>

        <div class="highlight-box" style="border-left-color: ${COLORS.success};">
          <p style="font-weight: 600; color: ${COLORS.gray[900]}; margin-bottom: 12px;">📅 Rendez-vous prévu</p>
          <div class="info-grid" style="margin: 0;">
            <div class="info-row">
              <span class="info-label">📍 Adresse</span>
              <span class="info-value">${escapeHtml(data.propertyAddress)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">📅 Date</span>
              <span class="info-value">${data.visitDate}</span>
            </div>
            <div class="info-row">
              <span class="info-label">🕐 Heure</span>
              <span class="info-value">${data.visitTime}</span>
            </div>
            ${data.ownerPhone ? `
            <div class="info-row">
              <span class="info-label">📞 Contact</span>
              <span class="info-value">${data.ownerPhone}</span>
            </div>
            ` : ''}
          </div>
        </div>

        <div style="text-align: center;">
          <a href="${data.bookingUrl}" class="button button-success">Voir ma réservation</a>
        </div>

        <p style="font-size: 14px; color: ${COLORS.gray[500]}; text-align: center;">
          Un rappel vous sera envoyé 24h avant la visite.<br>
          En cas d'empêchement, pensez à annuler votre réservation.
        </p>
      </div>
    `, `Visite confirmée pour le ${data.visitDate} à ${data.visitTime}`),
  }),

  /**
   * Visite annulée/refusée (pour le locataire)
   */
  visitBookingCancelled: (data: {
    tenantName: string;
    propertyAddress: string;
    visitDate: string;
    visitTime: string;
    cancellationReason?: string;
    cancelledBy: 'owner' | 'tenant';
    searchUrl: string;
  }) => ({
    subject: `❌ Visite annulée - ${escapeHtml(data.propertyAddress)}`,
    html: baseLayout(`
      <div class="content">
        <div style="text-align: center; margin-bottom: 24px;">
          <span class="badge badge-error">VISITE ANNULÉE</span>
        </div>

        <h1>Votre visite a été annulée</h1>
        <p>Bonjour ${escapeHtml(data.tenantName)},</p>
        <p>Malheureusement, la visite prévue ${data.cancelledBy === 'owner' ? 'a été annulée par le propriétaire' : 'a été annulée'}.</p>

        <div class="info-grid">
          <div class="info-row">
            <span class="info-label">📍 Bien</span>
            <span class="info-value">${escapeHtml(data.propertyAddress)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">📅 Date prévue</span>
            <span class="info-value">${data.visitDate} à ${data.visitTime}</span>
          </div>
        </div>

        ${data.cancellationReason ? `
        <div class="highlight-box" style="border-left-color: ${COLORS.error};">
          <p style="font-weight: 600; color: ${COLORS.gray[900]}; margin-bottom: 8px;">💬 Raison</p>
          <p style="color: ${COLORS.gray[700]}; margin: 0;">${data.cancellationReason}</p>
        </div>
        ` : ''}

        <p>Vous pouvez réserver un nouveau créneau si des disponibilités sont encore présentes, ou continuer votre recherche.</p>

        <div style="text-align: center;">
          <a href="${data.searchUrl}" class="button">Rechercher un logement</a>
        </div>
      </div>
    `, `Visite annulée - ${escapeHtml(data.propertyAddress)}`),
  }),

  /**
   * Rappel de visite (24h ou 1h avant)
   */
  visitReminder: (data: {
    recipientName: string;
    propertyAddress: string;
    visitDate: string;
    visitTime: string;
    hoursBeforeVisit: number;
    isOwner: boolean;
    contactName: string;
    contactPhone?: string;
    bookingUrl: string;
  }) => ({
    subject: `⏰ Rappel : Visite ${data.hoursBeforeVisit === 24 ? 'demain' : 'dans 1 heure'} - ${escapeHtml(data.propertyAddress)}`,
    html: baseLayout(`
      <div class="content">
        <div style="text-align: center; margin-bottom: 24px;">
          <span class="badge badge-info">RAPPEL DE VISITE</span>
        </div>

        <h1>N'oubliez pas votre visite !</h1>
        <p>Bonjour ${escapeHtml(data.recipientName)},</p>
        <p>${data.hoursBeforeVisit === 24
          ? 'Votre visite est prévue pour demain.'
          : 'Votre visite commence dans environ 1 heure.'}</p>

        <div class="highlight-box" style="border-left-color: ${COLORS.primary};">
          <div class="info-grid" style="margin: 0;">
            <div class="info-row">
              <span class="info-label">📍 Adresse</span>
              <span class="info-value">${escapeHtml(data.propertyAddress)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">📅 Date</span>
              <span class="info-value">${data.visitDate}</span>
            </div>
            <div class="info-row">
              <span class="info-label">🕐 Heure</span>
              <span class="info-value">${data.visitTime}</span>
            </div>
            <div class="info-row">
              <span class="info-label">👤 ${data.isOwner ? 'Visiteur' : 'Propriétaire'}</span>
              <span class="info-value">${escapeHtml(data.contactName)}${data.contactPhone ? ` - ${data.contactPhone}` : ''}</span>
            </div>
          </div>
        </div>

        <div style="text-align: center;">
          <a href="${data.bookingUrl}" class="button">Voir les détails</a>
        </div>

        <p style="font-size: 14px; color: ${COLORS.gray[500]}; text-align: center;">
          En cas d'empêchement, pensez à prévenir ${data.isOwner ? 'le visiteur' : 'le propriétaire'} au plus vite.
        </p>
      </div>
    `, `Rappel : Visite le ${data.visitDate} à ${data.visitTime}`),
  }),

  /**
   * Visite terminée - Demande de feedback (pour le locataire)
   */
  visitFeedbackRequest: (data: {
    tenantName: string;
    propertyAddress: string;
    visitDate: string;
    feedbackUrl: string;
  }) => ({
    subject: `💬 Comment s'est passée votre visite ? - ${escapeHtml(data.propertyAddress)}`,
    html: baseLayout(`
      <div class="content">
        <h1>Comment s'est passée votre visite ?</h1>
        <p>Bonjour ${escapeHtml(data.tenantName)},</p>
        <p>Vous avez visité le bien situé au <strong>${escapeHtml(data.propertyAddress)}</strong> le ${data.visitDate}.</p>
        <p>Votre avis nous intéresse ! Prenez quelques secondes pour évaluer cette visite.</p>

        <div style="text-align: center;">
          <a href="${data.feedbackUrl}" class="button">Donner mon avis</a>
        </div>

        <p style="font-size: 14px; color: ${COLORS.gray[500]}; text-align: center;">
          Votre feedback aide les propriétaires à améliorer l'expérience de visite.
        </p>
      </div>
    `, `Donnez votre avis sur la visite du ${data.visitDate}`),
  }),

  // ============================================
  // ONBOARDING EMAILS
  // ============================================

  /**
   * Email de bienvenue amélioré avec guide de démarrage
   */
  welcomeOnboarding: (data: {
    userName: string;
    role: 'owner' | 'tenant' | 'provider' | 'guarantor' | 'syndic' | 'agency';
    onboardingUrl: string;
    supportEmail?: string;
  }) => {
    const roleConfig: Record<
      'owner' | 'tenant' | 'provider' | 'guarantor' | 'syndic' | 'agency',
      { emoji: string; title: string; steps: string[]; benefits: string[] }
    > = {
      owner: {
        emoji: '🏠',
        title: 'propriétaire',
        steps: [
          'Complétez votre profil et informations bancaires',
          'Ajoutez votre premier bien immobilier',
          'Invitez vos locataires à rejoindre Talok',
          'Créez et faites signer vos baux en ligne',
        ],
        benefits: [
          'Encaissement automatique des loyers',
          'Quittances générées automatiquement',
          'Suivi des incidents de maintenance',
          'Tableau de bord financier complet',
        ],
      },
      tenant: {
        emoji: '🔑',
        title: 'locataire',
        steps: [
          'Rejoignez votre logement avec le code fourni',
          'Complétez votre dossier locataire',
          'Vérifiez votre identité en quelques clics',
          'Configurez votre mode de paiement',
        ],
        benefits: [
          'Paiement du loyer en 2 clics',
          'Quittances disponibles instantanément',
          'Signalement de problèmes simplifié',
          'Historique de tous vos documents',
        ],
      },
      provider: {
        emoji: '🔧',
        title: 'prestataire',
        steps: [
          'Complétez votre profil professionnel',
          'Définissez vos services et spécialités',
          'Configurez votre zone d\'intervention',
          'Commencez à recevoir des demandes',
        ],
        benefits: [
          'Visibilité auprès des propriétaires',
          'Gestion simplifiée des devis',
          'Paiement sécurisé des interventions',
          'Historique de vos missions',
        ],
      },
      guarantor: {
        emoji: '🤝',
        title: 'garant',
        steps: [
          'Vérifiez votre identité',
          'Renseignez vos informations financières',
          'Signez l\'acte de cautionnement',
        ],
        benefits: [
          'Processus 100% dématérialisé',
          'Signature électronique sécurisée',
          'Suivi du bail en temps réel',
        ],
      },
      syndic: {
        emoji: '🏢',
        title: 'syndic de copropriété',
        steps: [
          'Configurez votre cabinet et votre site',
          'Ajoutez vos immeubles, lots et tantièmes',
          'Importez vos copropriétaires',
          'Lancez votre première assemblée générale',
        ],
        benefits: [
          'Gestion centralisée des copropriétés',
          'Convocations et PV automatisés',
          'Suivi des charges et appels de fonds',
          'Communication simplifiée avec les copropriétaires',
        ],
      },
      agency: {
        emoji: '🏢',
        title: 'agence immobilière',
        steps: [
          'Configurez votre agence (SIRET, logo, équipe)',
          'Enregistrez vos mandats de gestion',
          'Invitez vos collaborateurs',
          'Offrez un espace en marque blanche à vos clients',
        ],
        benefits: [
          'Tableau de bord multi-mandats',
          'Automatisation des loyers et quittances',
          'Comptes clients et reporting CRG',
          'Marque blanche personnalisable',
        ],
      },
    };

    const config = roleConfig[data.role];

    return {
      subject: `${config.emoji} Bienvenue sur Talok, ${escapeHtml(data.userName)} !`,
      html: baseLayout(`
        <div class="content">
          <div style="text-align: center; margin-bottom: 32px;">
            <div style="display: inline-block; width: 80px; height: 80px; background: linear-gradient(135deg, ${COLORS.primary} 0%, #8b5cf6 100%); border-radius: 20px; line-height: 80px; font-size: 40px;">
              ${config.emoji}
            </div>
          </div>

          <h1 style="text-align: center;">Bienvenue sur Talok !</h1>
          <p style="text-align: center; font-size: 18px;">
            Bonjour ${escapeHtml(data.userName)}, votre espace ${config.title} est prêt.
          </p>

          <div class="divider"></div>

          <h2 style="font-size: 18px; margin-bottom: 16px;">🚀 Pour bien démarrer</h2>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 24px;">
            ${config.steps.map((step, i) => `
              <tr>
                <td style="padding: 12px 0; border-bottom: 1px solid ${COLORS.gray[200]};">
                  <div style="display: flex; align-items: center;">
                    <div style="width: 28px; height: 28px; background-color: ${COLORS.primary}; color: white; border-radius: 50%; text-align: center; line-height: 28px; font-weight: 600; font-size: 14px; margin-right: 12px;">
                      ${i + 1}
                    </div>
                    <span style="color: ${COLORS.gray[700]};">${step}</span>
                  </div>
                </td>
              </tr>
            `).join('')}
          </table>

          <div class="highlight-box" style="background: linear-gradient(135deg, ${COLORS.gray[50]} 0%, #ede9fe 100%);">
            <p style="font-weight: 600; color: ${COLORS.gray[900]}; margin-bottom: 12px;">✨ Ce que vous pouvez faire avec Talok</p>
            <ul style="margin: 0; padding-left: 20px; color: ${COLORS.gray[700]};">
              ${config.benefits.map(b => `<li style="margin-bottom: 8px;">${b}</li>`).join('')}
            </ul>
          </div>

          <div style="text-align: center; margin-top: 32px;">
            <a href="${data.onboardingUrl}" class="button" style="font-size: 18px; padding: 16px 40px;">
              Configurer mon espace
            </a>
          </div>

          <p style="text-align: center; font-size: 14px; color: ${COLORS.gray[500]}; margin-top: 24px;">
            La configuration ne prend que quelques minutes.<br>
            ${data.supportEmail ? `Des questions ? Écrivez-nous à ${data.supportEmail}` : ''}
          </p>
        </div>
      `, `Bienvenue ${escapeHtml(data.userName)} ! Configurez votre espace ${config.title} sur Talok.`),
    };
  },

  /**
   * Rappel d'onboarding après 24h
   */
  onboardingReminder24h: (data: {
    userName: string;
    role: 'owner' | 'tenant' | 'provider' | 'guarantor';
    progressPercent: number;
    nextStepLabel: string;
    onboardingUrl: string;
  }) => ({
    subject: `⏰ ${escapeHtml(data.userName)}, finalisez votre inscription sur Talok`,
    html: baseLayout(`
      <div class="content">
        <h1>Votre profil vous attend !</h1>
        <p>Bonjour ${escapeHtml(data.userName)},</p>
        <p>Vous avez commencé à configurer votre espace Talok hier, mais n'avez pas encore terminé.</p>

        <div class="highlight-box">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <div>
              <p style="font-weight: 600; color: ${COLORS.gray[900]}; margin-bottom: 4px;">Votre progression</p>
              <p style="color: ${COLORS.gray[500]}; font-size: 14px; margin: 0;">Prochaine étape : ${data.nextStepLabel}</p>
            </div>
            <div style="font-size: 32px; font-weight: 700; color: ${COLORS.primary};">
              ${data.progressPercent}%
            </div>
          </div>
          <div style="margin-top: 16px; height: 8px; background-color: ${COLORS.gray[200]}; border-radius: 4px; overflow: hidden;">
            <div style="width: ${data.progressPercent}%; height: 100%; background: linear-gradient(90deg, ${COLORS.primary} 0%, #8b5cf6 100%);"></div>
          </div>
        </div>

        <p>Quelques minutes suffisent pour terminer et profiter de toutes les fonctionnalités.</p>

        <div style="text-align: center;">
          <a href="${data.onboardingUrl}" class="button">Reprendre où j'en étais</a>
        </div>

        <p style="font-size: 14px; color: ${COLORS.gray[500]}; text-align: center;">
          Si vous avez des questions, n'hésitez pas à nous contacter.
        </p>
      </div>
    `, `Vous êtes à ${data.progressPercent}% - Finalisez votre profil Talok`),
  }),

  /**
   * Rappel d'onboarding après 72h
   */
  onboardingReminder72h: (data: {
    userName: string;
    role: 'owner' | 'tenant' | 'provider' | 'guarantor';
    progressPercent: number;
    onboardingUrl: string;
  }) => {
    const roleMessages = {
      owner: 'Vos futurs locataires vous attendent ! Finalisez votre espace pour commencer à gérer vos biens.',
      tenant: 'Votre propriétaire attend votre dossier complet. Finalisez votre inscription pour signer votre bail.',
      provider: 'Des propriétaires recherchent des prestataires comme vous. Complétez votre profil pour être visible.',
      guarantor: 'Le locataire que vous accompagnez a besoin de votre cautionnement. Finalisez votre inscription.',
    };

    return {
      subject: `📋 ${escapeHtml(data.userName)}, votre espace Talok n'est pas encore prêt`,
      html: baseLayout(`
        <div class="content">
          <div style="text-align: center; margin-bottom: 24px;">
            <span class="badge badge-warning">PROFIL INCOMPLET</span>
          </div>

          <h1 style="text-align: center;">On vous attend, ${escapeHtml(data.userName)} !</h1>
          <p style="text-align: center;">${roleMessages[data.role]}</p>

          <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
            <p style="font-size: 14px; color: #92400e; margin-bottom: 8px;">Votre progression actuelle</p>
            <p style="font-size: 48px; font-weight: 700; color: #d97706; margin: 0;">${data.progressPercent}%</p>
            <p style="font-size: 14px; color: #92400e; margin-top: 8px;">Plus que quelques étapes !</p>
          </div>

          <div style="text-align: center;">
            <a href="${data.onboardingUrl}" class="button button-warning">Terminer mon inscription</a>
          </div>

          <p style="font-size: 13px; color: ${COLORS.gray[500]}; text-align: center; margin-top: 24px;">
            Vous ne souhaitez plus recevoir ces rappels ?<br>
            <a href="${data.onboardingUrl}" style="color: ${COLORS.primary};">Connectez-vous et finalisez votre profil</a>
          </p>
        </div>
      `, `Plus que ${100 - data.progressPercent}% pour finaliser votre profil !`),
    };
  },

  /**
   * Rappel d'onboarding après 7 jours
   */
  onboardingReminder7d: (data: {
    userName: string;
    role: 'owner' | 'tenant' | 'provider' | 'guarantor';
    onboardingUrl: string;
  }) => ({
    subject: `💭 ${escapeHtml(data.userName)}, nous pensons à vous`,
    html: baseLayout(`
      <div class="content">
        <h1>Vous nous manquez, ${escapeHtml(data.userName)} !</h1>
        <p>Cela fait une semaine que vous avez créé votre compte Talok.</p>
        <p>Votre espace est toujours prêt à être configuré. Il ne vous faudra que quelques minutes pour profiter de toutes nos fonctionnalités.</p>

        <div class="highlight-box">
          <p style="font-weight: 600; color: ${COLORS.gray[900]}; margin-bottom: 8px;">💡 Le saviez-vous ?</p>
          <p style="color: ${COLORS.gray[700]}; margin: 0;">
            Les utilisateurs qui complètent leur profil dans la première semaine ont 3x plus de chances de gagner du temps sur leur gestion locative.
          </p>
        </div>

        <div style="text-align: center; margin-top: 32px;">
          <a href="${data.onboardingUrl}" class="button">Reprendre là où j'en étais</a>
        </div>

        <div class="divider"></div>

        <p style="font-size: 14px; color: ${COLORS.gray[500]}; text-align: center;">
          Besoin d'aide pour démarrer ?<br>
          Notre équipe est là pour vous accompagner.
        </p>
      </div>
    `, `Votre espace Talok vous attend depuis une semaine`),
  }),

  /**
   * Félicitations - Onboarding complété
   */
  onboardingCompleted: (data: {
    userName: string;
    role: 'owner' | 'tenant' | 'provider' | 'guarantor';
    dashboardUrl: string;
  }) => {
    const roleConfig = {
      owner: {
        emoji: '🏠',
        title: 'propriétaire',
        nextSteps: [
          { label: 'Ajouter un bien', url: '/owner/properties/new' },
          { label: 'Créer un bail', url: '/owner/leases/new' },
          { label: 'Inviter un locataire', url: '/owner/tenants/invite' },
        ],
      },
      tenant: {
        emoji: '🔑',
        title: 'locataire',
        nextSteps: [
          { label: 'Consulter mon bail', url: '/tenant/lease' },
          { label: 'Payer mon loyer', url: '/tenant/payments' },
          { label: 'Mes documents', url: '/tenant/documents' },
        ],
      },
      provider: {
        emoji: '🔧',
        title: 'prestataire',
        nextSteps: [
          { label: 'Voir mes missions', url: '/provider/jobs' },
          { label: 'Gérer mes devis', url: '/provider/quotes' },
          { label: 'Mon profil public', url: '/provider/profile' },
        ],
      },
      guarantor: {
        emoji: '🤝',
        title: 'garant',
        nextSteps: [
          { label: 'Voir le bail', url: '/guarantor/lease' },
          { label: 'Mes documents', url: '/guarantor/documents' },
        ],
      },
    };

    const config = roleConfig[data.role];

    return {
      subject: `🎉 Bravo ${escapeHtml(data.userName)}, votre espace est prêt !`,
      html: baseLayout(`
        <div class="content">
          <div style="text-align: center; margin-bottom: 32px;">
            <div style="display: inline-block; width: 100px; height: 100px; background: linear-gradient(135deg, ${COLORS.success} 0%, #059669 100%); border-radius: 50%; line-height: 100px; font-size: 50px;">
              🎉
            </div>
          </div>

          <h1 style="text-align: center;">Félicitations, ${escapeHtml(data.userName)} !</h1>
          <p style="text-align: center; font-size: 18px;">
            Votre espace ${config.title} est maintenant entièrement configuré.
          </p>

          <div style="background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%); border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
            <p style="font-size: 14px; color: #065f46; margin-bottom: 8px;">Votre profil</p>
            <p style="font-size: 48px; font-weight: 700; color: ${COLORS.success}; margin: 0;">100%</p>
            <p style="font-size: 14px; color: #065f46; margin-top: 8px;">Complété !</p>
          </div>

          <h2 style="font-size: 18px; margin-bottom: 16px;">🚀 Prochaines étapes suggérées</h2>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
            ${config.nextSteps.map((step, i) => `
              <tr>
                <td style="padding: 12px 0; border-bottom: ${i < config.nextSteps.length - 1 ? `1px solid ${COLORS.gray[200]}` : 'none'};">
                  <a href="${data.dashboardUrl.replace('/dashboard', step.url)}" style="color: ${COLORS.primary}; text-decoration: none; font-weight: 500;">
                    → ${step.label}
                  </a>
                </td>
              </tr>
            `).join('')}
          </table>

          <div style="text-align: center; margin-top: 32px;">
            <a href="${data.dashboardUrl}" class="button button-success">Accéder à mon espace</a>
          </div>
        </div>
      `, `Votre espace Talok est prêt à 100% !`),
    };
  },

  /**
   * Code OTP de vérification (signature de bail, 2FA, etc.)
   */
  otpVerification: (data: {
    otpCode: string;
    purpose?: string;
    expiresInMinutes?: number;
  }) => ({
    subject: `🔐 Code de vérification${data.purpose ? ` - ${data.purpose}` : ''}`,
    html: baseLayout(`
      <div class="content">
        <h1>Code de vérification</h1>
        <p>${data.purpose ? escapeHtml(data.purpose) : 'Voici votre code de vérification'} :</p>

        <div style="text-align: center; margin: 32px 0;">
          <div style="display: inline-block; background-color: ${COLORS.gray[50]}; border: 2px solid ${COLORS.gray[200]}; border-radius: 12px; padding: 20px 40px;">
            <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: ${COLORS.primary}; font-family: 'Courier New', monospace;">
              ${escapeHtml(data.otpCode)}
            </span>
          </div>
        </div>

        <p style="text-align: center; color: ${COLORS.gray[500]}; font-size: 14px;">
          Ce code est valable <strong>${data.expiresInMinutes || 10} minutes</strong>.
        </p>

        <div class="divider"></div>

        <p style="font-size: 13px; color: ${COLORS.gray[500]};">
          Si vous n'avez pas demandé ce code, ignorez cet email.
          Votre compte reste sécurisé.
        </p>
      </div>
    `, 'Votre code de vérification Talok'),
  }),

  leaseInvite: (data: {
    tenantName: string;
    ownerName: string;
    propertyAddress: string;
    rent: number;
    charges: number;
    leaseType: string;
    inviteUrl: string;
  }) => {
    const totalRent = data.rent + data.charges;
    const leaseTypeLabels: Record<string, string> = {
      nu: 'Location nue', meuble: 'Location meublée', colocation: 'Colocation',
      saisonnier: 'Location saisonnière', mobilite: 'Bail mobilité',
    };

    return {
      subject: `📄 ${escapeHtml(data.ownerName)} vous invite à signer un bail`,
      html: baseLayout(`
        <div class="content">
          <h1>Nouveau bail à signer</h1>
          <p>Bonjour${data.tenantName ? ` ${escapeHtml(data.tenantName)}` : ''},</p>
          <p><strong>${escapeHtml(data.ownerName)}</strong> vous invite à signer un contrat de bail pour le logement suivant :</p>

          <div class="highlight-box">
            <p style="font-weight: 600; color: ${COLORS.gray[900]}; margin-bottom: 8px;">📍 ${escapeHtml(data.propertyAddress)}</p>
          </div>

          <div class="info-grid">
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
              <tr>
                <td style="padding: 12px 0; border-bottom: 1px solid ${COLORS.gray[200]};">
                  <span style="color: ${COLORS.gray[500]}; font-size: 14px;">Loyer mensuel</span>
                </td>
                <td style="padding: 12px 0; border-bottom: 1px solid ${COLORS.gray[200]}; text-align: right;">
                  <span style="color: ${COLORS.primary}; font-weight: 700; font-size: 16px;">${totalRent.toLocaleString('fr-FR')} €/mois</span>
                  <br><span style="color: ${COLORS.gray[500]}; font-size: 12px;">${data.rent.toLocaleString('fr-FR')} € + ${data.charges.toLocaleString('fr-FR')} € charges</span>
                </td>
              </tr>
              <tr>
                <td style="padding: 12px 0;">
                  <span style="color: ${COLORS.gray[500]}; font-size: 14px;">Type de bail</span>
                </td>
                <td style="padding: 12px 0; text-align: right;">
                  <span style="color: ${COLORS.gray[900]}; font-weight: 500; font-size: 14px;">${leaseTypeLabels[data.leaseType] || escapeHtml(data.leaseType)}</span>
                </td>
              </tr>
            </table>
          </div>

          <div style="text-align: center;">
            <a href="${data.inviteUrl}" class="button">Compléter et signer mon bail</a>
          </div>

          <p style="font-size: 13px; color: ${COLORS.gray[500]}; text-align: center; margin-top: 16px;">
            Ce lien expire dans 7 jours.
          </p>
        </div>
      `, `${escapeHtml(data.ownerName)} vous invite à signer un bail sur Talok.`),
    };
  },

  /**
   * Facture initiale après signature du bail
   */
  initialInvoiceNotification: (data: {
    tenantName: string;
    propertyAddress: string;
    amount: number;
    rentAmount: number;
    chargesAmount: number;
    depositAmount: number;
    includesDeposit: boolean;
    dueDate: string;
    paymentUrl: string;
  }) => {
    const depositRow = data.includesDeposit
      ? `<tr>
          <td style="padding: 12px 0; border-bottom: 1px solid ${COLORS.gray[200]};">
            <span style="color: ${COLORS.gray[500]}; font-size: 14px;">Dépôt de garantie</span>
          </td>
          <td style="padding: 12px 0; border-bottom: 1px solid ${COLORS.gray[200]}; text-align: right;">
            <span style="color: ${COLORS.gray[900]}; font-weight: 500; font-size: 14px;">${data.depositAmount.toLocaleString('fr-FR')} €</span>
          </td>
        </tr>`
      : '';

    return {
      subject: `🧾 Facture initiale - ${data.amount.toLocaleString('fr-FR')} € pour ${data.propertyAddress}`,
      html: baseLayout(`
        <div class="content">
          <div style="text-align: center; margin-bottom: 24px;">
            <span class="badge badge-success">BAIL SIGNÉ</span>
          </div>

          <h1>Votre facture initiale est prête</h1>
          <p>Bonjour ${escapeHtml(data.tenantName)},</p>
          <p>Le bail pour <strong>${escapeHtml(data.propertyAddress)}</strong> est signé par toutes les parties. Votre premier versement est maintenant attendu.</p>

          <div class="highlight-box" style="border-left-color: ${COLORS.success};">
            <p style="color: ${COLORS.gray[500]}; font-size: 14px; margin-bottom: 4px;">Montant total à régler</p>
            <div class="amount" style="color: ${COLORS.success};">${data.amount.toLocaleString('fr-FR')} €</div>
            <p style="color: ${COLORS.gray[500]}; font-size: 14px;">Échéance : ${data.dueDate}</p>
          </div>

          <div class="info-grid">
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
              <tr>
                <td style="padding: 12px 0; border-bottom: 1px solid ${COLORS.gray[200]};">
                  <span style="color: ${COLORS.gray[500]}; font-size: 14px;">Loyer</span>
                </td>
                <td style="padding: 12px 0; border-bottom: 1px solid ${COLORS.gray[200]}; text-align: right;">
                  <span style="color: ${COLORS.gray[900]}; font-weight: 500; font-size: 14px;">${data.rentAmount.toLocaleString('fr-FR')} €</span>
                </td>
              </tr>
              <tr>
                <td style="padding: 12px 0; border-bottom: 1px solid ${COLORS.gray[200]};">
                  <span style="color: ${COLORS.gray[500]}; font-size: 14px;">Charges</span>
                </td>
                <td style="padding: 12px 0; border-bottom: 1px solid ${COLORS.gray[200]}; text-align: right;">
                  <span style="color: ${COLORS.gray[900]}; font-weight: 500; font-size: 14px;">${data.chargesAmount.toLocaleString('fr-FR')} €</span>
                </td>
              </tr>
              ${depositRow}
            </table>
          </div>

          <div style="text-align: center;">
            <a href="${data.paymentUrl}" class="button button-success">Régler ma facture</a>
          </div>

          <p style="font-size: 14px; color: ${COLORS.gray[500]};">
            Ce montant couvre votre premier versement${data.includesDeposit ? ' ainsi que le dépôt de garantie' : ''}.
            Vous pouvez payer par carte bancaire ou prélèvement SEPA depuis votre espace locataire.
          </p>
        </div>
      `, `Votre facture initiale de ${data.amount.toLocaleString('fr-FR')}€ pour ${escapeHtml(data.propertyAddress)} est disponible.`),
    };
  },

  cniExpiryNotification: (data: {
    recipientName: string;
    message: string;
    subject: string;
    daysUntilExpiry: number;
    urgencyLevel: string;
    tenantName?: string;
  }) => {
    const urgencyColors: Record<string, string> = {
      expiring_soon: COLORS.warning,
      expired: COLORS.error,
    };
    const urgencyColor = urgencyColors[data.urgencyLevel] || COLORS.warning;

    return {
      subject: data.subject,
      html: baseLayout(`
        <div class="content">
          <div style="text-align: center; margin-bottom: 24px;">
            <span class="badge" style="background-color: ${urgencyColor}20; color: ${urgencyColor};">
              ${data.daysUntilExpiry <= 0 ? 'DOCUMENT EXPIRÉ' : `EXPIRATION DANS ${data.daysUntilExpiry} JOUR(S)`}
            </span>
          </div>

          <h1>${escapeHtml(data.subject)}</h1>
          <p>Bonjour ${escapeHtml(data.recipientName)},</p>
          <p>${escapeHtml(data.message)}</p>

          ${data.tenantName ? `<p><strong>Locataire concerné :</strong> ${escapeHtml(data.tenantName)}</p>` : ''}

          <div class="highlight-box" style="border-left-color: ${urgencyColor};">
            <p style="margin: 0; font-weight: bold;">
              ${data.daysUntilExpiry <= 0 ? 'Document expiré' : `Expiration dans ${data.daysUntilExpiry} jour(s)`}
            </p>
          </div>

          <div style="text-align: center;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://talok.fr'}/documents" class="button">Gérer mes documents</a>
          </div>
        </div>
      `, escapeHtml(data.message)),
    };
  },

  integrationTest: (data: {
    testDate: string;
  }) => ({
    subject: 'Test de configuration Resend - Talok',
    html: baseLayout(`
      <div class="content">
        <div style="text-align: center; margin-bottom: 24px;">
          <span class="badge badge-success">TEST RÉUSSI</span>
        </div>
        <h1 style="text-align: center;">Configuration Resend réussie !</h1>
        <p style="text-align: center;">Votre intégration email fonctionne correctement.</p>
        <p style="text-align: center; color: ${COLORS.gray[500]}; font-size: 14px;">
          Test effectué le ${escapeHtml(data.testDate)}
        </p>
      </div>
    `, 'Votre intégration Resend fonctionne correctement.'),
  }),

  genericReminder: (data: {
    subject: string;
    content: string;
  }) => ({
    subject: data.subject,
    html: baseLayout(`
      <div class="content">
        <h1>${escapeHtml(data.subject)}</h1>
        <div style="white-space: pre-line; line-height: 1.6; color: ${COLORS.gray[700]};">
          ${escapeHtml(data.content).replace(/\n/g, '<br>')}
        </div>
      </div>
    `, escapeHtml(data.subject)),
  }),

  invoiceReminder: (data: {
    tenantName: string;
    period: string;
    amount: number;
    dueDate: string;
    reminderLevel: string;
    paymentUrl: string;
  }) => {
    const levelLabels: Record<string, { label: string; color: string }> = {
      L1: { label: 'Rappel amiable', color: COLORS.warning },
      L2: { label: 'Rappel formel', color: '#ea580c' },
      L3: { label: 'Mise en demeure', color: COLORS.error },
    };
    const level = levelLabels[data.reminderLevel] || levelLabels.L1;

    return {
      subject: `${level.label} - Loyer ${data.period}`,
      html: baseLayout(`
        <div class="content">
          <div style="text-align: center; margin-bottom: 24px;">
            <span class="badge" style="background-color: ${level.color}20; color: ${level.color};">${level.label.toUpperCase()}</span>
          </div>

          <h1>Paiement en attente</h1>
          <p>Bonjour ${escapeHtml(data.tenantName)},</p>
          <p>Nous n'avons pas encore reçu le paiement de votre loyer pour la période de <strong>${data.period}</strong>.</p>

          <div class="highlight-box" style="border-left-color: ${level.color};">
            <p style="color: ${COLORS.gray[500]}; font-size: 14px; margin-bottom: 4px;">Montant dû</p>
            <div class="amount" style="color: ${level.color};">${data.amount.toLocaleString('fr-FR')} €</div>
            <p style="color: ${COLORS.gray[500]}; font-size: 14px;">Échéance : ${data.dueDate}</p>
          </div>

          <div style="text-align: center;">
            <a href="${data.paymentUrl}" class="button" style="background-color: ${level.color};">Régulariser maintenant</a>
          </div>

          <p style="font-size: 13px; color: ${COLORS.gray[500]}; margin-top: 24px;">
            Si vous avez déjà effectué le paiement, veuillez ignorer ce message.
          </p>
        </div>
      `, `Rappel : loyer ${data.period} en attente (${data.amount.toLocaleString('fr-FR')} €)`),
    };
  },

  /**
   * Demande de scan QR code pour remise des clefs
   */
  keyHandoverScanRequest: (data: {
    tenantFirstName: string;
    propertyAddress: string;
    handoverUrl: string;
    expiresAt?: string;
  }) => ({
    subject: `🔑 Action requise — Confirmez la remise de vos clefs`,
    html: baseLayout(`
      <div class="content">
        <div style="text-align: center; margin-bottom: 24px;">
          <span style="font-size: 48px;">🔑</span>
        </div>

        <h1>Remise des clefs</h1>
        <p>Bonjour ${escapeHtml(data.tenantFirstName)},</p>
        <p>Votre propriétaire vous attend pour confirmer la remise des clefs de votre logement situé au <strong>${escapeHtml(data.propertyAddress)}</strong>.</p>
        <p>Ouvrez l'application Talok et rendez-vous dans la section <strong>Mon bail &gt; Remise des clefs</strong> pour scanner le QR code présenté par votre propriétaire.</p>

        ${data.expiresAt ? `
        <div class="highlight-box">
          <p style="color: ${COLORS.gray[500]}; font-size: 14px; margin-bottom: 4px;">Valable jusqu'au</p>
          <p style="font-weight: 600; color: ${COLORS.gray[900]}; font-size: 16px;">${data.expiresAt}</p>
        </div>
        ` : ''}

        <div style="text-align: center;">
          <a href="${data.handoverUrl}" class="button">Ouvrir Talok</a>
        </div>

        <p style="font-size: 13px; color: ${COLORS.gray[500]}; margin-top: 24px;">
          Si vous n'êtes pas concerné par cette demande, veuillez ignorer ce message.
        </p>
      </div>
    `, `Votre propriétaire attend votre confirmation pour la remise des clefs au ${escapeHtml(data.propertyAddress)}`),
  }),

  /**
   * Notification au propriétaire : le locataire a confirmé la remise des clefs
   */
  keyHandoverConfirmed: (data: {
    ownerName: string;
    tenantName: string;
    propertyAddress: string;
    confirmedAt: string;
    leaseUrl: string;
  }) => ({
    subject: `✅ ${escapeHtml(data.tenantName)} a confirmé la réception des clefs`,
    html: baseLayout(`
      <div class="content">
        <div style="text-align: center; margin-bottom: 24px;">
          <span style="font-size: 48px;">✅</span>
        </div>

        <h1>Remise des clefs confirmée</h1>
        <p>Bonjour ${escapeHtml(data.ownerName)},</p>
        <p><strong>${escapeHtml(data.tenantName)}</strong> a confirmé la réception des clefs pour le logement situé au <strong>${escapeHtml(data.propertyAddress)}</strong>.</p>

        <div class="highlight-box">
          <p style="color: ${COLORS.gray[500]}; font-size: 14px; margin-bottom: 4px;">Confirmé le</p>
          <p style="font-weight: 600; color: ${COLORS.success}; font-size: 16px;">${data.confirmedAt}</p>
        </div>

        <div style="text-align: center;">
          <a href="${data.leaseUrl}" class="button button-success">Voir le bail</a>
        </div>
      </div>
    `, `${escapeHtml(data.tenantName)} a confirmé la réception des clefs au ${escapeHtml(data.propertyAddress)}`),
  }),

  /**
   * Confirmation d'email (brandé Talok)
   *
   * IMPORTANT — ACTION MANUELLE REQUISE :
   * Supabase Auth envoie la confirmation email via son SMTP natif.
   * Pour utiliser ce template à la place :
   * 1. Dans le dashboard Supabase → Auth → Email Templates → "Confirm signup"
   * 2. Copier le HTML généré par cette fonction (appeler emailTemplates.emailConfirmation({ ... }))
   * 3. Remplacer le template par défaut dans Supabase
   * 4. Utiliser {{ .ConfirmationURL }} comme variable Supabase pour le lien
   *
   * Alternative : configurer un Auth Hook (Send Email) pour intercepter et envoyer via Resend.
   */
  emailConfirmation: (data: {
    userName: string;
    confirmationUrl: string;
  }) => {
    const safeUserName = escapeHtml(data.userName);
    return {
      subject: "Confirmez votre email — Talok",
      html: baseLayout(`
        <div style="padding: 32px 24px;">
          <h1 style="color: ${COLORS.gray[900]}; margin: 0 0 16px; font-size: 24px;">
            Bienvenue sur Talok !
          </h1>
          <p style="color: ${COLORS.gray[700]}; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
            Bonjour ${safeUserName}, confirmez votre adresse email pour activer votre compte et commencer à gérer vos locations.
          </p>

          <div style="text-align: center; margin: 32px 0;">
            <a href="${data.confirmationUrl}" class="button">Confirmer mon email</a>
          </div>

          <p style="font-size: 13px; color: ${COLORS.gray[500]}; margin-top: 24px; line-height: 1.5;">
            Ce lien expire dans 24 heures. Si vous n'avez pas créé de compte sur Talok, ignorez cet email.
          </p>

          <p style="font-size: 13px; color: ${COLORS.gray[500]}; margin-top: 16px;">
            Besoin d'aide ? Contactez <a href="mailto:support@talok.fr" style="color: ${COLORS.primary};">support@talok.fr</a>
          </p>
        </div>
      `, `Confirmez votre email pour activer votre compte Talok`),
    };
  },

  guarantorEngagement: (data: {
    guarantorName: string;
    tenantName: string;
    propertyAddress: string;
    rentAmount: number;
    chargesAmount: number;
    dashboardUrl: string;
  }) => ({
    subject: `Vous êtes désigné garant pour ${data.tenantName}`,
    html: baseLayout(`
      <div class="content">
        <h1>Engagement de cautionnement</h1>
        <p>Bonjour ${escapeHtml(data.guarantorName)},</p>
        <p>Vous avez été désigné comme garant pour <strong>${escapeHtml(data.tenantName)}</strong> dans le cadre d'un bail locatif.</p>

        <div class="highlight-box">
          <p style="color: ${COLORS.gray[500]}; font-size: 14px; margin-bottom: 4px;">Bien concerné</p>
          <p style="font-weight: 600; color: ${COLORS.gray[900]};">${escapeHtml(data.propertyAddress)}</p>
          <div style="display: flex; gap: 24px; margin-top: 12px;">
            <div>
              <p style="color: ${COLORS.gray[500]}; font-size: 13px; margin-bottom: 2px;">Loyer</p>
              <p style="font-weight: 600; color: ${COLORS.gray[900]};">${data.rentAmount.toLocaleString('fr-FR')} €</p>
            </div>
            <div>
              <p style="color: ${COLORS.gray[500]}; font-size: 13px; margin-bottom: 2px;">Charges</p>
              <p style="font-weight: 600; color: ${COLORS.gray[900]};">${data.chargesAmount.toLocaleString('fr-FR')} €</p>
            </div>
          </div>
        </div>

        <div style="text-align: center;">
          <a href="${data.dashboardUrl}" class="button">Accéder à mon espace garant</a>
        </div>

        <p style="font-size: 13px; color: ${COLORS.gray[500]}; margin-top: 24px;">
          En tant que garant, vous vous engagez à couvrir les obligations locatives du locataire en cas de défaillance.
        </p>
      </div>
    `, `Vous êtes garant pour ${escapeHtml(data.tenantName)}`),
  }),

  guarantorInvitation: (data: {
    guarantorName: string;
    ownerName: string;
    tenantName: string;
    propertyAddress: string;
    rentAmount: number;
    chargesAmount: number;
    cautionType: string;
    inviteUrl: string;
  }) => {
    const cautionLabels: Record<string, string> = {
      simple: "Caution simple",
      solidaire: "Caution solidaire",
      visale: "Garantie Visale",
    };
    return {
      subject: `Invitation : devenez garant pour ${data.tenantName} sur Talok`,
      html: baseLayout(`
        <div class="content">
          <h1>Vous êtes invité(e) à devenir garant</h1>
          <p>Bonjour ${escapeHtml(data.guarantorName)},</p>
          <p><strong>${escapeHtml(data.ownerName)}</strong> vous invite à vous porter caution pour <strong>${escapeHtml(data.tenantName)}</strong> dans le cadre d'un bail locatif.</p>

          <div class="highlight-box">
            <p style="color: ${COLORS.gray[500]}; font-size: 14px; margin-bottom: 4px;">Bien concerné</p>
            <p style="font-weight: 600; color: ${COLORS.gray[900]};">${escapeHtml(data.propertyAddress)}</p>
            <div style="display: flex; gap: 24px; margin-top: 12px;">
              <div>
                <p style="color: ${COLORS.gray[500]}; font-size: 13px; margin-bottom: 2px;">Loyer</p>
                <p style="font-weight: 600; color: ${COLORS.gray[900]};">${data.rentAmount.toLocaleString('fr-FR')} €</p>
              </div>
              <div>
                <p style="color: ${COLORS.gray[500]}; font-size: 13px; margin-bottom: 2px;">Charges</p>
                <p style="font-weight: 600; color: ${COLORS.gray[900]};">${data.chargesAmount.toLocaleString('fr-FR')} €</p>
              </div>
              <div>
                <p style="color: ${COLORS.gray[500]}; font-size: 13px; margin-bottom: 2px;">Type</p>
                <p style="font-weight: 600; color: ${COLORS.gray[900]};">${cautionLabels[data.cautionType] || data.cautionType}</p>
              </div>
            </div>
          </div>

          <p>Pour accepter cette invitation, créez votre compte garant sur Talok :</p>

          <div style="text-align: center;">
            <a href="${data.inviteUrl}" class="button">Créer mon compte garant</a>
          </div>

          <p style="font-size: 13px; color: ${COLORS.gray[500]}; margin-top: 24px;">
            Cette invitation expire dans 30 jours. Si vous ne souhaitez pas vous porter garant, vous pouvez ignorer cet email.
          </p>
        </div>
      `, `Invitation garant pour ${escapeHtml(data.tenantName)} sur Talok`),
    };
  },

  guarantorEngagementSigned: (data: {
    ownerName: string;
    guarantorName: string;
    tenantName: string;
    propertyAddress: string;
    cautionType: string;
  }) => {
    const cautionLabels: Record<string, string> = {
      caution_simple: "Caution simple",
      caution_solidaire: "Caution solidaire",
      visale: "Garantie Visale",
    };
    return {
      subject: `Acte de caution signé par ${data.guarantorName}`,
      html: baseLayout(`
        <div class="content">
          <div style="text-align: center; margin-bottom: 24px;">
            <span class="badge badge-success">ACTE SIGNÉ</span>
          </div>
          <h1>L'acte de cautionnement a été signé</h1>
          <p>Bonjour ${escapeHtml(data.ownerName)},</p>
          <p><strong>${escapeHtml(data.guarantorName)}</strong> a signé l'acte de cautionnement (${cautionLabels[data.cautionType] || data.cautionType}) pour <strong>${escapeHtml(data.tenantName)}</strong>.</p>

          <div class="highlight-box">
            <p style="color: ${COLORS.gray[500]}; font-size: 14px; margin-bottom: 4px;">Bien concerné</p>
            <p style="font-weight: 600; color: ${COLORS.gray[900]};">${escapeHtml(data.propertyAddress)}</p>
          </div>

          <p>Le garant est désormais actif sur ce bail. Vous pouvez consulter les détails depuis votre espace propriétaire.</p>
        </div>
      `, `Acte de caution signé pour ${escapeHtml(data.tenantName)}`),
    };
  },

  guarantorLiberated: (data: {
    guarantorName: string;
    tenantName: string;
    propertyAddress: string;
    reason: string;
  }) => {
    const reasonLabels: Record<string, string> = {
      fin_bail: "fin du bail",
      remplacement_locataire: "remplacement du locataire",
      depart_colocataire_6mois: "départ du colocataire cautionné (après 6 mois)",
      accord_parties: "accord entre les parties",
      autre: "autre motif",
    };
    return {
      subject: `Libération de votre engagement de caution`,
      html: baseLayout(`
        <div class="content">
          <div style="text-align: center; margin-bottom: 24px;">
            <span class="badge badge-info">LIBÉRATION</span>
          </div>
          <h1>Vous êtes libéré(e) de votre engagement</h1>
          <p>Bonjour ${escapeHtml(data.guarantorName)},</p>
          <p>Votre engagement de cautionnement pour <strong>${escapeHtml(data.tenantName)}</strong> a été clôturé.</p>

          <div class="highlight-box">
            <p style="color: ${COLORS.gray[500]}; font-size: 14px; margin-bottom: 4px;">Bien concerné</p>
            <p style="font-weight: 600; color: ${COLORS.gray[900]};">${escapeHtml(data.propertyAddress)}</p>
            <p style="color: ${COLORS.gray[500]}; font-size: 14px; margin-top: 12px; margin-bottom: 4px;">Motif</p>
            <p style="font-weight: 600; color: ${COLORS.gray[900]};">${reasonLabels[data.reason] || data.reason}</p>
          </div>

          <p>Vous n'êtes plus tenu(e) aux obligations de cette caution. Si vous avez des questions, contactez le propriétaire ou notre support.</p>
        </div>
      `, `Libération de votre caution pour ${escapeHtml(data.tenantName)}`),
    };
  },

  providerInvite: (data: {
    providerName: string;
    email: string;
    tempPassword: string;
    loginUrl: string;
  }) => ({
    subject: 'Votre accès Talok Prestataire',
    html: baseLayout(`
      <div class="content">
        <h1>Bienvenue sur Talok !</h1>
        <p>Bonjour ${escapeHtml(data.providerName)},</p>
        <p>Un compte prestataire a été créé pour vous sur la plateforme Talok.</p>

        <div class="highlight-box">
          <p style="color: ${COLORS.gray[500]}; font-size: 14px; margin-bottom: 8px;">Vos identifiants de connexion</p>
          <p style="margin: 4px 0;"><strong>Email :</strong> ${escapeHtml(data.email)}</p>
          <p style="margin: 4px 0;"><strong>Mot de passe temporaire :</strong> <code style="background: ${COLORS.gray[100]}; padding: 2px 6px; border-radius: 4px;">${escapeHtml(data.tempPassword)}</code></p>
        </div>

        <div style="background: #fef3c7; border-radius: 8px; padding: 12px 16px; margin: 16px 0;">
          <p style="margin: 0; color: #92400e; font-size: 14px;">
            <strong>Important :</strong> Changez votre mot de passe dès votre première connexion.
          </p>
        </div>

        <div style="text-align: center;">
          <a href="${data.loginUrl}" class="button">Se connecter</a>
        </div>
      </div>
    `, 'Votre accès prestataire Talok'),
  }),

  renovationQuoteRequest: (data: {
    providerName: string;
    propertyAddress: string;
    description: string;
    dashboardUrl: string;
  }) => ({
    subject: `Demande de devis — ${data.propertyAddress}`,
    html: baseLayout(`
      <div class="content">
        <h1>Demande de devis</h1>
        <p>Bonjour ${escapeHtml(data.providerName)},</p>
        <p>Un propriétaire vous a sélectionné pour un devis de travaux de rénovation.</p>

        <div class="highlight-box">
          <p style="color: ${COLORS.gray[500]}; font-size: 14px; margin-bottom: 4px;">Bien concerné</p>
          <p style="font-weight: 600; color: ${COLORS.gray[900]};">${escapeHtml(data.propertyAddress)}</p>
          <p style="color: ${COLORS.gray[500]}; font-size: 14px; margin-top: 12px; margin-bottom: 4px;">Description des travaux</p>
          <p style="color: ${COLORS.gray[700]}; white-space: pre-line;">${escapeHtml(data.description)}</p>
        </div>

        <div style="text-align: center;">
          <a href="${data.dashboardUrl}" class="button">Voir la demande et répondre</a>
        </div>
      </div>
    `, `Demande de devis pour ${escapeHtml(data.propertyAddress)}`),
  }),

  /**
   * Confirmation de suppression de compte (RGPD Article 17)
   */
  accountDeletionConfirmation: (data: {
    userName: string;
  }) => ({
    subject: 'Votre compte Talok a été supprimé',
    html: baseLayout(`
      <div class="content">
        <div style="text-align: center; margin-bottom: 24px;">
          <span style="font-size: 48px;">👋</span>
        </div>

        <h1>Compte supprimé</h1>
        <p>Bonjour ${escapeHtml(data.userName)},</p>
        <p>Conformément à votre demande et au droit à l'effacement (Article 17 du RGPD), votre compte Talok a été supprimé.</p>

        <div class="highlight-box">
          <p style="font-weight: 600; color: ${COLORS.gray[900]};">Ce qui a été fait :</p>
          <ul style="color: ${COLORS.gray[700]}; font-size: 14px; margin-top: 8px;">
            <li>Vos données personnelles ont été anonymisées</li>
            <li>Vos photos et documents d'identité ont été supprimés</li>
            <li>Toutes vos sessions ont été fermées</li>
          </ul>
          <p style="color: ${COLORS.gray[500]}; font-size: 13px; margin-top: 12px;">
            Les factures et quittances sont conservées 10 ans (obligation légale comptable).
          </p>
        </div>

        <p style="font-size: 13px; color: ${COLORS.gray[500]}; margin-top: 24px;">
          Pour toute question, contactez notre DPO : <a href="mailto:dpo@talok.fr" style="color: ${COLORS.primary};">dpo@talok.fr</a>
        </p>
      </div>
    `, 'Votre compte Talok a été supprimé conformément au RGPD'),
  }),
};


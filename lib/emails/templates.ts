/**
 * Templates d'emails HTML professionnels
 * Design moderne et responsive pour tous les types de notifications
 */

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
function baseLayout(content: string, preheader?: string): string {
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
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    
    body {
      margin: 0;
      padding: 0;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
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
          🏠 Talok
        </a>
      </div>
      ${content}
      <div class="footer">
        <p>
          © ${new Date().getFullYear()} Talok. Tous droits réservés.<br>
          <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://talok.fr'}/legal/privacy">Politique de confidentialité</a> · 
          <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://talok.fr'}/legal/terms">Conditions d'utilisation</a>
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
        <p>Bonjour ${data.tenantName},</p>
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
                <span style="color: ${COLORS.gray[900]}; font-weight: 500; font-size: 14px;">${data.propertyAddress}</span>
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
        <p style="text-align: center;">Bonjour ${data.tenantName}, votre paiement a été traité avec succès.</p>
        
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
        <p>Bonjour ${data.tenantName},</p>
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
    subject: `🔧 Nouveau ticket : ${data.ticketTitle}`,
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
        <p>Bonjour ${data.recipientName},</p>
        <p>Un nouveau ticket de maintenance a été créé par ${data.createdBy}.</p>
        
        <div class="highlight-box">
          <p style="font-weight: 600; color: ${COLORS.gray[900]}; margin-bottom: 8px;">${data.ticketTitle}</p>
          <p style="color: ${COLORS.gray[700]}; font-size: 14px;">${data.ticketDescription}</p>
        </div>
        
        <div class="info-grid">
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
            <tr>
              <td style="padding: 12px 0; border-bottom: 1px solid ${COLORS.gray[200]};">
                <span style="color: ${COLORS.gray[500]}; font-size: 14px;">Logement</span>
              </td>
              <td style="padding: 12px 0; border-bottom: 1px solid ${COLORS.gray[200]}; text-align: right;">
                <span style="color: ${COLORS.gray[900]}; font-weight: 500; font-size: 14px;">${data.propertyAddress}</span>
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
    `, `Nouveau ticket de maintenance : ${data.ticketTitle}`),
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
    subject: `🔔 Ticket mis à jour : ${data.ticketTitle}`,
    html: baseLayout(`
      <div class="content">
        <h1>Mise à jour de votre ticket</h1>
        <p>Bonjour ${data.recipientName},</p>
        <p>Le ticket "<strong>${data.ticketTitle}</strong>" a été mis à jour par ${data.updatedBy}.</p>
        
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
        <p>Bonjour ${data.signerName},</p>
        <p>${data.ownerName} vous invite à signer le bail pour le logement suivant :</p>
        
        <div class="highlight-box">
          <p style="font-weight: 600; color: ${COLORS.gray[900]}; margin-bottom: 8px;">${data.propertyAddress}</p>
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
          Ce lien est valable pendant 7 jours. Si vous avez des questions, contactez directement ${data.ownerName}.
        </p>
      </div>
    `, `Vous êtes invité à signer un bail pour ${data.propertyAddress}`),
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
      ? `🎉 Bail entièrement signé - ${data.propertyAddress}`
      : `✅ Nouvelle signature - ${data.signerName}`,
    html: baseLayout(`
      <div class="content">
        <div style="text-align: center; margin-bottom: 24px;">
          <span class="badge badge-success">${data.allSigned ? 'BAIL ACTIF' : 'SIGNATURE REÇUE'}</span>
        </div>
        
        <h1>${data.allSigned ? 'Bail entièrement signé !' : 'Nouvelle signature reçue'}</h1>
        <p>Bonjour ${data.ownerName},</p>
        <p>${data.allSigned 
          ? `Excellente nouvelle ! Toutes les parties ont signé le bail pour <strong>${data.propertyAddress}</strong>. Le bail est maintenant actif.`
          : `<strong>${data.signerName}</strong> (${data.signerRole}) a signé le bail pour <strong>${data.propertyAddress}</strong>.`
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
    `, data.allSigned ? 'Votre bail est maintenant actif !' : `${data.signerName} a signé le bail.`),
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
        <p>Bonjour ${data.tenantName},</p>
        <p><strong>${data.ownerName}</strong> vous invite à rejoindre le logement suivant sur Talok :</p>
        
        <div class="highlight-box">
          <p style="font-weight: 600; color: ${COLORS.gray[900]}; margin-bottom: 8px;">${data.propertyAddress}</p>
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
    `, `${data.ownerName} vous invite à rejoindre ${data.propertyAddress}`),
  }),

  /**
   * Bienvenue - nouveau compte créé
   */
  welcome: (data: {
    userName: string;
    role: 'owner' | 'tenant' | 'provider';
    loginUrl: string;
  }) => {
    const roleInfo = {
      owner: { title: 'propriétaire', emoji: '🏠' },
      tenant: { title: 'locataire', emoji: '🔑' },
      provider: { title: 'prestataire', emoji: '🔧' },
    };
    
    return {
      subject: `${roleInfo[data.role].emoji} Bienvenue sur Talok !`,
      html: baseLayout(`
        <div class="content">
          <div style="text-align: center; margin-bottom: 24px;">
            <span style="font-size: 48px;">${roleInfo[data.role].emoji}</span>
          </div>
          
          <h1 style="text-align: center;">Bienvenue ${data.userName} !</h1>
          <p style="text-align: center;">Votre compte ${roleInfo[data.role].title} a été créé avec succès.</p>
          
          <div class="divider"></div>
          
          <p>Avec Talok, vous pouvez :</p>
          <ul style="color: ${COLORS.gray[700]};">
            ${data.role === 'owner' ? `
              <li>Gérer vos logements et locataires</li>
              <li>Créer et faire signer des baux en ligne</li>
              <li>Suivre vos loyers et paiements</li>
              <li>Gérer la maintenance via des tickets</li>
            ` : data.role === 'tenant' ? `
              <li>Consulter et signer vos baux</li>
              <li>Payer votre loyer en ligne</li>
              <li>Télécharger vos quittances</li>
              <li>Signaler des problèmes de maintenance</li>
            ` : `
              <li>Recevoir des demandes d'intervention</li>
              <li>Gérer vos devis et factures</li>
              <li>Suivre vos missions en cours</li>
            `}
          </ul>
          
          <div style="text-align: center;">
            <a href="${data.loginUrl}" class="button">Accéder à mon espace</a>
          </div>
        </div>
      `, `Bienvenue sur Talok, votre espace ${roleInfo[data.role].title} est prêt.`),
    };
  },

  /**
   * Réinitialisation de mot de passe
   */
  passwordReset: (data: {
    userName: string;
    resetUrl: string;
    expiresIn: string;
  }) => ({
    subject: `🔐 Réinitialisation de mot de passe`,
    html: baseLayout(`
      <div class="content">
        <h1>Réinitialisation de mot de passe</h1>
        <p>Bonjour ${data.userName},</p>
        <p>Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe :</p>
        
        <div style="text-align: center;">
          <a href="${data.resetUrl}" class="button">Réinitialiser mon mot de passe</a>
        </div>
        
        <p style="font-size: 14px; color: ${COLORS.gray[500]};">
          Ce lien expire dans ${data.expiresIn}. Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email en toute sécurité.
        </p>
      </div>
    `, 'Réinitialisez votre mot de passe Talok.'),
  }),

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
      subject: `📢 Évolution de votre abonnement ${data.planName}`,
      html: baseLayout(`
        <div class="content">
          <div style="text-align: center; margin-bottom: 24px;">
            <span class="badge ${priceIncrease ? 'badge-warning' : 'badge-info'}">
              MODIFICATION TARIFAIRE
            </span>
          </div>
          
          <h1>Évolution de votre abonnement</h1>
          <p>Bonjour ${data.userName},</p>
          <p>Conformément à l'article L121-84 du Code de la consommation, nous vous informons d'une évolution des tarifs de votre plan <strong>${data.planName}</strong>.</p>
          
          <div class="divider"></div>
          
          <h2 style="font-size: 18px; margin-bottom: 16px;">Modification tarifaire</h2>
          
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 24px;">
            <tr>
              <td style="padding: 16px; background: ${COLORS.gray[50]}; border-radius: 8px 0 0 8px; text-align: center; width: 45%;">
                <p style="color: ${COLORS.gray[500]}; font-size: 12px; margin: 0 0 8px 0;">ANCIEN TARIF</p>
                <p style="text-decoration: line-through; color: ${COLORS.gray[400]}; font-size: 24px; font-weight: 600; margin: 0;">
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
      `, `Évolution tarifaire de votre plan ${data.planName} - Action requise`),
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
        <p>Bonjour ${data.userName},</p>
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
};


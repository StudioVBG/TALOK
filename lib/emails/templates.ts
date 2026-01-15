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
    subject: `📅 Nouvelle demande de visite - ${data.propertyAddress}`,
    html: baseLayout(`
      <div class="content">
        <div style="text-align: center; margin-bottom: 24px;">
          <span class="badge badge-warning">DEMANDE DE VISITE</span>
        </div>

        <h1>Nouvelle demande de visite</h1>
        <p>Bonjour ${data.ownerName},</p>
        <p><strong>${data.tenantName}</strong> souhaite visiter votre bien.</p>

        <div class="info-grid">
          <div class="info-row">
            <span class="info-label">📍 Bien</span>
            <span class="info-value">${data.propertyAddress}</span>
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
          <p style="color: ${COLORS.gray[700]}; margin: 0;">${data.tenantMessage}</p>
        </div>
        ` : ''}

        <div style="text-align: center;">
          <a href="${data.bookingsUrl}" class="button">Voir les demandes de visite</a>
        </div>

        <p style="font-size: 14px; color: ${COLORS.gray[500]}; text-align: center;">
          Confirmez ou refusez cette demande depuis votre espace propriétaire.
        </p>
      </div>
    `, `Nouvelle demande de visite de ${data.tenantName}`),
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
    subject: `✅ Visite confirmée - ${data.propertyAddress}`,
    html: baseLayout(`
      <div class="content">
        <div style="text-align: center; margin-bottom: 24px;">
          <span class="badge badge-success">VISITE CONFIRMÉE</span>
        </div>

        <h1>Votre visite est confirmée !</h1>
        <p>Bonjour ${data.tenantName},</p>
        <p>Bonne nouvelle ! Le propriétaire a confirmé votre demande de visite.</p>

        <div class="highlight-box" style="border-left-color: ${COLORS.success};">
          <p style="font-weight: 600; color: ${COLORS.gray[900]}; margin-bottom: 12px;">📅 Rendez-vous prévu</p>
          <div class="info-grid" style="margin: 0;">
            <div class="info-row">
              <span class="info-label">📍 Adresse</span>
              <span class="info-value">${data.propertyAddress}</span>
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
    subject: `❌ Visite annulée - ${data.propertyAddress}`,
    html: baseLayout(`
      <div class="content">
        <div style="text-align: center; margin-bottom: 24px;">
          <span class="badge badge-error">VISITE ANNULÉE</span>
        </div>

        <h1>Votre visite a été annulée</h1>
        <p>Bonjour ${data.tenantName},</p>
        <p>Malheureusement, la visite prévue ${data.cancelledBy === 'owner' ? 'a été annulée par le propriétaire' : 'a été annulée'}.</p>

        <div class="info-grid">
          <div class="info-row">
            <span class="info-label">📍 Bien</span>
            <span class="info-value">${data.propertyAddress}</span>
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
    `, `Visite annulée - ${data.propertyAddress}`),
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
    subject: `⏰ Rappel : Visite ${data.hoursBeforeVisit === 24 ? 'demain' : 'dans 1 heure'} - ${data.propertyAddress}`,
    html: baseLayout(`
      <div class="content">
        <div style="text-align: center; margin-bottom: 24px;">
          <span class="badge badge-info">RAPPEL DE VISITE</span>
        </div>

        <h1>N'oubliez pas votre visite !</h1>
        <p>Bonjour ${data.recipientName},</p>
        <p>${data.hoursBeforeVisit === 24
          ? 'Votre visite est prévue pour demain.'
          : 'Votre visite commence dans environ 1 heure.'}</p>

        <div class="highlight-box" style="border-left-color: ${COLORS.primary};">
          <div class="info-grid" style="margin: 0;">
            <div class="info-row">
              <span class="info-label">📍 Adresse</span>
              <span class="info-value">${data.propertyAddress}</span>
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
              <span class="info-value">${data.contactName}${data.contactPhone ? ` - ${data.contactPhone}` : ''}</span>
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
    subject: `💬 Comment s'est passée votre visite ? - ${data.propertyAddress}`,
    html: baseLayout(`
      <div class="content">
        <h1>Comment s'est passée votre visite ?</h1>
        <p>Bonjour ${data.tenantName},</p>
        <p>Vous avez visité le bien situé au <strong>${data.propertyAddress}</strong> le ${data.visitDate}.</p>
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
    role: 'owner' | 'tenant' | 'provider' | 'guarantor';
    onboardingUrl: string;
    supportEmail?: string;
  }) => {
    const roleConfig = {
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
    };

    const config = roleConfig[data.role];

    return {
      subject: `${config.emoji} Bienvenue sur Talok, ${data.userName} !`,
      html: baseLayout(`
        <div class="content">
          <div style="text-align: center; margin-bottom: 32px;">
            <div style="display: inline-block; width: 80px; height: 80px; background: linear-gradient(135deg, ${COLORS.primary} 0%, #8b5cf6 100%); border-radius: 20px; line-height: 80px; font-size: 40px;">
              ${config.emoji}
            </div>
          </div>

          <h1 style="text-align: center;">Bienvenue sur Talok !</h1>
          <p style="text-align: center; font-size: 18px;">
            Bonjour ${data.userName}, votre espace ${config.title} est prêt.
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
      `, `Bienvenue ${data.userName} ! Configurez votre espace ${config.title} sur Talok.`),
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
    subject: `⏰ ${data.userName}, finalisez votre inscription sur Talok`,
    html: baseLayout(`
      <div class="content">
        <h1>Votre profil vous attend !</h1>
        <p>Bonjour ${data.userName},</p>
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
      subject: `📋 ${data.userName}, votre espace Talok n'est pas encore prêt`,
      html: baseLayout(`
        <div class="content">
          <div style="text-align: center; margin-bottom: 24px;">
            <span class="badge badge-warning">PROFIL INCOMPLET</span>
          </div>

          <h1 style="text-align: center;">On vous attend, ${data.userName} !</h1>
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
    subject: `💭 ${data.userName}, nous pensons à vous`,
    html: baseLayout(`
      <div class="content">
        <h1>Vous nous manquez, ${data.userName} !</h1>
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
      subject: `🎉 Bravo ${data.userName}, votre espace est prêt !`,
      html: baseLayout(`
        <div class="content">
          <div style="text-align: center; margin-bottom: 32px;">
            <div style="display: inline-block; width: 100px; height: 100px; background: linear-gradient(135deg, ${COLORS.success} 0%, #059669 100%); border-radius: 50%; line-height: 100px; font-size: 50px;">
              🎉
            </div>
          </div>

          <h1 style="text-align: center;">Félicitations, ${data.userName} !</h1>
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
};


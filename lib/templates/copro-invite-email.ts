// =====================================================
// Template Email: Invitation COPRO
// =====================================================

export interface CoproInviteEmailData {
  first_name: string;
  site_name: string;
  lot_number?: string;
  role_label: string;
  invite_url: string;
  personal_message?: string;
  expires_at: string;
  syndic_name?: string;
  syndic_email?: string;
}

export function generateCoproInviteEmail(data: CoproInviteEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const expiresDate = new Date(data.expires_at).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const subject = `Invitation à rejoindre la copropriété ${data.site_name}`;

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      line-height: 1.6;
      color: #1e293b;
      background-color: #f8fafc;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    .card {
      background: white;
      border-radius: 16px;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #06b6d4, #3b82f6);
      padding: 32px;
      text-align: center;
    }
    .header h1 {
      color: white;
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
    .content {
      padding: 32px;
    }
    .greeting {
      font-size: 18px;
      margin-bottom: 16px;
    }
    .info-box {
      background: #f1f5f9;
      border-radius: 12px;
      padding: 20px;
      margin: 24px 0;
    }
    .info-item {
      display: flex;
      align-items: center;
      margin-bottom: 12px;
    }
    .info-item:last-child {
      margin-bottom: 0;
    }
    .info-label {
      color: #64748b;
      font-size: 14px;
      min-width: 120px;
    }
    .info-value {
      font-weight: 600;
      color: #0f172a;
    }
    .message-box {
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 16px;
      margin: 24px 0;
      border-radius: 0 8px 8px 0;
    }
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #06b6d4, #3b82f6);
      color: white;
      text-decoration: none;
      padding: 16px 32px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      margin: 24px 0;
    }
    .cta-button:hover {
      opacity: 0.9;
    }
    .expiry {
      color: #64748b;
      font-size: 14px;
      margin-top: 16px;
    }
    .footer {
      padding: 24px 32px;
      background: #f8fafc;
      text-align: center;
      font-size: 12px;
      color: #64748b;
    }
    .footer a {
      color: #06b6d4;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <h1>🏢 Invitation Copropriété</h1>
      </div>
      
      <div class="content">
        <p class="greeting">
          Bonjour <strong>${data.first_name}</strong>,
        </p>
        
        <p>
          Vous êtes invité(e) à rejoindre l'espace copropriétaire de 
          <strong>${data.site_name}</strong>.
        </p>
        
        <div class="info-box">
          <div class="info-item">
            <span class="info-label">Copropriété</span>
            <span class="info-value">${data.site_name}</span>
          </div>
          ${data.lot_number ? `
          <div class="info-item">
            <span class="info-label">Lot attribué</span>
            <span class="info-value">Lot n°${data.lot_number}</span>
          </div>
          ` : ''}
          <div class="info-item">
            <span class="info-label">Votre rôle</span>
            <span class="info-value">${data.role_label}</span>
          </div>
        </div>
        
        ${data.personal_message ? `
        <div class="message-box">
          <strong>Message du syndic :</strong>
          <p style="margin: 8px 0 0 0;">${data.personal_message}</p>
        </div>
        ` : ''}
        
        <p>
          En acceptant cette invitation, vous aurez accès à :
        </p>
        <ul>
          <li>📊 Vos appels de charges et le suivi de vos paiements</li>
          <li>📄 Les documents de la copropriété</li>
          <li>🗳️ Les assemblées générales et votes en ligne</li>
          <li>🔧 Les signalements et demandes de maintenance</li>
        </ul>
        
        <div style="text-align: center;">
          <a href="${data.invite_url}" class="cta-button">
            Accepter l'invitation →
          </a>
        </div>
        
        <p class="expiry">
          ⏳ Cette invitation expire le <strong>${expiresDate}</strong>.
        </p>
      </div>
      
      <div class="footer">
        <p>
          Si vous n'attendiez pas cette invitation, vous pouvez ignorer cet email.
        </p>
        ${data.syndic_email ? `
        <p>
          Contact syndic : <a href="mailto:${data.syndic_email}">${data.syndic_email}</a>
        </p>
        ` : ''}
        <p style="margin-top: 16px;">
          © ${new Date().getFullYear()} Talok SaaS
        </p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `
Bonjour ${data.first_name},

Vous êtes invité(e) à rejoindre l'espace copropriétaire de ${data.site_name}.

Détails de l'invitation :
- Copropriété : ${data.site_name}
${data.lot_number ? `- Lot attribué : Lot n°${data.lot_number}` : ''}
- Votre rôle : ${data.role_label}

${data.personal_message ? `Message du syndic : ${data.personal_message}\n` : ''}
Pour accepter cette invitation, cliquez sur le lien suivant :
${data.invite_url}

Cette invitation expire le ${expiresDate}.

En acceptant, vous aurez accès à :
- Vos appels de charges et le suivi de vos paiements
- Les documents de la copropriété
- Les assemblées générales et votes en ligne
- Les signalements et demandes de maintenance

Si vous n'attendiez pas cette invitation, vous pouvez ignorer cet email.

${data.syndic_email ? `Contact syndic : ${data.syndic_email}` : ''}

© ${new Date().getFullYear()} Talok SaaS
  `.trim();

  return { subject, html, text };
}

export default generateCoproInviteEmail;


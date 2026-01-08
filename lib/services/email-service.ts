/**
 * Service d'envoi d'emails
 * 
 * Compatible avec :
 * - Resend (recommandé)
 * - SendGrid
 * - Postmark
 * - SMTP générique
 * 
 * Récupère automatiquement les credentials depuis la DB (Admin > Intégrations)
 * ou utilise les variables d'environnement en fallback.
 */

import { getResendCredentials } from "./credentials-service";

// Types
export type EmailProvider = "resend" | "sendgrid" | "postmark" | "smtp";

export interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  contentType?: string;
}

export interface EmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
  attachments?: EmailAttachment[];
  tags?: string[];
  metadata?: Record<string, string>;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  simulated?: boolean;
  details?: string;
}

export interface EmailTemplate {
  id: string;
  subject: string;
  html: string;
  text?: string;
}

// Configuration
const config = {
  provider: (process.env.EMAIL_PROVIDER as EmailProvider) || "resend",
  apiKey: process.env.RESEND_API_KEY || process.env.EMAIL_API_KEY || "",
  from: process.env.EMAIL_FROM || "Talok <noreply@talok.fr>",
  replyTo: process.env.EMAIL_REPLY_TO,
  // Forcer l'envoi même en dev si cette variable est définie
  forceSend: process.env.EMAIL_FORCE_SEND === "true",
};

/**
 * Remplace les variables dans un template
 */
function interpolate(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{${key}}}`, "g"), value);
  }
  return result;
}

/**
 * Envoie un email via Resend
 * Récupère les credentials depuis la DB ou les variables d'environnement
 */
async function sendViaResend(options: EmailOptions): Promise<EmailResult> {
  try {
    // Récupérer les credentials depuis la DB ou l'environnement
    let apiKey = config.apiKey;
    let fromAddress = options.from || config.from;
    
    console.log("[Email] sendViaResend appelé, destinataire:", options.to);
    
    // Essayer de récupérer depuis la DB
    try {
      const dbCredentials = await getResendCredentials();
      console.log("[Email] Credentials DB:", dbCredentials ? "trouvés" : "non trouvés");
      if (dbCredentials) {
        apiKey = dbCredentials.apiKey;
        console.log("[Email] API Key (premiers caractères):", apiKey?.substring(0, 10) + "...");
        if (!options.from && dbCredentials.emailFrom) {
          fromAddress = dbCredentials.emailFrom;
        }
        console.log("[Email] Adresse d'expédition:", fromAddress);
      }
    } catch (credError) {
      console.warn("[Email] Impossible de récupérer les credentials DB, utilisation de l'environnement:", credError);
    }

    if (!apiKey) {
      console.error("[Email] ❌ Pas de clé API configurée");
      return { 
        success: false, 
        error: "Resend n'est pas configuré. Ajoutez votre clé API dans Admin > Intégrations." 
      };
    }

    // Corriger le format de l'adresse d'expédition si nécessaire
    // Resend exige le format "Nom <email@domain.com>" ou utiliser onboarding@resend.dev
    if (!fromAddress.includes("<") && !fromAddress.includes(">")) {
      // C'est juste une adresse email, vérifier si c'est un domaine vérifié
      if (fromAddress.includes("@gmail.com") || fromAddress.includes("@hotmail.com") || fromAddress.includes("@yahoo.com")) {
        console.warn("[Email] ⚠️ Adresse d'expédition non autorisée:", fromAddress);
        console.warn("[Email] ⚠️ Utilisation de onboarding@resend.dev (limité à l'email du propriétaire du compte)");
        fromAddress = "Talok <onboarding@resend.dev>";
      } else {
        fromAddress = `Talok <${fromAddress}>`;
      }
    }
    
    console.log("[Email] Adresse finale d'expédition:", fromAddress);

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: fromAddress,
        to: Array.isArray(options.to) ? options.to : [options.to],
        subject: options.subject,
        html: options.html,
        text: options.text,
        reply_to: options.replyTo || config.replyTo,
        cc: options.cc,
        bcc: options.bcc,
        attachments: options.attachments?.map((a) => ({
          filename: a.filename,
          content: typeof a.content === "string" ? a.content : a.content.toString("base64"),
        })),
        tags: options.tags?.map((t) => ({ name: t })),
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("[Email] ❌ Erreur Resend:", error);
      return { success: false, error: error.message || "Erreur Resend" };
    }

    const data = await response.json();
    console.log("[Email] ✅ Email envoyé avec succès! ID:", data.id);
    return { success: true, messageId: data.id };
  } catch (error) {
    console.error("[Email] ❌ Exception:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Envoie un email via SendGrid
 */
async function sendViaSendGrid(options: EmailOptions): Promise<EmailResult> {
  try {
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: (Array.isArray(options.to) ? options.to : [options.to]).map((email) => ({ email })),
            cc: options.cc?.map((email) => ({ email })),
            bcc: options.bcc?.map((email) => ({ email })),
          },
        ],
        from: { email: options.from || config.from },
        reply_to: options.replyTo ? { email: options.replyTo } : undefined,
        subject: options.subject,
        content: [
          options.text && { type: "text/plain", value: options.text },
          options.html && { type: "text/html", value: options.html },
        ].filter(Boolean),
        attachments: options.attachments?.map((a) => ({
          filename: a.filename,
          content: typeof a.content === "string" ? Buffer.from(a.content).toString("base64") : a.content.toString("base64"),
          type: a.contentType,
        })),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: error || "Erreur SendGrid" };
    }

    return { success: true, messageId: response.headers.get("x-message-id") || undefined };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Envoie un email (abstraction du provider)
 */
export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  // Validation
  if (!options.to || (Array.isArray(options.to) && options.to.length === 0)) {
    return { success: false, error: "Destinataire requis" };
  }
  if (!options.subject) {
    return { success: false, error: "Sujet requis" };
  }
  if (!options.html && !options.text) {
    return { success: false, error: "Contenu requis (html ou text)" };
  }

  // Vérifier si on a une clé API configurée (env OU db)
  let hasApiKey = !!config.apiKey;
  
  // Si pas de clé en env, vérifier dans la DB
  if (!hasApiKey) {
    try {
      const dbCredentials = await getResendCredentials();
      hasApiKey = !!dbCredentials?.apiKey;
      if (hasApiKey) {
        console.log("[Email] ✅ Clé API trouvée dans la base de données");
      }
    } catch (e) {
      console.warn("[Email] Impossible de vérifier les credentials DB");
    }
  }

  // Log en développement (sauf si forceSend est activé)
  if (process.env.NODE_ENV === "development" && !config.forceSend) {
    console.log("[Email] 📧 Envoi simulé (mode dev):", {
      to: options.to,
      subject: options.subject,
    });
    console.log("[Email] 💡 Pour envoyer réellement, ajoutez EMAIL_FORCE_SEND=true dans .env.local");
    return { success: true, messageId: `dev-${Date.now()}`, simulated: true };
  }

  // Vérifier qu'on a une clé API
  if (!hasApiKey) {
    console.error("[Email] ❌ Aucune clé API configurée (ni RESEND_API_KEY en env, ni dans la DB)");
    return { success: false, error: "Clé API email non configurée" };
  }

  console.log("[Email] 📤 Envoi réel via", config.provider, "à", options.to);

  // Sélection du provider
  switch (config.provider) {
    case "resend":
      return sendViaResend(options);
    case "sendgrid":
      return sendViaSendGrid(options);
    default:
      return { success: false, error: `Provider non supporté: ${config.provider}` };
  }
}

/**
 * Envoie un email depuis un template
 */
export async function sendTemplateEmail(
  templateId: string,
  to: string | string[],
  variables: Record<string, string>
): Promise<EmailResult> {
  const template = EMAIL_TEMPLATES[templateId];
  if (!template) {
    return { success: false, error: `Template inconnu: ${templateId}` };
  }

  return sendEmail({
    to,
    subject: interpolate(template.subject, variables),
    html: interpolate(template.html, variables),
    text: template.text ? interpolate(template.text, variables) : undefined,
  });
}

// ============================================
// TEMPLATES D'EMAILS
// ============================================

const baseStyles = `
  body { font-family: 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; }
  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
  .header { background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
  .header h1 { margin: 0; font-size: 24px; }
  .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; }
  .footer { background: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; }
  .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; }
  .button:hover { background: #2563eb; }
  .highlight { background: #f0f9ff; padding: 15px; border-radius: 6px; margin: 15px 0; }
  .amount { font-size: 28px; font-weight: 700; color: #3b82f6; }
`;

export const EMAIL_TEMPLATES: Record<string, EmailTemplate> = {
  // Bienvenue
  welcome: {
    id: "welcome",
    subject: "Bienvenue sur Talok, {{name}} !",
    html: `
<!DOCTYPE html>
<html>
<head><style>${baseStyles}</style></head>
<body>
<div class="container">
  <div class="header">
    <h1>🏠 Bienvenue !</h1>
  </div>
  <div class="content">
    <p>Bonjour {{name}},</p>
    <p>Nous sommes ravis de vous accueillir sur <strong>Talok</strong> !</p>
    <p>Votre compte a été créé avec succès. Vous pouvez maintenant :</p>
    <ul>
      <li>Ajouter vos biens immobiliers</li>
      <li>Gérer vos locataires</li>
      <li>Suivre vos loyers et paiements</li>
      <li>Générer des documents automatiquement</li>
    </ul>
    <p style="text-align: center; margin: 30px 0;">
      <a href="{{dashboard_url}}" class="button">Accéder à mon espace</a>
    </p>
    <p>Si vous avez des questions, notre équipe est là pour vous aider.</p>
  </div>
  <div class="footer">
    <p>© {{year}} Talok. Tous droits réservés.</p>
  </div>
</div>
</body>
</html>
    `,
  },

  // Quittance de loyer
  rent_receipt: {
    id: "rent_receipt",
    subject: "Quittance de loyer - {{period}}",
    html: `
<!DOCTYPE html>
<html>
<head><style>${baseStyles}</style></head>
<body>
<div class="container">
  <div class="header">
    <h1>📄 Quittance de loyer</h1>
  </div>
  <div class="content">
    <p>Bonjour {{tenant_name}},</p>
    <p>Veuillez trouver ci-joint votre quittance de loyer pour la période de <strong>{{period}}</strong>.</p>
    
    <div class="highlight">
      <p style="margin: 0;"><strong>Bien :</strong> {{property_address}}</p>
      <p style="margin: 5px 0 0;"><strong>Montant :</strong> <span class="amount">{{amount}} €</span></p>
    </div>
    
    <p>Ce document atteste du paiement de votre loyer.</p>
    
    <p style="text-align: center; margin: 30px 0;">
      <a href="{{receipt_url}}" class="button">Télécharger la quittance</a>
    </p>
  </div>
  <div class="footer">
    <p>© {{year}} Talok. Tous droits réservés.</p>
  </div>
</div>
</body>
</html>
    `,
  },

  // Rappel de loyer
  rent_reminder: {
    id: "rent_reminder",
    subject: "Rappel : Loyer de {{period}} en attente",
    html: `
<!DOCTYPE html>
<html>
<head><style>${baseStyles}</style></head>
<body>
<div class="container">
  <div class="header" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);">
    <h1>⏰ Rappel de paiement</h1>
  </div>
  <div class="content">
    <p>Bonjour {{tenant_name}},</p>
    <p>Nous n'avons pas encore reçu le paiement de votre loyer pour <strong>{{period}}</strong>.</p>
    
    <div class="highlight" style="background: #fef3c7;">
      <p style="margin: 0;"><strong>Montant dû :</strong> <span class="amount" style="color: #d97706;">{{amount}} €</span></p>
      <p style="margin: 5px 0 0;"><strong>Échéance :</strong> {{due_date}}</p>
    </div>
    
    <p>Merci de régulariser votre situation dans les meilleurs délais.</p>
    
    <p style="text-align: center; margin: 30px 0;">
      <a href="{{payment_url}}" class="button" style="background: #f59e0b;">Payer maintenant</a>
    </p>
    
    <p style="font-size: 14px; color: #6b7280;">
      Si vous avez déjà effectué le paiement, veuillez ignorer ce message.
    </p>
  </div>
  <div class="footer">
    <p>© {{year}} Talok. Tous droits réservés.</p>
  </div>
</div>
</body>
</html>
    `,
  },

  // Nouveau ticket
  ticket_created: {
    id: "ticket_created",
    subject: "Nouvelle demande : {{ticket_title}}",
    html: `
<!DOCTYPE html>
<html>
<head><style>${baseStyles}</style></head>
<body>
<div class="container">
  <div class="header">
    <h1>🎫 Nouvelle demande</h1>
  </div>
  <div class="content">
    <p>Bonjour {{owner_name}},</p>
    <p>Une nouvelle demande a été créée par votre locataire.</p>
    
    <div class="highlight">
      <p style="margin: 0;"><strong>Titre :</strong> {{ticket_title}}</p>
      <p style="margin: 5px 0 0;"><strong>Bien :</strong> {{property_address}}</p>
      <p style="margin: 5px 0 0;"><strong>Créé par :</strong> {{tenant_name}}</p>
      <p style="margin: 5px 0 0;"><strong>Priorité :</strong> {{priority}}</p>
    </div>
    
    <p style="text-align: center; margin: 30px 0;">
      <a href="{{ticket_url}}" class="button">Voir la demande</a>
    </p>
  </div>
  <div class="footer">
    <p>© {{year}} Talok. Tous droits réservés.</p>
  </div>
</div>
</body>
</html>
    `,
  },

  // Signature de bail
  lease_signature: {
    id: "lease_signature",
    subject: "Signature requise : Bail pour {{property_address}}",
    html: `
<!DOCTYPE html>
<html>
<head><style>${baseStyles}</style></head>
<body>
<div class="container">
  <div class="header" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
    <h1>✍️ Signature requise</h1>
  </div>
  <div class="content">
    <p>Bonjour {{recipient_name}},</p>
    <p>Un contrat de bail est en attente de votre signature.</p>
    
    <div class="highlight" style="background: #d1fae5;">
      <p style="margin: 0;"><strong>Bien :</strong> {{property_address}}</p>
      <p style="margin: 5px 0 0;"><strong>Type de bail :</strong> {{lease_type}}</p>
      <p style="margin: 5px 0 0;"><strong>Date de début :</strong> {{start_date}}</p>
      <p style="margin: 5px 0 0;"><strong>Loyer :</strong> {{rent}} €/mois</p>
    </div>
    
    <p>Veuillez signer ce document avant le <strong>{{expiry_date}}</strong>.</p>
    
    <p style="text-align: center; margin: 30px 0;">
      <a href="{{signature_url}}" class="button" style="background: #10b981;">Signer le bail</a>
    </p>
  </div>
  <div class="footer">
    <p>© {{year}} Talok. Tous droits réservés.</p>
  </div>
</div>
</body>
</html>
    `,
  },

  // Paiement reçu (pour le propriétaire)
  payment_received: {
    id: "payment_received",
    subject: "Paiement reçu : {{amount}} € de {{tenant_name}}",
    html: `
<!DOCTYPE html>
<html>
<head><style>${baseStyles}</style></head>
<body>
<div class="container">
  <div class="header" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
    <h1>💰 Paiement reçu</h1>
  </div>
  <div class="content">
    <p>Bonjour {{owner_name}},</p>
    <p>Un paiement a été enregistré avec succès.</p>
    
    <div class="highlight" style="background: #d1fae5;">
      <p style="margin: 0; text-align: center;"><span class="amount" style="color: #10b981;">{{amount}} €</span></p>
      <hr style="border: none; border-top: 1px solid #a7f3d0; margin: 15px 0;">
      <p style="margin: 0;"><strong>Locataire :</strong> {{tenant_name}}</p>
      <p style="margin: 5px 0 0;"><strong>Bien :</strong> {{property_address}}</p>
      <p style="margin: 5px 0 0;"><strong>Période :</strong> {{period}}</p>
      <p style="margin: 5px 0 0;"><strong>Date :</strong> {{payment_date}}</p>
    </div>
    
    <p style="text-align: center; margin: 30px 0;">
      <a href="{{dashboard_url}}" class="button" style="background: #10b981;">Voir mes finances</a>
    </p>
  </div>
  <div class="footer">
    <p>© {{year}} Talok. Tous droits réservés.</p>
  </div>
</div>
</body>
</html>
    `,
  },

  // Invitation bail (pour le locataire)
  lease_invite: {
    id: "lease_invite",
    subject: "{{owner_name}} vous invite à signer un bail",
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invitation à signer votre bail</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #3b82f6, #8b5cf6); padding: 32px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">📄 Nouveau bail à signer</h1>
    </div>

    <!-- Content -->
    <div style="padding: 32px;">
      <p style="font-size: 16px; color: #374151; margin: 0 0 24px 0;">
        {{greeting}},
      </p>
      
      <p style="font-size: 16px; color: #374151; margin: 0 0 24px 0;">
        <strong>{{owner_name}}</strong> vous invite à signer un contrat de bail pour le logement suivant :
      </p>

      <!-- Property card -->
      <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <p style="margin: 0 0 8px 0; font-size: 14px; color: #64748b;">📍 Adresse</p>
        <p style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: #1e293b;">
          {{property_address}}
        </p>
        
        <table style="width: 100%;">
          <tr>
            <td style="vertical-align: top; padding-right: 20px;">
              <p style="margin: 0 0 4px 0; font-size: 14px; color: #64748b;">💰 Loyer</p>
              <p style="margin: 0; font-size: 18px; font-weight: 700; color: #3b82f6;">
                {{total_rent}} €/mois
              </p>
              <p style="margin: 4px 0 0 0; font-size: 12px; color: #94a3b8;">
                {{rent}} € + {{charges}} € charges
              </p>
            </td>
            <td style="vertical-align: top;">
              <p style="margin: 0 0 4px 0; font-size: 14px; color: #64748b;">📋 Type</p>
              <p style="margin: 0; font-size: 16px; font-weight: 600; color: #1e293b;">
                {{lease_type}}
              </p>
            </td>
          </tr>
        </table>
      </div>

      <!-- Steps -->
      <p style="font-size: 14px; color: #64748b; margin: 0 0 16px 0;">
        Pour finaliser votre bail, vous devrez :
      </p>
      
      <div style="margin-bottom: 24px;">
        <table style="width: 100%;">
          <tr>
            <td style="width: 36px; vertical-align: top; padding-bottom: 12px;">
              <div style="width: 24px; height: 24px; background: #3b82f6; border-radius: 50%; color: white; font-size: 12px; font-weight: bold; text-align: center; line-height: 24px;">1</div>
            </td>
            <td style="vertical-align: top; padding-bottom: 12px;">
              <p style="margin: 0; font-weight: 600; color: #1e293b;">Vérifier votre identité</p>
              <p style="margin: 4px 0 0 0; font-size: 14px; color: #64748b;">Scan de votre CNI ou France Identité</p>
            </td>
          </tr>
          <tr>
            <td style="width: 36px; vertical-align: top; padding-bottom: 12px;">
              <div style="width: 24px; height: 24px; background: #3b82f6; border-radius: 50%; color: white; font-size: 12px; font-weight: bold; text-align: center; line-height: 24px;">2</div>
            </td>
            <td style="vertical-align: top; padding-bottom: 12px;">
              <p style="margin: 0; font-weight: 600; color: #1e293b;">Relire le bail</p>
              <p style="margin: 4px 0 0 0; font-size: 14px; color: #64748b;">Vérifiez toutes les informations du contrat</p>
            </td>
          </tr>
          <tr>
            <td style="width: 36px; vertical-align: top;">
              <div style="width: 24px; height: 24px; background: #3b82f6; border-radius: 50%; color: white; font-size: 12px; font-weight: bold; text-align: center; line-height: 24px;">3</div>
            </td>
            <td style="vertical-align: top;">
              <p style="margin: 0; font-weight: 600; color: #1e293b;">Signer électroniquement</p>
              <p style="margin: 4px 0 0 0; font-size: 14px; color: #64748b;">Signature sécurisée avec code SMS</p>
            </td>
          </tr>
        </table>
      </div>

      <!-- CTA Button -->
      <div style="text-align: center; margin: 32px 0;">
        <a href="{{invite_url}}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: white; text-decoration: none; padding: 16px 32px; border-radius: 12px; font-weight: 600; font-size: 16px;">
          ✍️ Compléter et signer mon bail
        </a>
      </div>

      <p style="font-size: 14px; color: #94a3b8; text-align: center; margin: 0;">
        Ce lien expire dans 7 jours.
      </p>
    </div>

    <!-- Footer -->
    <div style="background: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #e2e8f0;">
      <p style="margin: 0 0 8px 0; font-size: 14px; color: #64748b;">
        🔒 Signature électronique sécurisée
      </p>
      <p style="margin: 0; font-size: 12px; color: #94a3b8;">
        © {{year}} Talok - Votre solution de gestion immobilière
      </p>
    </div>
  </div>
</body>
</html>
    `,
  },
};

// ============================================
// FONCTIONS UTILITAIRES
// ============================================

/**
 * Envoie un email de bienvenue
 */
export async function sendWelcomeEmail(
  to: string,
  name: string,
  dashboardUrl: string
): Promise<EmailResult> {
  return sendTemplateEmail("welcome", to, {
    name,
    dashboard_url: dashboardUrl,
    year: new Date().getFullYear().toString(),
  });
}

/**
 * Envoie une quittance de loyer
 */
export async function sendRentReceiptEmail(
  to: string,
  tenantName: string,
  period: string,
  amount: number,
  propertyAddress: string,
  receiptUrl: string
): Promise<EmailResult> {
  return sendTemplateEmail("rent_receipt", to, {
    tenant_name: tenantName,
    period,
    amount: amount.toLocaleString("fr-FR"),
    property_address: propertyAddress,
    receipt_url: receiptUrl,
    year: new Date().getFullYear().toString(),
  });
}

/**
 * Envoie un rappel de loyer
 */
export async function sendRentReminderEmail(
  to: string,
  tenantName: string,
  period: string,
  amount: number,
  dueDate: string,
  paymentUrl: string
): Promise<EmailResult> {
  return sendTemplateEmail("rent_reminder", to, {
    tenant_name: tenantName,
    period,
    amount: amount.toLocaleString("fr-FR"),
    due_date: dueDate,
    payment_url: paymentUrl,
    year: new Date().getFullYear().toString(),
  });
}

/**
 * Envoie une notification de paiement reçu
 */
export async function sendPaymentReceivedEmail(
  to: string,
  ownerName: string,
  tenantName: string,
  amount: number,
  propertyAddress: string,
  period: string,
  paymentDate: string,
  dashboardUrl: string
): Promise<EmailResult> {
  return sendTemplateEmail("payment_received", to, {
    owner_name: ownerName,
    tenant_name: tenantName,
    amount: amount.toLocaleString("fr-FR"),
    property_address: propertyAddress,
    period,
    payment_date: paymentDate,
    dashboard_url: dashboardUrl,
    year: new Date().getFullYear().toString(),
  });
}

/**
 * Envoie une invitation de bail au locataire, colocataire ou garant
 */
export async function sendLeaseInviteEmail(params: {
  to: string;
  tenantName?: string;
  ownerName: string;
  propertyAddress: string;
  rent: number;
  charges: number;
  leaseType: string;
  inviteUrl: string;
  role?: "locataire_principal" | "colocataire" | "garant";
  isReminder?: boolean;
}): Promise<EmailResult> {
  const leaseTypeLabels: Record<string, string> = {
    nu: "Location nue",
    meuble: "Location meublée",
    colocation: "Colocation",
    saisonnier: "Location saisonnière",
    mobilite: "Bail mobilité",
  };

  const roleLabels: Record<string, string> = {
    locataire_principal: "locataire principal",
    colocataire: "colocataire",
    garant: "garant",
  };

  const roleText = params.role ? roleLabels[params.role] : "locataire";
  const isGuarantor = params.role === "garant";

  const totalRent = params.rent + params.charges;
  const greeting = params.tenantName ? `Bonjour ${params.tenantName}` : "Bonjour";

  // Adapter le message selon le rôle et si c'est un rappel
  let actionText: string;
  if (isGuarantor) {
    actionText = params.isReminder 
      ? "Rappel : vous avez été invité(e) à vous porter garant"
      : "Vous avez été invité(e) à vous porter garant";
  } else {
    actionText = params.isReminder
      ? `Rappel : vous avez été invité(e) en tant que ${roleText}`
      : `Vous avez été invité(e) en tant que ${roleText}`;
  }

  return sendTemplateEmail("lease_invite", params.to, {
    greeting,
    owner_name: params.ownerName,
    property_address: params.propertyAddress,
    total_rent: totalRent.toLocaleString("fr-FR"),
    rent: params.rent.toLocaleString("fr-FR"),
    charges: params.charges.toLocaleString("fr-FR"),
    lease_type: leaseTypeLabels[params.leaseType] || params.leaseType,
    invite_url: params.inviteUrl,
    year: new Date().getFullYear().toString(),
    // Nouveaux champs pour le template
    role_text: roleText,
    action_text: actionText,
    is_guarantor: isGuarantor,
    is_reminder: params.isReminder || false,
  });
}

/**
 * Envoie un email de demande de signature de bail
 */
export async function sendLeaseSignatureEmail(
  to: string,
  recipientName: string,
  propertyAddress: string,
  leaseType: string,
  startDate: string,
  rent: number,
  signatureUrl: string,
  expiryDate: string
): Promise<EmailResult> {
  const leaseTypeLabels: Record<string, string> = {
    nu: "Location nue",
    meuble: "Location meublée",
    colocation: "Colocation",
    saisonnier: "Location saisonnière",
    mobilite: "Bail mobilité",
  };

  return sendTemplateEmail("lease_signature", to, {
    recipient_name: recipientName,
    property_address: propertyAddress,
    lease_type: leaseTypeLabels[leaseType] || leaseType,
    start_date: startDate,
    rent: rent.toLocaleString("fr-FR"),
    signature_url: signatureUrl,
    expiry_date: expiryDate,
    year: new Date().getFullYear().toString(),
  });
}

export default {
  sendEmail,
  sendTemplateEmail,
  sendWelcomeEmail,
  sendRentReceiptEmail,
  sendRentReminderEmail,
  sendPaymentReceivedEmail,
  sendLeaseInviteEmail,
  sendLeaseSignatureEmail,
  EMAIL_TEMPLATES,
};


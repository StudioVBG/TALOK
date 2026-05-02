/**
 * Service d'envoi d'emails
 * 
 * Compatible avec :
 * - Resend (recommandé)
 * 
 * Récupère automatiquement les credentials depuis la DB (Admin > Intégrations)
 * ou utilise les variables d'environnement en fallback.
 */

import {
  sendEmail as sendEmailViaResendSDK,
  sendVisitReminder as sendVisitReminderViaResend,
  sendPaymentConfirmation as sendPaymentConfirmationViaResend,
  sendTicketUpdateNotification as sendTicketUpdateNotificationViaResend,
  emailService as resendEmailService,
  sendWelcomeEmail as sendWelcomeEmailViaResend,
} from "@/lib/emails/resend.service";
import { resolveResendRuntimeConfig } from "./resend-config";

export { sendVisitReminderViaResend as sendVisitReminderEmail };
export { sendPaymentConfirmationViaResend as sendPaymentConfirmation };
export { sendTicketUpdateNotificationViaResend as sendTicketUpdateNotification };
export { resendEmailService as emailService };
export { sendWelcomeEmailViaResend as sendWelcomeEmail };

// Types
export type EmailProvider = "resend";

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
  tags?: Array<{ name: string; value: string }>;
  idempotencyKey?: string;
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

export interface EmailConfigurationStatus {
  provider: EmailProvider;
  nodeEnv: string;
  configured: boolean;
  canSendLive: boolean;
  deliveryMode: "live" | "simulation";
  sources: {
    apiKey: "environment" | "database" | "none";
    fromAddress: "environment" | "database" | "default";
  };
  env: {
    hasResendApiKey: boolean;
    hasEmailApiKey: boolean;
    hasEmailFrom: boolean;
    hasReplyTo: boolean;
    hasAppUrl: boolean;
    hasPasswordResetCookieSecret: boolean;
    forceSend: boolean;
  };
  database: {
    available: boolean;
    checkFailed: boolean;
    credentialEnv: string | null;
    hasEmailFrom: boolean;
  };
  resolved: {
    fromAddress: string;
    replyTo: string | null;
  };
  warnings: string[];
}

// Configuration
const config = {
  provider: (process.env.EMAIL_PROVIDER as EmailProvider) || "resend",
  // Forcer l'envoi même en dev si cette variable est définie
  forceSend: process.env.EMAIL_FORCE_SEND === "true",
};

export async function getEmailConfigurationStatus(): Promise<EmailConfigurationStatus> {
  const warnings: string[] = [];
  const nodeEnv = process.env.NODE_ENV || "development";
  const deliveryMode =
    nodeEnv === "development" && !config.forceSend ? "simulation" : "live";
  const resendConfig = await resolveResendRuntimeConfig();
  const apiKeySource = resendConfig.sources.apiKey;
  const fromAddressSource = resendConfig.sources.fromAddress;
  const rawFromAddress = resendConfig.rawFromAddress;
  const fromAddress = resendConfig.fromAddress;
  const replyTo = resendConfig.replyTo;

  if (deliveryMode === "simulation") {
    warnings.push(
      "Les emails sont simules en developpement tant que EMAIL_FORCE_SEND n'est pas active."
    );
  }

  if (apiKeySource === "none") {
    warnings.push(
      "Aucune cle API email active n'a ete detectee dans l'environnement ni dans Admin > Integrations."
    );
  }

  if (!process.env.NEXT_PUBLIC_APP_URL) {
    warnings.push("NEXT_PUBLIC_APP_URL est absente: les liens email peuvent etre invalides.");
  }

  if (!process.env.PASSWORD_RESET_COOKIE_SECRET) {
    warnings.push(
      "PASSWORD_RESET_COOKIE_SECRET est absente: le reset mot de passe utilise un secret de secours non adapte a la production."
    );
  }

  if (rawFromAddress.includes("@send.")) {
    warnings.push(
      "L'adresse d'expedition utilise un sous-domaine @send.* qui n'est probablement pas verifie dans Resend."
    );
  }

  if (fromAddress.includes("onboarding@resend.dev")) {
    warnings.push(
      "L'adresse d'expedition onboarding@resend.dev limite les envois a l'adresse du proprietaire du compte Resend."
    );
  }

  return {
    provider: config.provider,
    nodeEnv,
    configured: apiKeySource !== "none",
    canSendLive: apiKeySource !== "none" && deliveryMode === "live",
    deliveryMode,
    sources: {
      apiKey: apiKeySource,
      fromAddress: fromAddressSource,
    },
    env: {
      hasResendApiKey: Boolean(resendConfig.apiKey),
      hasEmailApiKey: Boolean(process.env.EMAIL_API_KEY),
      hasEmailFrom: Boolean(fromAddress),
      hasReplyTo: Boolean(replyTo),
      hasAppUrl: Boolean(process.env.NEXT_PUBLIC_APP_URL),
      hasPasswordResetCookieSecret: Boolean(process.env.PASSWORD_RESET_COOKIE_SECRET),
      forceSend: config.forceSend,
    },
    database: {
      available: resendConfig.sources.apiKey === "database",
      checkFailed: resendConfig.dbCheckFailed,
      credentialEnv: resendConfig.dbCredentialEnv,
      hasEmailFrom: resendConfig.sources.fromAddress === "database",
    },
    resolved: {
      fromAddress,
      replyTo,
    },
    warnings,
  };
}

import { emailTemplates } from "@/lib/emails/templates";

/**
 * Envoie un email via Resend
 *
 * Délègue au service resend.service.ts qui fournit :
 * - SDK Resend officiel
 * - Retry automatique (3 tentatives avec backoff exponentiel)
 * - Validation avancée (RFC 5322, domaines jetables)
 * - Logging structuré
 */
async function sendViaResend(options: EmailOptions): Promise<EmailResult> {
  try {
    const result = await sendEmailViaResendSDK({
      to: options.to,
      subject: options.subject,
      html: options.html || "",
      text: options.text,
      from: options.from,
      replyTo: options.replyTo,
      cc: options.cc,
      bcc: options.bcc,
      attachments: options.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
      })),
      tags: options.tags,
      idempotencyKey: options.idempotencyKey,
    });

    return {
      success: result.success,
      messageId: result.id,
      error: result.error,
    };
  } catch (error) {
    console.error("[Email] ❌ Exception:", error);
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

  // Note: La vérification des credentials et le mode simulation dev sont
  // gérés par resend.service.ts (délégation). On garde uniquement le
  // warning pour les environnements de staging mal configurés.
  if (process.env.NODE_ENV === "development" && !config.forceSend) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
    if (appUrl && !appUrl.includes("localhost") && !appUrl.includes("127.0.0.1")) {
      console.error(
        `[Email] ⚠️ ATTENTION: NODE_ENV=development mais APP_URL=${appUrl} semble être un environnement de production. ` +
        `Les emails sont SIMULÉS et ne seront PAS envoyés. Corrigez NODE_ENV ou ajoutez EMAIL_FORCE_SEND=true.`
      );
    }
  }

  // Sélection du provider
  switch (config.provider) {
    case "resend":
      return sendViaResend(options);
    default:
      return { success: false, error: `Provider non supporté: ${config.provider}` };
  }
}

// ============================================
// FONCTIONS UTILITAIRES (basées sur emailTemplates.*)
// ============================================

/**
 * @deprecated Utiliser sendEmail() directement avec emailTemplates.* pour les nouveaux flux.
 * Conservé pour compatibilité avec sendTemplateEmail("lease_invite", ...) dans le codebase.
 */
export async function sendTemplateEmail(
  templateId: string,
  to: string | string[],
  variables: Record<string, string>
): Promise<EmailResult> {
  const legacyMapper: Record<string, () => { subject: string; html: string }> = {
    lease_invite: () => emailTemplates.leaseInvite({
      tenantName: variables.greeting?.replace("Bonjour ", "") || "",
      ownerName: variables.owner_name,
      propertyAddress: variables.property_address,
      rent: Number(variables.rent?.replace(/\s/g, "").replace(",", ".")) || 0,
      charges: Number(variables.charges?.replace(/\s/g, "").replace(",", ".")) || 0,
      leaseType: variables.lease_type,
      inviteUrl: variables.invite_url,
    }),
  };

  const mapper = legacyMapper[templateId];
  if (!mapper) {
    return { success: false, error: `Template legacy inconnu: ${templateId}. Migrer vers emailTemplates.*` };
  }

  const template = mapper();
  return sendEmail({
    to,
    subject: template.subject,
    html: template.html,
    tags: [{ name: "type", value: templateId }],
  });
}

export async function sendRentReceiptEmail(
  to: string,
  tenantName: string,
  period: string,
  amount: number,
  propertyAddress: string,
  receiptUrl: string
): Promise<EmailResult> {
  const template = emailTemplates.paymentConfirmation({
    tenantName,
    amount,
    paymentDate: new Date().toLocaleDateString("fr-FR"),
    paymentMethod: "Virement",
    period,
    receiptUrl,
  });
  return sendEmail({
    to,
    subject: template.subject,
    html: template.html,
    tags: [{ name: "type", value: "rent_receipt" }],
  });
}

export async function sendRentReminderEmail(
  to: string,
  tenantName: string,
  period: string,
  amount: number,
  dueDate: string,
  paymentUrl: string,
  idempotencyKey?: string
): Promise<EmailResult> {
  const template = emailTemplates.paymentReminder({
    tenantName,
    amount,
    dueDate,
    daysLate: 0,
    invoiceUrl: paymentUrl,
  });
  return sendEmail({
    to,
    subject: template.subject,
    html: template.html,
    idempotencyKey,
    tags: [{ name: "type", value: "rent_reminder" }],
  });
}

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
  const template = emailTemplates.paymentConfirmation({
    tenantName: ownerName,
    amount,
    paymentDate,
    paymentMethod: "Carte bancaire",
    period,
    receiptUrl: dashboardUrl,
  });
  return sendEmail({
    to,
    subject: `Paiement reçu : ${amount.toLocaleString("fr-FR")} € de ${tenantName}`,
    html: template.html,
    tags: [{ name: "type", value: "payment_received" }],
  });
}

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
  const template = emailTemplates.leaseInvite({
    tenantName: params.tenantName || "",
    ownerName: params.ownerName,
    propertyAddress: params.propertyAddress,
    rent: params.rent,
    charges: params.charges,
    leaseType: params.leaseType,
    inviteUrl: params.inviteUrl,
  });
  return sendEmail({
    to: params.to,
    subject: template.subject,
    html: template.html,
    tags: [{ name: "type", value: "lease_invite" }],
  });
}

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
  const template = emailTemplates.signatureRequest({
    signerName: recipientName,
    ownerName: "",
    propertyAddress,
    leaseType,
    signatureUrl,
  });
  return sendEmail({
    to,
    subject: template.subject,
    html: template.html,
    tags: [{ name: "type", value: "lease_signature" }],
  });
}

export async function sendInitialInvoiceEmail(params: {
  to: string;
  tenantName: string;
  propertyAddress: string;
  amount: number;
  rentAmount: number;
  chargesAmount: number;
  depositAmount: number;
  includesDeposit: boolean;
  dueDate: string;
}): Promise<EmailResult> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://talok.fr";
  const template = emailTemplates.initialInvoiceNotification({
    tenantName: params.tenantName,
    propertyAddress: params.propertyAddress,
    amount: params.amount,
    rentAmount: params.rentAmount,
    chargesAmount: params.chargesAmount,
    depositAmount: params.depositAmount,
    includesDeposit: params.includesDeposit,
    dueDate: params.dueDate,
    paymentUrl: `${appUrl}/tenant/payments`,
  });
  return sendEmail({
    to: params.to,
    subject: template.subject,
    html: template.html,
    tags: [{ name: "type", value: "initial_invoice" }],
    idempotencyKey: `initial-invoice/${params.to}`,
  });
}

export default {
  sendEmail,
  getEmailConfigurationStatus,
  sendTemplateEmail,
  sendWelcomeEmail: sendWelcomeEmailViaResend,
  sendRentReceiptEmail,
  sendRentReminderEmail,
  sendPaymentReceivedEmail,
  sendLeaseInviteEmail,
  sendLeaseSignatureEmail,
  sendInitialInvoiceEmail,
};


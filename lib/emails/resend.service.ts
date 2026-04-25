/**
 * Service d'envoi d'emails avec Resend
 *
 * Documentation: https://resend.com/docs
 *
 * Fonctionnalités:
 * - Retry automatique avec exponential backoff (3 tentatives)
 * - Rate limiting (5/min/destinataire, 100/min global)
 * - Validation des adresses email
 * - Logging structuré
 */

import { Resend } from 'resend';
import { emailTemplates } from './templates';
import {
  providerQuoteApprovedEmail,
  type ProviderQuoteApprovedParams,
} from './templates/provider-quote-approved';
import {
  providerComplianceReminderEmail,
  type ProviderComplianceReminderParams,
} from './templates/provider-compliance-reminder';
import { withRetry } from './utils/retry';
import { checkRateLimitBatch } from './utils/rate-limit';
import { validateEmails } from './utils/validation';
import { getPasswordRecoveryCallbackUrl } from "@/lib/utils/redirect-url";
import { resolveResendRuntimeConfig } from "@/lib/services/resend-config";

// Client Resend (singleton)
let resendClient: { apiKey: string; client: Resend } | null = null;

function getResendClient(apiKey: string): Resend {
  if (!resendClient || resendClient.apiKey !== apiKey) {
    resendClient = {
      apiKey,
      client: new Resend(apiKey),
    };
  }
  return resendClient.client;
}
// Configuration retry
const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 1000,
  backoffMultiplier: 2,
  maxDelayMs: 10000,
};

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
  }>;
  tags?: Array<{
    name: string;
    value: string;
  }>;
  /** Clé d'idempotence pour éviter les doublons (max 256 chars, expire 24h) */
  idempotencyKey?: string;
  /** Désactiver le rate limiting pour cet envoi */
  skipRateLimit?: boolean;
  /** Désactiver le retry pour cet envoi */
  skipRetry?: boolean;
}

export interface EmailResult {
  success: boolean;
  id?: string;
  error?: string;
  /** Indique si l'envoi a nécessité des retries */
  retried?: boolean;
  /** Nombre de tentatives effectuées */
  attempts?: number;
}

/**
 * Envoie un email via Resend
 *
 * Fonctionnalités intégrées:
 * - Validation des adresses email
 * - Rate limiting (protection contre l'envoi massif)
 * - Retry automatique en cas d'échec réseau (3 tentatives)
 */
export async function sendEmail(options: SendEmailOptions): Promise<EmailResult> {
  const startTime = Date.now();
  let attempts = 0;

  try {
    const resendConfig = await resolveResendRuntimeConfig({
      preferredFrom: options.from,
      preferredReplyTo: options.replyTo,
    });

    if (!resendConfig.apiKey) {
      return {
        success: false,
        error: "Resend n'est pas configuré. Ajoutez votre clé API dans Admin > Intégrations.",
        attempts: 0,
      };
    }

    // 1. Valider et normaliser les destinataires
    const recipients = Array.isArray(options.to) ? options.to : [options.to];
    const validation = validateEmails(recipients);

    if (!validation.valid || validation.validEmails.length === 0) {
      const invalidList = validation.invalidEmails.map(e => e.email).join(', ');
      console.error('[Email] Adresses invalides:', invalidList);
      return {
        success: false,
        error: `Adresses email invalides: ${invalidList || 'aucune adresse fournie'}`,
        attempts: 0,
      };
    }

    // Log si certaines adresses ont été filtrées
    if (validation.invalidEmails.length > 0) {
      console.warn(
        `[Email] ${validation.invalidEmails.length} adresse(s) invalide(s) ignorée(s):`,
        validation.invalidEmails.map(e => e.email)
      );
    }

    // 2. Mode simulation en développement (sauf si EMAIL_FORCE_SEND=true)
    if (process.env.NODE_ENV === "development" && process.env.EMAIL_FORCE_SEND !== "true") {
      console.warn(
        `[Email] 📧 Envoi simulé (mode dev) — destinataire: ${validation.validEmails.join(', ')} — sujet: ${options.subject}`
      );
      console.warn("[Email] 💡 Pour envoyer réellement, ajoutez EMAIL_FORCE_SEND=true dans .env.local");
      return {
        success: true,
        id: `dev-${Date.now()}`,
        attempts: 0,
      };
    }

    // 3. Vérifier le rate limit
    if (!options.skipRateLimit) {
      const rateLimitCheck = checkRateLimitBatch(validation.validEmails);

      if (!rateLimitCheck.allowed) {
        console.warn('[Email] Rate limit atteint:', rateLimitCheck.reason);
        return {
          success: false,
          error: rateLimitCheck.reason,
          attempts: 0,
        };
      }
    }

    // 4. Fonction d'envoi (sera retryée si nécessaire)
    const doSend = async (): Promise<{ id: string }> => {
      attempts++;
      const resend = getResendClient(resendConfig.apiKey);

      const sendParams: Parameters<typeof resend.emails.send>[0] = {
        from: resendConfig.fromAddress,
        to: validation.validEmails,
        subject: options.subject,
        html: options.html,
        text: options.text,
        replyTo: resendConfig.replyTo || undefined,
        cc: options.cc,
        bcc: options.bcc,
        attachments: options.attachments,
        tags: options.tags,
      };

      const { data, error } = options.idempotencyKey
        ? await resend.emails.send(sendParams, { idempotencyKey: options.idempotencyKey })
        : await resend.emails.send(sendParams);

      if (error) {
        throw new Error(error.message);
      }

      return { id: data?.id || 'unknown' };
    };

    // 5. Exécuter avec ou sans retry
    let result: { id: string };

    if (options.skipRetry) {
      result = await doSend();
    } else {
      result = await withRetry(doSend, {
        ...RETRY_CONFIG,
        onRetry: (error, attempt, delay) => {
          console.warn(
            `[Email] Tentative ${attempt}/${RETRY_CONFIG.maxRetries} échouée pour ${validation.validEmails.join(', ')}: ${error.message}. Retry dans ${delay}ms`
          );
        },
      });
    }

    // 6. Log succès
    const duration = Date.now() - startTime;
    // TODO: replace with structured logger once available
    console.log(
      `[Email] Envoyé avec succès | ID: ${result.id} | To: ${validation.validEmails.join(', ')} | ` +
      `Durée: ${duration}ms | Tentatives: ${attempts}`
    );

    return {
      success: true,
      id: result.id,
      retried: attempts > 1,
      attempts,
    };
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
    console.error(
      `[Email] ❌ Échec définitif | To: ${options.to} | Erreur: ${errorMessage} | ` +
      `Durée: ${duration}ms | Tentatives: ${attempts}`
    );

    return {
      success: false,
      error: errorMessage,
      retried: attempts > 1,
      attempts,
    };
  }
}

/**
 * Envoie une notification de nouvelle facture
 */
export async function sendInvoiceNotification(data: {
  tenantEmail: string;
  tenantName: string;
  propertyAddress: string;
  period: string;
  amount: number;
  dueDate: string;
  invoiceId: string;
}): Promise<EmailResult> {
  const template = emailTemplates.newInvoice({
    tenantName: data.tenantName,
    propertyAddress: data.propertyAddress,
    period: data.period,
    amount: data.amount,
    dueDate: data.dueDate,
    invoiceUrl: `${process.env.NEXT_PUBLIC_APP_URL}/tenant/payments?invoice=${data.invoiceId}`,
  });

  return sendEmail({
    to: data.tenantEmail,
    subject: template.subject,
    html: template.html,
    idempotencyKey: `invoice-notif/${data.invoiceId}`,
    tags: [
      { name: 'type', value: 'invoice' },
      { name: 'invoice_id', value: data.invoiceId },
    ],
  });
}

/**
 * Envoie une confirmation de paiement
 */
export async function sendPaymentConfirmation(data: {
  tenantEmail: string;
  tenantName: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  period: string;
  paymentId: string;
}): Promise<EmailResult> {
  const template = emailTemplates.paymentConfirmation({
    tenantName: data.tenantName,
    amount: data.amount,
    paymentDate: data.paymentDate,
    paymentMethod: data.paymentMethod,
    period: data.period,
    receiptUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/${data.paymentId}/receipt`,
  });

  return sendEmail({
    to: data.tenantEmail,
    subject: template.subject,
    html: template.html,
    idempotencyKey: `payment-confirm/${data.paymentId}`,
    tags: [
      { name: 'type', value: 'payment_confirmation' },
      { name: 'payment_id', value: data.paymentId },
    ],
  });
}

/**
 * Envoie un rappel de paiement
 */
export async function sendPaymentReminder(data: {
  tenantEmail: string;
  tenantName: string;
  amount: number;
  dueDate: string;
  daysLate: number;
  invoiceId: string;
}): Promise<EmailResult> {
  const template = emailTemplates.paymentReminder({
    tenantName: data.tenantName,
    amount: data.amount,
    dueDate: data.dueDate,
    daysLate: data.daysLate,
    invoiceUrl: `${process.env.NEXT_PUBLIC_APP_URL}/tenant/payments?invoice=${data.invoiceId}`,
  });

  return sendEmail({
    to: data.tenantEmail,
    subject: template.subject,
    html: template.html,
    idempotencyKey: `payment-reminder/${data.invoiceId}/${data.daysLate}`,
    tags: [
      { name: 'type', value: 'payment_reminder' },
      { name: 'invoice_id', value: data.invoiceId },
      { name: 'days_late', value: String(data.daysLate) },
    ],
  });
}

/**
 * Envoie une notification de nouveau ticket
 */
export async function sendNewTicketNotification(data: {
  recipientEmail: string;
  recipientName: string;
  ticketTitle: string;
  ticketDescription: string;
  priority: 'basse' | 'normale' | 'haute';
  propertyAddress: string;
  createdBy: string;
  ticketId: string;
}): Promise<EmailResult> {
  const template = emailTemplates.newTicket({
    recipientName: data.recipientName,
    ticketTitle: data.ticketTitle,
    ticketDescription: data.ticketDescription,
    priority: data.priority,
    propertyAddress: data.propertyAddress,
    createdBy: data.createdBy,
    ticketUrl: `${process.env.NEXT_PUBLIC_APP_URL}/tickets/${data.ticketId}`,
  });

  return sendEmail({
    to: data.recipientEmail,
    subject: template.subject,
    html: template.html,
    idempotencyKey: `ticket-created/${data.ticketId}`,
    tags: [
      { name: 'type', value: 'new_ticket' },
      { name: 'ticket_id', value: data.ticketId },
      { name: 'priority', value: data.priority },
    ],
  });
}

/**
 * Envoie une notification de mise à jour de ticket
 */
export async function sendTicketUpdateNotification(data: {
  recipientEmail: string;
  recipientName: string;
  ticketTitle: string;
  newStatus: string;
  updatedBy: string;
  comment?: string;
  ticketId: string;
}): Promise<EmailResult> {
  const template = emailTemplates.ticketUpdated({
    recipientName: data.recipientName,
    ticketTitle: data.ticketTitle,
    newStatus: data.newStatus,
    updatedBy: data.updatedBy,
    comment: data.comment,
    ticketUrl: `${process.env.NEXT_PUBLIC_APP_URL}/tickets/${data.ticketId}`,
  });

  return sendEmail({
    to: data.recipientEmail,
    subject: template.subject,
    html: template.html,
    idempotencyKey: `ticket-update/${data.ticketId}/${data.newStatus}`,
    tags: [
      { name: 'type', value: 'ticket_update' },
      { name: 'ticket_id', value: data.ticketId },
    ],
  });
}

/**
 * Envoie une demande de signature
 */
export async function sendSignatureRequest(data: {
  signerEmail: string;
  signerName: string;
  ownerName: string;
  propertyAddress: string;
  leaseType: string;
  signatureToken: string;
}): Promise<EmailResult> {
  const template = emailTemplates.signatureRequest({
    signerName: data.signerName,
    ownerName: data.ownerName,
    propertyAddress: data.propertyAddress,
    leaseType: data.leaseType,
    signatureUrl: `${process.env.NEXT_PUBLIC_APP_URL}/signature/${data.signatureToken}`,
  });

  return sendEmail({
    to: data.signerEmail,
    subject: template.subject,
    html: template.html,
    idempotencyKey: `signature-request/${data.signatureToken}`,
    tags: [
      { name: 'type', value: 'signature_request' },
    ],
  });
}

/**
 * Envoie une notification de signature au propriétaire
 */
export async function sendLeaseSignedNotification(data: {
  ownerEmail: string;
  ownerName: string;
  signerName: string;
  signerRole: string;
  propertyAddress: string;
  allSigned: boolean;
  leaseId: string;
}): Promise<EmailResult> {
  const template = emailTemplates.leaseSignedNotification({
    ownerName: data.ownerName,
    signerName: data.signerName,
    signerRole: data.signerRole,
    propertyAddress: data.propertyAddress,
    allSigned: data.allSigned,
    leaseUrl: `${process.env.NEXT_PUBLIC_APP_URL}/owner/leases/${data.leaseId}`,
  });

  return sendEmail({
    to: data.ownerEmail,
    subject: template.subject,
    html: template.html,
    idempotencyKey: `lease-signed/${data.leaseId}/${data.signerName}`,
    tags: [
      { name: 'type', value: 'lease_signed' },
      { name: 'lease_id', value: data.leaseId },
      { name: 'all_signed', value: String(data.allSigned) },
    ],
  });
}

/**
 * Envoie une invitation à rejoindre un logement
 */
export async function sendPropertyInvitation(data: {
  tenantEmail: string;
  tenantName: string;
  ownerName: string;
  propertyAddress: string;
  propertyCode: string;
}): Promise<EmailResult> {
  const template = emailTemplates.propertyInvitation({
    tenantName: data.tenantName,
    ownerName: data.ownerName,
    propertyAddress: data.propertyAddress,
    propertyCode: data.propertyCode,
    inviteUrl: `${process.env.NEXT_PUBLIC_APP_URL}/invite?code=${data.propertyCode}`,
  });

  return sendEmail({
    to: data.tenantEmail,
    subject: template.subject,
    html: template.html,
    idempotencyKey: `property-invite/${data.propertyCode}/${data.tenantEmail}`,
    tags: [
      { name: 'type', value: 'property_invitation' },
      { name: 'property_code', value: data.propertyCode },
    ],
  });
}

/**
 * Envoie un email de bienvenue avec guide d'onboarding par rôle.
 *
 * Utilise le template `welcomeOnboarding` (steps numérotés + bénéfices) et
 * redirige l'utilisateur vers la première étape de son parcours.
 */
export async function sendWelcomeEmail(data: {
  userEmail: string;
  userName: string;
  role: 'owner' | 'tenant' | 'provider' | 'guarantor' | 'syndic' | 'agency';
}): Promise<EmailResult> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://talok.fr';

  // Première étape d'onboarding par rôle (cohérent avec /auth/callback)
  const onboardingPath: Record<typeof data.role, string> = {
    owner: '/signup/plan?role=owner',
    tenant: '/tenant/onboarding/context',
    provider: '/provider/onboarding/profile',
    guarantor: '/guarantor/onboarding/context',
    syndic: '/syndic/onboarding/profile',
    agency: '/agency/onboarding/profile',
  };

  const template = emailTemplates.welcomeOnboarding({
    userName: data.userName,
    role: data.role,
    onboardingUrl: `${appUrl}${onboardingPath[data.role]}`,
    supportEmail: 'support@talok.fr',
  });

  return sendEmail({
    to: data.userEmail,
    subject: template.subject,
    html: template.html,
    idempotencyKey: `welcome/${data.userEmail}`,
    tags: [
      { name: 'type', value: 'welcome' },
      { name: 'role', value: data.role },
    ],
  });
}

/**
 * Envoie un email de réinitialisation de mot de passe
 */
export async function sendPasswordResetEmail(data: {
  userEmail: string;
  userName: string;
  resetUrl?: string;
  actionLink?: string;
  resetToken?: string;
  expiresIn?: string;
}): Promise<EmailResult> {
  const resetUrl = data.resetUrl ?? data.actionLink;

  // Le flux actif envoie un action_link Supabase complet. Refuser silencieusement
  // de reconstruire un ancien lien /auth/reset-password?token=... qui n'est plus supporté.
  if (!resetUrl) {
    console.error(
      "[Email] sendPasswordResetEmail called without resetUrl/actionLink. " +
      `Legacy resetToken flow no longer supported: ${Boolean(data.resetToken)}`
    );

    return {
      success: false,
      error: `Lien de réinitialisation manquant. Utilisez l'URL de recovery complète (ex: ${getPasswordRecoveryCallbackUrl()}).`,
      attempts: 0,
    };
  }

  const template = emailTemplates.passwordReset({
    userName: data.userName,
    resetUrl,
    expiresIn: data.expiresIn || '1 heure',
  });

  return sendEmail({
    to: data.userEmail,
    subject: template.subject,
    html: template.html,
    idempotencyKey: `password-reset/${data.userEmail}`,
    tags: [
      { name: 'type', value: 'password_reset' },
    ],
  });
}

// ============================================
// VISIT SCHEDULING EMAIL FUNCTIONS - SOTA 2026
// ============================================

/**
 * Envoie une notification de nouvelle demande de visite au propriétaire
 */
export async function sendVisitBookingRequest(data: {
  ownerEmail: string;
  ownerName: string;
  tenantName: string;
  propertyAddress: string;
  visitDate: string;
  visitTime: string;
  tenantMessage?: string;
  bookingId: string;
}): Promise<EmailResult> {
  const template = emailTemplates.visitBookingRequest({
    ownerName: data.ownerName,
    tenantName: data.tenantName,
    propertyAddress: data.propertyAddress,
    visitDate: data.visitDate,
    visitTime: data.visitTime,
    tenantMessage: data.tenantMessage,
    bookingsUrl: `${process.env.NEXT_PUBLIC_APP_URL}/owner/visits`,
  });

  return sendEmail({
    to: data.ownerEmail,
    subject: template.subject,
    html: template.html,
    idempotencyKey: `visit-booking-request/${data.bookingId}`,
    tags: [
      { name: 'type', value: 'visit_booking_request' },
      { name: 'booking_id', value: data.bookingId },
    ],
  });
}

/**
 * Envoie une confirmation de visite au locataire
 */
export async function sendVisitBookingConfirmed(data: {
  tenantEmail: string;
  tenantName: string;
  propertyAddress: string;
  visitDate: string;
  visitTime: string;
  ownerName: string;
  ownerPhone?: string;
  bookingId: string;
}): Promise<EmailResult> {
  const template = emailTemplates.visitBookingConfirmed({
    tenantName: data.tenantName,
    propertyAddress: data.propertyAddress,
    visitDate: data.visitDate,
    visitTime: data.visitTime,
    ownerName: data.ownerName,
    ownerPhone: data.ownerPhone,
    bookingUrl: `${process.env.NEXT_PUBLIC_APP_URL}/tenant/visits/${data.bookingId}`,
  });

  return sendEmail({
    to: data.tenantEmail,
    subject: template.subject,
    html: template.html,
    idempotencyKey: `visit-booking-confirmed/${data.bookingId}`,
    tags: [
      { name: 'type', value: 'visit_booking_confirmed' },
      { name: 'booking_id', value: data.bookingId },
    ],
  });
}

/**
 * Envoie une notification d'annulation de visite
 */
export async function sendVisitBookingCancelled(data: {
  tenantEmail: string;
  tenantName: string;
  propertyAddress: string;
  visitDate: string;
  visitTime: string;
  cancellationReason?: string;
  cancelledBy: 'owner' | 'tenant';
  bookingId: string;
}): Promise<EmailResult> {
  const template = emailTemplates.visitBookingCancelled({
    tenantName: data.tenantName,
    propertyAddress: data.propertyAddress,
    visitDate: data.visitDate,
    visitTime: data.visitTime,
    cancellationReason: data.cancellationReason,
    cancelledBy: data.cancelledBy,
    searchUrl: `${process.env.NEXT_PUBLIC_APP_URL}/search`,
  });

  return sendEmail({
    to: data.tenantEmail,
    subject: template.subject,
    html: template.html,
    idempotencyKey: `visit-booking-cancelled/${data.bookingId}`,
    tags: [
      { name: 'type', value: 'visit_booking_cancelled' },
      { name: 'booking_id', value: data.bookingId },
      { name: 'cancelled_by', value: data.cancelledBy },
    ],
  });
}

/**
 * Envoie un rappel de visite
 */
export async function sendVisitReminder(data: {
  recipientEmail: string;
  recipientName: string;
  propertyAddress: string;
  visitDate: string;
  visitTime: string;
  hoursBeforeVisit: number;
  isOwner: boolean;
  contactName: string;
  contactPhone?: string;
  bookingId: string;
}): Promise<EmailResult> {
  const template = emailTemplates.visitReminder({
    recipientName: data.recipientName,
    propertyAddress: data.propertyAddress,
    visitDate: data.visitDate,
    visitTime: data.visitTime,
    hoursBeforeVisit: data.hoursBeforeVisit,
    isOwner: data.isOwner,
    contactName: data.contactName,
    contactPhone: data.contactPhone,
    bookingUrl: data.isOwner
      ? `${process.env.NEXT_PUBLIC_APP_URL}/owner/visits`
      : `${process.env.NEXT_PUBLIC_APP_URL}/tenant/visits/${data.bookingId}`,
  });

  const role = data.isOwner ? 'owner' : 'tenant';
  return sendEmail({
    to: data.recipientEmail,
    subject: template.subject,
    html: template.html,
    idempotencyKey: `visit-reminder-${data.hoursBeforeVisit}h-${role}/${data.bookingId}`,
    tags: [
      { name: 'type', value: 'visit_reminder' },
      { name: 'booking_id', value: data.bookingId },
      { name: 'hours_before', value: String(data.hoursBeforeVisit) },
    ],
  });
}

/**
 * Envoie une demande de feedback après visite
 */
export async function sendVisitFeedbackRequest(data: {
  tenantEmail: string;
  tenantName: string;
  propertyAddress: string;
  visitDate: string;
  bookingId: string;
}): Promise<EmailResult> {
  const template = emailTemplates.visitFeedbackRequest({
    tenantName: data.tenantName,
    propertyAddress: data.propertyAddress,
    visitDate: data.visitDate,
    feedbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/tenant/visits/${data.bookingId}/feedback`,
  });

  return sendEmail({
    to: data.tenantEmail,
    subject: template.subject,
    html: template.html,
    idempotencyKey: `visit-feedback/${data.bookingId}`,
    tags: [
      { name: 'type', value: 'visit_feedback_request' },
      { name: 'booking_id', value: data.bookingId },
    ],
  });
}

// ============================================
// KEY HANDOVER EMAIL FUNCTIONS
// ============================================

/**
 * Envoie une demande de scan QR code au locataire pour la remise des clefs
 */
export async function sendKeyHandoverScanRequest(data: {
  tenantEmail: string;
  tenantFirstName: string;
  propertyAddress: string;
  leaseId: string;
  handoverId: string;
  expiresAt?: Date;
}): Promise<EmailResult> {
  const handoverUrl = `${process.env.NEXT_PUBLIC_APP_URL}/tenant/lease/${data.leaseId}/handover`;

  const expiresAtFormatted = data.expiresAt
    ? new Intl.DateTimeFormat('fr-FR', {
        dateStyle: 'long',
        timeStyle: 'short',
        timeZone: 'Europe/Paris',
      }).format(data.expiresAt)
    : undefined;

  const template = emailTemplates.keyHandoverScanRequest({
    tenantFirstName: data.tenantFirstName,
    propertyAddress: data.propertyAddress,
    handoverUrl,
    expiresAt: expiresAtFormatted,
  });

  return sendEmail({
    to: data.tenantEmail,
    subject: template.subject,
    html: template.html,
    idempotencyKey: `key-handover-scan/${data.handoverId}`,
    tags: [
      { name: 'type', value: 'key_handover_scan_request' },
      { name: 'lease_id', value: data.leaseId },
    ],
  });
}

/**
 * Envoie une notification au propriétaire quand le locataire confirme la remise des clefs
 */
export async function sendKeyHandoverConfirmedNotification(data: {
  ownerEmail: string;
  ownerName: string;
  tenantName: string;
  propertyAddress: string;
  confirmedAt: Date;
  leaseId: string;
  handoverId: string;
}): Promise<EmailResult> {
  const confirmedAtFormatted = new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Europe/Paris',
  }).format(data.confirmedAt);

  const template = emailTemplates.keyHandoverConfirmed({
    ownerName: data.ownerName,
    tenantName: data.tenantName,
    propertyAddress: data.propertyAddress,
    confirmedAt: confirmedAtFormatted,
    leaseUrl: `${process.env.NEXT_PUBLIC_APP_URL}/owner/leases/${data.leaseId}`,
  });

  return sendEmail({
    to: data.ownerEmail,
    subject: template.subject,
    html: template.html,
    idempotencyKey: `key-handover-confirmed/${data.handoverId}`,
    tags: [
      { name: 'type', value: 'key_handover_confirmed' },
      { name: 'lease_id', value: data.leaseId },
    ],
  });
}

/**
 * Envoie la demande de contresignature d'un reçu espèces au locataire.
 * Appelée après que le propriétaire ait signé le reçu (flow 2 étapes).
 */
export async function sendCashReceiptSignatureRequest(data: {
  tenantEmail: string;
  tenantName: string;
  ownerName: string;
  propertyAddress: string;
  period: string;
  amount: number;
  receiptId: string;
  receiptNumber: string;
}): Promise<EmailResult> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://talok.fr';
  const template = emailTemplates.cashReceiptSignatureRequest({
    tenantName: data.tenantName,
    ownerName: data.ownerName,
    propertyAddress: data.propertyAddress,
    period: data.period,
    amount: data.amount,
    receiptNumber: data.receiptNumber,
    signatureUrl: `${appUrl}/tenant/payments/cash-receipt/${data.receiptId}`,
  });

  return sendEmail({
    to: data.tenantEmail,
    subject: template.subject,
    html: template.html,
    idempotencyKey: `cash-receipt-signature/${data.receiptId}`,
    tags: [
      { name: 'type', value: 'cash_receipt_signature_request' },
      { name: 'receipt_id', value: data.receiptId },
    ],
  });
}

/**
 * Confirmation de suppression de compte (RGPD Article 17)
 */
export async function sendAccountDeletionConfirmation(
  email: string,
  userName: string
): Promise<EmailResult> {
  const template = emailTemplates.accountDeletionConfirmation({ userName });

  return sendEmail({
    to: email,
    subject: template.subject,
    html: template.html,
    tags: [{ name: 'type', value: 'account_deletion' }],
  });
}

/**
 * Alerte propriétaire : impayé J+7 ou J+15
 */
export async function sendOwnerPaymentAlert(data: {
  ownerEmail: string;
  ownerName: string;
  tenantName: string;
  propertyAddress: string;
  amount: number;
  daysLate: number;
  period: string;
  invoiceId: string;
  level: 'urgent' | 'mise-en-demeure';
}): Promise<EmailResult> {
  const template = emailTemplates.ownerPaymentOverdue({
    ownerName: data.ownerName,
    tenantName: data.tenantName,
    propertyAddress: data.propertyAddress,
    amount: data.amount,
    daysLate: data.daysLate,
    period: data.period,
    invoiceUrl: `${process.env.NEXT_PUBLIC_APP_URL}/owner/invoices/${data.invoiceId}`,
    level: data.level,
  });

  return sendEmail({
    to: data.ownerEmail,
    subject: template.subject,
    html: template.html,
    idempotencyKey: `owner-payment-alert/${data.invoiceId}/${data.level}`,
    tags: [
      { name: 'type', value: 'owner_payment_overdue' },
      { name: 'invoice_id', value: data.invoiceId },
      { name: 'days_late', value: String(data.daysLate) },
      { name: 'level', value: data.level },
    ],
  });
}

/**
 * Envoie au locataire une invitation à signer un état des lieux
 */
export async function sendEDLSignatureRequest(data: {
  signerEmail: string;
  signerName: string;
  ownerName: string;
  propertyAddress: string;
  edlId: string;
  edlType: "entree" | "sortie";
  signatureToken: string;
}): Promise<EmailResult> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.talok.fr";
  const template = emailTemplates.edlSignatureRequest({
    signerName: data.signerName,
    ownerName: data.ownerName,
    propertyAddress: data.propertyAddress,
    edlType: data.edlType,
    signatureUrl: `${appUrl}/signature-edl/${data.signatureToken}`,
  });

  return sendEmail({
    to: data.signerEmail,
    subject: template.subject,
    html: template.html,
    idempotencyKey: `edl-signature-request/${data.edlId}/${data.signatureToken}`,
    tags: [
      { name: 'type', value: 'edl_signature_request' },
      { name: 'edl_id', value: data.edlId },
      { name: 'edl_type', value: data.edlType },
    ],
  });
}

/**
 * Notifie la contrepartie qu'une partie a signé l'EDL
 */
export async function sendEDLCounterpartySignedNotification(data: {
  recipientEmail: string;
  recipientName: string;
  signerName: string;
  signerRole: "owner" | "tenant";
  recipientRole: "owner" | "tenant";
  propertyAddress: string;
  edlId: string;
  edlType: "entree" | "sortie";
  tokenUrl?: string;
}): Promise<EmailResult> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.talok.fr";
  const signatureUrl =
    data.recipientRole === "owner"
      ? `${appUrl}/owner/inspections/${data.edlId}?sign=1`
      : data.tokenUrl || `${appUrl}/tenant/inspections/${data.edlId}`;
  const template = emailTemplates.edlCounterpartySigned({
    recipientName: data.recipientName,
    signerName: data.signerName,
    signerRoleLabel: data.signerRole === "owner" ? "Le propriétaire" : "Le locataire",
    propertyAddress: data.propertyAddress,
    edlType: data.edlType,
    signatureUrl,
  });

  return sendEmail({
    to: data.recipientEmail,
    subject: template.subject,
    html: template.html,
    idempotencyKey: `edl-counterparty-signed/${data.edlId}/${data.signerRole}`,
    tags: [
      { name: 'type', value: 'edl_counterparty_signed' },
      { name: 'edl_id', value: data.edlId },
      { name: 'signer_role', value: data.signerRole },
    ],
  });
}

/**
 * Notifie une partie que l'EDL est entièrement signé
 */
export async function sendEDLFullySignedNotification(data: {
  recipientEmail: string;
  recipientName: string;
  recipientRole: "owner" | "tenant";
  propertyAddress: string;
  edlId: string;
  edlType: "entree" | "sortie";
}): Promise<EmailResult> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.talok.fr";
  const edlUrl =
    data.recipientRole === "owner"
      ? `${appUrl}/owner/inspections/${data.edlId}`
      : `${appUrl}/tenant/inspections/${data.edlId}`;
  const template = emailTemplates.edlFullySigned({
    recipientName: data.recipientName,
    propertyAddress: data.propertyAddress,
    edlType: data.edlType,
    edlUrl,
  });

  return sendEmail({
    to: data.recipientEmail,
    subject: template.subject,
    html: template.html,
    idempotencyKey: `edl-fully-signed/${data.edlId}/${data.recipientRole}`,
    tags: [
      { name: 'type', value: 'edl_fully_signed' },
      { name: 'edl_id', value: data.edlId },
      { name: 'recipient_role', value: data.recipientRole },
    ],
  });
}

/**
 * Envoie au prestataire la notification d'acceptation d'un de ses devis.
 *
 * idempotencyKey: quote-accepted/<quoteId> — un seul email par devis,
 * meme en cas de re-tentative.
 */
export async function sendProviderQuoteApprovedEmail(
  data: ProviderQuoteApprovedParams & { providerEmail: string }
): Promise<EmailResult> {
  const template = providerQuoteApprovedEmail(data);
  return sendEmail({
    to: data.providerEmail,
    subject: template.subject,
    html: template.html,
    idempotencyKey: `quote-accepted/${data.quoteId}`,
    tags: [
      { name: 'type', value: 'provider-quote-approved' },
      { name: 'quote_id', value: data.quoteId },
    ],
  });
}

/**
 * Envoie au prestataire un rappel d'expiration d'un document compliance.
 *
 * idempotencyKey: compliance-reminder/<provider>/<documentLabel>/<window>
 *   ou window est 'expired' | 'j7' | 'j30' — evite les doublons quand le
 *   cron passe deux fois dans la meme fenetre.
 */
export async function sendProviderComplianceReminderEmail(
  data: ProviderComplianceReminderParams & {
    providerEmail: string;
    providerProfileId: string;
    /** Fenetre d'envoi pour la cle d'idempotence */
    window: 'expired' | 'j7' | 'j30';
  }
): Promise<EmailResult> {
  const template = providerComplianceReminderEmail(data);
  const labelKey = data.documentLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return sendEmail({
    to: data.providerEmail,
    subject: template.subject,
    html: template.html,
    idempotencyKey: `compliance-reminder/${data.providerProfileId}/${labelKey}/${data.window}`,
    tags: [
      { name: 'type', value: 'provider-compliance-reminder' },
      { name: 'window', value: data.window },
    ],
  });
}

// Export du service
export const emailService = {
  send: sendEmail,
  sendInvoiceNotification,
  sendPaymentConfirmation,
  sendPaymentReminder,
  sendNewTicketNotification,
  sendTicketUpdateNotification,
  sendSignatureRequest,
  sendLeaseSignedNotification,
  sendEDLSignatureRequest,
  sendEDLCounterpartySignedNotification,
  sendEDLFullySignedNotification,
  sendPropertyInvitation,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  // Visit Scheduling - SOTA 2026
  sendVisitBookingRequest,
  sendVisitBookingConfirmed,
  sendVisitBookingCancelled,
  sendVisitReminder,
  sendVisitFeedbackRequest,
  // Key Handover
  sendKeyHandoverScanRequest,
  sendKeyHandoverConfirmedNotification,
  // Paiements espèces (flow 2 étapes)
  sendCashReceiptSignatureRequest,
  // RGPD
  sendAccountDeletionConfirmation,
  // Alertes propriétaire impayés
  sendOwnerPaymentAlert,
  // Prestataires
  sendProviderQuoteApprovedEmail,
  sendProviderComplianceReminderEmail,
};


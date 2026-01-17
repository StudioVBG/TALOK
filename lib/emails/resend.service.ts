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
import { withRetry } from './utils/retry';
import { checkRateLimitBatch } from './utils/rate-limit';
import { validateEmails, isValidEmail } from './utils/validation';

// Client Resend (singleton)
let resendClient: Resend | null = null;

function getResendClient(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY non configurée. Ajoutez-la dans vos variables d\'environnement.');
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

// Configuration
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Talok <noreply@talok.fr>';
const REPLY_TO = process.env.RESEND_REPLY_TO || 'support@talok.fr';

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

    // 2. Vérifier le rate limit
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

    // 3. Fonction d'envoi (sera retryée si nécessaire)
    const doSend = async (): Promise<{ id: string }> => {
      attempts++;
      const resend = getResendClient();

      const { data, error } = await resend.emails.send({
        from: FROM_EMAIL,
        to: validation.validEmails,
        subject: options.subject,
        html: options.html,
        text: options.text,
        reply_to: options.replyTo || REPLY_TO,
        cc: options.cc,
        bcc: options.bcc,
        attachments: options.attachments,
        tags: options.tags,
      });

      if (error) {
        throw new Error(error.message);
      }

      return { id: data?.id || 'unknown' };
    };

    // 4. Exécuter avec ou sans retry
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

    // 5. Log succès
    const duration = Date.now() - startTime;
    console.log(
      `[Email] ✅ Envoyé avec succès | ID: ${result.id} | To: ${validation.validEmails.join(', ')} | ` +
      `Durée: ${duration}ms | Tentatives: ${attempts}`
    );

    return {
      success: true,
      id: result.id,
      retried: attempts > 1,
      attempts,
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(
      `[Email] ❌ Échec définitif | To: ${options.to} | Erreur: ${error.message} | ` +
      `Durée: ${duration}ms | Tentatives: ${attempts}`
    );

    return {
      success: false,
      error: error.message,
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
    tags: [
      { name: 'type', value: 'property_invitation' },
      { name: 'property_code', value: data.propertyCode },
    ],
  });
}

/**
 * Envoie un email de bienvenue
 */
export async function sendWelcomeEmail(data: {
  userEmail: string;
  userName: string;
  role: 'owner' | 'tenant' | 'provider';
}): Promise<EmailResult> {
  const template = emailTemplates.welcome({
    userName: data.userName,
    role: data.role,
    loginUrl: `${process.env.NEXT_PUBLIC_APP_URL}/auth/signin`,
  });

  return sendEmail({
    to: data.userEmail,
    subject: template.subject,
    html: template.html,
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
  resetToken: string;
}): Promise<EmailResult> {
  const template = emailTemplates.passwordReset({
    userName: data.userName,
    resetUrl: `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password?token=${data.resetToken}`,
    expiresIn: '1 heure',
  });

  return sendEmail({
    to: data.userEmail,
    subject: template.subject,
    html: template.html,
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

  return sendEmail({
    to: data.recipientEmail,
    subject: template.subject,
    html: template.html,
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
    tags: [
      { name: 'type', value: 'visit_feedback_request' },
      { name: 'booking_id', value: data.bookingId },
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
  sendPropertyInvitation,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  // Visit Scheduling - SOTA 2026
  sendVisitBookingRequest,
  sendVisitBookingConfirmed,
  sendVisitBookingCancelled,
  sendVisitReminder,
  sendVisitFeedbackRequest,
};


/**
 * Module d'export pour l'envoi d'emails
 * Re-export depuis le service principal pour compatibilité
 */

export { 
  sendEmail,
  sendTemplateEmail,
  sendTemplateEmail as sendTemplatedEmail, // alias
  sendWelcomeEmail,
  sendRentReminderEmail,
  sendPaymentReceivedEmail,
  sendRentReceiptEmail,
  sendLeaseInviteEmail,
  sendLeaseSignatureEmail,
  EMAIL_TEMPLATES,
} from "@/lib/services/email-service";

// Re-export du service par défaut
export { default as emailService } from "@/lib/services/email-service";

// Alias pour sendEmail (compatibilité)
export { sendEmail as send } from "@/lib/services/email-service";


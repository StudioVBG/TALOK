/**
 * Service de notifications email
 * 
 * Utilise le service Resend pour envoyer des emails
 * avec des templates professionnels
 */

import { emailService } from "@/lib/emails";

// Ré-exporter toutes les fonctions du service email
export {
  sendEmail,
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
} from "@/lib/emails";

// Export par défaut du service complet
export { emailService };

// Types exportés
export interface EmailData {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Classe de compatibilité avec l'ancien service
 * @deprecated Utilisez directement les fonctions exportées du service email
 */
export class EmailService {
  async sendEmail(data: EmailData) {
    return emailService.send(data);
  }

  async sendInvoiceNotification(invoiceId: string, tenantEmail: string) {
    // Compatibilité basique - les données complètes doivent être passées
    console.warn('[EmailService] Utilisation dépréciée. Utilisez emailService.sendInvoiceNotification avec toutes les données.');
    return emailService.send({
      to: tenantEmail,
      subject: "Nouvelle facture disponible",
      html: `<p>Une nouvelle facture est disponible. ID: ${invoiceId}</p>`,
    });
  }

  async sendPaymentConfirmation(paymentId: string, tenantEmail: string, amount: number) {
    console.warn('[EmailService] Utilisation dépréciée. Utilisez emailService.sendPaymentConfirmation avec toutes les données.');
    return emailService.send({
      to: tenantEmail,
      subject: "Confirmation de paiement",
      html: `<p>Votre paiement de ${amount}€ a été confirmé. ID: ${paymentId}</p>`,
    });
  }

  async sendTicketNotification(ticketId: string, ownerEmail: string, ticketTitle: string) {
    console.warn('[EmailService] Utilisation dépréciée. Utilisez emailService.sendNewTicketNotification avec toutes les données.');
    return emailService.send({
      to: ownerEmail,
      subject: "Nouveau ticket de maintenance",
      html: `<p>Nouveau ticket: ${ticketTitle}. ID: ${ticketId}</p>`,
    });
  }

  async sendLeaseSignatureRequest(leaseId: string, signerEmail: string, signerName: string) {
    console.warn('[EmailService] Utilisation dépréciée. Utilisez emailService.sendSignatureRequest avec toutes les données.');
    return emailService.send({
      to: signerEmail,
      subject: "Demande de signature de bail",
      html: `<p>Bonjour ${signerName}, vous devez signer un bail. ID: ${leaseId}</p>`,
    });
  }
}

// Instance pour compatibilité
export const legacyEmailService = new EmailService();

/**
 * Données des templates d'emails pour la prévisualisation
 *
 * Ce fichier génère les templates avec des données d'exemple
 * pour l'affichage dans le viewer admin/owner.
 */

import { emailTemplates } from "./templates";
import type { EmailTemplate, EmailCategory } from "@/components/emails/email-templates-viewer";

// Données de prévisualisation par défaut
const PREVIEW_DATA = {
  // Commun
  userName: "Jean Dupont",
  tenantName: "Marie Martin",
  ownerName: "Pierre Durand",
  propertyAddress: "12 rue de la Paix, 75002 Paris",

  // Paiements
  amount: 850,
  period: "Janvier 2026",
  dueDate: "5 janvier 2026",
  daysLate: 5,
  paymentDate: "3 janvier 2026",
  paymentMethod: "Prélèvement SEPA",

  // Baux
  leaseType: "Bail d'habitation vide",
  signerRole: "Locataire principal",
  allSigned: true,

  // Tickets
  ticketTitle: "Fuite robinet cuisine",
  ticketDescription: "Le robinet de la cuisine fuit depuis ce matin.",
  priority: "normale" as const,
  createdBy: "Marie Martin",
  newStatus: "En cours de traitement",

  // Invitations
  propertyCode: "PARIS123",

  // Visites
  visitDate: "15 janvier 2026",
  visitTime: "14h30",
  hoursBeforeVisit: 24,

  // URLs
  invoiceUrl: "#",
  receiptUrl: "#",
  ticketUrl: "#",
  leaseUrl: "#",
  signatureUrl: "#",
  inviteUrl: "#",
  loginUrl: "#",
  resetUrl: "#",
  onboardingUrl: "#",
  dashboardUrl: "#",
  bookingsUrl: "#",
  bookingUrl: "#",
  searchUrl: "#",
  feedbackUrl: "#",
  acceptUrl: "#",
  manageUrl: "#",

  // Divers
  expiresIn: "24 heures",
  role: "owner" as const,
  progressPercent: 65,
  nextStepLabel: "Informations bancaires",
  remainingSteps: 2,
  supportEmail: "support@talok.fr",

  // CGU
  version: "2.0",
  changesSummary: "Mise à jour des conditions de résiliation et ajout de nouvelles fonctionnalités.",
  effectiveDate: "1er février 2026",

  // Prix
  planName: "Pro",
  oldPriceMonthly: 2900,
  newPriceMonthly: 3400,
  oldPriceYearly: 29000,
  newPriceYearly: 34000,
  grandfatheredUntil: "31 mars 2026",
  changeReason: "Ajout de nouvelles fonctionnalités premium et amélioration de l'infrastructure.",
};

// Définition des templates
export function generateEmailTemplatesData(): EmailTemplate[] {
  const templates: EmailTemplate[] = [];

  // ============================================
  // ONBOARDING
  // ============================================

  // Bienvenue
  const welcomeOwner = emailTemplates.welcomeOnboarding({
    userName: PREVIEW_DATA.userName,
    role: "owner",
    onboardingUrl: PREVIEW_DATA.onboardingUrl,
    supportEmail: PREVIEW_DATA.supportEmail,
  });
  templates.push({
    id: "welcome-onboarding-owner",
    name: "Bienvenue - Propriétaire",
    description: "Email de bienvenue envoyé aux nouveaux propriétaires avec guide de démarrage",
    category: "onboarding",
    subject: welcomeOwner.subject,
    html: welcomeOwner.html,
    variables: ["userName", "role", "onboardingUrl", "supportEmail"],
  });

  const welcomeTenant = emailTemplates.welcomeOnboarding({
    userName: PREVIEW_DATA.tenantName,
    role: "tenant",
    onboardingUrl: PREVIEW_DATA.onboardingUrl,
  });
  templates.push({
    id: "welcome-onboarding-tenant",
    name: "Bienvenue - Locataire",
    description: "Email de bienvenue envoyé aux nouveaux locataires",
    category: "onboarding",
    subject: welcomeTenant.subject,
    html: welcomeTenant.html,
    variables: ["userName", "role", "onboardingUrl"],
  });

  // Rappels onboarding
  const reminder24h = emailTemplates.onboardingReminder24h({
    userName: PREVIEW_DATA.userName,
    role: "owner",
    progressPercent: PREVIEW_DATA.progressPercent,
    nextStepLabel: PREVIEW_DATA.nextStepLabel,
    onboardingUrl: PREVIEW_DATA.onboardingUrl,
  });
  templates.push({
    id: "onboarding-reminder-24h",
    name: "Rappel Onboarding - 24h",
    description: "Rappel envoyé 24h après une inscription incomplète",
    category: "onboarding",
    subject: reminder24h.subject,
    html: reminder24h.html,
    variables: ["userName", "role", "progressPercent", "nextStepLabel", "onboardingUrl"],
  });

  const reminder72h = emailTemplates.onboardingReminder72h({
    userName: PREVIEW_DATA.userName,
    role: "owner",
    progressPercent: PREVIEW_DATA.progressPercent,
    onboardingUrl: PREVIEW_DATA.onboardingUrl,
  });
  templates.push({
    id: "onboarding-reminder-72h",
    name: "Rappel Onboarding - 72h",
    description: "Rappel envoyé 72h après une inscription incomplète",
    category: "onboarding",
    subject: reminder72h.subject,
    html: reminder72h.html,
    variables: ["userName", "role", "progressPercent", "onboardingUrl"],
  });

  const reminder7d = emailTemplates.onboardingReminder7d({
    userName: PREVIEW_DATA.userName,
    role: "owner",
    onboardingUrl: PREVIEW_DATA.onboardingUrl,
  });
  templates.push({
    id: "onboarding-reminder-7d",
    name: "Rappel Onboarding - 7 jours",
    description: "Rappel envoyé 7 jours après une inscription incomplète",
    category: "onboarding",
    subject: reminder7d.subject,
    html: reminder7d.html,
    variables: ["userName", "role", "onboardingUrl"],
  });

  const onboardingCompleted = emailTemplates.onboardingCompleted({
    userName: PREVIEW_DATA.userName,
    role: "owner",
    dashboardUrl: PREVIEW_DATA.dashboardUrl,
  });
  templates.push({
    id: "onboarding-completed",
    name: "Onboarding Complété",
    description: "Félicitations envoyées quand le profil est à 100%",
    category: "onboarding",
    subject: onboardingCompleted.subject,
    html: onboardingCompleted.html,
    variables: ["userName", "role", "dashboardUrl"],
  });

  // ============================================
  // PAIEMENTS
  // ============================================

  const newInvoice = emailTemplates.newInvoice({
    tenantName: PREVIEW_DATA.tenantName,
    propertyAddress: PREVIEW_DATA.propertyAddress,
    period: PREVIEW_DATA.period,
    amount: PREVIEW_DATA.amount,
    dueDate: PREVIEW_DATA.dueDate,
    invoiceUrl: PREVIEW_DATA.invoiceUrl,
  });
  templates.push({
    id: "new-invoice",
    name: "Nouvelle Facture",
    description: "Notification d'une nouvelle facture de loyer disponible",
    category: "payment",
    subject: newInvoice.subject,
    html: newInvoice.html,
    variables: ["tenantName", "propertyAddress", "period", "amount", "dueDate", "invoiceUrl"],
  });

  const paymentConfirmation = emailTemplates.paymentConfirmation({
    tenantName: PREVIEW_DATA.tenantName,
    amount: PREVIEW_DATA.amount,
    paymentDate: PREVIEW_DATA.paymentDate,
    paymentMethod: PREVIEW_DATA.paymentMethod,
    period: PREVIEW_DATA.period,
    receiptUrl: PREVIEW_DATA.receiptUrl,
  });
  templates.push({
    id: "payment-confirmation",
    name: "Confirmation de Paiement",
    description: "Confirmation envoyée après réception d'un paiement",
    category: "payment",
    subject: paymentConfirmation.subject,
    html: paymentConfirmation.html,
    variables: ["tenantName", "amount", "paymentDate", "paymentMethod", "period", "receiptUrl"],
  });

  const paymentReminder = emailTemplates.paymentReminder({
    tenantName: PREVIEW_DATA.tenantName,
    amount: PREVIEW_DATA.amount,
    dueDate: PREVIEW_DATA.dueDate,
    daysLate: PREVIEW_DATA.daysLate,
    invoiceUrl: PREVIEW_DATA.invoiceUrl,
  });
  templates.push({
    id: "payment-reminder",
    name: "Rappel de Paiement",
    description: "Rappel envoyé pour un loyer en retard",
    category: "payment",
    subject: paymentReminder.subject,
    html: paymentReminder.html,
    variables: ["tenantName", "amount", "dueDate", "daysLate", "invoiceUrl"],
  });

  // ============================================
  // BAUX
  // ============================================

  const signatureRequest = emailTemplates.signatureRequest({
    signerName: PREVIEW_DATA.tenantName,
    ownerName: PREVIEW_DATA.ownerName,
    propertyAddress: PREVIEW_DATA.propertyAddress,
    leaseType: PREVIEW_DATA.leaseType,
    signatureUrl: PREVIEW_DATA.signatureUrl,
  });
  templates.push({
    id: "signature-request",
    name: "Demande de Signature",
    description: "Invitation à signer un bail",
    category: "lease",
    subject: signatureRequest.subject,
    html: signatureRequest.html,
    variables: ["signerName", "ownerName", "propertyAddress", "leaseType", "signatureUrl"],
  });

  const leaseSigned = emailTemplates.leaseSignedNotification({
    ownerName: PREVIEW_DATA.ownerName,
    signerName: PREVIEW_DATA.tenantName,
    signerRole: PREVIEW_DATA.signerRole,
    propertyAddress: PREVIEW_DATA.propertyAddress,
    allSigned: true,
    leaseUrl: PREVIEW_DATA.leaseUrl,
  });
  templates.push({
    id: "lease-signed",
    name: "Bail Signé",
    description: "Notification quand toutes les parties ont signé le bail",
    category: "lease",
    subject: leaseSigned.subject,
    html: leaseSigned.html,
    variables: ["ownerName", "signerName", "signerRole", "propertyAddress", "allSigned", "leaseUrl"],
  });

  const propertyInvitation = emailTemplates.propertyInvitation({
    tenantName: PREVIEW_DATA.tenantName,
    ownerName: PREVIEW_DATA.ownerName,
    propertyAddress: PREVIEW_DATA.propertyAddress,
    propertyCode: PREVIEW_DATA.propertyCode,
    inviteUrl: PREVIEW_DATA.inviteUrl,
  });
  templates.push({
    id: "property-invitation",
    name: "Invitation Logement",
    description: "Invitation à rejoindre un logement sur Talok",
    category: "lease",
    subject: propertyInvitation.subject,
    html: propertyInvitation.html,
    variables: ["tenantName", "ownerName", "propertyAddress", "propertyCode", "inviteUrl"],
  });

  // ============================================
  // MAINTENANCE
  // ============================================

  const newTicket = emailTemplates.newTicket({
    recipientName: PREVIEW_DATA.ownerName,
    ticketTitle: PREVIEW_DATA.ticketTitle,
    ticketDescription: PREVIEW_DATA.ticketDescription,
    priority: PREVIEW_DATA.priority,
    propertyAddress: PREVIEW_DATA.propertyAddress,
    createdBy: PREVIEW_DATA.createdBy,
    ticketUrl: PREVIEW_DATA.ticketUrl,
  });
  templates.push({
    id: "new-ticket",
    name: "Nouveau Ticket",
    description: "Notification d'un nouveau ticket de maintenance",
    category: "maintenance",
    subject: newTicket.subject,
    html: newTicket.html,
    variables: ["recipientName", "ticketTitle", "ticketDescription", "priority", "propertyAddress", "createdBy", "ticketUrl"],
  });

  const ticketUpdated = emailTemplates.ticketUpdated({
    recipientName: PREVIEW_DATA.tenantName,
    ticketTitle: PREVIEW_DATA.ticketTitle,
    newStatus: PREVIEW_DATA.newStatus,
    updatedBy: PREVIEW_DATA.ownerName,
    comment: "Le technicien passera demain matin entre 9h et 12h.",
    ticketUrl: PREVIEW_DATA.ticketUrl,
  });
  templates.push({
    id: "ticket-updated",
    name: "Ticket Mis à Jour",
    description: "Notification de mise à jour d'un ticket",
    category: "maintenance",
    subject: ticketUpdated.subject,
    html: ticketUpdated.html,
    variables: ["recipientName", "ticketTitle", "newStatus", "updatedBy", "comment", "ticketUrl"],
  });

  // ============================================
  // VISITES
  // ============================================

  const visitRequest = emailTemplates.visitBookingRequest({
    ownerName: PREVIEW_DATA.ownerName,
    tenantName: PREVIEW_DATA.tenantName,
    propertyAddress: PREVIEW_DATA.propertyAddress,
    visitDate: PREVIEW_DATA.visitDate,
    visitTime: PREVIEW_DATA.visitTime,
    tenantMessage: "Je suis très intéressé par ce logement, il correspond parfaitement à mes critères.",
    bookingsUrl: PREVIEW_DATA.bookingsUrl,
  });
  templates.push({
    id: "visit-booking-request",
    name: "Demande de Visite",
    description: "Notification d'une nouvelle demande de visite",
    category: "visit",
    subject: visitRequest.subject,
    html: visitRequest.html,
    variables: ["ownerName", "tenantName", "propertyAddress", "visitDate", "visitTime", "tenantMessage", "bookingsUrl"],
  });

  const visitConfirmed = emailTemplates.visitBookingConfirmed({
    tenantName: PREVIEW_DATA.tenantName,
    propertyAddress: PREVIEW_DATA.propertyAddress,
    visitDate: PREVIEW_DATA.visitDate,
    visitTime: PREVIEW_DATA.visitTime,
    ownerName: PREVIEW_DATA.ownerName,
    ownerPhone: "06 12 34 56 78",
    bookingUrl: PREVIEW_DATA.bookingUrl,
  });
  templates.push({
    id: "visit-booking-confirmed",
    name: "Visite Confirmée",
    description: "Confirmation d'une visite programmée",
    category: "visit",
    subject: visitConfirmed.subject,
    html: visitConfirmed.html,
    variables: ["tenantName", "propertyAddress", "visitDate", "visitTime", "ownerName", "ownerPhone", "bookingUrl"],
  });

  const visitReminder = emailTemplates.visitReminder({
    recipientName: PREVIEW_DATA.tenantName,
    propertyAddress: PREVIEW_DATA.propertyAddress,
    visitDate: PREVIEW_DATA.visitDate,
    visitTime: PREVIEW_DATA.visitTime,
    hoursBeforeVisit: 24,
    isOwner: false,
    contactName: PREVIEW_DATA.ownerName,
    contactPhone: "06 12 34 56 78",
    bookingUrl: PREVIEW_DATA.bookingUrl,
  });
  templates.push({
    id: "visit-reminder",
    name: "Rappel de Visite",
    description: "Rappel envoyé avant une visite programmée",
    category: "visit",
    subject: visitReminder.subject,
    html: visitReminder.html,
    variables: ["recipientName", "propertyAddress", "visitDate", "visitTime", "hoursBeforeVisit", "isOwner", "contactName", "contactPhone", "bookingUrl"],
  });

  const visitCancelled = emailTemplates.visitBookingCancelled({
    tenantName: PREVIEW_DATA.tenantName,
    propertyAddress: PREVIEW_DATA.propertyAddress,
    visitDate: PREVIEW_DATA.visitDate,
    visitTime: PREVIEW_DATA.visitTime,
    cancellationReason: "Le propriétaire n'est plus disponible à cette date.",
    cancelledBy: "owner",
    searchUrl: PREVIEW_DATA.searchUrl,
  });
  templates.push({
    id: "visit-cancelled",
    name: "Visite Annulée",
    description: "Notification d'annulation de visite",
    category: "visit",
    subject: visitCancelled.subject,
    html: visitCancelled.html,
    variables: ["tenantName", "propertyAddress", "visitDate", "visitTime", "cancellationReason", "cancelledBy", "searchUrl"],
  });

  const visitFeedback = emailTemplates.visitFeedbackRequest({
    tenantName: PREVIEW_DATA.tenantName,
    propertyAddress: PREVIEW_DATA.propertyAddress,
    visitDate: PREVIEW_DATA.visitDate,
    feedbackUrl: PREVIEW_DATA.feedbackUrl,
  });
  templates.push({
    id: "visit-feedback",
    name: "Demande de Feedback",
    description: "Demande d'avis après une visite",
    category: "visit",
    subject: visitFeedback.subject,
    html: visitFeedback.html,
    variables: ["tenantName", "propertyAddress", "visitDate", "feedbackUrl"],
  });

  // ============================================
  // LÉGAL
  // ============================================

  const priceChange = emailTemplates.priceChange({
    userName: PREVIEW_DATA.userName,
    planName: PREVIEW_DATA.planName,
    oldPriceMonthly: PREVIEW_DATA.oldPriceMonthly,
    newPriceMonthly: PREVIEW_DATA.newPriceMonthly,
    oldPriceYearly: PREVIEW_DATA.oldPriceYearly,
    newPriceYearly: PREVIEW_DATA.newPriceYearly,
    effectiveDate: PREVIEW_DATA.effectiveDate,
    grandfatheredUntil: PREVIEW_DATA.grandfatheredUntil,
    changeReason: PREVIEW_DATA.changeReason,
    manageUrl: PREVIEW_DATA.manageUrl,
  });
  templates.push({
    id: "price-change",
    name: "Changement de Tarif",
    description: "Notification de modification tarifaire (conforme L121-84)",
    category: "legal",
    subject: priceChange.subject,
    html: priceChange.html,
    variables: ["userName", "planName", "oldPriceMonthly", "newPriceMonthly", "effectiveDate", "grandfatheredUntil", "changeReason", "manageUrl"],
  });

  const cguUpdate = emailTemplates.cguUpdate({
    userName: PREVIEW_DATA.userName,
    version: PREVIEW_DATA.version,
    changesSummary: PREVIEW_DATA.changesSummary,
    effectiveDate: PREVIEW_DATA.effectiveDate,
    acceptUrl: PREVIEW_DATA.acceptUrl,
  });
  templates.push({
    id: "cgu-update",
    name: "Mise à Jour CGU",
    description: "Notification de mise à jour des conditions générales",
    category: "legal",
    subject: cguUpdate.subject,
    html: cguUpdate.html,
    variables: ["userName", "version", "changesSummary", "effectiveDate", "acceptUrl"],
  });

  // ============================================
  // COMPTE
  // ============================================

  const welcome = emailTemplates.welcome({
    userName: PREVIEW_DATA.userName,
    role: "owner",
    loginUrl: PREVIEW_DATA.loginUrl,
  });
  templates.push({
    id: "welcome",
    name: "Bienvenue (Simple)",
    description: "Email de bienvenue simple après création de compte",
    category: "account",
    subject: welcome.subject,
    html: welcome.html,
    variables: ["userName", "role", "loginUrl"],
  });

  const passwordReset = emailTemplates.passwordReset({
    userName: PREVIEW_DATA.userName,
    resetUrl: PREVIEW_DATA.resetUrl,
    expiresIn: PREVIEW_DATA.expiresIn,
  });
  templates.push({
    id: "password-reset",
    name: "Réinitialisation Mot de Passe",
    description: "Email de réinitialisation de mot de passe",
    category: "account",
    subject: passwordReset.subject,
    html: passwordReset.html,
    variables: ["userName", "resetUrl", "expiresIn"],
  });

  return templates;
}

// Export des templates pour utilisation directe
export const EMAIL_TEMPLATES_DATA = generateEmailTemplatesData();

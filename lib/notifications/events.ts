/**
 * Catalogue des événements de notification Talok
 *
 * Chaque événement définit :
 * - title/body builders (interpolation de variables)
 * - route builder (deep link)
 * - defaultChannels (canaux par défaut si pas de préférence utilisateur)
 * - priority
 */

export type NotificationEventKey =
  // Baux
  | 'lease.created'
  | 'lease.invitation_sent'
  | 'lease.signed'
  | 'lease.activated'
  | 'lease.expiring_soon'
  | 'lease.notice_received'
  | 'lease.terminated'
  // Paiements
  | 'payment.due_soon'
  | 'payment.received'
  | 'payment.failed'
  | 'payment.overdue'
  | 'payment.reminder'
  | 'receipt.generated'
  // Documents
  | 'document.uploaded'
  | 'document.shared'
  | 'document.expiring'
  // Tickets
  | 'ticket.created'
  | 'ticket.assigned'
  | 'ticket.resolved'
  // Prestataires
  | 'quote.requested'
  | 'quote.received'
  | 'intervention.scheduled'
  | 'intervention.completed'
  // Syndic / Copropriété
  | 'copro.appel_fonds'
  | 'copro.relance_impaye'
  | 'copro.convocation_ag'
  | 'copro.cloture_comptes'
  // Système
  | 'account.welcome'
  | 'subscription.expiring'
  | 'subscription.upgraded'
  | 'meter.overconsumption'
  | 'insurance.expiring'
  | 'diagnostic.expiring'
  // Candidatures
  | 'candidature.received'
  | 'candidature.accepted'
  // Dépôt de garantie
  | 'deposit.restitution';

export type NotificationChannel = 'email' | 'push' | 'sms' | 'in_app';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface EventDefinition {
  title: (vars: Record<string, string>) => string;
  body: (vars: Record<string, string>) => string;
  route: (vars: Record<string, string>) => string;
  defaultChannels: NotificationChannel[];
  priority: NotificationPriority;
  /** Email template key in emailTemplates (if exists) */
  emailTemplate?: string;
}

export const EVENT_CATALOGUE: Record<NotificationEventKey, EventDefinition> = {
  // =====================================================
  // BAUX
  // =====================================================
  'lease.created': {
    title: () => 'Nouveau bail créé',
    body: (v) => `Un bail a été créé pour ${v.propertyAddress || 'votre logement'}`,
    route: (v) => `/tenant/lease/${v.leaseId || ''}`,
    defaultChannels: ['email', 'in_app'],
    priority: 'normal',
    emailTemplate: 'leaseCreated',
  },
  'lease.invitation_sent': {
    title: () => 'Invitation à signer un bail',
    body: (v) => `${v.ownerName || 'Un propriétaire'} vous invite à signer le bail pour ${v.propertyAddress || 'un logement'}`,
    route: (v) => `/signature/${v.signatureToken || ''}`,
    defaultChannels: ['email'],
    priority: 'normal',
    emailTemplate: 'signatureRequest',
  },
  'lease.signed': {
    title: () => 'Bail signé',
    body: (v) => `Le bail pour ${v.propertyAddress || 'votre logement'} a été signé par toutes les parties`,
    route: (v) => v.isOwner === 'true' ? `/owner/leases/${v.leaseId || ''}` : '/tenant/lease',
    defaultChannels: ['email', 'push', 'in_app'],
    priority: 'normal',
    emailTemplate: 'leaseSigned',
  },
  'lease.activated': {
    title: () => 'Bail activé',
    body: (v) => `Le bail pour ${v.propertyAddress || 'votre logement'} est maintenant actif`,
    route: (v) => v.isOwner === 'true' ? `/owner/leases/${v.leaseId || ''}` : '/tenant/lease',
    defaultChannels: ['email', 'push'],
    priority: 'normal',
    emailTemplate: 'leaseActivated',
  },
  'lease.expiring_soon': {
    title: (v) => `Bail bientôt expiré (${v.daysLeft || '?'}j)`,
    body: (v) => `Le bail pour ${v.propertyAddress || 'votre logement'} expire dans ${v.daysLeft || '?'} jours`,
    route: (v) => `/owner/leases/${v.leaseId || ''}`,
    defaultChannels: ['email', 'push'],
    priority: 'high',
    emailTemplate: 'leaseExpiring',
  },
  'lease.notice_received': {
    title: () => 'Congé reçu',
    body: (v) => `Un congé a été déposé pour le bail de ${v.propertyAddress || 'votre logement'}`,
    route: (v) => v.isOwner === 'true' ? `/owner/leases/${v.leaseId || ''}` : '/tenant/lease',
    defaultChannels: ['email', 'push', 'in_app'],
    priority: 'high',
    emailTemplate: 'noticeReceived',
  },
  'lease.terminated': {
    title: () => 'Bail résilié',
    body: (v) => `Le bail pour ${v.propertyAddress || 'votre logement'} a été résilié`,
    route: (v) => v.isOwner === 'true' ? `/owner/leases/${v.leaseId || ''}` : '/tenant/lease',
    defaultChannels: ['email'],
    priority: 'normal',
    emailTemplate: 'leaseTerminated',
  },

  // =====================================================
  // PAIEMENTS
  // =====================================================
  'payment.due_soon': {
    title: () => 'Loyer bientôt dû',
    body: (v) => `Votre loyer de ${v.amount || '?'} € est dû le ${v.dueDate || '?'}`,
    route: (v) => `/tenant/payments?invoice=${v.invoiceId || ''}`,
    defaultChannels: ['email', 'push'],
    priority: 'normal',
    emailTemplate: 'paymentDueSoon',
  },
  'payment.received': {
    title: () => 'Paiement reçu',
    body: (v) => `${v.tenantName || 'Un locataire'} a payé ${v.amount || '?'} € pour ${v.period || 'le loyer'}`,
    route: (v) => `/owner/money?invoice=${v.invoiceId || ''}`,
    defaultChannels: ['email', 'push', 'in_app'],
    priority: 'normal',
    emailTemplate: 'paymentConfirmation',
  },
  'payment.failed': {
    title: () => 'Échec de paiement',
    body: (v) => `Le paiement de ${v.amount || '?'} € pour ${v.propertyAddress || 'votre logement'} a échoué`,
    route: (v) => `/tenant/payments?invoice=${v.invoiceId || ''}`,
    defaultChannels: ['email', 'push'],
    priority: 'high',
    emailTemplate: 'paymentFailed',
  },
  'payment.overdue': {
    title: () => 'Loyer en retard',
    body: (v) => `Le loyer de ${v.amount || '?'} € est en retard de ${v.daysLate || '?'} jours`,
    route: (v) => `/tenant/payments?invoice=${v.invoiceId || ''}`,
    defaultChannels: ['email'],
    priority: 'urgent',
    emailTemplate: 'paymentOverdue',
  },
  'payment.reminder': {
    title: () => 'Rappel de loyer',
    body: (v) => `Votre loyer de ${v.amount || '?'} € est en attente depuis ${v.daysLate || '?'} jours`,
    route: (v) => `/tenant/payments?invoice=${v.invoiceId || ''}`,
    defaultChannels: ['email'],
    priority: 'high',
    emailTemplate: 'paymentReminder',
  },
  'receipt.generated': {
    title: () => 'Quittance disponible',
    body: (v) => `Votre quittance de loyer pour ${v.period || 'ce mois'} est disponible`,
    route: () => '/tenant/documents',
    defaultChannels: ['email'],
    priority: 'low',
    emailTemplate: 'receiptGenerated',
  },

  // =====================================================
  // DOCUMENTS
  // =====================================================
  'document.uploaded': {
    title: () => 'Nouveau document',
    body: (v) => `${v.uploaderName || 'Un utilisateur'} a ajouté un document : ${v.documentName || 'fichier'}`,
    route: (v) => `/owner/documents/${v.documentId || ''}`,
    defaultChannels: ['in_app'],
    priority: 'low',
    emailTemplate: 'documentUploaded',
  },
  'document.shared': {
    title: () => 'Document partagé',
    body: (v) => `${v.ownerName || 'Votre propriétaire'} a partagé un document : ${v.documentName || 'fichier'}`,
    route: () => '/tenant/documents',
    defaultChannels: ['email', 'in_app'],
    priority: 'normal',
    emailTemplate: 'documentShared',
  },
  'document.expiring': {
    title: (v) => `Document bientôt expiré (${v.daysLeft || '?'}j)`,
    body: (v) => `Le document « ${v.documentName || '?'} » expire dans ${v.daysLeft || '?'} jours`,
    route: (v) => `/owner/documents/${v.documentId || ''}`,
    defaultChannels: ['email', 'push'],
    priority: 'high',
    emailTemplate: 'documentExpiring',
  },

  // =====================================================
  // TICKETS
  // =====================================================
  'ticket.created': {
    title: () => 'Nouvelle demande',
    body: (v) => `${v.tenantName || 'Un locataire'} a signalé : « ${v.ticketTitle || '?'} » pour ${v.propertyAddress || 'un logement'}`,
    route: (v) => `/owner/tickets/${v.ticketId || ''}`,
    defaultChannels: ['email', 'push', 'in_app'],
    priority: 'normal',
    emailTemplate: 'ticketCreated',
  },
  'ticket.assigned': {
    title: () => 'Intervention assignée',
    body: (v) => `Vous avez été assigné au ticket « ${v.ticketTitle || '?'} » pour ${v.propertyAddress || 'un logement'}`,
    route: (v) => `/provider/tickets/${v.ticketId || ''}`,
    defaultChannels: ['email', 'push'],
    priority: 'normal',
    emailTemplate: 'ticketAssigned',
  },
  'ticket.resolved': {
    title: () => 'Demande résolue',
    body: (v) => `Votre demande « ${v.ticketTitle || '?'} » a été résolue`,
    route: (v) => `/tenant/tickets/${v.ticketId || ''}`,
    defaultChannels: ['email', 'push', 'in_app'],
    priority: 'normal',
    emailTemplate: 'ticketResolved',
  },

  // =====================================================
  // PRESTATAIRES
  // =====================================================
  'quote.requested': {
    title: () => 'Demande de devis',
    body: (v) => `Un devis vous a été demandé pour ${v.propertyAddress || 'un logement'} : ${v.description || ''}`,
    route: (v) => `/provider/quotes/${v.quoteId || ''}`,
    defaultChannels: ['email', 'push'],
    priority: 'normal',
    emailTemplate: 'quoteRequested',
  },
  'quote.received': {
    title: () => 'Devis reçu',
    body: (v) => `${v.providerName || 'Un prestataire'} a envoyé un devis de ${v.amount || '?'} €`,
    route: (v) => `/owner/work-orders/${v.workOrderId || ''}`,
    defaultChannels: ['email', 'push', 'in_app'],
    priority: 'normal',
    emailTemplate: 'quoteReceived',
  },
  'intervention.scheduled': {
    title: (v) => `Intervention le ${v.date || '?'}`,
    body: (v) => `${v.providerName || 'Un prestataire'} interviendra dans votre logement le ${v.date || '?'} à ${v.time || '?'}`,
    route: () => '/tenant/work-orders',
    defaultChannels: ['email', 'push'],
    priority: 'normal',
    emailTemplate: 'interventionScheduled',
  },
  'intervention.completed': {
    title: () => 'Intervention terminée',
    body: (v) => `L'intervention de ${v.providerName || 'un prestataire'} pour ${v.propertyAddress || 'votre logement'} est terminée`,
    route: (v) => `/owner/work-orders/${v.workOrderId || ''}`,
    defaultChannels: ['email', 'in_app'],
    priority: 'normal',
    emailTemplate: 'interventionCompleted',
  },

  // =====================================================
  // SYNDIC / COPROPRIÉTÉ
  // =====================================================
  'copro.appel_fonds': {
    title: (v) => `Appel de fonds ${v.period || ''}`,
    body: (v) => `Un appel de fonds de ${v.amount || '?'} € est disponible pour ${v.coproName || 'votre copropriété'}`,
    route: (v) => `/copro/${v.coproId || ''}/appels`,
    defaultChannels: ['email'],
    priority: 'normal',
    emailTemplate: 'coproAppelFonds',
  },
  'copro.relance_impaye': {
    title: () => 'Relance impayé copropriété',
    body: (v) => `Vous avez un impayé de ${v.amount || '?'} € pour ${v.coproName || 'votre copropriété'}`,
    route: (v) => `/copro/${v.coproId || ''}/appels`,
    defaultChannels: ['email'],
    priority: 'high',
    emailTemplate: 'coproRelance',
  },
  'copro.convocation_ag': {
    title: () => 'Convocation AG',
    body: (v) => `Assemblée générale le ${v.date || '?'} pour ${v.coproName || 'votre copropriété'}`,
    route: (v) => `/copro/${v.coproId || ''}/ag/${v.agId || ''}`,
    defaultChannels: ['email'],
    priority: 'high',
    emailTemplate: 'coproConvocationAG',
  },
  'copro.cloture_comptes': {
    title: () => 'Clôture des comptes',
    body: (v) => `Les comptes ${v.year || ''} de ${v.coproName || 'votre copropriété'} sont clôturés`,
    route: (v) => `/copro/${v.coproId || ''}/comptes`,
    defaultChannels: ['email'],
    priority: 'normal',
    emailTemplate: 'coproClotureComptes',
  },

  // =====================================================
  // SYSTÈME
  // =====================================================
  'account.welcome': {
    title: () => 'Bienvenue sur Talok !',
    body: (v) => `Bienvenue ${v.userName || ''} ! Votre compte est prêt.`,
    route: () => '/dashboard',
    defaultChannels: ['email'],
    priority: 'normal',
    emailTemplate: 'welcome',
  },
  'subscription.expiring': {
    title: (v) => `Abonnement expire dans ${v.daysLeft || '?'} jours`,
    body: (v) => `Votre abonnement ${v.planName || ''} expire le ${v.expirationDate || '?'}`,
    route: () => '/settings/subscription',
    defaultChannels: ['email', 'push'],
    priority: 'high',
    emailTemplate: 'subscriptionExpiring',
  },
  'subscription.upgraded': {
    title: () => 'Abonnement mis à jour',
    body: (v) => `Vous êtes maintenant sur le plan ${v.planName || ''}`,
    route: () => '/settings/subscription',
    defaultChannels: ['email'],
    priority: 'normal',
    emailTemplate: 'subscriptionUpgraded',
  },
  'meter.overconsumption': {
    title: () => 'Surconsommation détectée',
    body: (v) => `Une surconsommation ${v.meterType || ''} a été détectée pour ${v.propertyAddress || 'un logement'}`,
    route: (v) => `/owner/properties/${v.propertyId || ''}/meters`,
    defaultChannels: ['email', 'push'],
    priority: 'high',
    emailTemplate: 'meterOverconsumption',
  },
  'insurance.expiring': {
    title: (v) => `Assurance expire dans ${v.daysLeft || '?'} jours`,
    body: (v) => `L'assurance de ${v.propertyAddress || 'votre logement'} expire le ${v.expirationDate || '?'}`,
    route: (v) => `/owner/properties/${v.propertyId || ''}/insurance`,
    defaultChannels: ['email', 'push'],
    priority: 'high',
    emailTemplate: 'insuranceExpiring',
  },
  'diagnostic.expiring': {
    title: (v) => `Diagnostic expire dans ${v.daysLeft || '?'} jours`,
    body: (v) => `Le diagnostic ${v.diagnosticType || ''} de ${v.propertyAddress || 'votre logement'} expire le ${v.expirationDate || '?'}`,
    route: (v) => `/owner/properties/${v.propertyId || ''}/diagnostics`,
    defaultChannels: ['email', 'push'],
    priority: 'high',
    emailTemplate: 'diagnosticExpiring',
  },

  // =====================================================
  // CANDIDATURES
  // =====================================================
  'candidature.received': {
    title: () => 'Nouvelle candidature',
    body: (v) => `${v.candidateName || 'Un candidat'} a postulé pour ${v.propertyAddress || 'votre logement'}`,
    route: (v) => `/owner/properties/${v.propertyId || ''}/candidatures`,
    defaultChannels: ['email', 'push', 'in_app'],
    priority: 'normal',
    emailTemplate: 'candidatureReceived',
  },
  'candidature.accepted': {
    title: () => 'Candidature acceptée',
    body: (v) => `Votre candidature pour ${v.propertyAddress || 'un logement'} a été acceptée !`,
    route: (v) => `/tenant/candidatures/${v.candidatureId || ''}`,
    defaultChannels: ['email', 'push', 'in_app'],
    priority: 'normal',
    emailTemplate: 'candidatureAccepted',
  },

  // =====================================================
  // DÉPÔT DE GARANTIE
  // =====================================================
  'deposit.restitution': {
    title: () => 'Restitution du dépôt de garantie',
    body: (v) => `Le dépôt de garantie de ${v.amount || '?'} € pour ${v.propertyAddress || 'votre logement'} a été restitué`,
    route: (v) => `/tenant/lease/${v.leaseId || ''}`,
    defaultChannels: ['email', 'in_app'],
    priority: 'normal',
    emailTemplate: 'depositRestitution',
  },
};

/**
 * Event category labels for UI grouping
 */
export const EVENT_CATEGORIES: Record<string, { label: string; events: NotificationEventKey[] }> = {
  lease: {
    label: 'Baux',
    events: [
      'lease.created', 'lease.invitation_sent', 'lease.signed',
      'lease.activated', 'lease.expiring_soon', 'lease.notice_received', 'lease.terminated',
    ],
  },
  payment: {
    label: 'Paiements',
    events: [
      'payment.due_soon', 'payment.received', 'payment.failed',
      'payment.overdue', 'payment.reminder', 'receipt.generated',
    ],
  },
  document: {
    label: 'Documents',
    events: ['document.uploaded', 'document.shared', 'document.expiring'],
  },
  ticket: {
    label: 'Demandes & Tickets',
    events: ['ticket.created', 'ticket.assigned', 'ticket.resolved'],
  },
  provider: {
    label: 'Prestataires',
    events: ['quote.requested', 'quote.received', 'intervention.scheduled', 'intervention.completed'],
  },
  copro: {
    label: 'Copropriété',
    events: ['copro.appel_fonds', 'copro.relance_impaye', 'copro.convocation_ag', 'copro.cloture_comptes'],
  },
  system: {
    label: 'Système',
    events: [
      'account.welcome', 'subscription.expiring', 'subscription.upgraded',
      'meter.overconsumption', 'insurance.expiring', 'diagnostic.expiring',
    ],
  },
  candidature: {
    label: 'Candidatures',
    events: ['candidature.received', 'candidature.accepted'],
  },
  deposit: {
    label: 'Dépôt de garantie',
    events: ['deposit.restitution'],
  },
};

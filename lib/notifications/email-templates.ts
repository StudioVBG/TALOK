/**
 * Email templates for the unified notification system.
 *
 * Each key maps to a NotificationEventKey (or '_generic' for fallback).
 * Templates receive event data + recipientName/recipientEmail.
 * Returns { subject, html } for sendEmail().
 */

import { baseLayout } from '@/lib/emails/templates';
import { escapeHtml } from '@/lib/utils/escape-html';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://talok.fr';

interface TemplateData extends Record<string, string | undefined> {
  recipientName: string;
  recipientEmail: string;
}

type TemplateBuilder = (data: TemplateData) => { subject: string; html: string };

function actionButton(url: string, label: string, variant: 'primary' | 'success' | 'warning' = 'primary'): string {
  const cls = variant === 'success' ? 'button button-success' : variant === 'warning' ? 'button button-warning' : 'button';
  return `<a href="${url}" class="${cls}" style="display:inline-block;text-decoration:none;">${escapeHtml(label)}</a>`;
}

function infoRow(label: string, value: string): string {
  return `
    <div class="info-row">
      <span class="info-label">${escapeHtml(label)}</span>
      <span class="info-value">${escapeHtml(value)}</span>
    </div>`;
}

/**
 * All notification email templates indexed by event key.
 * The '_generic' key is used as fallback when no specific template exists.
 */
export const notificationEmailTemplates: Record<string, TemplateBuilder> = {
  // =====================================================
  // GENERIC FALLBACK
  // =====================================================
  '_generic': (d) => ({
    subject: d.title || 'Notification Talok',
    html: baseLayout(`
      <div class="content">
        <h1>${escapeHtml(d.title || 'Notification')}</h1>
        <p>Bonjour ${escapeHtml(d.recipientName)},</p>
        <p>${escapeHtml(d.body || '')}</p>
        ${d.actionUrl ? actionButton(d.actionUrl, d.actionLabel || 'Voir sur Talok') : ''}
      </div>
    `, d.body),
  }),

  // =====================================================
  // BAUX
  // =====================================================
  'lease.activated': (d) => ({
    subject: `Bail activé — ${d.propertyAddress || 'Votre logement'}`,
    html: baseLayout(`
      <div class="content">
        <h1>Bail activé</h1>
        <p>Bonjour ${escapeHtml(d.recipientName)},</p>
        <p>Le bail pour <strong>${escapeHtml(d.propertyAddress || 'votre logement')}</strong> est maintenant actif.</p>
        <div class="info-grid">
          ${d.propertyAddress ? infoRow('Logement', d.propertyAddress) : ''}
          ${d.startDate ? infoRow('Date de début', d.startDate) : ''}
        </div>
        ${actionButton(`${APP_URL}/owner/leases/${d.leaseId || ''}`, 'Voir le bail')}
      </div>
    `, 'Votre bail est maintenant actif'),
  }),

  'lease.expiring_soon': (d) => ({
    subject: `Bail bientôt expiré — ${d.propertyAddress || 'Votre logement'}`,
    html: baseLayout(`
      <div class="content">
        <h1>Bail bientôt expiré</h1>
        <p>Bonjour ${escapeHtml(d.recipientName)},</p>
        <p>Le bail pour <strong>${escapeHtml(d.propertyAddress || 'votre logement')}</strong> expire dans <strong>${escapeHtml(d.daysLeft || '?')} jours</strong>.</p>
        <div class="highlight-box">
          <p>Pensez à renouveler ou à donner congé avant la date d'échéance.</p>
        </div>
        ${actionButton(`${APP_URL}/owner/leases/${d.leaseId || ''}`, 'Gérer le bail', 'warning')}
      </div>
    `, `Bail expire dans ${d.daysLeft || '?'} jours`),
  }),

  'lease.notice_received': (d) => ({
    subject: `Congé reçu — ${d.propertyAddress || 'Votre logement'}`,
    html: baseLayout(`
      <div class="content">
        <h1>Congé reçu</h1>
        <p>Bonjour ${escapeHtml(d.recipientName)},</p>
        <p>Un congé a été déposé pour le bail de <strong>${escapeHtml(d.propertyAddress || 'votre logement')}</strong>.</p>
        ${d.noticeDate ? `<div class="info-grid">${infoRow('Date de congé', d.noticeDate)}${d.endDate ? infoRow('Date de fin de bail', d.endDate) : ''}</div>` : ''}
        ${actionButton(`${APP_URL}/owner/leases/${d.leaseId || ''}`, 'Voir les détails')}
      </div>
    `, 'Un congé a été déposé'),
  }),

  'lease.terminated': (d) => ({
    subject: `Bail résilié — ${d.propertyAddress || 'Votre logement'}`,
    html: baseLayout(`
      <div class="content">
        <h1>Bail résilié</h1>
        <p>Bonjour ${escapeHtml(d.recipientName)},</p>
        <p>Le bail pour <strong>${escapeHtml(d.propertyAddress || 'votre logement')}</strong> a été résilié.</p>
        ${actionButton(`${APP_URL}/owner/leases/${d.leaseId || ''}`, 'Voir le bail')}
      </div>
    `, 'Votre bail a été résilié'),
  }),

  // =====================================================
  // PAIEMENTS (compléments aux templates existants)
  // =====================================================
  'payment.due_soon': (d) => ({
    subject: `Loyer bientôt dû — ${d.amount || ''} €`,
    html: baseLayout(`
      <div class="content">
        <h1>Loyer bientôt dû</h1>
        <p>Bonjour ${escapeHtml(d.recipientName)},</p>
        <p>Votre loyer est dû prochainement.</p>
        <div class="highlight-box">
          <p style="font-size: 14px; color: #6b7280; margin-bottom: 4px;">Montant</p>
          <div class="amount">${escapeHtml(d.amount || '?')} €</div>
          <p style="font-size: 14px; color: #6b7280;">Échéance : ${escapeHtml(d.dueDate || '?')}</p>
        </div>
        ${actionButton(`${APP_URL}/tenant/payments?invoice=${d.invoiceId || ''}`, 'Payer maintenant', 'success')}
      </div>
    `, `Loyer de ${d.amount || '?'} € dû le ${d.dueDate || '?'}`),
  }),

  'payment.failed': (d) => ({
    subject: `Échec de paiement — ${d.amount || ''} €`,
    html: baseLayout(`
      <div class="content">
        <h1>Échec de paiement</h1>
        <p>Bonjour ${escapeHtml(d.recipientName)},</p>
        <p>Le paiement de <strong>${escapeHtml(d.amount || '?')} €</strong> pour ${escapeHtml(d.propertyAddress || 'votre logement')} a échoué.</p>
        <div class="highlight-box">
          <p>Veuillez vérifier votre moyen de paiement et réessayer.</p>
        </div>
        ${actionButton(`${APP_URL}/tenant/payments?invoice=${d.invoiceId || ''}`, 'Réessayer le paiement', 'warning')}
      </div>
    `, 'Votre paiement a échoué'),
  }),

  'payment.overdue': (d) => ({
    subject: `Loyer en retard — ${d.daysLate || '?'} jours`,
    html: baseLayout(`
      <div class="content">
        <h1>Loyer en retard</h1>
        <p>Bonjour ${escapeHtml(d.recipientName)},</p>
        <p>Votre loyer de <strong>${escapeHtml(d.amount || '?')} €</strong> est en retard de <strong>${escapeHtml(d.daysLate || '?')} jours</strong>.</p>
        <div class="highlight-box">
          <p>Veuillez régulariser votre situation au plus vite pour éviter les frais de retard.</p>
        </div>
        ${actionButton(`${APP_URL}/tenant/payments?invoice=${d.invoiceId || ''}`, 'Payer maintenant', 'warning')}
      </div>
    `, `Loyer en retard de ${d.daysLate || '?'} jours`),
  }),

  // =====================================================
  // DOCUMENTS
  // =====================================================
  'document.shared': (d) => ({
    subject: `Document partagé — ${d.documentName || 'Nouveau document'}`,
    html: baseLayout(`
      <div class="content">
        <h1>Document partagé</h1>
        <p>Bonjour ${escapeHtml(d.recipientName)},</p>
        <p>${escapeHtml(d.ownerName || 'Votre propriétaire')} a partagé un document avec vous :</p>
        <div class="highlight-box">
          <p><strong>${escapeHtml(d.documentName || 'Document')}</strong></p>
        </div>
        ${actionButton(`${APP_URL}/tenant/documents`, 'Consulter le document')}
      </div>
    `, `${d.ownerName || 'Un propriétaire'} a partagé un document`),
  }),

  'document.expiring': (d) => ({
    subject: `Document bientôt expiré — ${d.documentName || ''}`,
    html: baseLayout(`
      <div class="content">
        <h1>Document bientôt expiré</h1>
        <p>Bonjour ${escapeHtml(d.recipientName)},</p>
        <p>Le document <strong>« ${escapeHtml(d.documentName || '?')} »</strong> expire dans <strong>${escapeHtml(d.daysLeft || '?')} jours</strong>.</p>
        <div class="highlight-box">
          <p>Pensez à renouveler ce document avant son expiration.</p>
        </div>
        ${actionButton(`${APP_URL}/owner/documents/${d.documentId || ''}`, 'Gérer le document', 'warning')}
      </div>
    `, `Document expire dans ${d.daysLeft || '?'} jours`),
  }),

  // =====================================================
  // TICKETS
  // =====================================================
  'ticket.assigned': (d) => ({
    subject: `Intervention assignée — ${d.ticketTitle || ''}`,
    html: baseLayout(`
      <div class="content">
        <h1>Nouvelle intervention assignée</h1>
        <p>Bonjour ${escapeHtml(d.recipientName)},</p>
        <p>Vous avez été assigné à l'intervention <strong>« ${escapeHtml(d.ticketTitle || '?')} »</strong>.</p>
        <div class="info-grid">
          ${d.propertyAddress ? infoRow('Logement', d.propertyAddress) : ''}
          ${d.priority ? infoRow('Priorité', d.priority) : ''}
        </div>
        ${actionButton(`${APP_URL}/provider/tickets/${d.ticketId || ''}`, 'Voir le ticket')}
      </div>
    `, 'Nouvelle intervention assignée'),
  }),

  'ticket.resolved': (d) => ({
    subject: `Demande résolue — ${d.ticketTitle || ''}`,
    html: baseLayout(`
      <div class="content">
        <h1>Demande résolue</h1>
        <p>Bonjour ${escapeHtml(d.recipientName)},</p>
        <p>Votre demande <strong>« ${escapeHtml(d.ticketTitle || '?')} »</strong> a été résolue.</p>
        ${d.resolution ? `<div class="highlight-box"><p>${escapeHtml(d.resolution)}</p></div>` : ''}
        ${actionButton(`${APP_URL}/tenant/tickets/${d.ticketId || ''}`, 'Voir les détails', 'success')}
      </div>
    `, 'Votre demande a été résolue'),
  }),

  // =====================================================
  // PRESTATAIRES
  // =====================================================
  'quote.requested': (d) => ({
    subject: `Demande de devis — ${d.propertyAddress || ''}`,
    html: baseLayout(`
      <div class="content">
        <h1>Demande de devis</h1>
        <p>Bonjour ${escapeHtml(d.recipientName)},</p>
        <p>Un devis vous a été demandé pour <strong>${escapeHtml(d.propertyAddress || 'un logement')}</strong>.</p>
        ${d.description ? `<div class="highlight-box"><p>${escapeHtml(d.description)}</p></div>` : ''}
        ${actionButton(`${APP_URL}/provider/quotes/${d.quoteId || ''}`, 'Répondre au devis')}
      </div>
    `, 'Nouvelle demande de devis'),
  }),

  'quote.received': (d) => ({
    subject: `Devis reçu — ${d.providerName || ''} (${d.amount || '?'} €)`,
    html: baseLayout(`
      <div class="content">
        <h1>Devis reçu</h1>
        <p>Bonjour ${escapeHtml(d.recipientName)},</p>
        <p><strong>${escapeHtml(d.providerName || 'Un prestataire')}</strong> a envoyé un devis.</p>
        <div class="highlight-box">
          <p style="font-size: 14px; color: #6b7280; margin-bottom: 4px;">Montant du devis</p>
          <div class="amount">${escapeHtml(d.amount || '?')} €</div>
        </div>
        ${actionButton(`${APP_URL}/owner/work-orders/${d.workOrderId || ''}`, 'Voir le devis')}
      </div>
    `, `Devis de ${d.providerName || 'un prestataire'}`),
  }),

  'intervention.scheduled': (d) => ({
    subject: `Intervention planifiée le ${d.date || '?'}`,
    html: baseLayout(`
      <div class="content">
        <h1>Intervention planifiée</h1>
        <p>Bonjour ${escapeHtml(d.recipientName)},</p>
        <p>Une intervention est prévue dans votre logement.</p>
        <div class="info-grid">
          ${d.date ? infoRow('Date', d.date) : ''}
          ${d.time ? infoRow('Heure', d.time) : ''}
          ${d.providerName ? infoRow('Prestataire', d.providerName) : ''}
          ${d.propertyAddress ? infoRow('Logement', d.propertyAddress) : ''}
        </div>
        ${actionButton(`${APP_URL}/tenant/work-orders`, 'Voir les détails')}
      </div>
    `, `Intervention le ${d.date || '?'}`),
  }),

  'intervention.completed': (d) => ({
    subject: `Intervention terminée — ${d.propertyAddress || ''}`,
    html: baseLayout(`
      <div class="content">
        <h1>Intervention terminée</h1>
        <p>Bonjour ${escapeHtml(d.recipientName)},</p>
        <p>L'intervention de <strong>${escapeHtml(d.providerName || 'un prestataire')}</strong> pour ${escapeHtml(d.propertyAddress || 'votre logement')} est terminée.</p>
        ${actionButton(`${APP_URL}/owner/work-orders/${d.workOrderId || ''}`, 'Voir le rapport', 'success')}
      </div>
    `, 'Intervention terminée'),
  }),

  // =====================================================
  // COPROPRIÉTÉ
  // =====================================================
  'copro.appel_fonds': (d) => ({
    subject: `Appel de fonds ${d.period || ''} — ${d.coproName || ''}`,
    html: baseLayout(`
      <div class="content">
        <h1>Appel de fonds</h1>
        <p>Bonjour ${escapeHtml(d.recipientName)},</p>
        <p>Un nouvel appel de fonds est disponible pour <strong>${escapeHtml(d.coproName || 'votre copropriété')}</strong>.</p>
        <div class="highlight-box">
          <p style="font-size: 14px; color: #6b7280; margin-bottom: 4px;">Montant</p>
          <div class="amount">${escapeHtml(d.amount || '?')} €</div>
          ${d.dueDate ? `<p style="font-size: 14px; color: #6b7280;">Échéance : ${escapeHtml(d.dueDate)}</p>` : ''}
        </div>
        ${actionButton(`${APP_URL}/copro/${d.coproId || ''}/appels`, 'Voir l\'appel de fonds')}
      </div>
    `, `Appel de fonds de ${d.amount || '?'} €`),
  }),

  'copro.relance_impaye': (d) => ({
    subject: `Relance impayé — ${d.coproName || 'Copropriété'}`,
    html: baseLayout(`
      <div class="content">
        <h1>Relance impayé</h1>
        <p>Bonjour ${escapeHtml(d.recipientName)},</p>
        <p>Vous avez un impayé de <strong>${escapeHtml(d.amount || '?')} €</strong> pour ${escapeHtml(d.coproName || 'votre copropriété')}.</p>
        <div class="highlight-box">
          <p>Veuillez régulariser votre situation au plus vite.</p>
        </div>
        ${actionButton(`${APP_URL}/copro/${d.coproId || ''}/appels`, 'Régulariser', 'warning')}
      </div>
    `, `Impayé de ${d.amount || '?'} € à régulariser`),
  }),

  'copro.convocation_ag': (d) => ({
    subject: `Convocation AG — ${d.coproName || 'Copropriété'}`,
    html: baseLayout(`
      <div class="content">
        <h1>Convocation Assemblée Générale</h1>
        <p>Bonjour ${escapeHtml(d.recipientName)},</p>
        <p>Vous êtes convoqué à l'assemblée générale de <strong>${escapeHtml(d.coproName || 'votre copropriété')}</strong>.</p>
        <div class="info-grid">
          ${d.date ? infoRow('Date', d.date) : ''}
          ${d.time ? infoRow('Heure', d.time) : ''}
          ${d.location ? infoRow('Lieu', d.location) : ''}
        </div>
        ${actionButton(`${APP_URL}/copro/${d.coproId || ''}/ag/${d.agId || ''}`, 'Voir l\'ordre du jour')}
      </div>
    `, `AG le ${d.date || '?'}`),
  }),

  'copro.cloture_comptes': (d) => ({
    subject: `Clôture des comptes ${d.year || ''} — ${d.coproName || ''}`,
    html: baseLayout(`
      <div class="content">
        <h1>Clôture des comptes</h1>
        <p>Bonjour ${escapeHtml(d.recipientName)},</p>
        <p>Les comptes ${escapeHtml(d.year || '')} de <strong>${escapeHtml(d.coproName || 'votre copropriété')}</strong> ont été clôturés.</p>
        ${actionButton(`${APP_URL}/copro/${d.coproId || ''}/comptes`, 'Consulter les comptes')}
      </div>
    `, `Comptes ${d.year || ''} clôturés`),
  }),

  // =====================================================
  // SYSTÈME
  // =====================================================
  'subscription.expiring': (d) => ({
    subject: `Votre abonnement expire bientôt`,
    html: baseLayout(`
      <div class="content">
        <h1>Abonnement bientôt expiré</h1>
        <p>Bonjour ${escapeHtml(d.recipientName)},</p>
        <p>Votre abonnement <strong>${escapeHtml(d.planName || '')}</strong> expire dans <strong>${escapeHtml(d.daysLeft || '?')} jours</strong> (le ${escapeHtml(d.expirationDate || '?')}).</p>
        <div class="highlight-box">
          <p>Renouvelez votre abonnement pour continuer à profiter de toutes les fonctionnalités.</p>
        </div>
        ${actionButton(`${APP_URL}/settings/subscription`, 'Gérer mon abonnement', 'warning')}
      </div>
    `, 'Votre abonnement expire bientôt'),
  }),

  'meter.overconsumption': (d) => ({
    subject: `Surconsommation détectée — ${d.propertyAddress || ''}`,
    html: baseLayout(`
      <div class="content">
        <h1>Surconsommation détectée</h1>
        <p>Bonjour ${escapeHtml(d.recipientName)},</p>
        <p>Une surconsommation ${escapeHtml(d.meterType || '')} a été détectée pour <strong>${escapeHtml(d.propertyAddress || 'un logement')}</strong>.</p>
        <div class="highlight-box">
          <p>Nous vous recommandons de vérifier les installations.</p>
        </div>
        ${actionButton(`${APP_URL}/owner/properties/${d.propertyId || ''}/meters`, 'Voir les compteurs', 'warning')}
      </div>
    `, 'Surconsommation détectée'),
  }),

  'insurance.expiring': (d) => ({
    subject: `Assurance bientôt expirée — ${d.propertyAddress || ''}`,
    html: baseLayout(`
      <div class="content">
        <h1>Assurance bientôt expirée</h1>
        <p>Bonjour ${escapeHtml(d.recipientName)},</p>
        <p>L'assurance de <strong>${escapeHtml(d.propertyAddress || 'votre logement')}</strong> expire dans <strong>${escapeHtml(d.daysLeft || '?')} jours</strong> (le ${escapeHtml(d.expirationDate || '?')}).</p>
        ${actionButton(`${APP_URL}/owner/properties/${d.propertyId || ''}/insurance`, 'Gérer l\'assurance', 'warning')}
      </div>
    `, `Assurance expire dans ${d.daysLeft || '?'} jours`),
  }),

  'diagnostic.expiring': (d) => ({
    subject: `Diagnostic bientôt expiré — ${d.diagnosticType || ''} (${d.propertyAddress || ''})`,
    html: baseLayout(`
      <div class="content">
        <h1>Diagnostic bientôt expiré</h1>
        <p>Bonjour ${escapeHtml(d.recipientName)},</p>
        <p>Le diagnostic <strong>${escapeHtml(d.diagnosticType || '')}</strong> de <strong>${escapeHtml(d.propertyAddress || 'votre logement')}</strong> expire dans <strong>${escapeHtml(d.daysLeft || '?')} jours</strong>.</p>
        ${actionButton(`${APP_URL}/owner/properties/${d.propertyId || ''}/diagnostics`, 'Gérer les diagnostics', 'warning')}
      </div>
    `, `Diagnostic expire dans ${d.daysLeft || '?'} jours`),
  }),

  // =====================================================
  // CANDIDATURES
  // =====================================================
  'candidature.received': (d) => ({
    subject: `Nouvelle candidature — ${d.candidateName || ''}`,
    html: baseLayout(`
      <div class="content">
        <h1>Nouvelle candidature</h1>
        <p>Bonjour ${escapeHtml(d.recipientName)},</p>
        <p><strong>${escapeHtml(d.candidateName || 'Un candidat')}</strong> a postulé pour <strong>${escapeHtml(d.propertyAddress || 'votre logement')}</strong>.</p>
        ${actionButton(`${APP_URL}/owner/properties/${d.propertyId || ''}/candidatures`, 'Voir la candidature')}
      </div>
    `, `Nouvelle candidature de ${d.candidateName || 'un candidat'}`),
  }),

  'candidature.accepted': (d) => ({
    subject: `Candidature acceptée — ${d.propertyAddress || ''}`,
    html: baseLayout(`
      <div class="content">
        <h1>Candidature acceptée !</h1>
        <p>Bonjour ${escapeHtml(d.recipientName)},</p>
        <p>Votre candidature pour <strong>${escapeHtml(d.propertyAddress || 'un logement')}</strong> a été acceptée !</p>
        <div class="highlight-box">
          <p>Les prochaines étapes vous seront communiquées par le propriétaire.</p>
        </div>
        ${actionButton(`${APP_URL}/tenant/candidatures/${d.candidatureId || ''}`, 'Voir les détails', 'success')}
      </div>
    `, 'Votre candidature a été acceptée'),
  }),

  // =====================================================
  // DÉPÔT DE GARANTIE
  // =====================================================
  'deposit.restitution': (d) => ({
    subject: `Restitution du dépôt de garantie — ${d.amount || '?'} €`,
    html: baseLayout(`
      <div class="content">
        <h1>Restitution du dépôt de garantie</h1>
        <p>Bonjour ${escapeHtml(d.recipientName)},</p>
        <p>Le dépôt de garantie pour <strong>${escapeHtml(d.propertyAddress || 'votre logement')}</strong> a été restitué.</p>
        <div class="highlight-box">
          <p style="font-size: 14px; color: #6b7280; margin-bottom: 4px;">Montant restitué</p>
          <div class="amount">${escapeHtml(d.amount || '?')} €</div>
        </div>
        ${actionButton(`${APP_URL}/tenant/lease/${d.leaseId || ''}`, 'Voir les détails', 'success')}
      </div>
    `, `Dépôt de ${d.amount || '?'} € restitué`),
  }),
};

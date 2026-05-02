/**
 * Templates email partagés pour les Edge Functions Supabase (Deno)
 *
 * Centralise les templates HTML utilisés par sepa-prenotification et process-outbox
 * pour éviter les templates inline et garantir la cohérence visuelle.
 */

const APP_URL = () => Deno.env.get("NEXT_PUBLIC_APP_URL") || "https://talok.fr";

function baseWrapper(content: string): string {
  return `
<div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
  <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); padding: 40px 30px; text-align: center;">
    <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">Talok</h1>
    <p style="color: #94a3b8; margin: 8px 0 0; font-size: 14px;">Gestion locative simplifiée</p>
  </div>
  <div style="padding: 40px 30px;">
    ${content}
  </div>
  <div style="background: #f8fafc; padding: 24px 30px; border-top: 1px solid #e2e8f0;">
    <p style="color: #94a3b8; font-size: 12px; margin: 0; text-align: center;">
      Vous recevez cet email car vous avez un compte sur Talok.
      <br />
      <a href="${APP_URL()}/settings/notifications" style="color: #64748b;">Gérer mes préférences</a>
    </p>
  </div>
</div>`.trim();
}

function ctaButton(label: string, url: string, color = "#3b82f6"): string {
  return `
<div style="text-align: center; margin: 32px 0;">
  <a href="${url}" style="display: inline-block; background: linear-gradient(135deg, ${color} 0%, ${color}dd 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 14px ${color}4d;">
    ${label}
  </a>
</div>`;
}

// ============================================
// SEPA Pre-notification
// ============================================

export function sepaPrenotification(params: {
  tenantName: string;
  mandateReference: string;
  amount: string;
  collectionDate: string;
  maskedIban: string;
  propertyAddress: string;
}): string {
  return baseWrapper(`
    <h2 style="color: #1e293b; margin: 0 0 20px;">Avis de prélèvement SEPA</h2>
    <p style="color: #475569; font-size: 16px;">Bonjour ${params.tenantName},</p>
    <p style="color: #475569; font-size: 16px;">Conformément à votre mandat SEPA <strong>${params.mandateReference}</strong>, un prélèvement sera effectué sur votre compte bancaire :</p>
    
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 20px 0;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Montant</td>
          <td style="padding: 8px 0; text-align: right; font-weight: bold; font-size: 18px; color: #1e293b;">${params.amount} €</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Date de prélèvement</td>
          <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #1e293b;">${params.collectionDate}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Compte débité</td>
          <td style="padding: 8px 0; text-align: right; font-family: monospace; color: #1e293b;">${params.maskedIban}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Logement</td>
          <td style="padding: 8px 0; text-align: right; color: #1e293b;">${params.propertyAddress}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Réf. mandat</td>
          <td style="padding: 8px 0; text-align: right; font-family: monospace; color: #64748b; font-size: 12px;">${params.mandateReference}</td>
        </tr>
      </table>
    </div>

    <p style="font-size: 14px; color: #475569;">
      Assurez-vous que votre compte dispose des fonds nécessaires à cette date.
      En cas de question ou de contestation, vous disposez d'un droit de remboursement 
      de <strong>8 semaines</strong> après le prélèvement (mandat SEPA Core).
    </p>

    ${ctaButton("Gérer mes moyens de paiement", `${APP_URL()}/tenant/settings/payments`, "#4f46e5")}

    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
    <p style="font-size: 12px; color: #94a3b8;">
      Cet email est envoyé conformément à la réglementation SEPA (notification D-14 minimum).
      Identifiant créancier : Talok SAS.
    </p>
  `);
}

// ============================================
// Signature / CTA Email
// ============================================

export function signatureEmail(params: {
  userName: string;
  subject: string;
  message: string;
  ctaLabel: string;
  ctaUrl: string;
}): string {
  return baseWrapper(`
    <h2 style="color: #1e293b; margin: 0 0 20px; font-size: 22px; font-weight: 600;">
      ${params.subject}
    </h2>
    <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
      ${params.userName},
    </p>
    <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 32px;">
      ${params.message}
    </p>
    ${ctaButton(params.ctaLabel, `${APP_URL()}${params.ctaUrl}`)}
  `);
}

// ============================================
// Legislation Update
// ============================================

export function legislationUpdate(params: {
  userName: string;
  isOwner: boolean;
  version: string;
  description: string;
  changesHtml: string;
  leaseId: string;
}): string {
  const actionBox = params.isOwner
    ? `<div style="background: #fef3c7; padding: 16px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0; color: #92400e;">
          <strong>⚠️ Action requise :</strong> Ces modifications seront appliquées automatiquement lors du prochain renouvellement de bail. 
          Vous pouvez consulter les détails dans votre espace propriétaire.
        </p>
      </div>`
    : `<p style="color: #64748b;">
        Ces modifications seront appliquées lors du prochain renouvellement de votre bail. 
        Votre propriétaire a été informé de ces changements.
      </p>`;

  return baseWrapper(`
    <h2 style="color: #1e293b;">Bonjour ${params.userName},</h2>
    <p>Une mise à jour législative <strong>(${params.version})</strong> concerne ${
      params.isOwner ? "un de vos baux" : "votre bail de location"
    }.</p>
    
    <div style="background: #f8fafc; border-left: 4px solid #f59e0b; padding: 16px; margin: 20px 0;">
      <h3 style="margin-top: 0; color: #92400e;">Changements apportés</h3>
      <p>${params.description}</p>
      <ul style="color: #475569;">${params.changesHtml}</ul>
    </div>

    ${actionBox}
    ${ctaButton("Voir les détails du bail", `${APP_URL()}/leases/${params.leaseId}`)}

    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
    <p style="color: #94a3b8; font-size: 12px;">
      Vous recevez cet email car vous êtes ${params.isOwner ? "propriétaire" : "locataire"} d'un bien géré via notre plateforme.
    </p>
  `);
}

// ============================================
// Payment Reminder
// ============================================

export function paymentReminder(params: {
  userName: string;
  montantTotal: string;
  periode: string;
  propertyAddress: string;
  daysOverdue: number;
  reminderLevel: string;
  reminderSubject: string;
}): string {
  const levelStyles: Record<string, { color: string; bgColor: string; emoji: string }> = {
    friendly: { color: "#3b82f6", bgColor: "#eff6ff", emoji: "📅" },
    reminder: { color: "#f59e0b", bgColor: "#fffbeb", emoji: "⏰" },
    urgent: { color: "#ef4444", bgColor: "#fef2f2", emoji: "⚠️" },
    final: { color: "#dc2626", bgColor: "#fee2e2", emoji: "🚨" },
  };

  const style = levelStyles[params.reminderLevel] || levelStyles.reminder;

  const warningBox = (params.reminderLevel === "urgent" || params.reminderLevel === "final")
    ? `<div style="background: #fee2e2; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
        <p style="color: #dc2626; margin: 0; font-size: 14px;">
          <strong>⚠️ Important :</strong> Un retard prolongé peut entraîner des frais supplémentaires et affecter votre relation avec votre propriétaire.
        </p>
      </div>`
    : "";

  return baseWrapper(`
    <div style="background: ${style.bgColor}; border-left: 4px solid ${style.color}; padding: 20px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
      <h2 style="color: ${style.color}; margin: 0 0 8px; font-size: 20px;">
        ${style.emoji} ${params.reminderSubject}
      </h2>
      <p style="color: #475569; margin: 0; font-size: 14px;">
        ${params.daysOverdue} jours depuis l'émission de la facture
      </p>
    </div>
    
    <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
      ${params.userName},
    </p>
    
    <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
      Nous n'avons pas encore reçu votre paiement de loyer pour <strong>${params.propertyAddress}</strong> (${params.periode}).
    </p>
    
    <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
      <p style="color: #64748b; margin: 0 0 8px; font-size: 14px;">Montant dû</p>
      <p style="color: #1e293b; margin: 0; font-size: 32px; font-weight: 700;">${params.montantTotal}€</p>
    </div>
    
    ${warningBox}
    ${ctaButton("Payer maintenant", `${APP_URL()}/tenant/payments`, style.color)}
    
    <p style="color: #94a3b8; font-size: 14px; text-align: center;">
      Si vous avez déjà effectué le paiement, ignorez ce message.
    </p>
  `);
}

// ============================================
// Overdue Alert (Owner)
// ============================================

export function overdueAlert(params: {
  userName: string;
  tenantName: string;
  montantTotal: string;
  periode: string;
  propertyAddress: string;
  daysOverdue: number;
}): string {
  return `
<div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
  <div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 40px 30px; text-align: center;">
    <h1 style="color: #ffffff; margin: 0; font-size: 24px;">🚨 Alerte Impayé</h1>
  </div>
  <div style="padding: 40px 30px;">
    <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
      ${params.userName},
    </p>
    
    <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
      <p style="color: #dc2626; margin: 0 0 8px; font-size: 16px; font-weight: 600;">
        Impayé détecté - ${params.daysOverdue} jours de retard
      </p>
      <p style="color: #7f1d1d; margin: 0;">
        <strong>${params.tenantName}</strong> n'a pas réglé son loyer pour <strong>${params.propertyAddress}</strong> (${params.periode}).
      </p>
    </div>
    
    <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
      <p style="color: #64748b; margin: 0 0 4px; font-size: 14px;">Montant impayé</p>
      <p style="color: #dc2626; margin: 0; font-size: 28px; font-weight: 700;">${params.montantTotal}€</p>
    </div>
    
    <h3 style="color: #1e293b; margin: 24px 0 12px; font-size: 16px;">Actions recommandées :</h3>
    <ul style="color: #475569; margin: 0 0 24px; padding-left: 20px; line-height: 1.8;">
      <li>Contactez votre locataire pour comprendre la situation</li>
      <li>Vérifiez si un problème technique empêche le paiement</li>
      <li>Envisagez une relance amiable avant toute procédure</li>
    </ul>
    
    ${ctaButton("Voir les impayés", `${APP_URL()}/owner/money?filter=late`, "#dc2626")}
  </div>
  <div style="background: #f8fafc; padding: 24px 30px; border-top: 1px solid #e2e8f0;">
    <p style="color: #94a3b8; font-size: 12px; margin: 0; text-align: center;">
      Des relances automatiques sont envoyées à votre locataire.
    </p>
  </div>
</div>`;
}

// ============================================
// Visit Booking
// ============================================

export function visitBookingRequest(params: {
  recipientName: string;
  tenantName: string;
  propertyAddress: string;
  visitDate: string;
  visitTime: string;
  tenantMessage?: string;
}): string {
  const msgBox = params.tenantMessage
    ? `<div style="background: #f1f5f9; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
        <p style="color: #64748b; margin: 0 0 8px; font-size: 12px; text-transform: uppercase;">Message du candidat</p>
        <p style="color: #475569; margin: 0; font-size: 14px; font-style: italic;">"${params.tenantMessage}"</p>
      </div>`
    : "";

  return baseWrapper(`
    <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">${params.recipientName},</p>
    
    <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 20px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
      <p style="color: #1e40af; margin: 0 0 8px; font-size: 16px; font-weight: 600;">${params.tenantName} souhaite visiter votre bien</p>
      <p style="color: #3b82f6; margin: 0;">${params.propertyAddress}</p>
    </div>

    <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
      <p style="color: #64748b; margin: 0 0 4px; font-size: 14px;">📅 Date : <strong style="color: #1e293b;">${params.visitDate}</strong></p>
      <p style="color: #64748b; margin: 8px 0 0; font-size: 14px;">🕐 Horaire : <strong style="color: #1e293b;">${params.visitTime}</strong></p>
    </div>

    ${msgBox}
    ${ctaButton("Voir les détails", `${APP_URL()}/owner/visits`, "#22c55e")}
    
    <p style="color: #94a3b8; font-size: 12px; text-align: center;">Répondez rapidement pour ne pas perdre ce candidat potentiel !</p>
  `);
}

export function visitBookingConfirmed(params: {
  recipientName: string;
  propertyAddress: string;
  visitDate: string;
  visitTime: string;
  ownerName: string;
  ownerPhone?: string;
  bookingId: string;
}): string {
  const phoneHtml = params.ownerPhone
    ? `<p style="color: #3b82f6; margin: 8px 0 0; font-size: 14px;">📞 ${params.ownerPhone}</p>`
    : "";

  return `
<div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
  <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 40px 30px; text-align: center;">
    <h1 style="color: #ffffff; margin: 0; font-size: 24px;">✅ Visite confirmée !</h1>
  </div>
  <div style="padding: 40px 30px;">
    <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">${params.recipientName},</p>
    <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">Bonne nouvelle ! Votre demande de visite a été acceptée.</p>
    
    <div style="background: #f0fdf4; border: 2px solid #22c55e; padding: 24px; border-radius: 12px; margin-bottom: 24px;">
      <h3 style="color: #166534; margin: 0 0 16px; font-size: 18px;">📍 ${params.propertyAddress}</h3>
      <p style="color: #64748b; margin: 0 0 4px; font-size: 14px;">📅 Date : <strong style="color: #1e293b;">${params.visitDate}</strong></p>
      <p style="color: #64748b; margin: 8px 0 0; font-size: 14px;">🕐 Horaire : <strong style="color: #1e293b;">${params.visitTime}</strong></p>
    </div>

    <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
      <p style="color: #64748b; margin: 0 0 8px; font-size: 14px;">Contact propriétaire</p>
      <p style="color: #1e293b; margin: 0; font-size: 16px; font-weight: 600;">${params.ownerName}</p>
      ${phoneHtml}
    </div>

    ${ctaButton("Voir ma visite", `${APP_URL()}/tenant/visits/${params.bookingId}`)}
    
    <div style="background: #fef3c7; padding: 16px; border-radius: 8px; margin-top: 24px;">
      <p style="color: #92400e; margin: 0; font-size: 14px;">
        💡 <strong>Conseil :</strong> Préparez vos questions sur le logement et n'oubliez pas d'arriver à l'heure !
      </p>
    </div>
  </div>
</div>`;
}

export function visitBookingCancelled(params: {
  recipientName: string;
  propertyAddress: string;
  visitDate: string;
  visitTime: string;
  cancellationReason?: string;
}): string {
  const reasonBox = params.cancellationReason
    ? `<div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
        <p style="color: #64748b; margin: 0 0 8px; font-size: 12px; text-transform: uppercase;">Raison</p>
        <p style="color: #475569; margin: 0; font-size: 14px;">${params.cancellationReason}</p>
      </div>`
    : "";

  return `
<div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
  <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 40px 30px; text-align: center;">
    <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Visite annulée</h1>
  </div>
  <div style="padding: 40px 30px;">
    <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">${params.recipientName},</p>
    <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">Nous sommes désolés, la visite prévue a été annulée par le propriétaire.</p>

    <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 20px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
      <p style="color: #991b1b; margin: 0 0 8px; font-size: 16px; font-weight: 600;">${params.propertyAddress}</p>
      <p style="color: #dc2626; margin: 0;">${params.visitDate} à ${params.visitTime}</p>
    </div>

    ${reasonBox}
    <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">Ne vous découragez pas ! Continuez à chercher le logement idéal.</p>
    ${ctaButton("Rechercher d'autres logements", `${APP_URL()}/search`)}
  </div>
</div>`;
}

// ============================================
// Initial Invoice (after lease fully signed)
// ============================================

export function initialInvoiceEmail(params: {
  tenantName: string;
  amount: string;
  rentAmount: string;
  chargesAmount: string;
  depositAmount: string;
  includesDeposit: boolean;
  propertyAddress: string;
  dueDate: string;
  leaseId: string;
}): string {
  const depositRow = params.includesDeposit
    ? `<tr>
        <td style="padding: 8px 0; color: #64748b; font-size: 14px; border-bottom: 1px solid #e2e8f0;">Dépôt de garantie</td>
        <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #1e293b; border-bottom: 1px solid #e2e8f0;">${params.depositAmount} €</td>
      </tr>`
    : "";

  return baseWrapper(`
    <h2 style="color: #1e293b; margin: 0 0 20px; font-size: 22px; font-weight: 600;">
      Votre facture initiale est prête
    </h2>
    <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
      ${params.tenantName},
    </p>
    <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
      Le bail pour <strong>${params.propertyAddress}</strong> est signé par toutes les parties.
      Votre premier versement est maintenant attendu pour finaliser votre entrée dans le logement.
    </p>

    <div style="background: #f0fdf4; border: 2px solid #22c55e; padding: 24px; border-radius: 12px; margin-bottom: 24px; text-align: center;">
      <p style="color: #166534; margin: 0 0 8px; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Montant total à régler</p>
      <p style="color: #166534; margin: 0; font-size: 36px; font-weight: 700;">${params.amount} €</p>
      <p style="color: #166534; margin: 8px 0 0; font-size: 14px;">Échéance : ${params.dueDate}</p>
    </div>

    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 0 0 24px;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 14px; border-bottom: 1px solid #e2e8f0;">Loyer${params.rentAmount !== params.amount ? " (prorata)" : ""}</td>
          <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #1e293b; border-bottom: 1px solid #e2e8f0;">${params.rentAmount} €</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 14px; border-bottom: 1px solid #e2e8f0;">Charges</td>
          <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #1e293b; border-bottom: 1px solid #e2e8f0;">${params.chargesAmount} €</td>
        </tr>
        ${depositRow}
        <tr>
          <td style="padding: 10px 0; color: #1e293b; font-size: 15px; font-weight: 700;">Total</td>
          <td style="padding: 10px 0; text-align: right; font-weight: 700; color: #1e293b; font-size: 15px;">${params.amount} €</td>
        </tr>
      </table>
    </div>

    ${ctaButton("Payer ma facture", `${APP_URL()}/tenant/payments`, "#22c55e")}

    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
    <p style="font-size: 14px; color: #94a3b8; text-align: center;">
      Ce montant couvre votre premier versement${params.includesDeposit ? " ainsi que le dépôt de garantie" : ""}.
      Vous pouvez payer par carte bancaire ou prélèvement SEPA depuis votre espace locataire.
    </p>
  `);
}

export function visitFeedbackRequest(params: {
  recipientName: string;
  propertyAddress: string;
  visitDate: string;
  bookingId: string;
}): string {
  return `
<div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
  <div style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); padding: 40px 30px; text-align: center;">
    <h1 style="color: #ffffff; margin: 0; font-size: 24px;">⭐ Comment s'est passée la visite ?</h1>
  </div>
  <div style="padding: 40px 30px;">
    <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">${params.recipientName},</p>
    <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
      Vous avez visité <strong>${params.propertyAddress}</strong> le ${params.visitDate}. Votre avis nous intéresse !
    </p>

    <div style="background: #f5f3ff; padding: 24px; border-radius: 12px; margin-bottom: 24px; text-align: center;">
      <p style="color: #6b21a8; margin: 0 0 16px; font-size: 16px;">Partagez votre expérience en 1 minute</p>
      <div style="font-size: 32px;">⭐⭐⭐⭐⭐</div>
    </div>

    ${ctaButton("Donner mon avis", `${APP_URL()}/tenant/visits/${params.bookingId}/feedback`, "#8b5cf6")}
    <p style="color: #94a3b8; font-size: 14px; text-align: center;">Votre feedback aide les autres locataires à trouver leur logement idéal.</p>
  </div>
</div>`;
}

// ============================================
// Tenant Self-Service — parcours locataire → prestataire
// ============================================

function bookingSummaryBox(params: {
  reference: string | null;
  title: string;
  category: string | null;
  providerCompany: string | null;
  preferredDate: string | null;
}): string {
  const rows: string[] = [];
  if (params.reference) {
    rows.push(
      `<tr><td style="padding: 6px 0; color: #64748b; font-size: 14px;">Référence</td><td style="padding: 6px 0; text-align: right; font-family: monospace; color: #1e293b;">${params.reference}</td></tr>`
    );
  }
  rows.push(
    `<tr><td style="padding: 6px 0; color: #64748b; font-size: 14px;">Objet</td><td style="padding: 6px 0; text-align: right; color: #1e293b;">${params.title}</td></tr>`
  );
  if (params.category) {
    rows.push(
      `<tr><td style="padding: 6px 0; color: #64748b; font-size: 14px;">Catégorie</td><td style="padding: 6px 0; text-align: right; color: #1e293b; text-transform: capitalize;">${params.category}</td></tr>`
    );
  }
  if (params.providerCompany) {
    rows.push(
      `<tr><td style="padding: 6px 0; color: #64748b; font-size: 14px;">Prestataire</td><td style="padding: 6px 0; text-align: right; color: #1e293b;">${params.providerCompany}</td></tr>`
    );
  }
  if (params.preferredDate) {
    rows.push(
      `<tr><td style="padding: 6px 0; color: #64748b; font-size: 14px;">Date souhaitée</td><td style="padding: 6px 0; text-align: right; color: #1e293b;">${params.preferredDate}</td></tr>`
    );
  }
  return `
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 20px 0;">
      <table style="width: 100%; border-collapse: collapse;">
        ${rows.join("\n")}
      </table>
    </div>
  `;
}

/** Email au propriétaire : son locataire vient de réserver un prestataire. */
export function tenantServiceBooked(params: {
  ownerName: string;
  tenantName: string;
  reference: string | null;
  title: string;
  category: string | null;
  providerCompany: string | null;
  preferredDate: string | null;
  ticketId: string;
}): string {
  return baseWrapper(`
    <h2 style="color: #1e293b; margin: 0 0 20px; font-size: 22px; font-weight: 600;">
      Nouvelle réservation de service
    </h2>
    <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
      Bonjour ${params.ownerName},
    </p>
    <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
      ${params.tenantName} vient de réserver un prestataire via son espace Talok.
      Vous êtes notifié à titre informatif — aucune action n'est requise.
    </p>
    ${bookingSummaryBox({
      reference: params.reference,
      title: params.title,
      category: params.category,
      providerCompany: params.providerCompany,
      preferredDate: params.preferredDate,
    })}
    ${ctaButton("Voir le ticket", `${APP_URL()}/owner/tickets/${params.ticketId}`)}
  `);
}

/** Email au propriétaire : validation requise pour une réservation locataire. */
export function tenantServiceApprovalRequested(params: {
  ownerName: string;
  tenantName: string;
  reference: string | null;
  title: string;
  category: string | null;
  providerCompany: string | null;
  preferredDate: string | null;
}): string {
  return baseWrapper(`
    <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 8px; margin: 0 0 24px;">
      <p style="margin: 0; color: #92400e; font-weight: 600; font-size: 15px;">
        ⏳ Action requise : votre locataire attend votre validation
      </p>
    </div>
    <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
      Bonjour ${params.ownerName},
    </p>
    <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
      ${params.tenantName} souhaite réserver un prestataire. Le prestataire ne
      sera notifié qu'une fois votre validation confirmée.
    </p>
    ${bookingSummaryBox({
      reference: params.reference,
      title: params.title,
      category: params.category,
      providerCompany: params.providerCompany,
      preferredDate: params.preferredDate,
    })}
    ${ctaButton("Valider ou refuser", `${APP_URL()}/owner/approvals`, "#f59e0b")}
  `);
}

/** Email au locataire : le propriétaire a refusé sa réservation. */
export function tenantServiceRejected(params: {
  tenantName: string;
  reference: string | null;
  title: string;
  reason: string | null;
}): string {
  const reasonBlock = params.reason
    ? `<div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0 0 8px; color: #991b1b; font-weight: 600;">Raison indiquée</p>
        <p style="margin: 0; color: #7f1d1d; font-style: italic;">« ${params.reason} »</p>
      </div>`
    : "";

  return baseWrapper(`
    <h2 style="color: #1e293b; margin: 0 0 20px; font-size: 22px; font-weight: 600;">
      Votre réservation a été refusée
    </h2>
    <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
      Bonjour ${params.tenantName},
    </p>
    <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
      Votre propriétaire n'a pas validé la réservation ${params.reference ? `<strong>${params.reference}</strong> ` : ""}concernant&nbsp;: <strong>${params.title}</strong>.
    </p>
    ${reasonBlock}
    <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
      Vous pouvez échanger avec votre propriétaire depuis votre espace, ou
      créer une demande classique qu'il prendra en charge lui-même.
    </p>
    ${ctaButton("Retourner à mes demandes", `${APP_URL()}/tenant/requests`, "#64748b")}
  `);
}

/** Email au prestataire : nouvelle mission assignée. */
export function workOrderAssignedToProvider(params: {
  providerName: string;
  reference: string | null;
  title: string;
  category: string | null;
  preferredDate: string | null;
  workOrderId: string;
}): string {
  return baseWrapper(`
    <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 16px; border-radius: 8px; margin: 0 0 24px;">
      <p style="margin: 0; color: #065f46; font-weight: 600; font-size: 15px;">
        🛠️ Nouvelle mission assignée
      </p>
    </div>
    <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
      Bonjour ${params.providerName},
    </p>
    <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
      Une nouvelle intervention vous a été confiée via Talok. Connectez-vous
      pour accepter la mission et proposer un devis.
    </p>
    ${bookingSummaryBox({
      reference: params.reference,
      title: params.title,
      category: params.category,
      providerCompany: null,
      preferredDate: params.preferredDate,
    })}
    ${ctaButton("Voir la mission", `${APP_URL()}/provider/tickets`, "#10b981")}
  `);
}

/** Email au syndic : signalement parties communes. */
export function ticketPartiesCommunesToSyndic(params: {
  syndicName: string;
  reference: string | null;
  title: string;
  priority: string | null;
  ticketId: string;
}): string {
  const priorityLabel =
    params.priority === "urgent" || params.priority === "urgente"
      ? `<span style="display: inline-block; padding: 2px 10px; background: #fee2e2; color: #991b1b; border-radius: 999px; font-size: 12px; font-weight: 600; margin-left: 8px;">URGENT</span>`
      : "";

  return baseWrapper(`
    <h2 style="color: #1e293b; margin: 0 0 20px; font-size: 22px; font-weight: 600;">
      Signalement parties communes ${priorityLabel}
    </h2>
    <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
      Bonjour ${params.syndicName},
    </p>
    <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
      Un locataire d'une propriété que vous syndiquez vient d'ouvrir un
      signalement sur les parties communes.
    </p>
    ${bookingSummaryBox({
      reference: params.reference,
      title: params.title,
      category: "Parties communes",
      providerCompany: null,
      preferredDate: null,
    })}
    ${ctaButton("Traiter le signalement", `${APP_URL()}/copro/tickets`, "#6366f1")}
  `);
}

/**
 * Email au prestataire : paiement reçu sur le compte Stripe Connect.
 * Déclenché depuis le webhook Stripe lorsque le PaymentIntent réussit,
 * donc les fonds sont déjà transférés au moment où cet email part.
 */
export function workOrderPaymentReceived(params: {
  providerName: string;
  amountEuros: string;
  paymentType: "deposit" | "balance" | "full";
  workOrderId: string;
  ticketReference: string | null;
}): string {
  const typeLabel =
    params.paymentType === "deposit"
      ? "l'acompte"
      : params.paymentType === "balance"
        ? "le solde"
        : "le paiement";

  const refLine = params.ticketReference
    ? `<p style="margin: 0 0 8px; color: #64748b; font-size: 13px;">Référence&nbsp;: <span style="font-family: monospace; color: #1e293b;">${params.ticketReference}</span></p>`
    : "";

  return baseWrapper(`
    <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 16px; border-radius: 8px; margin: 0 0 24px;">
      <p style="margin: 0; color: #065f46; font-weight: 600; font-size: 15px;">
        💶 Paiement reçu
      </p>
    </div>
    <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
      Bonjour ${params.providerName},
    </p>
    <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
      ${typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1)} de votre
      intervention a été versé sur votre compte.
    </p>

    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center;">
      ${refLine}
      <p style="margin: 0; color: #1e293b; font-size: 32px; font-weight: 700;">
        ${params.amountEuros}&nbsp;€
      </p>
    </div>

    <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
      Les fonds sont disponibles sur votre compte Stripe. Le détail de la
      commission plateforme est visible dans votre espace.
    </p>

    ${ctaButton("Voir l'intervention", `${APP_URL()}/provider/tickets`, "#10b981")}
  `);
}

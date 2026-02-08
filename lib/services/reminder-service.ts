/**
 * Service de relances automatiques
 * 
 * Gère les relances pour :
 * - Loyers impayés (J+5, J+15, J+30)
 * - Documents manquants
 * - Signatures en attente
 * - Renouvellement d'assurance
 */

import { createClient } from "@/lib/supabase/server";

// Types
export type ReminderType = 
  | "unpaid_rent_1"   // Première relance J+5
  | "unpaid_rent_2"   // Deuxième relance J+15
  | "unpaid_rent_3"   // Mise en demeure J+30
  | "document_missing"
  | "signature_pending"
  | "insurance_renewal"
  | "lease_renewal"
  | "rent_revision";

export type ReminderStatus = "pending" | "sent" | "failed" | "cancelled";
export type ReminderChannel = "email" | "sms" | "in_app";

export interface Reminder {
  id: string;
  type: ReminderType;
  status: ReminderStatus;
  channel: ReminderChannel;
  recipientId: string;
  recipientEmail?: string;
  recipientPhone?: string;
  subject: string;
  content: string;
  scheduledAt: string;
  sentAt?: string;
  metadata?: Record<string, any>;
}

export interface ReminderTemplate {
  type: ReminderType;
  subject: string;
  content: string;
  channels: ReminderChannel[];
  delayDays: number;
}

// Templates de relances
const REMINDER_TEMPLATES: Record<ReminderType, ReminderTemplate> = {
  unpaid_rent_1: {
    type: "unpaid_rent_1",
    subject: "Rappel : Loyer du mois de {{period}} en attente",
    content: `Bonjour {{tenant_name}},

Nous n'avons pas encore reçu le paiement de votre loyer pour le mois de {{period}}.

Montant dû : {{amount}} €
Échéance : {{due_date}}

Merci de bien vouloir régulariser votre situation dans les meilleurs délais.

Si vous avez déjà effectué le paiement, veuillez ignorer ce message.

Cordialement,
{{owner_name}}`,
    channels: ["email", "in_app"],
    delayDays: 5,
  },
  
  unpaid_rent_2: {
    type: "unpaid_rent_2",
    subject: "Second rappel : Loyer impayé - {{period}}",
    content: `Bonjour {{tenant_name}},

Malgré notre précédent rappel, nous n'avons toujours pas reçu le paiement de votre loyer.

Montant dû : {{amount}} €
Retard : {{days_late}} jours

Nous vous prions de bien vouloir régulariser cette situation sous 48 heures.

En cas de difficultés de paiement, n'hésitez pas à nous contacter pour trouver une solution.

Cordialement,
{{owner_name}}`,
    channels: ["email", "sms", "in_app"],
    delayDays: 15,
  },
  
  unpaid_rent_3: {
    type: "unpaid_rent_3",
    subject: "MISE EN DEMEURE - Loyer impayé {{period}}",
    content: `Madame, Monsieur {{tenant_name}},

Par la présente, nous vous mettons en demeure de régler sous 8 jours la somme de {{amount}} € correspondant au loyer et charges du mois de {{period}}.

À défaut de paiement dans ce délai, nous nous verrons dans l'obligation d'engager une procédure de recouvrement et de résiliation du bail, conformément à la clause résolutoire prévue au contrat.

Cette mise en demeure constitue le point de départ des intérêts de retard légaux.

Veuillez agréer l'expression de nos salutations distinguées.

{{owner_name}}`,
    channels: ["email"],
    delayDays: 30,
  },
  
  document_missing: {
    type: "document_missing",
    subject: "Document manquant pour votre dossier",
    content: `Bonjour {{tenant_name}},

Pour compléter votre dossier locatif, nous avons besoin du document suivant :

- {{document_type}}

Merci de nous le transmettre dans les meilleurs délais via votre espace locataire.

Cordialement,
{{owner_name}}`,
    channels: ["email", "in_app"],
    delayDays: 3,
  },
  
  signature_pending: {
    type: "signature_pending",
    subject: "Document en attente de signature",
    content: `Bonjour {{tenant_name}},

Un document nécessite votre signature :

{{document_name}}

Veuillez vous connecter à votre espace pour le signer électroniquement.

Ce document expire le {{expiry_date}}.

Cordialement,
{{owner_name}}`,
    channels: ["email", "in_app"],
    delayDays: 2,
  },
  
  insurance_renewal: {
    type: "insurance_renewal",
    subject: "Rappel : Renouvellement de votre assurance habitation",
    content: `Bonjour {{tenant_name}},

Votre attestation d'assurance habitation arrive à expiration le {{expiry_date}}.

Conformément à votre contrat de bail, vous devez nous transmettre une nouvelle attestation avant cette date.

Merci de téléverser ce document dans votre espace locataire.

Cordialement,
{{owner_name}}`,
    channels: ["email", "in_app"],
    delayDays: 30,
  },
  
  lease_renewal: {
    type: "lease_renewal",
    subject: "Votre bail arrive à échéance",
    content: `Bonjour {{tenant_name}},

Votre contrat de location arrive à son terme le {{end_date}}.

Options disponibles :
- Renouvellement du bail
- Non-renouvellement (préavis requis)

Merci de nous faire part de vos intentions.

Cordialement,
{{owner_name}}`,
    channels: ["email", "in_app"],
    delayDays: 90,
  },
  
  rent_revision: {
    type: "rent_revision",
    subject: "Information : Révision annuelle du loyer",
    content: `Bonjour {{tenant_name}},

Conformément à votre contrat de bail, le loyer sera révisé à compter du {{revision_date}}.

Ancien loyer : {{old_rent}} €
Nouveau loyer : {{new_rent}} €
Indice de référence : {{index_type}} ({{index_value}})

Ce nouveau montant sera appliqué à partir de la prochaine échéance.

Cordialement,
{{owner_name}}`,
    channels: ["email", "in_app"],
    delayDays: 30,
  },
};

/**
 * Remplace les variables dans un template
 */
function interpolateTemplate(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{${key}}}`, "g"), value);
  }
  return result;
}

/**
 * Crée une relance
 */
export async function createReminder(
  type: ReminderType,
  recipientId: string,
  variables: Record<string, string>,
  options?: {
    channel?: ReminderChannel;
    scheduledAt?: Date;
    metadata?: Record<string, any>;
  }
): Promise<Reminder | null> {
  const supabase = await createClient();
  const template = REMINDER_TEMPLATES[type];
  
  if (!template) {
    console.error(`Template non trouvé pour le type: ${type}`);
    return null;
  }
  
  // Récupérer les infos du destinataire
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, prenom, nom, telephone, user_id")
    .eq("id", recipientId)
    .single();
  
  if (!profile) {
    console.error(`Profil non trouvé: ${recipientId}`);
    return null;
  }
  
  // Récupérer l'email depuis auth.users
  const { data: authUser } = await supabase.auth.admin.getUserById(profile.user_id);
  const email = authUser?.user?.email;
  
  const channel = options?.channel || template.channels[0];
  const scheduledAt = options?.scheduledAt || new Date();
  
  const reminder: Omit<Reminder, "id"> = {
    type,
    status: "pending",
    channel,
    recipientId,
    recipientEmail: email,
    recipientPhone: profile.telephone ?? undefined,
    subject: interpolateTemplate(template.subject, variables),
    content: interpolateTemplate(template.content, variables),
    scheduledAt: scheduledAt.toISOString(),
    metadata: options?.metadata,
  };
  
  // Sauvegarder en base (si la table existe)
  // Pour l'instant, on retourne juste l'objet
  return {
    id: `reminder-${Date.now()}`,
    ...reminder,
  };
}

/**
 * Envoie une relance par email
 */
async function sendEmailReminder(reminder: Reminder): Promise<boolean> {
  // TODO: Intégrer avec un service d'email (Resend, SendGrid, etc.)
  console.log(`[Email] Envoi à ${reminder.recipientEmail}:`, reminder.subject);
  
  // Simulation d'envoi
  return true;
}

/**
 * Envoie une relance par SMS
 */
async function sendSmsReminder(reminder: Reminder): Promise<boolean> {
  // TODO: Intégrer avec un service SMS (Twilio, etc.)
  if (!reminder.recipientPhone) {
    console.warn("Pas de numéro de téléphone pour le SMS");
    return false;
  }
  
  console.log(`[SMS] Envoi à ${reminder.recipientPhone}:`, reminder.subject);
  return true;
}

/**
 * Envoie une notification in-app
 */
async function sendInAppReminder(reminder: Reminder): Promise<boolean> {
  const supabase = await createClient();
  
  // Créer une notification in-app
  const { error } = await supabase.from("notifications").insert({
    profile_id: reminder.recipientId,
    type: reminder.type,
    title: reminder.subject,
    message: reminder.content.slice(0, 200) + "...",
    read: false,
    metadata: reminder.metadata,
  });
  
  if (error) {
    console.error("Erreur création notification:", error);
    return false;
  }
  
  return true;
}

/**
 * Envoie une relance selon le canal configuré
 */
export async function sendReminder(reminder: Reminder): Promise<boolean> {
  let success = false;
  
  switch (reminder.channel) {
    case "email":
      success = await sendEmailReminder(reminder);
      break;
    case "sms":
      success = await sendSmsReminder(reminder);
      break;
    case "in_app":
      success = await sendInAppReminder(reminder);
      break;
  }
  
  // Mettre à jour le statut
  reminder.status = success ? "sent" : "failed";
  reminder.sentAt = success ? new Date().toISOString() : undefined;
  
  return success;
}

/**
 * Génère les relances pour les loyers impayés
 */
export async function generateUnpaidRentReminders(ownerId: string): Promise<Reminder[]> {
  const supabase = await createClient();
  const reminders: Reminder[] = [];
  const now = new Date();
  
  // Récupérer les factures impayées
  const { data: invoices } = await supabase
    .from("invoices")
    .select(`
      id,
      periode,
      montant_total,
      created_at,
      tenant_id,
      tenant:profiles!tenant_id (
        id,
        prenom,
        nom
      )
    `)
    .eq("owner_id", ownerId)
    .in("statut", ["sent", "late"]);
  
  if (!invoices) return reminders;
  
  // Récupérer le profil propriétaire
  const { data: ownerProfile } = await supabase
    .from("profiles")
    .select("prenom, nom")
    .eq("id", ownerId)
    .single();
  
  const ownerName = ownerProfile 
    ? `${ownerProfile.prenom} ${ownerProfile.nom}` 
    : "Le propriétaire";
  
  for (const invoice of invoices) {
    const createdAt = new Date(invoice.created_at);
    const daysLate = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
    const tenant = invoice.tenant as any;
    const tenantName = tenant ? `${tenant.prenom} ${tenant.nom}` : "Locataire";
    
    const variables = {
      tenant_name: tenantName,
      owner_name: ownerName,
      period: formatPeriod(invoice.periode),
      amount: invoice.montant_total.toString(),
      due_date: createdAt.toLocaleDateString("fr-FR"),
      days_late: daysLate.toString(),
    };
    
    let reminderType: ReminderType | null = null;
    
    if (daysLate >= 30) {
      reminderType = "unpaid_rent_3";
    } else if (daysLate >= 15) {
      reminderType = "unpaid_rent_2";
    } else if (daysLate >= 5) {
      reminderType = "unpaid_rent_1";
    }
    
    if (reminderType && tenant?.id) {
      const reminder = await createReminder(reminderType, tenant.id, variables, {
        metadata: { invoiceId: invoice.id, daysLate },
      });
      
      if (reminder) {
        reminders.push(reminder);
      }
    }
  }
  
  return reminders;
}

/**
 * Formate une période (2025-01) en texte
 */
function formatPeriod(period: string): string {
  const [year, month] = period.split("-");
  const monthNames = [
    "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre"
  ];
  return `${monthNames[parseInt(month) - 1]} ${year}`;
}

/**
 * Planifie les relances automatiques pour un propriétaire
 */
export async function scheduleAutomaticReminders(ownerId: string): Promise<{
  scheduled: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let scheduled = 0;
  
  try {
    // Relances loyers impayés
    const unpaidReminders = await generateUnpaidRentReminders(ownerId);
    scheduled += unpaidReminders.length;
    
    // Envoyer les relances
    for (const reminder of unpaidReminders) {
      const success = await sendReminder(reminder);
      if (!success) {
        errors.push(`Échec envoi relance ${reminder.type} à ${reminder.recipientId}`);
      }
    }
  } catch (error) {
    errors.push(`Erreur génération relances: ${error}`);
  }
  
  return { scheduled, errors };
}

export default {
  createReminder,
  sendReminder,
  generateUnpaidRentReminders,
  scheduleAutomaticReminders,
  REMINDER_TEMPLATES,
};


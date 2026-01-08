/**
 * Service de notifications Push, SMS et Email
 */

// ============================================
// TYPES
// ============================================

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  data?: Record<string, any>;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  tag?: string;
  requireInteraction?: boolean;
}

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface SMSPayload {
  to: string;
  body: string;
  from?: string;
}

export interface NotificationOptions {
  channels?: Array<"email" | "push" | "sms" | "in_app">;
  priority?: "low" | "normal" | "high" | "urgent";
  scheduledFor?: Date;
  actionUrl?: string;
}

// ============================================
// PUSH NOTIFICATIONS (Web Push)
// ============================================

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

/**
 * Envoyer une notification push
 */
export async function sendPushNotification(
  subscription: PushSubscription,
  payload: NotificationPayload
): Promise<{ success: boolean; error?: string }> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn("VAPID keys non configurées");
    return { success: false, error: "VAPID keys non configurées" };
  }

  try {
    // Utiliser la bibliothèque web-push
    const webPush = await import("web-push");

    webPush.setVapidDetails(
      "mailto:support@talok.fr",
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY
    );

    await webPush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: subscription.keys,
      },
      JSON.stringify(payload)
    );

    return { success: true };
  } catch (error: any) {
    console.error("Erreur envoi push:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Envoyer une notification push à plusieurs abonnés
 */
export async function sendPushToMultiple(
  subscriptions: PushSubscription[],
  payload: NotificationPayload
): Promise<{ sent: number; failed: number; errors: string[] }> {
  const results = await Promise.allSettled(
    subscriptions.map((sub) => sendPushNotification(sub, payload))
  );

  const errors: string[] = [];
  let sent = 0;
  let failed = 0;

  results.forEach((result, index) => {
    if (result.status === "fulfilled" && result.value.success) {
      sent++;
    } else {
      failed++;
      const error =
        result.status === "rejected"
          ? result.reason.message
          : result.value.error;
      if (error) errors.push(`Sub ${index}: ${error}`);
    }
  });

  return { sent, failed, errors };
}

// ============================================
// SMS (Twilio)
// ============================================

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

/**
 * Envoyer un SMS via Twilio
 */
export async function sendSMS(
  payload: SMSPayload
): Promise<{ success: boolean; sid?: string; error?: string }> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    console.warn("Twilio non configuré");
    return { success: false, error: "Twilio non configuré" };
  }

  const from = payload.from || TWILIO_PHONE_NUMBER;

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization:
            "Basic " +
            Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString(
              "base64"
            ),
        },
        body: new URLSearchParams({
          To: payload.to,
          From: from,
          Body: payload.body,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.message || "Erreur Twilio" };
    }

    return { success: true, sid: data.sid };
  } catch (error: any) {
    console.error("Erreur envoi SMS:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Formater un numéro de téléphone français pour Twilio
 */
export function formatPhoneNumber(phone: string): string {
  // Supprimer tous les caractères non numériques
  const cleaned = phone.replace(/\D/g, "");

  // Si commence par 0, remplacer par +33
  if (cleaned.startsWith("0")) {
    return "+33" + cleaned.slice(1);
  }

  // Si ne commence pas par +, ajouter +
  if (!phone.startsWith("+")) {
    return "+" + cleaned;
  }

  return "+" + cleaned;
}

// ============================================
// SERVICE UNIFIÉ
// ============================================

/**
 * Envoyer une notification via tous les canaux appropriés
 */
export async function notifyUser(
  profileId: string,
  type: string,
  title: string,
  body: string,
  options: NotificationOptions = {}
): Promise<{
  email?: string;
  push?: { sent: number; failed: number };
  sms?: { success: boolean; sid?: string };
  inApp?: string;
}> {
  const channels = options.channels || ["email", "push", "in_app"];
  const results: any = {};

  // Récupérer les infos de l'utilisateur et ses préférences
  // (À implémenter avec Supabase)

  if (channels.includes("push")) {
    // Récupérer les subscriptions push de l'utilisateur
    // et envoyer les notifications
    results.push = { sent: 0, failed: 0 };
  }

  if (channels.includes("sms")) {
    // Récupérer le numéro de téléphone et envoyer le SMS
    results.sms = { success: false };
  }

  return results;
}

// ============================================
// TEMPLATES DE NOTIFICATIONS
// ============================================

export const NOTIFICATION_TEMPLATES = {
  // Paiements
  payment_reminder: {
    title: "Rappel de paiement",
    body: (props: { amount: string; dueDate: string }) =>
      `Votre loyer de ${props.amount} est dû le ${props.dueDate}. N'oubliez pas de régler.`,
  },
  payment_received: {
    title: "Paiement reçu",
    body: (props: { amount: string }) =>
      `Votre paiement de ${props.amount} a bien été reçu. Merci !`,
  },
  payment_late: {
    title: "Loyer en retard",
    body: (props: { amount: string; daysLate: number }) =>
      `Votre loyer de ${props.amount} est en retard de ${props.daysLate} jour(s). Merci de régulariser rapidement.`,
  },

  // Tickets
  ticket_created: {
    title: "Nouveau ticket créé",
    body: (props: { ticketTitle: string; property: string }) =>
      `Un nouveau ticket "${props.ticketTitle}" a été créé pour ${props.property}.`,
  },
  ticket_updated: {
    title: "Ticket mis à jour",
    body: (props: { ticketTitle: string; newStatus: string }) =>
      `Le ticket "${props.ticketTitle}" est passé en statut : ${props.newStatus}.`,
  },

  // Documents
  document_available: {
    title: "Nouveau document disponible",
    body: (props: { documentType: string }) =>
      `Un nouveau document (${props.documentType}) est disponible dans votre espace.`,
  },

  // Bail
  lease_expiring: {
    title: "Bail bientôt expiré",
    body: (props: { property: string; daysLeft: number }) =>
      `Le bail pour ${props.property} expire dans ${props.daysLeft} jours.`,
  },
  lease_signed: {
    title: "Bail signé",
    body: (props: { property: string }) =>
      `Le bail pour ${props.property} a été signé par toutes les parties.`,
  },

  // EDL
  edl_scheduled: {
    title: "État des lieux programmé",
    body: (props: { date: string; property: string; type: string }) =>
      `L'état des lieux ${props.type} pour ${props.property} est prévu le ${props.date}.`,
  },

  // Interventions
  intervention_scheduled: {
    title: "Intervention programmée",
    body: (props: { date: string; provider: string; description: string }) =>
      `Une intervention est prévue le ${props.date} avec ${props.provider} : ${props.description}.`,
  },
};

/**
 * Générer le contenu d'une notification à partir d'un template
 */
export function generateNotificationContent<K extends keyof typeof NOTIFICATION_TEMPLATES>(
  templateKey: K,
  props: Parameters<(typeof NOTIFICATION_TEMPLATES)[K]["body"]>[0]
): { title: string; body: string } {
  const template = NOTIFICATION_TEMPLATES[templateKey];
  return {
    title: template.title,
    body: (template.body as Function)(props),
  };
}

// ============================================
// EXPORT
// ============================================

export const notificationService = {
  sendPushNotification,
  sendPushToMultiple,
  sendSMS,
  formatPhoneNumber,
  notifyUser,
  generateNotificationContent,
};








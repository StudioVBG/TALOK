/**
 * Service de notifications
 * 
 * Gère les notifications :
 * - In-app (base de données)
 * - Push (Web Push API)
 * - Email (via service externe)
 */

import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/emails/resend.service";

// Types
export type NotificationType =
  | "payment_received"
  | "payment_due"
  | "payment_late"
  | "lease_signed"
  | "lease_ending"
  | "document_uploaded"
  | "document_signed"
  | "ticket_created"
  | "ticket_updated"
  | "ticket_resolved"
  | "message_received"
  | "maintenance_scheduled"
  | "rent_revision"
  | "edl_ready_to_sign"
  | "edl_signed_by_counterparty"
  | "edl_fully_signed"
  | "system"
  | "custom";

export type NotificationPriority = "low" | "normal" | "high" | "urgent";
export type NotificationChannel = "in_app" | "push" | "email" | "sms";

export interface Notification {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  recipientId: string;
  channels: NotificationChannel[];
  read: boolean;
  actionUrl?: string;
  actionLabel?: string;
  imageUrl?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  readAt?: string;
  expiresAt?: string;
}

export interface CreateNotificationInput {
  type: NotificationType;
  priority?: NotificationPriority;
  title: string;
  message: string;
  recipientId: string;
  channels?: NotificationChannel[];
  actionUrl?: string;
  actionLabel?: string;
  imageUrl?: string;
  metadata?: Record<string, any>;
  expiresAt?: string;
}

// Configuration des types de notification
const notificationConfig: Record<NotificationType, {
  defaultPriority: NotificationPriority;
  defaultChannels: NotificationChannel[];
  icon: string;
}> = {
  payment_received: {
    defaultPriority: "normal",
    defaultChannels: ["in_app", "email"],
    icon: "💰",
  },
  payment_due: {
    defaultPriority: "high",
    defaultChannels: ["in_app", "email", "push"],
    icon: "📅",
  },
  payment_late: {
    defaultPriority: "urgent",
    defaultChannels: ["in_app", "email", "push", "sms"],
    icon: "⚠️",
  },
  lease_signed: {
    defaultPriority: "normal",
    defaultChannels: ["in_app", "email"],
    icon: "✍️",
  },
  lease_ending: {
    defaultPriority: "high",
    defaultChannels: ["in_app", "email"],
    icon: "📋",
  },
  document_uploaded: {
    defaultPriority: "low",
    defaultChannels: ["in_app"],
    icon: "📄",
  },
  document_signed: {
    defaultPriority: "normal",
    defaultChannels: ["in_app", "email"],
    icon: "✅",
  },
  ticket_created: {
    defaultPriority: "normal",
    defaultChannels: ["in_app", "push"],
    icon: "🎫",
  },
  ticket_updated: {
    defaultPriority: "low",
    defaultChannels: ["in_app"],
    icon: "🔄",
  },
  ticket_resolved: {
    defaultPriority: "normal",
    defaultChannels: ["in_app", "push"],
    icon: "✅",
  },
  message_received: {
    defaultPriority: "normal",
    defaultChannels: ["in_app", "push", "email"],
    icon: "💬",
  },
  maintenance_scheduled: {
    defaultPriority: "normal",
    defaultChannels: ["in_app", "email"],
    icon: "🔧",
  },
  rent_revision: {
    defaultPriority: "high",
    defaultChannels: ["in_app", "email"],
    icon: "📈",
  },
  edl_ready_to_sign: {
    defaultPriority: "high",
    defaultChannels: ["in_app", "email", "push"],
    icon: "✍️",
  },
  edl_signed_by_counterparty: {
    defaultPriority: "normal",
    defaultChannels: ["in_app", "email"],
    icon: "✍️",
  },
  edl_fully_signed: {
    defaultPriority: "normal",
    defaultChannels: ["in_app", "email"],
    icon: "✅",
  },
  system: {
    defaultPriority: "low",
    defaultChannels: ["in_app"],
    icon: "ℹ️",
  },
  custom: {
    defaultPriority: "normal",
    defaultChannels: ["in_app"],
    icon: "🔔",
  },
};

/**
 * Envoie un push réel (web VAPID + FCM natif) aux appareils enregistrés du destinataire.
 * Ne lance pas d'erreur si l'envoi échoue — les push sont best-effort.
 */
async function dispatchPush(
  profileId: string,
  title: string,
  body: string,
  actionUrl?: string,
) {
  try {
    const serviceClient = createServiceRoleClient();

    const { data: subs } = await serviceClient
      .from("push_subscriptions")
      .select("id, endpoint, p256dh_key, auth_key, device_type")
      .eq("profile_id", profileId)
      .eq("is_active", true);

    if (!subs || subs.length === 0) return;

    const webSubs = subs.filter((s) => s.device_type === "web");
    const nativeSubs = subs.filter((s) => s.device_type === "android" || s.device_type === "ios");

    // Web Push via VAPID
    if (webSubs.length > 0) {
      const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
      const vapidSubject = process.env.VAPID_SUBJECT || "mailto:support@talok.fr";

      if (vapidPublic && vapidPrivate) {
        // @ts-ignore — web-push has no declaration file
        const webPush = await import("web-push");
        webPush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

        const payload = JSON.stringify({
          title,
          body,
          icon: "/icons/icon-192x192.png",
          badge: "/icons/badge-72x72.png",
          data: { url: actionUrl },
        });

        await Promise.allSettled(
          webSubs.map(async (sub) => {
            try {
              await webPush.sendNotification(
                { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh_key, auth: sub.auth_key } },
                payload,
              );
            } catch (err: any) {
              if (err?.statusCode === 410 || err?.statusCode === 404) {
                await serviceClient
                  .from("push_subscriptions")
                  .update({ is_active: false } as any)
                  .eq("id", sub.id as string);
              }
            }
          }),
        );
      }
    }

    // FCM natif via Firebase Admin
    if (nativeSubs.length > 0) {
      const firebaseServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
      if (firebaseServiceAccount) {
        const admin = await import("firebase-admin");

        if (!admin.default.apps?.length) {
          admin.default.initializeApp({
            credential: admin.default.credential.cert(
              JSON.parse(firebaseServiceAccount),
            ),
          });
        }

        await Promise.allSettled(
          nativeSubs.map(async (sub: any) => {
            // Le token FCM est stocké dans endpoint sous forme fcm://TOKEN
            const fcmToken = sub.endpoint.startsWith("fcm://")
              ? sub.endpoint.slice(6)
              : sub.endpoint;

            try {
              await admin.default.messaging().send({
                token: fcmToken,
                notification: { title, body },
                data: { url: actionUrl || "" },
              });
            } catch (err: any) {
              if (
                err?.code === "messaging/invalid-registration-token" ||
                err?.code === "messaging/registration-token-not-registered"
              ) {
                await serviceClient
                  .from("push_subscriptions")
                  .update({ is_active: false } as any)
                  .eq("id", sub.id as string);
              }
            }
          }),
        );
      }
    }
  } catch (e) {
    console.warn("[notification-service] Push dispatch failed:", e);
  }
}

/**
 * Envoie un email de notification via Resend. Best-effort, ne jette pas.
 *
 * Respecte :
 *   - notification_preferences.email_enabled (défaut true si absent)
 *   - notification_preferences.disabled_templates (skip si type dedans)
 * Throttle : saute l'envoi si une notification du même type pour le même
 * profil + même conversation a déjà reçu un email dans les 2 dernières
 * minutes (évite le spam lors d'échanges rapides).
 *
 * Après envoi, met à jour notifications.channels_status.email_sent_at pour
 * que les prochains appels voient l'émission récente via le throttle.
 */
async function dispatchEmail(
  notificationId: string,
  profileId: string,
  title: string,
  body: string,
  actionUrl: string | undefined,
  notificationType: NotificationType,
  metadata?: Record<string, any>,
): Promise<void> {
  try {
    const serviceClient = createServiceRoleClient();

    // 1. Résoudre email + prénom depuis profiles → auth.users
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("user_id, prenom")
      .eq("id", profileId)
      .maybeSingle() as { data: { user_id: string | null; prenom: string | null } | null };
    if (!profile?.user_id) return;

    const { data: authUser } = await serviceClient.auth.admin.getUserById(profile.user_id);
    const email = authUser?.user?.email;
    if (!email) return;

    // 2. Préférences utilisateur — table notification_preferences
    const { data: prefs } = await serviceClient
      .from("notification_preferences")
      .select("email_enabled, disabled_templates")
      .eq("profile_id", profileId)
      .maybeSingle() as { data: { email_enabled: boolean | null; disabled_templates: string[] | null } | null };
    if (prefs?.email_enabled === false) return;
    if (prefs?.disabled_templates?.includes(notificationType)) return;

    // 3. Throttle 2 minutes par (profile, type, conversation_id)
    const conversationId = metadata?.conversationId ?? metadata?.conversation_id;
    if (conversationId) {
      const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      const { data: recent } = await serviceClient
        .from("notifications")
        .select("id, channels_status, metadata")
        .eq("profile_id", profileId)
        .eq("type", notificationType)
        .gte("created_at", twoMinAgo)
        .neq("id", notificationId)
        .order("created_at", { ascending: false })
        .limit(10);
      const throttled = (recent ?? []).some((n: any) => {
        const cid = n.metadata?.conversationId ?? n.metadata?.conversation_id;
        return cid === conversationId && n.channels_status?.email_sent_at;
      });
      if (throttled) return;
    }

    // 4. Envoi via Resend — HTML minimal, pas de template dédié v1
    const fullUrl = actionUrl
      ? actionUrl.startsWith("http")
        ? actionUrl
        : `https://app.talok.fr${actionUrl}`
      : undefined;
    const salutation = profile.prenom ? `Bonjour ${profile.prenom},` : "Bonjour,";
    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:24px;">
        <p>${salutation}</p>
        <p><strong>${escapeHtml(title)}</strong></p>
        <p style="color:#374151;">${escapeHtml(body)}</p>
        ${fullUrl ? `<p style="margin-top:24px;"><a href="${fullUrl}" style="display:inline-block;background:#2563EB;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Ouvrir sur Talok</a></p>` : ""}
        <hr style="margin:32px 0;border:0;border-top:1px solid #E5E7EB;">
        <p style="color:#6B7280;font-size:12px;">Vous recevez cet email car vous avez une notification Talok. Gérez vos préférences depuis votre espace.</p>
      </div>
    `;

    const result = await sendEmail({
      to: email,
      subject: title,
      html,
      tags: [
        { name: "notification_type", value: notificationType },
        { name: "talok_channel", value: "notification" },
      ],
    });

    if (result.success) {
      // 5. Marquer email_sent_at sur la notification pour le throttle futur
      await serviceClient
        .from("notifications")
        .update({
          channels_status: {
            email_sent_at: new Date().toISOString(),
            email_id: result.id ?? null,
          },
        } as any)
        .eq("id", notificationId);
    }
  } catch (e) {
    console.warn("[notification-service] Email dispatch failed:", e);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Crée une notification in-app et envoie un push réel si le canal push est activé.
 * recipientId est traité comme profile_id : on résout user_id pour la RLS.
 */
export async function createNotification(
  input: CreateNotificationInput
): Promise<Notification | null> {
  const supabase = await createClient();
  const config = notificationConfig[input.type];

  let userId: string | null = null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("id", input.recipientId)
    .single();
  if (profile?.user_id) {
    userId = profile.user_id;
  }

  const channels = input.channels || config.defaultChannels;

  const notification: Record<string, unknown> = {
    type: input.type,
    priority: input.priority || config.defaultPriority,
    title: input.title,
    body: input.message,
    message: input.message,
    profile_id: input.recipientId,
    channels,
    is_read: false,
    action_url: input.actionUrl,
    action_label: input.actionLabel,
    image_url: input.imageUrl,
    metadata: input.metadata,
    expires_at: input.expiresAt,
  };
  if (userId) {
    notification.user_id = userId;
  }

  const { data, error } = await supabase
    .from("notifications")
    .insert(notification)
    .select()
    .single();

  if (error) {
    console.error("Erreur création notification:", error);
    return null;
  }

  // Envoyer un push réel si le canal push est activé
  if (channels.includes("push")) {
    dispatchPush(input.recipientId, input.title, input.message, input.actionUrl)
      .catch((e) => console.warn("[notification-service] dispatchPush error:", e));
  }

  // Envoyer un email si le canal email est activé (best-effort, throttle 2min)
  if (channels.includes("email") && data?.id) {
    dispatchEmail(
      data.id as string,
      input.recipientId,
      input.title,
      input.message,
      input.actionUrl,
      input.type,
      input.metadata,
    ).catch((e) => console.warn("[notification-service] dispatchEmail error:", e));
  }

  // Convertir au format Notification
  return {
    id: data.id,
    type: data.type as NotificationType,
    priority: (data.priority ?? 'normal') as NotificationPriority,
    title: data.title,
    message: data.message ?? '',
    recipientId: data.profile_id ?? '',
    channels: (data.channels ?? []) as NotificationChannel[],
    read: data.is_read ?? data.read ?? false,
    actionUrl: data.action_url ?? undefined,
    actionLabel: data.action_label ?? undefined,
    imageUrl: data.image_url ?? undefined,
    metadata: data.metadata as Record<string, any> | undefined,
    createdAt: data.created_at,
    readAt: data.read_at ?? undefined,
    expiresAt: data.expires_at ?? undefined,
  } as Notification;
}

/**
 * Récupère les notifications d'un utilisateur
 */
export async function getNotifications(
  profileId: string,
  options?: {
    unreadOnly?: boolean;
    limit?: number;
    offset?: number;
    types?: NotificationType[];
  }
): Promise<{ notifications: Notification[]; unreadCount: number }> {
  const supabase = await createClient();
  
  let query = supabase
    .from("notifications")
    .select("*", { count: "exact" })
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });

  if (options?.unreadOnly) {
    query = query.eq("is_read", false);
  }

  if (options?.types && options.types.length > 0) {
    query = query.in("type", options.types);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("Erreur récupération notifications:", error);
    return { notifications: [], unreadCount: 0 };
  }

  // Compter les non lues
  const { count: unreadCount } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("profile_id", profileId)
    .eq("is_read", false);

  const notifications: Notification[] = (data || []).map((n: any) => ({
    id: n.id,
    type: n.type,
    priority: n.priority,
    title: n.title,
    message: n.message,
    recipientId: n.profile_id,
    channels: n.channels,
    read: n.is_read ?? n.read ?? false,
    actionUrl: n.action_url,
    actionLabel: n.action_label,
    imageUrl: n.image_url,
    metadata: n.metadata,
    createdAt: n.created_at,
    readAt: n.read_at,
    expiresAt: n.expires_at,
  }));

  return {
    notifications,
    unreadCount: unreadCount || 0,
  };
}

/**
 * Marque une notification comme lue
 */
export async function markAsRead(notificationId: string): Promise<boolean> {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("id", notificationId);

  return !error;
}

/**
 * Marque toutes les notifications comme lues
 */
export async function markAllAsRead(profileId: string): Promise<boolean> {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("profile_id", profileId)
    .eq("is_read", false);

  return !error;
}

/**
 * Supprime une notification
 */
export async function deleteNotification(notificationId: string): Promise<boolean> {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("id", notificationId);

  return !error;
}

/**
 * Supprime les notifications expirées
 */
export async function cleanupExpiredNotifications(): Promise<number> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from("notifications")
    .delete()
    .lt("expires_at", new Date().toISOString())
    .select("id");

  if (error) {
    console.error("Erreur nettoyage notifications:", error);
    return 0;
  }

  return data?.length || 0;
}

// ============================================
// NOTIFICATIONS PRÉDÉFINIES
// ============================================

/**
 * Notifie un paiement reçu
 */
export async function notifyPaymentReceived(
  ownerId: string,
  tenantName: string,
  amount: number,
  period: string,
  invoiceId: string
): Promise<Notification | null> {
  return createNotification({
    type: "payment_received",
    title: "Paiement reçu",
    message: `${tenantName} a payé ${amount.toLocaleString("fr-FR")} € pour ${period}`,
    recipientId: ownerId,
    actionUrl: `/owner/money?invoice=${invoiceId}`,
    actionLabel: "Voir le paiement",
    metadata: { tenantName, amount, period, invoiceId },
  });
}

/**
 * Notifie un loyer en retard
 */
export async function notifyPaymentLate(
  tenantId: string,
  amount: number,
  daysLate: number,
  invoiceId: string
): Promise<Notification | null> {
  return createNotification({
    type: "payment_late",
    priority: daysLate >= 15 ? "urgent" : "high",
    title: "Loyer en retard",
    message: `Votre loyer de ${amount.toLocaleString("fr-FR")} € est en retard de ${daysLate} jours`,
    recipientId: tenantId,
    actionUrl: `/tenant/payments?invoice=${invoiceId}`,
    actionLabel: "Payer maintenant",
    metadata: { amount, daysLate, invoiceId },
  });
}

/**
 * Notifie la signature d'un bail
 */
export async function notifyLeaseSigned(
  recipientId: string,
  propertyAddress: string,
  leaseId: string,
  isOwner: boolean
): Promise<Notification | null> {
  return createNotification({
    type: "lease_signed",
    title: "Bail signé",
    message: `Le bail pour ${propertyAddress} a été signé par toutes les parties`,
    recipientId,
    actionUrl: isOwner 
      ? `/owner/leases/${leaseId}` 
      : `/tenant/lease`,
    actionLabel: "Voir le bail",
    metadata: { propertyAddress, leaseId },
  });
}

/**
 * Notifie un nouveau ticket
 */
export async function notifyTicketCreated(
  ownerId: string,
  ticketTitle: string,
  propertyAddress: string,
  ticketId: string,
  tenantName: string
): Promise<Notification | null> {
  return createNotification({
    type: "ticket_created",
    title: "Nouvelle demande",
    message: `${tenantName} a créé une demande : "${ticketTitle}" pour ${propertyAddress}`,
    recipientId: ownerId,
    actionUrl: `/owner/tickets/${ticketId}`,
    actionLabel: "Voir la demande",
    metadata: { ticketTitle, propertyAddress, ticketId, tenantName },
  });
}

/**
 * Notifie un message reçu
 */
export async function notifyMessageReceived(
  recipientId: string,
  senderName: string,
  messagePreview: string,
  conversationId: string,
  recipientRole?: "owner" | "tenant" | "provider"
): Promise<Notification | null> {
  const basePath =
    recipientRole === "owner"
      ? "/owner/messages"
      : recipientRole === "provider"
      ? "/provider/messages"
      : "/tenant/messages";
  return createNotification({
    type: "message_received",
    title: `Message de ${senderName}`,
    message: messagePreview.slice(0, 100) + (messagePreview.length > 100 ? "..." : ""),
    recipientId,
    actionUrl: `${basePath}?conversation=${conversationId}`,
    actionLabel: "Répondre",
    metadata: { senderName, conversationId },
  });
}

/**
 * Notifie qu'un EDL est prêt à être signé (status "completed")
 */
export async function notifyEDLReadyToSign(
  recipientId: string,
  edlId: string,
  edlType: "entree" | "sortie",
  propertyAddress: string,
  recipientRole: "owner" | "tenant",
  tokenUrl?: string,
): Promise<Notification | null> {
  const kind = edlType === "entree" ? "d'entrée" : "de sortie";
  const actionUrl =
    recipientRole === "owner"
      ? `/owner/inspections/${edlId}?sign=1`
      : tokenUrl || `/tenant/inspections/${edlId}`;
  return createNotification({
    type: "edl_ready_to_sign",
    title: "État des lieux prêt à être signé",
    message: `L'EDL ${kind} pour ${propertyAddress} est prêt. Veuillez le signer.`,
    recipientId,
    actionUrl,
    actionLabel: "Signer",
    metadata: { edlId, edlType, propertyAddress, recipientRole },
  });
}

/**
 * Notifie qu'une partie a signé l'EDL — l'autre doit encore signer.
 */
export async function notifyEDLSignedByCounterparty(
  recipientId: string,
  edlId: string,
  edlType: "entree" | "sortie",
  propertyAddress: string,
  signerRole: "owner" | "tenant",
  recipientRole: "owner" | "tenant",
): Promise<Notification | null> {
  const who = signerRole === "owner" ? "Le propriétaire" : "Le locataire";
  const kind = edlType === "entree" ? "d'entrée" : "de sortie";
  const actionUrl =
    recipientRole === "owner"
      ? `/owner/inspections/${edlId}?sign=1`
      : `/tenant/inspections/${edlId}`;
  return createNotification({
    type: "edl_signed_by_counterparty",
    title: `${who} a signé l'état des lieux`,
    message: `${who} a signé l'EDL ${kind} pour ${propertyAddress}. Il reste votre signature.`,
    recipientId,
    actionUrl,
    actionLabel: "Signer à mon tour",
    metadata: { edlId, edlType, signerRole, recipientRole },
  });
}

/**
 * Notifie que l'EDL est entièrement signé (les deux parties).
 */
export async function notifyEDLFullySigned(
  recipientId: string,
  edlId: string,
  edlType: "entree" | "sortie",
  propertyAddress: string,
  recipientRole: "owner" | "tenant",
): Promise<Notification | null> {
  const kind = edlType === "entree" ? "d'entrée" : "de sortie";
  const actionUrl =
    recipientRole === "owner"
      ? `/owner/inspections/${edlId}`
      : `/tenant/inspections/${edlId}`;
  return createNotification({
    type: "edl_fully_signed",
    title: "État des lieux signé par toutes les parties",
    message: `L'EDL ${kind} pour ${propertyAddress} est signé. Le PDF scellé est disponible.`,
    recipientId,
    actionUrl,
    actionLabel: "Voir le PDF",
    metadata: { edlId, edlType, recipientRole },
  });
}

export default {
  createNotification,
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  cleanupExpiredNotifications,
  notifyPaymentReceived,
  notifyPaymentLate,
  notifyLeaseSigned,
  notifyTicketCreated,
  notifyMessageReceived,
  notifyEDLReadyToSign,
  notifyEDLSignedByCounterparty,
  notifyEDLFullySigned,
  notificationConfig,
};


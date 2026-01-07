/**
 * Service de notifications
 * 
 * Gère les notifications :
 * - In-app (base de données)
 * - Push (Web Push API)
 * - Email (via service externe)
 */

import { createClient } from "@/lib/supabase/server";

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
    defaultChannels: ["in_app", "push"],
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
 * Crée une notification in-app
 */
export async function createNotification(
  input: CreateNotificationInput
): Promise<Notification | null> {
  const supabase = await createClient();
  const config = notificationConfig[input.type];
  
  const notification = {
    type: input.type,
    priority: input.priority || config.defaultPriority,
    title: input.title,
    message: input.message,
    profile_id: input.recipientId,
    channels: input.channels || config.defaultChannels,
    read: false,
    action_url: input.actionUrl,
    action_label: input.actionLabel,
    image_url: input.imageUrl,
    metadata: input.metadata,
    expires_at: input.expiresAt,
  };

  const { data, error } = await supabase
    .from("notifications")
    .insert(notification)
    .select()
    .single();

  if (error) {
    console.error("Erreur création notification:", error);
    return null;
  }

  // Convertir au format Notification
  return {
    id: data.id,
    type: data.type,
    priority: data.priority,
    title: data.title,
    message: data.message,
    recipientId: data.profile_id,
    channels: data.channels,
    read: data.read,
    actionUrl: data.action_url,
    actionLabel: data.action_label,
    imageUrl: data.image_url,
    metadata: data.metadata,
    createdAt: data.created_at,
    readAt: data.read_at,
    expiresAt: data.expires_at,
  };
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
    query = query.eq("read", false);
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
    .eq("read", false);

  const notifications: Notification[] = (data || []).map((n: any) => ({
    id: n.id,
    type: n.type,
    priority: n.priority,
    title: n.title,
    message: n.message,
    recipientId: n.profile_id,
    channels: n.channels,
    read: n.read,
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
    .update({ read: true, read_at: new Date().toISOString() })
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
    .update({ read: true, read_at: new Date().toISOString() })
    .eq("profile_id", profileId)
    .eq("read", false);

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
  conversationId: string
): Promise<Notification | null> {
  return createNotification({
    type: "message_received",
    title: `Message de ${senderName}`,
    message: messagePreview.slice(0, 100) + (messagePreview.length > 100 ? "..." : ""),
    recipientId,
    actionUrl: `/messages/${conversationId}`,
    actionLabel: "Répondre",
    metadata: { senderName, conversationId },
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
  notificationConfig,
};


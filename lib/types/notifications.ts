// =====================================================
// Types pour le Système de Notifications SOTA 2025
// =====================================================

/**
 * Canal de notification
 */
export type NotificationChannel = 'in_app' | 'email' | 'sms' | 'push';

/**
 * Priorité de notification
 */
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

/**
 * Statut de notification
 */
export type NotificationStatus = 
  | 'pending'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed'
  | 'cancelled';

/**
 * Mode digest
 */
export type DigestMode = 'instant' | 'daily' | 'weekly';

/**
 * Template de notification
 */
export interface NotificationTemplate {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string;
  channels: NotificationChannel[];
  priority: NotificationPriority;
  in_app_title: string | null;
  in_app_message: string | null;
  in_app_icon: string | null;
  in_app_action_url: string | null;
  email_subject: string | null;
  email_html_template: string | null;
  email_text_template: string | null;
  sms_template: string | null;
  push_title: string | null;
  push_body: string | null;
  push_image_url: string | null;
  variables: string[];
  throttle_key: string | null;
  throttle_window_minutes: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Préférences de notification utilisateur
 */
export interface NotificationPreferences {
  id: string;
  profile_id: string;
  in_app_enabled: boolean;
  email_enabled: boolean;
  sms_enabled: boolean;
  push_enabled: boolean;
  notification_email: string | null;
  sms_phone: string | null;
  category_preferences: Record<string, NotificationChannel[]>;
  disabled_templates: string[];
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  quiet_hours_timezone: string;
  digest_mode: DigestMode;
  digest_time: string;
  digest_day: number | null;
  updated_at: string;
}

/**
 * Notification
 */
export interface Notification {
  id: string;
  profile_id: string;
  template_id: string | null;
  template_code: string | null;
  type: string;
  title: string;
  message: string;
  data: Record<string, unknown>;
  channels_status: Record<NotificationChannel, NotificationStatus>;
  priority: NotificationPriority;
  action_url: string | null;
  action_label: string | null;
  status: NotificationStatus;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  failed_at: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  expires_at: string | null;
}

/**
 * Abonnement push
 */
export interface NotificationSubscription {
  id: string;
  profile_id: string;
  type: 'web_push' | 'fcm' | 'apns';
  endpoint: string;
  p256dh: string | null;
  auth: string | null;
  device_name: string | null;
  device_type: string | null;
  user_agent: string | null;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
  expires_at: string | null;
}

/**
 * Formulaire de mise à jour des préférences
 */
export interface UpdateNotificationPreferencesData {
  in_app_enabled?: boolean;
  email_enabled?: boolean;
  sms_enabled?: boolean;
  push_enabled?: boolean;
  notification_email?: string;
  sms_phone?: string;
  category_preferences?: Record<string, NotificationChannel[]>;
  disabled_templates?: string[];
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  quiet_hours_timezone?: string;
  digest_mode?: DigestMode;
  digest_time?: string;
  digest_day?: number;
}

/**
 * Données pour créer une notification
 */
export interface CreateNotificationData {
  template_code: string;
  variables?: Record<string, string>;
  data?: Record<string, unknown>;
}

/**
 * Données pour créer une notification custom
 */
export interface CreateCustomNotificationData {
  profile_id: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  priority?: NotificationPriority;
  action_url?: string;
  action_label?: string;
  channels?: NotificationChannel[];
}

// =====================================================
// Labels et constantes
// =====================================================

export const NOTIFICATION_CHANNEL_LABELS: Record<NotificationChannel, string> = {
  in_app: 'Dans l\'application',
  email: 'Email',
  sms: 'SMS',
  push: 'Notification push',
};

export const NOTIFICATION_PRIORITY_LABELS: Record<NotificationPriority, string> = {
  low: 'Basse',
  normal: 'Normale',
  high: 'Haute',
  urgent: 'Urgente',
};

export const NOTIFICATION_STATUS_LABELS: Record<NotificationStatus, string> = {
  pending: 'En attente',
  sent: 'Envoyée',
  delivered: 'Délivrée',
  read: 'Lue',
  failed: 'Échec',
  cancelled: 'Annulée',
};

export const NOTIFICATION_CATEGORIES = [
  { value: 'invoice', label: 'Facturation' },
  { value: 'work_order', label: 'Interventions' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'compliance', label: 'Conformité' },
  { value: 'review', label: 'Avis' },
  { value: 'lease', label: 'Baux' },
  { value: 'payment', label: 'Paiements' },
  { value: 'security', label: 'Sécurité' },
];

export const DIGEST_MODE_LABELS: Record<DigestMode, string> = {
  instant: 'Instantané',
  daily: 'Résumé quotidien',
  weekly: 'Résumé hebdomadaire',
};

// =====================================================
// Helpers
// =====================================================

/**
 * Icône par catégorie de notification
 */
export function getNotificationIcon(type: string): string {
  const icons: Record<string, string> = {
    invoice: '📄',
    work_order: '🔧',
    maintenance: '🏠',
    compliance: '✅',
    review: '⭐',
    lease: '📝',
    payment: '💳',
    security: '🛡️',
    security_alert: '🛡️',
    audit_critical: '🚨',
    audit_high: '⚠️',
  };
  return icons[type] || '🔔';
}

/**
 * Couleur par priorité
 */
export function getNotificationPriorityColor(priority: NotificationPriority): {
  bg: string;
  text: string;
  border: string;
} {
  const colors: Record<NotificationPriority, { bg: string; text: string; border: string }> = {
    low: { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' },
    normal: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' },
    high: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200' },
    urgent: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200' },
  };
  return colors[priority];
}

/**
 * Formater le temps relatif
 */
export function formatRelativeTime(date: string): string {
  const now = new Date();
  const notifDate = new Date(date);
  const diffMs = now.getTime() - notifDate.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'À l\'instant';
  if (diffMins < 60) return `Il y a ${diffMins} min`;
  if (diffHours < 24) return `Il y a ${diffHours}h`;
  if (diffDays < 7) return `Il y a ${diffDays}j`;
  
  return notifDate.toLocaleDateString('fr-FR');
}

/**
 * Grouper les notifications par date
 */
export function groupNotificationsByDate(
  notifications: Notification[]
): Record<string, Notification[]> {
  const groups: Record<string, Notification[]> = {};
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  for (const notif of notifications) {
    const date = new Date(notif.created_at).toDateString();
    let key: string;

    if (date === today) {
      key = 'Aujourd\'hui';
    } else if (date === yesterday) {
      key = 'Hier';
    } else {
      key = new Date(notif.created_at).toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });
    }

    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(notif);
  }

  return groups;
}


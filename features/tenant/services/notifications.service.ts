import { createClient } from "@/lib/supabase/client";
import { apiClient } from "@/lib/api-client";

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  link_url?: string | null;
  read_at?: string | null;
  sent_channels: string[];
  created_at: string;
}

export interface NotificationSetting {
  id: string;
  user_id: string;
  channel: "email" | "push" | "sms" | "in_app";
  category: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export class NotificationsService {
  private _supabase: ReturnType<typeof createClient> | null = null;

  // Lazy getter pour éviter la création du client au niveau du module (erreur de build)
  private get supabase() {
    if (!this._supabase) {
      this._supabase = createClient();
    }
    return this._supabase;
  }

  /**
   * Récupérer les notifications
   */
  async getNotifications(
    unreadOnly: boolean = false,
    limit: number = 50
  ): Promise<Notification[]> {
    const response = await apiClient.get<{ notifications: Notification[] }>(
      `/notifications?unread_only=${unreadOnly}&limit=${limit}`
    );
    return response.notifications;
  }

  /**
   * Marquer une notification comme lue
   */
  async markAsRead(notificationId: string): Promise<void> {
    await apiClient.patch("/notifications", {
      notification_id: notificationId,
      read: true,
    });
  }

  /**
   * Récupérer les paramètres de notifications
   */
  async getSettings(): Promise<NotificationSetting[]> {
    const response = await apiClient.get<{ settings: NotificationSetting[] }>(
      "/notifications/settings"
    );
    return response.settings;
  }

  /**
   * Mettre à jour un paramètre
   */
  async updateSetting(
    channel: "email" | "push" | "sms" | "in_app",
    category: string,
    enabled: boolean
  ): Promise<NotificationSetting> {
    const response = await apiClient.patch<{ setting: NotificationSetting }>(
      "/notifications/settings",
      {
        channel,
        category,
        enabled,
      }
    );
    return response.setting;
  }

  /**
   * S'abonner aux nouvelles notifications (Realtime)
   */
  async subscribeToNotifications(callback: (notification: Notification) => void) {
    const {
      data: { user },
    } = await this.supabase.auth.getUser();

    return this.supabase
      .channel("notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user?.id}`,
        },
        (payload) => {
          callback(payload.new as Notification);
        }
      )
      .subscribe();
  }
}

export const notificationsService = new NotificationsService();


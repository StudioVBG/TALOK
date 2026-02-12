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
  private supabase = createClient();

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
    await apiClient.post(`/notifications/${notificationId}/read`, {});
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
   * Note: La table notifications utilise profile_id (pas user_id)
   */
  async subscribeToNotifications(callback: (notification: Notification) => void) {
    const {
      data: { user },
    } = await this.supabase.auth.getUser();

    if (!user) return null;

    // Récupérer le profile_id car la table notifications filtre par profile_id
    const { data: profile } = await this.supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!profile) return null;

    return this.supabase
      .channel("notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `profile_id=eq.${profile.id}`,
        },
        (payload) => {
          callback(payload.new as Notification);
        }
      )
      .subscribe();
  }
}

export const notificationsService = new NotificationsService();


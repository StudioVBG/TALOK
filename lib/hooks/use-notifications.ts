"use client";

/**
 * Hook pour les notifications temps réel
 * Utilise Supabase Realtime pour recevoir les notifications instantanément
 * 
 * Fonctionnalités:
 * - Écoute temps réel des nouvelles notifications
 * - Compteur de non-lues
 * - Actions mark as read / delete
 * - Son de notification optionnel
 */

import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/hooks/use-auth";
import { useToast } from "@/components/ui/use-toast";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface Notification {
  id: string;
  user_id: string;
  recipient_id?: string; // Alias optionnel de user_id
  type:
    | "payment_received"
    | "payment_late"
    | "payment_reminder"
    | "lease_signed"
    | "lease_pending_signature"
    | "lease_expiring"
    | "ticket_new"
    | "ticket_update"
    | "ticket_resolved"
    | "message_new"
    | "document_uploaded"
    | "document_signed"
    | "security_alert"
    | "audit_critical"
    | "audit_high"
    | "reminder"
    | "alert"
    | "system";
  title: string;
  message: string;
  body?: string; // Alias de message dans certaines tables
  link?: string;
  link_url?: string; // Alias de link
  related_id?: string;
  related_type?: string;
  read: boolean;
  created_at: string;
  read_at?: string;
}

interface UseNotificationsOptions {
  /** Activer le son pour les nouvelles notifications */
  enableSound?: boolean;
  /** Afficher un toast pour les nouvelles notifications */
  showToast?: boolean;
  /** Nombre max de notifications à charger */
  limit?: number;
}

interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  deleteAllNotifications: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useNotifications(options: UseNotificationsOptions = {}): UseNotificationsReturn {
  const { enableSound = false, showToast = true, limit = 50 } = options;
  
  const { profile } = useAuth();
  const { toast } = useToast();
  const supabase = createClient();
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Calculer le nombre de non-lues
  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  // Jouer un son de notification
  const playNotificationSound = useCallback(() => {
    if (enableSound && typeof window !== "undefined") {
      try {
        const audio = new Audio("/sounds/notification.mp3");
        audio.volume = 0.5;
        audio.play().catch(() => {
          // Ignorer les erreurs de lecture audio (autoplay bloqué)
        });
      } catch {
        // Ignorer si l'audio n'est pas supporté
      }
    }
  }, [enableSound]);

  // Charger les notifications
  const fetchNotifications = useCallback(async () => {
    if (!profile?.id) return;

    try {
      setLoading(true);
      setError(null);

      // Utiliser user_id (colonne originale) car recipient_id peut ne pas être dans le cache PostgREST
      // On filtre aussi par recipient_id via OR pour la compatibilité future
      const { data, error: fetchError } = await supabase
        .from("notifications")
        .select("*")
        .or(`user_id.eq.${profile.user_id},recipient_id.eq.${profile.id}`)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (fetchError) {
        // Fallback: essayer uniquement avec user_id si recipient_id cause une erreur
        console.warn("[useNotifications] Fallback to user_id only:", fetchError.message);
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("notifications")
          .select("*")
          .eq("user_id", profile.user_id)
          .order("created_at", { ascending: false })
          .limit(limit);
        
        if (fallbackError) {
          console.error("[useNotifications] Fallback error:", fallbackError);
          setError("Erreur lors du chargement des notifications");
          return;
        }
        setNotifications((fallbackData || []) as Notification[]);
        return;
      }

      setNotifications((data || []) as Notification[]);
    } catch (err) {
      console.error("[useNotifications] Error:", err);
      setError("Erreur lors du chargement des notifications");
    } finally {
      setLoading(false);
    }
  }, [profile?.id, profile?.user_id, supabase, limit]);

  // Marquer comme lu
  const markAsRead = useCallback(async (id: string) => {
    // Mise à jour optimiste
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true, read_at: new Date().toISOString() } : n))
    );

    const { error: updateError } = await supabase
      .from("notifications")
      .update({ read: true, read_at: new Date().toISOString() })
      .eq("id", id);

    if (updateError) {
      console.error("[useNotifications] Mark as read error:", updateError);
      // Rollback
      fetchNotifications();
    }
  }, [supabase, fetchNotifications]);

  // Marquer toutes comme lues
  const markAllAsRead = useCallback(async () => {
    if (!profile?.id || !profile?.user_id) return;

    // Mise à jour optimiste
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read: true, read_at: new Date().toISOString() }))
    );

    // Utiliser user_id pour la mise à jour
    const { error: updateError } = await supabase
      .from("notifications")
      .update({ read: true, read_at: new Date().toISOString() })
      .eq("user_id", profile.user_id)
      .eq("read", false);

    if (updateError) {
      console.error("[useNotifications] Mark all as read error:", updateError);
      fetchNotifications();
    }
  }, [profile?.id, profile?.user_id, supabase, fetchNotifications]);

  // Supprimer une notification
  const deleteNotification = useCallback(async (id: string) => {
    // Mise à jour optimiste
    setNotifications((prev) => prev.filter((n) => n.id !== id));

    const { error: deleteError } = await supabase
      .from("notifications")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("[useNotifications] Delete error:", deleteError);
      fetchNotifications();
    }
  }, [supabase, fetchNotifications]);

  // Supprimer toutes les notifications
  const deleteAllNotifications = useCallback(async () => {
    if (!profile?.id || !profile?.user_id) return;

    // Mise à jour optimiste
    setNotifications([]);

    // Utiliser user_id pour la suppression
    const { error: deleteError } = await supabase
      .from("notifications")
      .delete()
      .eq("user_id", profile.user_id);

    if (deleteError) {
      console.error("[useNotifications] Delete all error:", deleteError);
      fetchNotifications();
    }
  }, [profile?.id, profile?.user_id, supabase, fetchNotifications]);

  // Charger les notifications au montage
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Configurer le listener temps réel
  useEffect(() => {
    if (!profile?.id || !profile?.user_id) return;

    let channel: RealtimeChannel;

    const setupRealtime = async () => {
      // Utiliser user_id pour le realtime (colonne originale)
      channel = supabase
        .channel(`notifications:${profile.user_id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${profile.user_id}`,
          },
          (payload) => {
            const newNotification = payload.new as Notification;
            
            // Ajouter la nouvelle notification en haut de la liste
            setNotifications((prev) => [newNotification, ...prev].slice(0, limit));
            
            // Jouer le son
            playNotificationSound();
            
            // Afficher le toast
            if (showToast) {
              toast({
                title: newNotification.title,
                description: newNotification.message,
                duration: 5000,
              });
            }
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${profile.user_id}`,
          },
          (payload) => {
            const updatedNotification = payload.new as Notification;
            setNotifications((prev) =>
              prev.map((n) => (n.id === updatedNotification.id ? updatedNotification : n))
            );
          }
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${profile.user_id}`,
          },
          (payload) => {
            const deletedId = (payload.old as any).id;
            setNotifications((prev) => prev.filter((n) => n.id !== deletedId));
          }
        )
        .subscribe();
    };

    setupRealtime();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  // Only re-subscribe when identity or connection changes — NOT on callback changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, profile?.user_id, supabase, limit]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications,
    refresh: fetchNotifications,
  };
}

// Export des types
export type { UseNotificationsOptions, UseNotificationsReturn };


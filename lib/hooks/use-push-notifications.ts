"use client";

/**
 * Hook pour les notifications push du navigateur
 * Gère la demande de permission et l'envoi de notifications système
 */

import { useState, useEffect, useCallback } from "react";

interface UsePushNotificationsReturn {
  /** Permission actuelle: 'default' | 'granted' | 'denied' */
  permission: NotificationPermission | "unsupported";
  /** Demander la permission */
  requestPermission: () => Promise<boolean>;
  /** Envoyer une notification push */
  sendNotification: (title: string, options?: NotificationOptions) => void;
  /** Les notifications push sont-elles supportées */
  isSupported: boolean;
  /** La permission est-elle accordée */
  isGranted: boolean;
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");

  // Vérifier le support et la permission au montage
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission);
  }, []);

  const isSupported = permission !== "unsupported";
  const isGranted = permission === "granted";

  // Demander la permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      console.warn("[usePushNotifications] Notifications not supported");
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result === "granted";
    } catch (error) {
      console.error("[usePushNotifications] Error requesting permission:", error);
      return false;
    }
  }, [isSupported]);

  // Envoyer une notification
  const sendNotification = useCallback(
    (title: string, options?: NotificationOptions) => {
      if (!isGranted) {
        console.warn("[usePushNotifications] Permission not granted");
        return;
      }

      try {
        const notification = new Notification(title, {
          icon: "/icon-192x192.png",
          badge: "/icon-72x72.png",
          ...options,
        });

        // Fermer automatiquement après 5 secondes
        setTimeout(() => notification.close(), 5000);

        // Gérer le clic
        notification.onclick = () => {
          window.focus();
          notification.close();
          // Si une URL est fournie dans data, naviguer vers elle
          if (options?.data?.url) {
            window.location.href = options.data.url;
          }
        };
      } catch (error) {
        console.error("[usePushNotifications] Error sending notification:", error);
      }
    },
    [isGranted]
  );

  return {
    permission,
    requestPermission,
    sendNotification,
    isSupported,
    isGranted,
  };
}

export default usePushNotifications;


"use client";

/**
 * Hook pour les notifications push — supporte Capacitor natif (FCM) et Web Push (VAPID)
 *
 * Sur Capacitor natif (Android/iOS) : utilise @capacitor/push-notifications + FCM
 * Sur le web : utilise l'API Notification du navigateur
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Capacitor } from "@capacitor/core";

interface UsePushNotificationsReturn {
  /** Permission actuelle: 'default' | 'granted' | 'denied' */
  permission: NotificationPermission | "unsupported";
  /** Demander la permission et s'enregistrer */
  requestPermission: () => Promise<boolean>;
  /** Envoyer une notification locale (web uniquement) */
  sendNotification: (title: string, options?: NotificationOptions) => void;
  /** Les notifications push sont-elles supportées */
  isSupported: boolean;
  /** La permission est-elle accordée */
  isGranted: boolean;
  /** Est-ce qu'on est sur Capacitor natif */
  isNative: boolean;
}

const isNativePlatform = Capacitor.isNativePlatform();

/**
 * Enregistre le token FCM auprès du serveur
 */
async function registerTokenOnServer(token: string, platform: "android" | "ios") {
  try {
    await fetch("/api/notifications/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: `fcm://${token}`,
        keys: { p256dh: token, auth: token },
        device_type: platform,
        device_name: `${platform} device`,
      }),
    });
  } catch (e) {
    console.warn("[usePushNotifications] Failed to register token:", e);
  }
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const listenersRegistered = useRef(false);

  // Initialisation au montage
  useEffect(() => {
    if (typeof window === "undefined") {
      setPermission("unsupported");
      return;
    }

    if (isNativePlatform) {
      // Capacitor natif : vérifier la permission via le plugin
      import("@capacitor/push-notifications").then(({ PushNotifications }) => {
        PushNotifications.checkPermissions().then((result: { receive: string }) => {
          if (result.receive === "granted") {
            setPermission("granted");
            // Re-register pour s'assurer que le token est à jour
            setupNativeListeners(PushNotifications);
            PushNotifications.register();
          } else if (result.receive === "denied") {
            setPermission("denied");
          } else {
            setPermission("default");
          }
        });
      });
    } else {
      // Web : vérifier l'API Notification du navigateur
      if (!("Notification" in window)) {
        setPermission("unsupported");
        return;
      }
      setPermission(Notification.permission);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setupNativeListeners(PushNotifications: any) {
    if (listenersRegistered.current) return;
    listenersRegistered.current = true;

    const platform = Capacitor.getPlatform() as "android" | "ios";

    // Token reçu après register()
    PushNotifications.addListener("registration", (token: { value: string }) => {
      console.log("[Push] FCM token:", token.value);
      registerTokenOnServer(token.value, platform);
    });

    // Erreur d'enregistrement
    PushNotifications.addListener("registrationError", (err: any) => {
      console.error("[Push] Registration error:", err);
    });

    // Notification reçue en foreground
    PushNotifications.addListener("pushNotificationReceived", (notification: any) => {
      console.log("[Push] Received in foreground:", notification);
    });

    // Utilisateur tape sur la notification
    PushNotifications.addListener("pushNotificationActionPerformed", (action: any) => {
      const url = action.notification?.data?.url;
      if (url && typeof window !== "undefined") {
        window.location.href = url;
      }
    });
  }

  const isSupported = permission !== "unsupported";
  const isGranted = permission === "granted";

  // Demander la permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      console.warn("[usePushNotifications] Notifications not supported");
      return false;
    }

    try {
      if (isNativePlatform) {
        const { PushNotifications } = await import("@capacitor/push-notifications");
        const result = await PushNotifications.requestPermissions();

        if (result.receive === "granted") {
          setPermission("granted");
          setupNativeListeners(PushNotifications);
          await PushNotifications.register();
          return true;
        }
        setPermission("denied");
        return false;
      } else {
        // Web
        const result = await Notification.requestPermission();
        setPermission(result);
        return result === "granted";
      }
    } catch (error) {
      console.error("[usePushNotifications] Error requesting permission:", error);
      return false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSupported]);

  // Envoyer une notification locale (web uniquement — sur natif, les push viennent du serveur via FCM)
  const sendNotification = useCallback(
    (title: string, options?: NotificationOptions) => {
      if (!isGranted || isNativePlatform) return;

      try {
        const notification = new Notification(title, {
          icon: "/icon-192x192.png",
          badge: "/icon-72x72.png",
          ...options,
        });

        setTimeout(() => notification.close(), 5000);

        notification.onclick = () => {
          window.focus();
          notification.close();
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
    isNative: isNativePlatform,
  };
}

export default usePushNotifications;

/**
 * Server-side push notification sender
 *
 * Utilise la table push_subscriptions pour envoyer des notifications
 * via Web Push (VAPID) et FCM (natif iOS/Android).
 *
 * Usage:
 *   await sendPushNotification(profileId, "Loyer reçu", "450 € de Jean Dupont", {
 *     route: "/owner/invoices/123",
 *   });
 */

import { createServiceRoleClient } from "@/lib/supabase/server";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:support@talok.fr";

interface PushPayload {
  /** Deep link route (e.g. /owner/invoices/123) */
  route?: string;
  /** Arbitrary key-value data */
  [key: string]: string | undefined;
}

/**
 * Envoie une notification push à un profil donné (tous ses devices actifs).
 */
export async function sendPushNotification(
  profileId: string,
  title: string,
  body: string,
  data?: PushPayload
) {
  const serviceClient = createServiceRoleClient();

  const { data: subscriptions, error } = await serviceClient
    .from("push_subscriptions")
    .select("id, endpoint, p256dh_key, auth_key, device_type")
    .eq("profile_id", profileId)
    .eq("is_active", true) as { data: Array<{ id: string; endpoint: string; p256dh_key: string | null; auth_key: string | null; device_type: string }> | null; error: any };

  if (error || !subscriptions?.length) return { sent: 0, failed: 0 };

  const webSubs = subscriptions.filter(
    (s) => s.device_type === "web" || !s.device_type
  );
  const nativeSubs = subscriptions.filter(
    (s) => s.device_type === "android" || s.device_type === "ios"
  );

  let sent = 0;
  let failed = 0;

  // Web Push via VAPID
  if (webSubs.length > 0 && VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    // @ts-ignore — web-push has no declaration file
    const webPush = await import("web-push");
    webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    const payload = JSON.stringify({
      title,
      body,
      icon: "/icons/icon-192x192.png",
      badge: "/icons/badge-72x72.png",
      data: { url: data?.route, ...data },
    });

    for (const sub of webSubs) {
      try {
        await webPush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh_key, auth: sub.auth_key },
          },
          payload
        );
        sent++;
      } catch (err: any) {
        failed++;
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          await serviceClient
            .from("push_subscriptions")
            .update({ is_active: false } as any)
            .eq("id", sub.id as string);
        }
      }
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
            JSON.parse(firebaseServiceAccount)
          ),
        });
      }

      for (const sub of nativeSubs) {
        const fcmToken = sub.endpoint.startsWith("fcm://")
          ? sub.endpoint.slice(6)
          : sub.endpoint;
        try {
          await admin.default.messaging().send({
            token: fcmToken,
            notification: { title, body },
            data: {
              route: data?.route || "",
              ...Object.fromEntries(
                Object.entries(data || {}).filter(([, v]) => v !== undefined)
              ),
            },
            apns: {
              payload: { aps: { sound: "default", badge: 1 } },
            },
            android: {
              priority: "high",
              notification: { sound: "default", channelId: "default" },
            },
          });
          sent++;
        } catch (err: any) {
          failed++;
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
      }
    }
  }

  return { sent, failed };
}

/**
 * Envoie une notification push à plusieurs profils.
 */
export async function sendPushToMultipleProfiles(
  profileIds: string[],
  title: string,
  body: string,
  data?: PushPayload
) {
  const results = await Promise.allSettled(
    profileIds.map((id) => sendPushNotification(id, title, body, data))
  );

  return results.reduce(
    (acc, r) => {
      if (r.status === "fulfilled") {
        acc.sent += r.value.sent;
        acc.failed += r.value.failed;
      } else {
        acc.failed++;
      }
      return acc;
    },
    { sent: 0, failed: 0 }
  );
}

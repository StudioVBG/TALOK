/**
 * Service de notifications unifié Talok
 *
 * Point d'entrée unique : notify(event, recipientId, data, options?)
 *
 * Workflow :
 *   1. Vérifie les préférences utilisateur (per-event)
 *   2. Dispatch sur les canaux activés :
 *      - In-app  → insertion table notifications (Supabase Realtime)
 *      - Email   → Resend via resend.service.ts
 *      - Push    → Web Push (VAPID) + FCM natif via push/send.ts
 *      - SMS     → Twilio via sms.service.ts (add-on payant)
 *
 * Règles :
 *   - Chaque canal est wrappé en try/catch (fire-and-forget)
 *   - Un échec email ne bloque pas le push
 *   - Les SMS ne sont envoyés que si l'add-on est actif
 *   - Les tokens push invalides sont désactivés automatiquement
 */

import { createServiceRoleClient } from '@/lib/supabase/server';
import { sendPushNotification } from '@/lib/push/send';
import { sendSMS, resolveTwilioCredentials } from '@/lib/sms';
import { sendEmail } from '@/lib/emails/resend.service';
import { notificationEmailTemplates } from './email-templates';
import {
  EVENT_CATALOGUE,
  type NotificationEventKey,
  type NotificationChannel,
} from './events';

export interface NotifyOptions {
  /** Force specific channels (bypass user preferences) */
  forceChannels?: NotificationChannel[];
  /** Extra metadata stored in the notification */
  metadata?: Record<string, unknown>;
}

export interface NotifyResult {
  success: boolean;
  channels_sent: NotificationChannel[];
  errors: Array<{ channel: NotificationChannel; error: string }>;
}

/**
 * Envoie une notification multi-canal pour un événement donné.
 *
 * @param event       - Clé d'événement (e.g. 'payment.received')
 * @param recipientId - profile_id du destinataire
 * @param data        - Variables pour les templates (title, body, route, email)
 * @param options     - Options avancées
 */
export async function notify(
  event: NotificationEventKey,
  recipientId: string,
  data: Record<string, string>,
  options?: NotifyOptions,
): Promise<NotifyResult> {
  const eventDef = EVENT_CATALOGUE[event];
  if (!eventDef) {
    console.error(`[notify] Unknown event: ${event}`);
    return { success: false, channels_sent: [], errors: [{ channel: 'in_app', error: `Unknown event: ${event}` }] };
  }

  const title = eventDef.title(data);
  const body = eventDef.body(data);
  const route = eventDef.route(data);

  // 1. Determine active channels
  const channels = options?.forceChannels || await getActiveChannels(recipientId, event, eventDef.defaultChannels);

  const channelsSent: NotificationChannel[] = [];
  const errors: Array<{ channel: NotificationChannel; error: string }> = [];

  // 2. In-app notification
  if (channels.includes('in_app')) {
    try {
      await insertInAppNotification(recipientId, event, title, body, route, channels, options?.metadata);
      channelsSent.push('in_app');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[notify] in_app failed for ${event}:`, msg);
      errors.push({ channel: 'in_app', error: msg });
    }
  }

  // 3. Email
  if (channels.includes('email')) {
    try {
      await sendNotificationEmail(recipientId, event, data);
      channelsSent.push('email');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[notify] email failed for ${event}:`, msg);
      errors.push({ channel: 'email', error: msg });
    }
  }

  // 4. Push
  if (channels.includes('push')) {
    try {
      const result = await sendPushNotification(recipientId, title, body, { route });
      if (result.sent > 0) {
        channelsSent.push('push');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[notify] push failed for ${event}:`, msg);
      errors.push({ channel: 'push', error: msg });
    }
  }

  // 5. SMS (only if service is available — add-on payant)
  if (channels.includes('sms')) {
    try {
      // Quick credential check to avoid unnecessary work if Twilio isn't set up.
      await resolveTwilioCredentials();
      const phone = await getRecipientPhone(recipientId);
      if (phone) {
        const smsBody = `${title}\n${body}`.slice(0, 320);
        const result = await sendSMS({
          to: phone,
          body: smsBody,
          context: { type: 'notification', profileId: recipientId, relatedId: event },
        });
        if (result.success) {
          channelsSent.push('sms');
        } else {
          errors.push({ channel: 'sms', error: result.error || 'SMS send failed' });
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      // Pas de credential Twilio = non-bloquant, on n'enregistre pas d'erreur bruyante
      if (!msg.includes('credentials missing')) {
        console.error(`[notify] sms failed for ${event}:`, msg);
        errors.push({ channel: 'sms', error: msg });
      }
    }
  }

  // Log summary
  console.log(`[notify] ${event} → ${recipientId} | sent: [${channelsSent.join(',')}] | errors: ${errors.length}`);

  return {
    success: channelsSent.length > 0,
    channels_sent: channelsSent,
    errors,
  };
}

/**
 * Sends notifications to multiple recipients for the same event.
 */
export async function notifyMany(
  event: NotificationEventKey,
  recipientIds: string[],
  data: Record<string, string>,
  options?: NotifyOptions,
): Promise<NotifyResult[]> {
  const results = await Promise.allSettled(
    recipientIds.map((id) => notify(event, id, data, options)),
  );

  return results.map((r) =>
    r.status === 'fulfilled'
      ? r.value
      : { success: false, channels_sent: [], errors: [{ channel: 'in_app' as const, error: String(r.reason) }] },
  );
}

// =====================================================
// Internal helpers
// =====================================================

/**
 * Loads per-event preferences for a user. Falls back to event defaults.
 */
async function getActiveChannels(
  profileId: string,
  event: NotificationEventKey,
  defaultChannels: NotificationChannel[],
): Promise<NotificationChannel[]> {
  try {
    const supabase = createServiceRoleClient();

    // Check per-event preferences
    const { data: eventPref } = await supabase
      .from('notification_event_preferences')
      .select('email_enabled, push_enabled, sms_enabled, in_app_enabled')
      .eq('profile_id', profileId)
      .eq('event_type', event)
      .maybeSingle();

    if (eventPref) {
      const channels: NotificationChannel[] = [];
      if (eventPref.email_enabled) channels.push('email');
      if (eventPref.push_enabled) channels.push('push');
      if (eventPref.sms_enabled) channels.push('sms');
      if (eventPref.in_app_enabled) channels.push('in_app');
      return channels;
    }

    // Check global preferences
    const { data: globalPref } = await supabase
      .from('notification_preferences')
      .select('email_enabled, push_enabled, sms_enabled, in_app_enabled')
      .eq('profile_id', profileId)
      .maybeSingle();

    if (globalPref) {
      return defaultChannels.filter((ch) => {
        switch (ch) {
          case 'email': return globalPref.email_enabled !== false;
          case 'push': return globalPref.push_enabled !== false;
          case 'sms': return globalPref.sms_enabled === true;
          case 'in_app': return globalPref.in_app_enabled !== false;
          default: return true;
        }
      });
    }

    return defaultChannels;
  } catch (err) {
    console.warn('[notify] Failed to load preferences, using defaults:', err);
    return defaultChannels;
  }
}

/**
 * Inserts an in-app notification into the database.
 */
async function insertInAppNotification(
  profileId: string,
  event: string,
  title: string,
  body: string,
  route: string,
  channels: NotificationChannel[],
  metadata?: Record<string, unknown>,
) {
  const supabase = createServiceRoleClient();

  // Resolve user_id from profile_id for RLS compatibility
  const { data: profile } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('id', profileId)
    .single();

  const insertData: Record<string, unknown> = {
    profile_id: profileId,
    type: event,
    title,
    body,
    message: body,
    route,
    channels_sent: channels,
    is_read: false,
    metadata: metadata || {},
    data: metadata || {},
  };

  if (profile?.user_id) {
    insertData.user_id = profile.user_id;
  }

  const { error } = await supabase.from('notifications').insert(insertData);

  if (error) {
    throw new Error(`Insert notification failed: ${error.message}`);
  }
}

/**
 * Sends an email notification using the appropriate template.
 */
async function sendNotificationEmail(
  profileId: string,
  event: NotificationEventKey,
  data: Record<string, string>,
) {
  const supabase = createServiceRoleClient();

  // Get recipient email
  const { data: profile } = await supabase
    .from('profiles')
    .select('email, prenom, nom, user_id')
    .eq('id', profileId)
    .single();

  let email = profile?.email;

  // Fallback to auth.users email
  if (!email && profile?.user_id) {
    const { data: authUser } = await supabase.auth.admin.getUserById(profile.user_id);
    email = authUser?.user?.email;
  }

  if (!email) {
    throw new Error(`No email found for profile ${profileId}`);
  }

  const recipientName = [profile?.prenom, profile?.nom].filter(Boolean).join(' ') || 'Utilisateur';

  // Try to use a specific email template
  const templateBuilder = notificationEmailTemplates[event];
  if (templateBuilder) {
    const template = templateBuilder({ ...data, recipientName, recipientEmail: email });
    await sendEmail({
      to: email,
      subject: template.subject,
      html: template.html,
      tags: [{ name: 'event', value: event }],
    });
    return;
  }

  // Fallback: generic notification email
  const eventDef = EVENT_CATALOGUE[event];
  const title = eventDef.title(data);
  const body = eventDef.body(data);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://talok.fr';
  const route = eventDef.route(data);

  const genericTemplate = notificationEmailTemplates['_generic']!({
    recipientName,
    recipientEmail: email,
    title,
    body,
    actionUrl: route ? `${appUrl}${route}` : appUrl,
    actionLabel: 'Voir sur Talok',
  });

  await sendEmail({
    to: email,
    subject: genericTemplate.subject,
    html: genericTemplate.html,
    tags: [{ name: 'event', value: event }],
  });
}

/**
 * Gets recipient phone number for SMS.
 */
async function getRecipientPhone(profileId: string): Promise<string | null> {
  const supabase = createServiceRoleClient();

  // Check SMS-specific phone in preferences
  const { data: pref } = await supabase
    .from('notification_preferences')
    .select('sms_phone')
    .eq('profile_id', profileId)
    .maybeSingle();

  if (pref?.sms_phone) return pref.sms_phone;

  // Fallback to profile phone
  const { data: profile } = await supabase
    .from('profiles')
    .select('telephone')
    .eq('id', profileId)
    .single();

  return profile?.telephone || null;
}
